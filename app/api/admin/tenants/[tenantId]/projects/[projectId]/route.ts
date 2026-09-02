import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { activarProyecto } from "@/lib/services/projects";

export const dynamic = "force-dynamic";

/**
 * Enciende o apaga la ventana de vinculación del proyecto (D-221.2). Body: { isActive }.
 *
 * No hay DELETE, y no es un olvido: la ventana ES `is_active`. Apagar corta los vínculos
 * nuevos sin romper ninguna conversación viva; borrar chocaría con el `ON DELETE RESTRICT`
 * que la 016 puso sobre `tenant_channels.project_id` a propósito.
 */
export async function PATCH(
  request: Request,
  context: { params: Promise<{ tenantId: string; projectId: string }> }
) {
  const { tenantId, projectId } = await context.params;
  const auth = await requireTenantAdmin(tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.isActive !== "boolean") {
    return NextResponse.json({ error: "Se esperaba { isActive: boolean }." }, { status: 400 });
  }

  const res = await activarProyecto(tenantId, projectId, body.isActive, auth.user.id);
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  return NextResponse.json({ success: true });
}
