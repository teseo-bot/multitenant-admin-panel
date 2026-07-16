// app/api/admin/partners/catalog/route.ts
// PA7-W4 — Catálogo interno de paquetes de aliados (herramienta de venta de Knowledge Ops).
//
// GET: lista paquetes publicados de aliados verificados. Solo se muestran aquellos
// que pueden venderse en Knowledge Ops — NOT marketplace público self-service.
// Regla de producto: `published` y aliado `verified`.

import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";
import { type CatalogItem } from "@/lib/partners/catalog";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { rows } = await pool.query(
      `SELECT pp.id            AS package_id,
              pp.slug          AS package_slug,
              pp.title,
              pp.description,
              pp.systems,
              pp.altitude_max,
              p.id             AS partner_id,
              p.slug           AS partner_slug,
              p.legal_name,
              p.vertical,
              (SELECT MAX(v.version) FROM partner_package_versions v WHERE v.package_id = pp.id) AS latest_version,
              (SELECT COUNT(*)::int FROM partner_contracts c
                WHERE c.package_id = pp.id AND c.status = 'active') AS active_contracts
       FROM partner_packages pp
       JOIN partners p ON p.id = pp.partner_id
       WHERE pp.status = 'published'
         AND p.status = 'verified'
       ORDER BY p.legal_name, pp.title`
    );

    const items = rows as CatalogItem[];
    return NextResponse.json({ items });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.catalog.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
