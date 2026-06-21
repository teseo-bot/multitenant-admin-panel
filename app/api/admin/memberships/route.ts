import { NextResponse } from "next/server";
import { requirePlatformAdmin, requireTenantAdmin } from "@/lib/auth/guards";
import { listMemberships, type Role, type MembershipStatus } from "@/lib/services/membership";

export const dynamic = "force-dynamic";

/**
 * Lista de membresías con filtros (WU-14/WU-13). Sirve a dos vistas:
 *  - Global (sin tenantId)  => requiere Platform Admin.
 *  - Scoped a un tenant     => requiere admin de ese tenant (o Platform Admin).
 * Filtros: tenantId, role, moduleId, status, q (email/nombre).
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") || undefined;
  const role = (url.searchParams.get("role") as Role) || undefined;
  const moduleId = url.searchParams.get("moduleId") || undefined;
  const status = (url.searchParams.get("status") as MembershipStatus) || undefined;
  const q = url.searchParams.get("q") || undefined;

  const auth = tenantId ? await requireTenantAdmin(tenantId) : await requirePlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const memberships = await listMemberships({ tenantId, role, moduleId, status, q });
  return NextResponse.json(memberships);
}
