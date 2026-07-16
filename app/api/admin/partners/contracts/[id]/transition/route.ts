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
//
// PA7-W2: gate de eval de paquete ANTES de la PRIMERA activación de un contrato del
// paquete (lib/partners/eval-gate.ts::decideActivationGate, lógica pura). Esta ruta SOLO
// orquesta I/O: resuelve `isFirstActivation` (query SQL) y `evalStatus` (llamada M2M al
// compiler vía lib/partners/compiler-client.ts::getPackageEvalStatus — el panel NUNCA
// consulta el Cold-Tier directo). Bloqueo → 409 (`eval_gate_failed`) o 503
// (`eval_status_unavailable`, fail-closed si el compiler no responde), salvo override
// manual de Knowledge Ops (`override_eval`+`override_reason` en el body), que se audita en
// `eventDetail` de partner_contract_events. La re-activación suspended→active NO pasa por
// el gate (decideActivationGate lo resuelve sin siquiera consultar eval).

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
import { decideActivationGate } from "@/lib/partners/eval-gate";
import { getPackageEvalStatus, CompilerCallError } from "@/lib/partners/compiler-client";

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
      // PA5-W2-followup: partner_slug/partner_legal_name/package_slug/package_title vía
      // subqueries correlacionadas (mismo estilo que `version`, arriba) — evita el JOIN
      // directo con partners/partner_packages, que ambiguaría columnas compartidas con
      // CONTRACT_COLUMNS (id/partner_id/status/created_at existen en las 3 tablas).
      const { rows } = await client.query(
        `SELECT ${CONTRACT_COLUMNS},
                (SELECT ppv.version FROM partner_package_versions ppv
                   WHERE ppv.package_id = partner_contracts.package_id
                   ORDER BY ppv.version DESC LIMIT 1) AS version,
                (SELECT p.slug FROM partners p WHERE p.id = partner_contracts.partner_id) AS partner_slug,
                (SELECT p.legal_name FROM partners p WHERE p.id = partner_contracts.partner_id) AS partner_legal_name,
                (SELECT pk.slug FROM partner_packages pk WHERE pk.id = partner_contracts.package_id) AS package_slug,
                (SELECT pk.title FROM partner_packages pk WHERE pk.id = partner_contracts.package_id) AS package_title
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

      // PA7-W2: gate de eval de paquete, SOLO para action='activate' con from='pending_signature'
      // (la re-activación suspended→active NO pasa por el gate, ver decideActivationGate).
      // Se determina "primera activación del paquete" (¿existe OTRO contrato del mismo
      // package_id que ya haya pasado por 'active' alguna vez, i.e. status NOT IN
      // ('draft','pending_signature')?) y, si aplica, se consulta el estado de eval al
      // compiler (NUNCA se toca el Cold-Tier directo — lib/partners/compiler-client.ts).
      // Toda la decisión de bloquear/permitir vive en decideActivationGate (lógica pura).
      let evalGateAuditDetail: Record<string, unknown> | undefined;

      if (action === "activate" && from === "pending_signature") {
        const { rows: otherActivationRows } = await client.query(
          `SELECT 1 FROM partner_contracts
             WHERE package_id = $1 AND id != $2 AND status NOT IN ('draft','pending_signature')
             LIMIT 1`,
          [row.package_id, id]
        );
        const isFirstActivation = otherActivationRows.length === 0;

        if (isFirstActivation) {
          let evalStatus: { passed: boolean } | "unavailable";
          try {
            const status = await getPackageEvalStatus(row.package_id, row.partner_id);
            evalStatus = { passed: status.passed };
          } catch (err) {
            if (err instanceof CompilerCallError) {
              evalStatus = "unavailable";
            } else {
              throw err;
            }
          }

          const override =
            parsed.data.override_eval && parsed.data.override_reason
              ? { reason: parsed.data.override_reason }
              : null;

          const gate = decideActivationGate({
            isFirstActivation: true,
            from,
            action,
            evalStatus,
            override,
          });

          if (!gate.allow) {
            const httpStatus = gate.blockReason === "eval_status_unavailable" ? 503 : 409;
            return NextResponse.json(
              { error: gate.blockReason, eval_status: evalStatus },
              { status: httpStatus }
            );
          }

          if (gate.auditDetail) {
            evalGateAuditDetail = gate.auditDetail;
          }
        }
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
        partner_slug: row.partner_slug,
        partner_legal_name: row.partner_legal_name,
        package_slug: row.package_slug,
        package_title: row.package_title,
      };

      try {
        await applyTransitionWithSync({
          tx: createPoolClientTx(client),
          syncFn: syncLicenseToCompiler,
          contract,
          to,
          actor: auth.user.id,
          eventDetail: { from, to, action, ...evalGateAuditDetail },
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
