import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { listMemberships, type Role, type MembershipStatus } from "@/lib/services/membership";
import { logger } from "@/lib/logger";

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    logger.warn('api.admin.users.denied', { status: auth.status });
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const url = new URL(request.url);
  const tenantId = url.searchParams.get("tenantId") || undefined;
  const role = (url.searchParams.get("role") as Role) || undefined;
  const moduleId = url.searchParams.get("moduleId") || undefined;
  const status = (url.searchParams.get("status") as MembershipStatus) || undefined;
  const q = url.searchParams.get("q") || undefined;

  const memberships = await listMemberships({ tenantId, role, moduleId, status, q });
  return NextResponse.json(memberships);
}
