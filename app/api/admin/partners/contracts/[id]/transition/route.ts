// app/api/admin/partners/contracts/[id]/transition/route.ts
// PA4-W1 — Knowledge Ops: transición de estado de un contrato de aliado (TRD §7.2/§4).
// Guard: requirePlatformAdmin (ver nota de desviación en app/api/admin/partners/route.ts).
//
// Acciones expuestas: activate|suspend|terminate (TransitionContractBodySchema). El actor
// SIEMPRE es humano (el admin autenticado) — `active→expired` es exclusiva del actor
// 'system' (TRD §4) y por tanto NO se expone como acción aquí; esa transición corresponde
// a un job de sistema fuera del alcance de esta WU.
//
// Toda la decisión (409 vs 422 vs proceder) vive en classifyTransition
// (lib/partners/contract-state-machine.ts, lógica pura). Esta ruta solo:
//   1. resuelve `to` desde la acción,
//   2. lee el contrato actual,
//   3. clasifica la transición,
//   4. si 'ok': UPDATE + INSERT en partner_contract_events en LA MISMA transacción [INV-4.4].

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
      const { rows } = await client.query(
        `SELECT status, signed_by_partner, signed_by_teseo, terms_sha256
           FROM partner_contracts WHERE id = $1`,
        [id]
      );
      if (rows.length === 0) {
        return NextResponse.json({ error: "Contrato no encontrado" }, { status: 404 });
      }

      const from = rows[0].status as ContractStatus;
      const signatures: ContractSignatureState = {
        signed_by_partner: rows[0].signed_by_partner,
        signed_by_teseo: rows[0].signed_by_teseo,
        terms_sha256: rows[0].terms_sha256,
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

      await client.query("BEGIN");
      try {
        const updateResult = await client.query(
          `UPDATE partner_contracts SET status = $1 WHERE id = $2 AND status = $3
           RETURNING ${CONTRACT_COLUMNS}`,
          [to, id, from]
        );

        if (updateResult.rows.length === 0) {
          // El estado cambió entre el SELECT y el UPDATE (carrera concurrente).
          await client.query("ROLLBACK");
          return NextResponse.json(
            { error: "El contrato cambió de estado concurrentemente, reintenta" },
            { status: 409 }
          );
        }

        // [INV-4.4]: evento en la MISMA transacción que el UPDATE de status.
        await client.query(
          `INSERT INTO partner_contract_events (contract_id, event, actor, detail)
           VALUES ($1, 'status_changed', $2, $3)`,
          [id, auth.user.id, JSON.stringify({ from, to, action })]
        );

        await client.query("COMMIT");
        return NextResponse.json(updateResult.rows[0]);
      } catch (txErr) {
        await client.query("ROLLBACK");
        throw txErr;
      }
    } finally {
      client.release();
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.contracts.id.transition.error", { error: String(err), id });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
