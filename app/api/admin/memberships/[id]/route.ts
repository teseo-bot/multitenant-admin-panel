import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth/guards";
import {
  getMembership,
  setRole,
  setModuleAccess,
  suspend,
  reactivate,
  removeMembership,
  type Role,
  type ModuleGrant,
} from "@/lib/services/membership";

export const dynamic = "force-dynamic";

const VALID_ROLES: Role[] = ["OWNER", "ADMIN", "MEMBER", "VIEWER"];

/**
 * Mutaciones de membresía (WU-11/E4). Acciones: suspend | reactivate | setRole | setModules.
 * Autorización por tenant de la propia membresía (o Platform Admin).
 */
export async function PATCH(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const body = await request.json().catch(() => null);
  if (!body?.action) return NextResponse.json({ error: "Falta 'action'" }, { status: 400 });

  const membership = await getMembership(id);
  if (!membership) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

  const auth = await requireTenantAdmin(membership.tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });
  const actor = auth.user.id;

  try {
    switch (body.action) {
      case "suspend":
        await suspend(id, actor);
        break;
      case "reactivate":
        await reactivate(id, actor);
        break;
      case "setRole":
        if (!VALID_ROLES.includes(body.role)) return NextResponse.json({ error: "Rol inválido" }, { status: 400 });
        await setRole(id, body.role as Role, actor);
        break;
      case "setModules":
        if (!Array.isArray(body.grants)) return NextResponse.json({ error: "'grants' debe ser arreglo" }, { status: 400 });
        await setModuleAccess(id, body.grants as ModuleGrant[], actor);
        break;
      default:
        return NextResponse.json({ error: `Acción no soportada: ${body.action}` }, { status: 400 });
    }
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error en la mutación" }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: { params: Promise<{ id: string }> }) {
  const { id } = await context.params;
  const membership = await getMembership(id);
  if (!membership) return NextResponse.json({ error: "Membresía no encontrada" }, { status: 404 });

  const auth = await requireTenantAdmin(membership.tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    await removeMembership(id, auth.user.id);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al eliminar" }, { status: 500 });
  }
}
