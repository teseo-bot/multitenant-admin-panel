// app/api/admin/partners/[id]/route.ts
// PA4-W1 — Knowledge Ops: obtener/editar un aliado (TRD §7.2).
// Guard: requirePlatformAdmin (ver nota de desviación en app/api/admin/partners/route.ts).

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const PARTNER_COLUMNS =
  "id, slug, legal_name, vertical, contact_email, status, kms_key_id, created_at";

// Update: solo campos editables tras el alta. `status` sigue su propio ciclo de vida
// (pending_verification/verified/suspended/offboarded) — v1 permite setearlo directo desde
// Knowledge Ops (no hay máquina de estados de aliado especificada en esta WU, a diferencia
// de la de contratos).
const UpdatePartnerBodySchema = z
  .object({
    legal_name: z.string().min(3).max(160).optional(),
    contact_email: z.string().email().optional(),
    vertical: z.enum(["legal", "marketing", "consultoria", "reclutamiento", "otro"]).optional(),
    status: z.enum(["pending_verification", "verified", "suspended", "offboarded"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, { message: "Body vacío" });

function zodDetails(issues: { path: PropertyKey[]; message: string }[]) {
  return issues.map((issue) => ({ path: issue.path.map(String).join("."), message: issue.message }));
}

export async function GET(_req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await context.params;
    const { rows } = await pool.query(
      `SELECT ${PARTNER_COLUMNS} FROM partners WHERE id = $1`,
      [id]
    );
    if (rows.length === 0) {
      return NextResponse.json({ error: "Aliado no encontrado" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.id.get.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: { params: Promise<{ id: string }> }) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id } = await context.params;
    const body = await req.json().catch(() => null);
    const parsed = UpdatePartnerBodySchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validación fallida", details: zodDetails(parsed.error.issues) },
        { status: 422 }
      );
    }

    const fields = parsed.data;
    const setClauses: string[] = [];
    const values: unknown[] = [];
    let i = 1;
    for (const [key, value] of Object.entries(fields)) {
      setClauses.push(`${key} = $${i}`);
      values.push(value);
      i++;
    }
    values.push(id);

    const { rows } = await pool.query(
      `UPDATE partners SET ${setClauses.join(", ")} WHERE id = $${i} RETURNING ${PARTNER_COLUMNS}`,
      values
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Aliado no encontrado" }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.id.patch.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
