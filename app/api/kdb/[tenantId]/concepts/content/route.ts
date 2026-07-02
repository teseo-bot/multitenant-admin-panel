// GET /api/kdb/[tenantId]/concepts/content?path= — TRD §9
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { withTenant } from "@/lib/kdb/pool";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ tenantId: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { tenantId } = await context.params;
  if (!tenantId) {
    return NextResponse.json({ error: "tenantId requerido" }, { status: 404 });
  }

  const url = new URL(request.url);
  const path = url.searchParams.get("path");
  if (!path) {
    return NextResponse.json({ error: "query param 'path' requerido" }, { status: 422 });
  }

  try {
    const concept = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `SELECT frontmatter, body_text
         FROM okf_concepts
         WHERE path = $1`,
        [path]
      );
      return rows[0] ?? null;
    });

    if (!concept) {
      return NextResponse.json({ error: "Concepto no encontrado" }, { status: 404 });
    }

    // TODO K7: log_entries reales requieren leer log.md vía BundleStore/GCS —
    // el panel no tiene cliente GCS y no debe añadir esa dependencia en esta WU.
    // Ver BACKEND §D2 / TRD §9. Se devuelve arreglo vacío como placeholder.
    return NextResponse.json({
      frontmatter: concept.frontmatter,
      body: concept.body_text,
      log_entries: [] as string[],
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al obtener concepto" },
      { status: 500 }
    );
  }
}
