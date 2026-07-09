// app/api/partners/me/contracts/[id]/sign/route.ts
// PA4-W2 — firma simple por OTP de contrato de aliado (lado partner).
// Guard: requirePartnerMember() (lib/partners/session.ts).
//
// Dos modos según el body:
//   - Sin `code` (body ausente o sin ese campo): genera un OTP nuevo, lo hashea, hace
//     UPSERT en partner_contract_otp (reinicia attempts/locked_until) y lo envía por
//     correo al contact_email del aliado (lib/mailer.ts::sendMail, respeta
//     MAILER_DRY_RUN). Responde 202.
//   - Con `{code}`: carga el challenge y delega la decisión a verifyOtp (lógica pura,
//     lib/partners/contract-otp.ts). 'locked'→423, 'wrong'→401 (con intentos restantes),
//     'expired'→410, 'ok'→ set signed_by_partner y, si aplica, auto-activación
//     (classifyTransition + UPDATE status + INSERT evento, MISMA transacción — patrón de
//     PA4-W1 en app/api/admin/partners/contracts/[id]/transition/route.ts).
//
// Antes de cualquiera de los dos modos: si terms_sha256 del contrato es NULL → 422 (no
// se puede firmar sin términos).

import { NextRequest, NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
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

export const dynamic = "force-dynamic";

const SIGNER_ROLE = "partner" as const;

const CONTRACT_COLUMNS =
  "id, partner_id, tenant_id, package_id, kind, scope, fee_model, derived_knowledge_clause, " +
  "valid_from, valid_until, status, terms_sha256, signed_by_partner, signed_by_teseo, created_at";

export async function POST(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;

  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const body = await req.json().catch(() => null);
    const code =
      body && typeof body === "object" && typeof (body as Record<string, unknown>).code === "string"
        ? ((body as Record<string, unknown>).code as string)
        : null;

    const { rows: contractRows } = await pool.query(
      `SELECT ${CONTRACT_COLUMNS} FROM partner_contracts WHERE id = $1 AND partner_id = $2`,
      [id, guard.partner.id]
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
      return await sendChallenge(id, guard.partner.id);
    }

    return await verifyChallenge(id, code, guard.uid, contract);
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.partners.me.contracts.id.sign.error", { error: String(err), id });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

async function sendChallenge(contractId: string, partnerId: string) {
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

  const { rows: partnerRows } = await pool.query(`SELECT contact_email FROM partners WHERE id = $1`, [
    partnerId,
  ]);
  const contactEmail = partnerRows[0]?.contact_email as string | undefined;

  if (contactEmail) {
    await sendMail({
      to: contactEmail,
      subject: "Código de firma de contrato de aliado — Teseo",
      html: `<p>Tu código de firma es: <strong>${otp}</strong></p><p>Vence en 10 minutos.</p>`,
    });
  } else {
    logger.warn("api.partners.me.contracts.id.sign.no_contact_email", { contract_id: contractId });
  }

  return NextResponse.json({ status: "otp_sent" }, { status: 202 });
}

async function verifyChallenge(
  contractId: string,
  code: string,
  signerUid: string,
  contract: Record<string, any>
) {
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
    await client.query("BEGIN");

    const signature = { user_id: signerUid, at: new Date().toISOString() };
    const { rows: updated } = await client.query(
      `UPDATE partner_contracts SET signed_by_partner = $1 WHERE id = $2 RETURNING ${CONTRACT_COLUMNS}`,
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

    const signatures: ContractSignatureState = {
      signed_by_partner: finalContract.signed_by_partner,
      signed_by_teseo: finalContract.signed_by_teseo,
      terms_sha256: finalContract.terms_sha256,
    };

    if (finalContract.status === "pending_signature" && canActivate(signatures)) {
      const classification = classifyTransition("pending_signature", "active", "system", signatures);
      if (classification === "ok") {
        const { rows: activated } = await client.query(
          `UPDATE partner_contracts SET status = 'active' WHERE id = $1 AND status = 'pending_signature'
           RETURNING ${CONTRACT_COLUMNS}`,
          [contractId]
        );
        if (activated.length > 0) {
          finalContract = activated[0];
          await client.query(
            `INSERT INTO partner_contract_events (contract_id, event, actor, detail)
             VALUES ($1, 'status_changed', 'system', $2)`,
            [contractId, JSON.stringify({ from: "pending_signature", to: "active", action: "auto_activate" })]
          );
        }
      }
    }

    await client.query("COMMIT");
    return NextResponse.json(finalContract);
  } catch (txErr) {
    await client.query("ROLLBACK");
    throw txErr;
  } finally {
    client.release();
  }
}
