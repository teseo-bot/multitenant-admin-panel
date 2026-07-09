// app/api/admin/partners/contracts/[id]/sign/route.ts
// PA4-W2 — firma simple por OTP de contrato de aliado (lado Teseo). Espejo de
// app/api/partners/me/contracts/[id]/sign/route.ts — misma lógica de OTP
// (lib/partners/contract-otp.ts) y mismo patrón de auto-activación DELEGADA a
// `applyTransitionWithSync` en transacción separada de la captura de firma (PA4-W3b,
// lib/partners/license-sync.ts, [INV-7.1]). Diferencias frente al espejo de aliado:
//   - Guard: requirePlatformAdmin() (lib/auth/guards.ts — mismo que usó PA4-W1).
//   - No hay scoping por partner_id (el admin ve cualquier contrato).
//   - El OTP se envía al email del propio admin autenticado (no hay "contact_email"
//     de Teseo persistido en BD).
//   - Escribe signed_by_teseo (no signed_by_partner).
//
// Antes de cualquiera de los dos modos: si terms_sha256 del contrato es NULL → 422.

import { NextRequest, NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { sendMail } from "@/lib/mailer";
import {
  generateOtp,
  hashOtp,
  verifyOtp,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
  type OtpChallenge,
} from "@/lib/partners/contract-otp";
import {
  classifyTransition,
  canActivate,
  type ContractSignatureState,
} from "@/lib/partners/contract-state-machine";
import {
  applyTransitionWithSync,
  createPoolClientTx,
  syncLicenseToCompiler,
  LicenseSyncError,
  type ContractForLicenseProjection,
} from "@/lib/partners/license-sync";

export const dynamic = "force-dynamic";

const SIGNER_ROLE = "teseo" as const;

const CONTRACT_COLUMNS =
  "id, partner_id, tenant_id, package_id, kind, scope, fee_model, derived_knowledge_clause, " +
  "valid_from, valid_until, status, terms_sha256, signed_by_partner, signed_by_teseo, created_at";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => null);
    const code =
      body && typeof body === "object" && typeof (body as Record<string, unknown>).code === "string"
        ? ((body as Record<string, unknown>).code as string)
        : null;

    const { rows: contractRows } = await pool.query(
      `SELECT ${CONTRACT_COLUMNS} FROM partner_contracts WHERE id = $1`,
      [id]
    );
    if (contractRows.length === 0) {
      return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
    }
    const contract = contractRows[0];

    if (contract.terms_sha256 == null) {
      return NextResponse.json(
        { error: "No se puede firmar: el contrato no tiene términos (terms_sha256 nulo)" },
        { status: 422 }
      );
    }

    if (code === null) {
      return await sendChallenge(id, auth.user.email);
    }

    return await verifyChallenge(id, code, auth.user.id);
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.contracts.id.sign.error", { error: String(err), id });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

async function sendChallenge(contractId: string, adminEmail: string | null) {
  const otp = generateOtp();
  const codeHash = hashOtp(otp);
  const expiresAt = new Date(Date.now() + OTP_TTL_MS);

  await pool.query(
    `INSERT INTO partner_contract_otp (contract_id, signer_role, code_hash, expires_at, attempts, locked_until)
     VALUES ($1, $2, $3, $4, 0, NULL)
     ON CONFLICT (contract_id, signer_role)
     DO UPDATE SET code_hash = EXCLUDED.code_hash, expires_at = EXCLUDED.expires_at,
                    attempts = 0, locked_until = NULL, created_at = now()`,
    [contractId, SIGNER_ROLE, codeHash, expiresAt]
  );

  if (adminEmail) {
    await sendMail({
      to: adminEmail,
      subject: "Código de firma de contrato de aliado — Teseo",
      html: `<p>Tu código de firma es: <strong>${otp}</strong></p><p>Vence en 10 minutos.</p>`,
    });
  } else {
    logger.warn("api.admin.partners.contracts.id.sign.no_admin_email", { contract_id: contractId });
  }

  return NextResponse.json({ status: "otp_sent" }, { status: 202 });
}

async function verifyChallenge(contractId: string, code: string, signerUid: string) {
  const { rows: otpRows } = await pool.query(
    `SELECT code_hash, expires_at, attempts, locked_until
       FROM partner_contract_otp WHERE contract_id = $1 AND signer_role = $2`,
    [contractId, SIGNER_ROLE]
  );
  if (otpRows.length === 0) {
    return NextResponse.json(
      { error: "No hay un código de firma pendiente para este contrato, solicita uno nuevo" },
      { status: 410 }
    );
  }

  const row = otpRows[0];
  const challenge: OtpChallenge = {
    code_hash: row.code_hash,
    expires_at: new Date(row.expires_at).getTime(),
    attempts: row.attempts,
    locked_until: row.locked_until ? new Date(row.locked_until).getTime() : null,
  };

  const now = Date.now();
  const outcome = verifyOtp(challenge, code, now);

  if (outcome.result === "wrong") {
    await pool.query(
      `UPDATE partner_contract_otp SET attempts = $1, locked_until = $2
         WHERE contract_id = $3 AND signer_role = $4`,
      [
        outcome.next.attempts,
        outcome.next.locked_until ? new Date(outcome.next.locked_until) : null,
        contractId,
        SIGNER_ROLE,
      ]
    );
    const remaining = Math.max(0, MAX_ATTEMPTS - outcome.next.attempts);
    return NextResponse.json({ error: "Código incorrecto", attempts_remaining: remaining }, { status: 401 });
  }

  if (outcome.result === "locked") {
    const retryAfterSec = Math.max(0, Math.ceil(((outcome.next.locked_until ?? now) - now) / 1000));
    return NextResponse.json(
      { error: "Demasiados intentos fallidos, bloqueado temporalmente", retry_after_seconds: retryAfterSec },
      { status: 423, headers: { "Retry-After": String(retryAfterSec) } }
    );
  }

  if (outcome.result === "expired") {
    return NextResponse.json({ error: "El código expiró, solicita uno nuevo" }, { status: 410 });
  }

  // outcome.result === 'ok'
  const client = await pool.connect();
  try {
    // Transacción 1: captura de la firma. Independiente de la auto-activación de abajo
    // — si el sync de licencia de la activación falla, la firma YA capturada aquí no se
    // pierde (queda pending_signature + signed_by_teseo set, reintentable).
    await client.query("BEGIN");

    const signature = { user_id: signerUid, at: new Date().toISOString() };
    const { rows: updated } = await client.query(
      `UPDATE partner_contracts SET signed_by_teseo = $1 WHERE id = $2 RETURNING ${CONTRACT_COLUMNS}`,
      [JSON.stringify(signature), contractId]
    );
    let finalContract = updated[0];

    await client.query(
      `DELETE FROM partner_contract_otp WHERE contract_id = $1 AND signer_role = $2`,
      [contractId, SIGNER_ROLE]
    );

    await client.query(
      `INSERT INTO partner_contract_events (contract_id, event, actor, detail)
       VALUES ($1, 'signed', $2, $3)`,
      [contractId, signerUid, JSON.stringify({ signer_role: SIGNER_ROLE })]
    );

    await client.query("COMMIT");

    const signatures: ContractSignatureState = {
      signed_by_partner: finalContract.signed_by_partner,
      signed_by_teseo: finalContract.signed_by_teseo,
      terms_sha256: finalContract.terms_sha256,
    };

    if (finalContract.status === "pending_signature" && canActivate(signatures)) {
      const classification = classifyTransition("pending_signature", "active", "system", signatures);
      if (classification === "ok") {
        // Transacción 2 (separada): activación + sync síncrono de licencia [INV-7.1],
        // delegada a applyTransitionWithSync. `version` viene de
        // partner_package_versions (no hay columna `version` en partner_contracts/
        // partner_packages, ver nota en license-sync.ts).
        // PA5-W2-followup: se resuelven en el mismo viaje los 4 campos de presentación
        // (partner_slug/partner_legal_name/package_slug/package_title) vía subqueries
        // escalares sin FROM (válido en Postgres), consultando partners/partner_packages
        // por PK — no hace falta JOIN con partner_contracts porque ya tenemos
        // partner_id/package_id en finalContract.
        const { rows: versionRows } = await client.query(
          `SELECT
              (SELECT ppv.version FROM partner_package_versions ppv
                 WHERE ppv.package_id = $1
                 ORDER BY ppv.version DESC LIMIT 1) AS version,
              (SELECT pk.slug FROM partner_packages pk WHERE pk.id = $1) AS package_slug,
              (SELECT pk.title FROM partner_packages pk WHERE pk.id = $1) AS package_title,
              (SELECT p.slug FROM partners p WHERE p.id = $2) AS partner_slug,
              (SELECT p.legal_name FROM partners p WHERE p.id = $2) AS partner_legal_name`,
          [finalContract.package_id, finalContract.partner_id]
        );
        const contractForSync: ContractForLicenseProjection = {
          id: finalContract.id,
          tenant_id: finalContract.tenant_id,
          partner_id: finalContract.partner_id,
          package_id: finalContract.package_id,
          version: versionRows[0]?.version,
          scope: finalContract.scope,
          valid_from: new Date(finalContract.valid_from).toISOString(),
          valid_until: new Date(finalContract.valid_until).toISOString(),
          status: "pending_signature",
          partner_slug: versionRows[0]?.partner_slug,
          partner_legal_name: versionRows[0]?.partner_legal_name,
          package_slug: versionRows[0]?.package_slug,
          package_title: versionRows[0]?.package_title,
        };

        try {
          await applyTransitionWithSync({
            tx: createPoolClientTx(client),
            syncFn: syncLicenseToCompiler,
            contract: contractForSync,
            to: "active",
            actor: "system",
            eventDetail: { from: "pending_signature", to: "active", action: "auto_activate" },
          });
          finalContract = { ...finalContract, status: "active" };
        } catch (err) {
          // La firma (transacción 1) YA quedó persistida — solo la auto-activación se
          // revierte. El contrato queda pending_signature+firmado, reintentable.
          logger.error("api.admin.partners.contracts.id.sign.auto_activate_failed", {
            error: String(err),
            contract_id: contractId,
            is_license_sync_error: err instanceof LicenseSyncError,
          });
        }
      }
    }

    return NextResponse.json(finalContract);
  } catch (txErr) {
    await client.query("ROLLBACK");
    throw txErr;
  } finally {
    client.release();
  }
}
