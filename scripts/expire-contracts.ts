// scripts/expire-contracts.ts
// PA4-W3b — cron Cloud Run: expira contratos de aliado vencidos + notificaciones
// D-30/D-7/D-1 de vencimiento próximo.
//
// Uso:
//   npx tsx scripts/expire-contracts.ts
//
// Dos responsabilidades independientes en cada corrida:
//   1. Expiración: SELECT de partner_contracts con status='active' AND valid_until <
//      now(). Por cada uno, transición a 'expired' (actor 'system') vía el MISMO
//      orquestador `applyTransitionWithSync` (lib/partners/license-sync.ts, PA4-W3b)
//      que usan las rutas admin de transición/firma — sync = delete de licencia (ver
//      `projectContractToAction`: status destino 'expired' → delete, ignora
//      scope/version). Idempotente por construcción: el SELECT solo toma
//      status='active', así que una corrida posterior sobre un contrato ya 'expired'
//      nunca vuelve a seleccionarlo ni a re-expirarlo. Si `applyTransitionWithSync`
//      lanza (LicenseSyncError o ConcurrentTransitionError), ese contrato individual
//      queda SIN expirar (rollback vía el orquestador) y la corrida continúa con el
//      resto — no aborta todo el batch por un solo fallo de sync.
//   2. Notificaciones D-30/D-7/D-1: SELECT de contratos status='active' cuyo
//      valid_until cae EXACTAMENTE a 30/7/1 días de hoy (comparación por fecha
//      calendario vía make_interval, no por instante). Asume cadencia diaria del cron:
//      cada umbral hace match un único día calendario, así que una corrida diaria
//      nunca reenvía el mismo aviso para el mismo contrato — no se introduce una tabla
//      de deduplicación nueva (no pedida por la WU) porque el filtro de fecha ya la
//      hace innecesaria bajo cadencia diaria.

import { pool } from "../lib/db";
import { sendMail } from "../lib/mailer";
import {
  applyTransitionWithSync,
  createPoolClientTx,
  syncLicenseToCompiler,
  LicenseSyncError,
  ConcurrentTransitionError,
  type ContractForLicenseProjection,
} from "../lib/partners/license-sync";

interface ExpiringContractRow {
  id: string;
  tenant_id: string;
  partner_id: string;
  package_id: string;
  scope: { systems: string[]; altitude_max: number; modules: string[] };
  valid_from: string;
  valid_until: string;
  version: number | null;
}

async function expireDueContracts(): Promise<{ expired: number; failed: number }> {
  const { rows } = await pool.query<ExpiringContractRow>(
    `SELECT pc.id, pc.tenant_id, pc.partner_id, pc.package_id, pc.scope, pc.valid_from, pc.valid_until,
            (SELECT ppv.version FROM partner_package_versions ppv
               WHERE ppv.package_id = pc.package_id ORDER BY ppv.version DESC LIMIT 1) AS version
       FROM partner_contracts pc
       WHERE pc.status = 'active' AND pc.valid_until < now()`
  );

  let expired = 0;
  let failed = 0;

  for (const row of rows) {
    const client = await pool.connect();
    try {
      // `version` no se usa realmente en este flujo (status destino 'expired' →
      // projectContractToAction devuelve 'delete', que ignora los campos de license) —
      // se resuelve igual para satisfacer el tipo de ContractForLicenseProjection.
      const contract: ContractForLicenseProjection = {
        id: row.id,
        tenant_id: row.tenant_id,
        partner_id: row.partner_id,
        package_id: row.package_id,
        version: row.version ?? 0,
        scope: row.scope,
        valid_from: new Date(row.valid_from).toISOString(),
        valid_until: new Date(row.valid_until).toISOString(),
        status: "active",
      };

      await applyTransitionWithSync({
        tx: createPoolClientTx(client),
        syncFn: syncLicenseToCompiler,
        contract,
        to: "expired",
        actor: "system",
        eventDetail: { from: "active", to: "expired", action: "auto_expire" },
      });
      expired++;
      console.log(`✓ contrato ${row.id} expirado (valid_until=${row.valid_until})`);
    } catch (err) {
      failed++;
      const kind =
        err instanceof LicenseSyncError
          ? "license_sync_error"
          : err instanceof ConcurrentTransitionError
            ? "concurrent_transition"
            : "unknown";
      console.error(`✗ contrato ${row.id} NO expirado (${kind}):`, err);
    } finally {
      client.release();
    }
  }

  return { expired, failed };
}

const NOTICE_THRESHOLDS_DAYS = [30, 7, 1] as const;

async function sendExpiryNotices(): Promise<{ sent: number }> {
  let sent = 0;

  for (const days of NOTICE_THRESHOLDS_DAYS) {
    const { rows } = await pool.query(
      `SELECT pc.id, pc.valid_until, p.contact_email, p.legal_name
         FROM partner_contracts pc
         JOIN partners p ON p.id = pc.partner_id
        WHERE pc.status = 'active'
          AND pc.valid_until::date = (now() + make_interval(days => $1))::date`,
      [days]
    );

    for (const row of rows) {
      if (!row.contact_email) {
        console.warn(`AVISO: contrato ${row.id} sin contact_email, se omite notificación D-${days}`);
        continue;
      }
      const diasTxt = days === 1 ? "1 día" : `${days} días`;
      try {
        await sendMail({
          to: row.contact_email,
          subject: `Tu contrato con Teseo vence en ${diasTxt}`,
          html:
            `<p>Hola ${row.legal_name},</p>` +
            `<p>Tu contrato de aliado (id ${row.id}) vence el ` +
            `<strong>${new Date(row.valid_until).toLocaleDateString("es-MX")}</strong> (en ${diasTxt}).</p>` +
            `<p>Si necesitas renovarlo, contacta a tu equipo de Teseo.</p>`,
        });
        sent++;
        console.log(`✓ notificación D-${days} enviada para contrato ${row.id} (${row.contact_email})`);
      } catch (err) {
        console.error(`✗ notificación D-${days} falló para contrato ${row.id}:`, err);
      }
    }
  }

  return { sent };
}

export async function main(): Promise<void> {
  console.log("[expire-contracts] iniciando...");
  const { expired, failed } = await expireDueContracts();
  const { sent } = await sendExpiryNotices();
  console.log(
    `[expire-contracts] listo: ${expired} expirados, ${failed} fallidos, ${sent} notificaciones enviadas.`
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

if (require.main === module) {
  main()
    .then(async () => {
      await pool.end().catch(() => {});
      process.exit(process.exitCode ?? 0);
    })
    .catch(async (err) => {
      console.error("ERROR:", err);
      await pool.end().catch(() => {});
      process.exit(1);
    });
}
