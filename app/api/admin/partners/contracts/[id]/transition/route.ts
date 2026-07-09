// app/api/admin/partners/contracts/[id]/transition/route.ts
// PA4-W1 — Knowledge Ops: transición de estado de un contrato de aliado (TRD §7.2/§4).
// Guard: requirePlatformAdmin (ver nota de desviación en app/api/admin/partners/route.ts).
//
// Acciones expuestas: activate|suspend|terminate (TransitionContractBodySchema). El actor
// SIEMPRE es humano (el admin autenticado) — `active→expired` es exclusiva del actor
// 'system' (TRD §4) y por tanto NO se expone como acción aquí; esa transición corresponde
// a un job de sistema fuera del alcance de esta WU (ver scripts/expire-contracts.ts, PA4-W3b).
//
// Toda la decisión (409 vs 422 vs proceder) vive en classifyTransition
// (lib/partners/contract-state-machine.ts, lógica pura). Esta ruta:
//   1. resuelve `to` desde la acción,
//   2. lee el contrato actual (+ `version` del paquete publicado, para la licencia),
//   3. clasifica la transición,
//   4. si 'ok': delega el UPDATE + INSERT en partner_contract_events + sync síncrono de
//      licencia [INV-4.4]/[INV-7.1] al orquestador `applyTransitionWithSync`
//      (lib/partners/license-sync.ts, PA4-W3b). Un fallo de sync (LicenseSyncError) NO
//      persiste la transición → 502. Una carrera concurrente (ConcurrentTransitionError)
//      → 409, mismo comportamiento que la implementación manual previa.

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { TransitionContractBodySchema } from "@/lib/partners/contracts";
import {
  classifyTransition,
  type ContractStatus,
  type ContractSignatureState,
} from "@/lib/partners/contract-state-machine";
import {
  applyTransitionWithSync,
  createPoolClientTx,
  syncLicenseToCompiler,
  LicenseSyncError,
  ConcurrentTransitionError,
  type ContractForLicenseProjection,
} from "@/lib/partners/license-sync";

export const dynamic = "force-dynamic";

const CONTRACT_COLUMNS =
  "id, partner_id, tenant_id, package_id, kind, scope, fee_model, derived_knowledge_clause, " +
  "valid_from, valid_until, status, terms_sha256, signed_by_partner, signed_by_teseo, created_at";

const ACTION_TO_STATUS: Record<"activate" | "suspend" | "terminate", ContractStatus> = {
  activate: "active",
  suspend: "suspended",
  terminate: "terminated",
};

function zodDetails(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => null);
    const parsed = TransitionContractBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: zodDetails(parsed.error.issues) },
        { status: 422 }
      );
    }

    const { action } = parsed.data;
    const to = ACTION_TO_STATUS[action];

    const client = await pool.connect();
    try {
      // `version` viene de partner_package_versions (la última publicada del package_id
      // del contrato) — NO existe columna `version` en partner_contracts/partner_packages
      // (migrations-gcp/006_partners.sql, 007_partner_contracts.sql). Se resuelve aquí,
      // ANTES de la transacción, para que applyTransitionWithSync reciba un contrato ya
      // completo y su flujo interno se limite a UPDATE+INSERT (sin tocar más tablas).
      const { rows } = await client.query(
        `SELECT ${CONTRACT_COLUMNS},
                (SELECT ppv.version FROM partner_package_versions ppv
                   WHERE ppv.package_id = partner_contracts.package_id
                   ORDER BY ppv.version DESC LIMIT 1) AS version
           FROM partner_contracts WHERE id = $1`,
        [id]
      );
      if (rows.length === 0) {
        return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
      }

      const row = rows[0];
      const from = row.status as ContractStatus;
      const signatures: ContractSignatureState = {
        signed_by_partner: row.signed_by_partner,
        signed_by_teseo: row.signed_by_teseo,
        terms_sha256: row.terms_sha256,
      };

      const classification = classifyTransition(from, to, auth.user.id, signatures);

      if (classification === "invalid") {
        return NextResponse.json(
          { error: `Transición inválida: ${from} → ${to}` },
          { status: 409 }
        );
      }
      if (classification === "needs-signatures") {
        return NextResponse.json(
          { error: "No se puede activar: faltan firmas o terms_sha256" },
          { status: 422 }
        );
      }

      const contract: ContractForLicenseProjection = {
        id: row.id,
        tenant_id: row.tenant_id,
        partner_id: row.partner_id,
        package_id: row.package_id,
        version: row.version,
        scope: row.scope,
        valid_from: new Date(row.valid_from).toISOString(),
        valid_until: new Date(row.valid_until).toISOString(),
        status: from,
      };

      try {
        await applyTransitionWithSync({
          tx: createPoolClientTx(client),
          syncFn: syncLicenseToCompiler,
          contract,
          to,
          actor: auth.user.id,
          eventDetail: { from, to, action },
        });
      } catch (err) {
        if (err instanceof ConcurrentTransitionError) {
          return NextResponse.json(
            { error: "El contrato cambió de estado concurrentemente, reintenta" },
            { status: 409 }
          );
        }
        if (err instanceof LicenseSyncError) {
          logger.error("api.admin.partners.contracts.id.transition.license_sync_error", {
            error: String(err),
            id,
          });
          return NextResponse.json(
            { error: "No se pudo sincronizar la licencia con el compiler, la transición no se aplicó" },
            { status: 502 }
          );
        }
        throw err;
      }

      return NextResponse.json({ ...row, status: to, version: undefined });
    } finally {
      client.release();
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.contracts.id.transition.error", { error: String(err), id });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
