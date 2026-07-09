// app/api/admin/partners/referrals/route.ts
// PA4-W1 — Knowledge Ops: CRUD de referidos (D-P5, TRD §7.2). CRUD simple sobre
// partner_referrals (PK compuesta tenant_id+partner_id, migrations-gcp/007_partner_contracts.sql).
// Guard: requirePlatformAdmin (ver nota de desviación en app/api/admin/partners/route.ts).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const REFERRAL_COLUMNS = "tenant_id, partner_id, referred_at, active";

// Mirror de PartnerReferralSchema (contracts/src/partners.ts) — `referred_at` lo fija la DDL
// (default now()); `active` es opcional, default true.
const CreateReferralBodySchema = z.object({
  tenant_id: z.string().min(1),
  partner_id: z.string().uuid(),
  active: z.boolean().optional(),
});

function zodDetails(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

export async function GET(req: NextRequest) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const url = new URL(req.url);
    const tenantId = url.searchParams.get("tenant_id") || undefined;
    const partnerId = url.searchParams.get("partner_id") || undefined;

    const conditions: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    if (tenantId) {
      conditions.push(`tenant_id = $${i++}`);
      values.push(tenantId);
    }
    if (partnerId) {
      conditions.push(`partner_id = $${i++}`);
      values.push(partnerId);
    }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const { rows } = await pool.query(
      `SELECT ${REFERRAL_COLUMNS} FROM partner_referrals ${where} ORDER BY referred_at DESC`,
      values
    );
    return NextResponse.json({ referrals: rows });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.referrals.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const body = await req.json().catch(() => null);
    const parsed = CreateReferralBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: zodDetails(parsed.error.issues) },
        { status: 422 }
      );
    }

    const { tenant_id, partner_id, active } = parsed.data;

    try {
      const { rows } = await pool.query(
        `INSERT INTO partner_referrals (tenant_id, partner_id, active)
         VALUES ($1, $2, COALESCE($3, TRUE))
         RETURNING ${REFERRAL_COLUMNS}`,
        [tenant_id, partner_id, active ?? null]
      );
      return NextResponse.json(rows[0], { status: 201 });
    } catch (err: any) {
      if (err.code === "23505") {
        return NextResponse.json(
          { error: "Ya existe un referido para ese tenant_id + partner_id" },
          { status: 409 }
        );
      }
      throw err;
    }
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.referrals.post.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
