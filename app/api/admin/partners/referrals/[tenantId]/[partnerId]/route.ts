// app/api/admin/partners/referrals/[tenantId]/[partnerId]/route.ts
// PA4-W1 — Knowledge Ops: editar/borrar un referido (D-P5, TRD §7.2). PK compuesta.
// Guard: requirePlatformAdmin (ver nota de desviación en app/api/admin/partners/route.ts).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const REFERRAL_COLUMNS = "tenant_id, partner_id, referred_at, active";

const UpdateReferralBodySchema = z.object({ active: z.boolean() });

function zodDetails(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ tenantId: string; partnerId: string }> }
) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { tenantId, partnerId } = await context.params;
    const body = await req.json().catch(() => null);
    const parsed = UpdateReferralBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: zodDetails(parsed.error.issues) },
        { status: 422 }
      );
    }

    const { rows } = await pool.query(
      `UPDATE partner_referrals SET active = $1 WHERE tenant_id = $2 AND partner_id = $3
       RETURNING ${REFERRAL_COLUMNS}`,
      [parsed.data.active, tenantId, partnerId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Referido no encontrado" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.referrals.patch.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ tenantId: string; partnerId: string }> }
) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { tenantId, partnerId } = await context.params;
    const { rows } = await pool.query(
      `DELETE FROM partner_referrals WHERE tenant_id = $1 AND partner_id = $2
       RETURNING ${REFERRAL_COLUMNS}`,
      [tenantId, partnerId]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Referido no encontrado" }, { status: 404 });
    }
    return NextResponse.json({ success: true, data: rows[0] });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.referrals.delete.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
