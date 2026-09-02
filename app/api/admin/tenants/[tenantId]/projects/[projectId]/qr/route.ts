import { requireTenantAdmin } from "@/lib/auth/guards";
import { listarProyectos, numeroWhatsapp } from "@/lib/services/projects";
import { construirEnlaceWa } from "@/lib/projects/enlace";
import QRCode from "qrcode";

export const dynamic = "force-dynamic";

/**
 * El QR del proyecto, en SVG.
 *
 * SVG y no PNG porque su destino es un slide y una lona: el vector escala al tamaño del
 * escenario sin pixelarse, y es lo que va a pedir quien monte la presentación.
 *
 * `?descargar=1` lo sirve como adjunto. Sin eso va en línea, que es como lo pinta la pantalla.
 *
 * Nivel de corrección de errores M (~15 %): el código va impreso y proyectado, donde se come
 * reflejos y recortes, pero subir a Q/H engorda la retícula y la hace más difícil de escanear
 * de lejos —que es el caso de uso real, alguien enfocando desde la fila 20—.
 */
export async function GET(
  request: Request,
  context: { params: Promise<{ tenantId: string; projectId: string }> }
) {
  const { tenantId, projectId } = await context.params;
  const auth = await requireTenantAdmin(tenantId);
  if (!auth.ok) return new Response(auth.error, { status: auth.status });

  const catalogo = await listarProyectos(tenantId);
  if (!catalogo.ok) {
    return new Response("Falta la migración 016 en esta base.", { status: 501 });
  }

  const proyecto = catalogo.proyectos.find((p) => p.id === projectId);
  if (!proyecto) return new Response("Proyecto no encontrado en este tenant.", { status: 404 });

  const enlace = construirEnlaceWa(await numeroWhatsapp(tenantId), proyecto.slug);
  if (!enlace) {
    // 409 y no 404: el proyecto existe, lo que falta es la línea de WhatsApp del tenant. Un
    // 404 aquí mandaría a buscar el proyecto, que es el sitio equivocado.
    return new Response(
      "Este tenant no tiene número de WhatsApp activo: sin línea no hay enlace que codificar.",
      { status: 409 }
    );
  }

  const svg = await QRCode.toString(enlace, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 2,
  });

  const descargar = new URL(request.url).searchParams.get("descargar") === "1";

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      // `private`: el enlace lleva el número del tenant, y ninguna caché compartida debe
      // guardarlo. `no-store` sería más simple pero rompería el `<img>` en cada repintado.
      "Cache-Control": "private, max-age=300",
      "Content-Disposition": descargar
        ? `attachment; filename="qr-${proyecto.slug}.svg"`
        : "inline",
    },
  });
}
