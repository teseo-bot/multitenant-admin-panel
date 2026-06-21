import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { listTenantModules, setTenantModules } from "@/lib/services/modules";

export const dynamic = "force-dynamic";

/** Lista el catálogo de módulos con su estado de activación para el tenant. */
export async function GET(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  const auth = await requireTenantAdmin(tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const modules = await listTenantModules(tenantId);
  return NextResponse.json(modules);
}

/** Activa/desactiva módulos del tenant. Body: { entries: [{ moduleId, isActive }] }. */
export async function PUT(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  const body = await request.json().catch(() => null);
  if (!Array.isArray(body?.entries)) {
    return NextResponse.json({ error: "'entries' debe ser un arreglo de { moduleId, isActive }" }, { status: 400 });
  }

  const auth = await requireTenantAdmin(tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  try {
    await setTenantModules(tenantId, body.entries, auth.user.id);
    const modules = await listTenantModules(tenantId);
    return NextResponse.json({ success: true, modules });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || "Error al actualizar módulos" }, { status: 500 });
  }
}
