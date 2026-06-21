import { NextResponse } from "next/server";
import { requirePlatformAdmin, requireTenantAdmin } from "@/lib/auth/guards";
import { listAuditEvents } from "@/lib/services/audit";

export const dynamic = "force-dynamic";

/**
 * Bitácora de gestión de usuarios (WU-15). Global (sin tenantId) => Platform
 * Admin; con tenantId => admin de ese tenant. Filtros: tenantId, action.
 */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") || undefined;
  const action = url.searchParams.get("action") || undefined;

  const auth = tenantId ? await requireTenantAdmin(tenantId) : await requirePlatformAdmin();
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const events = await listAuditEvents({ tenantId, action });
  return NextResponse.json(events);
}
