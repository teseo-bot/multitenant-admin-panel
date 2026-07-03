// GET /api/kdb/[tenantId]/evals — TRD §9
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { withTenant } from "@/lib/kdb/pool";

export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
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

  try {
    const result = await withTenant(tenantId, async (client) => {
      const [runs, questionsCount] = await Promise.all([
        client.query(
          `SELECT id, tenant_id, run_at, score, details, model_version
           FROM okf_eval_runs
           ORDER BY run_at DESC`
        ),
        client.query(
          `SELECT COUNT(*)::int AS count FROM okf_golden_questions WHERE active = TRUE`
        ),
      ]);

      return {
        runs: runs.rows,
        questions_count: questionsCount.rows[0]?.count ?? 0,
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al obtener evals" },
      { status: 500 }
    );
  }
}
