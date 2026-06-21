import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { inviteAndProvision } from "@/lib/services/invitations";
import { logger } from "@/lib/logger";
import type { Role } from "@/lib/services/membership";

export const dynamic = "force-dynamic";

const VALID_ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body?.tenantId || !body?.email || !body?.role) {
    return NextResponse.json({ error: "Faltan campos: tenantId, email, role" }, { status: 400 });
  }
  if (!VALID_ROLES.includes(body.role)) {
    return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
  }

  // Autorización: admin del tenant (o platform admin, que pasa siempre).
  const auth = await requireTenantAdmin(body.tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    const result = await inviteAndProvision({
      tenantId: body.tenantId,
      email: body.email,
      role: body.role as Role,
      invitedBy: auth.user.id,
      fullName: body.fullName,
    });
    return NextResponse.json({ success: true, ...result }, { status: 201 });
  } catch (err: any) {
    logger.error("api.admin.invitations.post.error", { error: String(err) });
    return NextResponse.json({ error: err?.message || "Error al invitar" }, { status: 500 });
  }
}
