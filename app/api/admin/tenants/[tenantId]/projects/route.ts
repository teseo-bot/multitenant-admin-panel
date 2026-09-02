import { NextResponse } from "next/server";
import { requireTenantAdmin } from "@/lib/auth/guards";
import { listarProyectos, crearProyecto, numeroWhatsapp } from "@/lib/services/projects";
import { construirEnlaceWa } from "@/lib/projects/enlace";

export const dynamic = "force-dynamic";

/**
 * Catálogo de proyectos del tenant, con el enlace de cada uno ya montado.
 *
 * El enlace se calcula aquí y no en el cliente porque depende del número de WhatsApp del
 * tenant, que es dato del plano de control y no tiene por qué viajar al navegador suelto.
 *
 * `numero: null` es información, no un fallo: significa que el tenant aún no tiene línea de
 * WhatsApp dada de alta, y la pantalla lo dice. Se sirve aparte de `enlace` para que el
 * cliente pueda distinguir «no hay línea» de «esta clave no monta enlace».
 */
export async function GET(_request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  const auth = await requireTenantAdmin(tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const catalogo = await listarProyectos(tenantId);
  if (!catalogo.ok) {
    // 501 y no 200-con-lista-vacía: la pantalla tiene que poder decir «falta la migración 016»
    // en vez de «este tenant no tiene proyectos», que manda a buscar una configuración que no
    // existe. Son estados distintos y se sirven distintos.
    return NextResponse.json(
      { error: "Falta la migración 016 en esta base: `tenant_projects` no existe.", motivo: catalogo.motivo },
      { status: 501 }
    );
  }

  const numero = await numeroWhatsapp(tenantId);

  return NextResponse.json({
    numero,
    proyectos: catalogo.proyectos.map((p) => ({
      ...p,
      enlace: construirEnlaceWa(numero, p.slug),
    })),
  });
}

/** Da de alta un proyecto. Body: { clave, displayName }. */
export async function POST(request: Request, context: { params: Promise<{ tenantId: string }> }) {
  const { tenantId } = await context.params;
  const auth = await requireTenantAdmin(tenantId);
  if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

  const body = await request.json().catch(() => null);
  if (!body || typeof body.clave !== "string" || typeof body.displayName !== "string") {
    return NextResponse.json({ error: "Se esperaba { clave, displayName }." }, { status: 400 });
  }

  const res = await crearProyecto(
    tenantId,
    { clave: body.clave, displayName: body.displayName },
    auth.user.id
  );
  if (!res.ok) return NextResponse.json({ error: res.error }, { status: res.status });

  const numero = await numeroWhatsapp(tenantId);
  return NextResponse.json(
    { proyecto: { ...res.proyecto, enlace: construirEnlaceWa(numero, res.proyecto.slug) }, numero },
    { status: 201 }
  );
}
