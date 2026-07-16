// app/api/partners/me/citation-stats/route.ts
// PA7-W3 (TRD §9; [INV-5.4]): métricas de citas de conocimiento certificado del aliado de sesión.
// Patrón y guard EXACTOS de app/api/partners/me/contracts/route.ts.
//
// GET: devuelve las stats de los últimos 30 días de los contratos del aliado de sesión, desde
// `partner_citation_stats` (metering escrito por scripts/aggregate-partner-citations.ts del
// compiler). [INV-5.4]: solo conteos + IDs de contrato/paquete/tenant que el aliado YA conoce
// (son sus propios contratos) — nada de contenido de conversaciones ni identidad de usuarios.

import { NextResponse } from "next/server";
import { requirePartnerMember } from "@/lib/partners/session";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

export interface CitationStatRow {
  contract_id: string;
  day: string;
  citations: number;
  tenant_id: string;
  package_id: string;
}

export async function GET() {
  try {
    const guard = await requirePartnerMember();
    if (!guard.ok) {
      const status = guard.status === 401 ? 401 : 403;
      return NextResponse.json({ error: guard.error }, { status });
    }

    const { rows } = await pool.query<CitationStatRow>(
      `SELECT
         s.contract_id,
         s.day,
         s.citations,
         c.tenant_id,
         c.package_id
       FROM partner_citation_stats s
       JOIN partner_contracts c ON c.id = s.contract_id
       WHERE c.partner_id = $1
         AND s.day >= (CURRENT_DATE - INTERVAL '30 days')
       ORDER BY s.day DESC`,
      [guard.partner.id]
    );

    return NextResponse.json({ stats: rows });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") {
      throw err;
    }
    logger.error("api.partners.me.citation-stats.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
