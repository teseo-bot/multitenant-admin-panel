// GET /api/kdb/[tenantId]/concepts?system=&q= — TRD §9
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { withTenant } from "@/lib/kdb/pool";
import { HOCFLIT_SYSTEMS } from "@/lib/kdb/schemas";

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
  const system = url.searchParams.get("system") || undefined;
  const q = url.searchParams.get("q") || undefined;

  if (system && !(HOCFLIT_SYSTEMS as readonly string[]).includes(system)) {
    return NextResponse.json(
      { error: `system inválido. Valores permitidos: ${HOCFLIT_SYSTEMS.join(", ")}` },
      { status: 422 }
    );
  }

  try {
    const concepts = await withTenant(tenantId, async (client) => {
      const conditions: string[] = [];
      const values: unknown[] = [];

      if (system) {
        values.push(system);
        conditions.push(`system_slug = $${values.length}`);
      }
      if (q) {
        values.push(`%${q}%`);
        const idx = values.length;
        conditions.push(
          `(frontmatter->>'title' ILIKE $${idx} OR frontmatter->>'description' ILIKE $${idx})`
        );
      }

      const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : "";
      const { rows } = await client.query(
        `SELECT path, frontmatter, updated_at
         FROM okf_concepts
         ${where}
         ORDER BY updated_at DESC`,
        values
      );
      return rows;
    });

    return NextResponse.json(concepts);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al listar concepts" },
      { status: 500 }
    );
  }
}
