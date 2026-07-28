// app/api/admin/partners/[id]/members/[userId]/route.ts
// Knowledge Ops: cambiar el rol de un miembro o quitarlo del aliado.
//
// Quitar la fila corta el acceso al portal de inmediato (requirePartnerMember
// exige fila real), pero NO borra la cuenta del IdP de aliados: la misma persona
// puede pertenecer a otro aliado, y borrar identidades desde aquí sería un
// efecto colateral no pedido. El offboarding de la cuenta es aparte.

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { pool } from "@/lib/db";
import { logger } from "@/lib/logger";

export const dynamic = "force-dynamic";

const MEMBER_COLUMNS = "partner_id, user_id, member_role, created_at, onboarded_at";

const UpdateMemberBodySchema = z.object({
  member_role: z.enum(["member", "curator"]),
});

export async function PATCH(
  req: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id, userId } = await context.params;
    const parsed = UpdateMemberBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return NextResponse.json({ error: "Cuerpo inválido" }, { status: 400 });
    }

    const { rows } = await pool.query(
      `UPDATE partner_members SET member_role = $3
       WHERE partner_id = $1 AND user_id = $2
       RETURNING ${MEMBER_COLUMNS}`,
      [id, userId, parsed.data.member_role]
    );

    if (rows.length === 0) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }

    logger.info("api.admin.partners.members.role_changed", {
      partner_id: id,
      user_id: userId,
      member_role: parsed.data.member_role,
    });

    return NextResponse.json({ member: rows[0] });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.members.patch.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  context: { params: Promise<{ id: string; userId: string }> }
) {
  try {
    const auth = await requirePlatformAdmin();
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const { id, userId } = await context.params;
    const { rowCount } = await pool.query(
      "DELETE FROM partner_members WHERE partner_id = $1 AND user_id = $2",
      [id, userId]
    );

    if (rowCount === 0) {
      return NextResponse.json({ error: "Miembro no encontrado" }, { status: 404 });
    }

    logger.info("api.admin.partners.members.removed", { partner_id: id, user_id: userId });
    return NextResponse.json({ ok: true });
  } catch (err: any) {
    if (err?.digest === "DYNAMIC_SERVER_USAGE") throw err;
    logger.error("api.admin.partners.members.delete.error", { error: String(err) });
    return NextResponse.json({ error: "Error interno del servidor" }, { status: 500 });
  }
}
