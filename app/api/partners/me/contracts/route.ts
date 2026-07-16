// app/api/partners/me/contracts/route.ts
// KL6-W1 (PLAN-KnowledgeLab-Epicas-KL.md; DISEÑO-Knowledge-Lab.md §5): lista de contratos del aliado
// de sesión (solo lectura, filtrado por partner_id — RP-PA-11).
//
// GET: devuelve array de partner_contracts con los campos requeridos para la tabla:
//   id, tenant_id, package_id, package_title (vía JOIN), kind, status, valid_from, valid_until,
//   derived_knowledge_clause, created_at
// Orden: created_at DESC.

import { NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export interface PartnerContractRow {
  id: string;
  tenant_id: string;
  package_id: string;
  package_title: string;
  kind: "direct" | "marketplace";
  status: "draft" | "pending_signature" | "active" | "suspended" | "terminated" | "expired";
  valid_from: string;
  valid_until: string;
  derived_knowledge_clause: "client_keeps" | "review_on_exit";
  created_at: string;
}

export async function GET() {
  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const { rows } = await pool.query<PartnerContractRow>(
      `SELECT
         pc.id,
         pc.tenant_id,
         pc.package_id,
         pp.title AS package_title,
         pc.kind,
         pc.status,
         pc.valid_from,
         pc.valid_until,
         pc.derived_knowledge_clause,
         pc.created_at
       FROM partner_contracts pc
       LEFT JOIN partner_packages pp ON pp.id = pc.package_id
       WHERE pc.partner_id = $1
       ORDER BY pc.created_at DESC`,
      [guard.partner.id]
    );

    return NextResponse.json({ contracts: rows });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.contracts.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
