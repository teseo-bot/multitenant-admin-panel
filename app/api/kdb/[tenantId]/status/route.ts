// GET /api/kdb/[tenantId]/status — TRD §9
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
      const [candidatesPending, draftsStaged, v2LastRun, v3LastRun, evalLast] =
        await Promise.all([
          client.query(
            `SELECT COUNT(*)::int AS count FROM knowledge_candidates WHERE status = 'pending'`
          ),
          client.query(
            `SELECT COUNT(*)::int AS count FROM knowledge_candidates WHERE status = 'drafted'`
          ),
          client.query(
            `SELECT MAX(processed_at) AS last_run FROM knowledge_candidates WHERE status IN ('drafted','discarded','error')`
          ),
          client.query(
            `SELECT MAX(reviewed_at) AS last_run FROM okf_merge_proposals WHERE status = 'applied'`
          ),
          client.query(
            `SELECT score, run_at FROM okf_eval_runs ORDER BY run_at DESC LIMIT 1`
          ),
        ]);

      return {
        pipelines: {
          v2_last_run: v2LastRun.rows[0]?.last_run ?? null,
          v3_last_run: v3LastRun.rows[0]?.last_run ?? null,
          candidates_pending: candidatesPending.rows[0]?.count ?? 0,
          drafts_staged: draftsStaged.rows[0]?.count ?? 0,
        },
        eval_last: evalLast.rows[0]
          ? { score: Number(evalLast.rows[0].score), run_at: evalLast.rows[0].run_at }
          : null,
      };
    });

    return NextResponse.json(result);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al obtener status" },
      { status: 500 }
    );
  }
}
