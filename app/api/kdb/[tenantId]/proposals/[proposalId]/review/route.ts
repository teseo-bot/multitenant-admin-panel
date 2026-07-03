// POST /api/kdb/[tenantId]/proposals/[proposalId]/review — TRD §9, BACKEND §D2
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { withTenant } from "@/lib/kdb/pool";
import { validateReviewBody, buildReviewUpdatePlan, type ExistingProposalRow } from "@/lib/kdb/review";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ tenantId: string; proposalId: string }> }
) {
  const auth = await requirePlatformAdmin();
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const { tenantId, proposalId } = await context.params;
  if (!tenantId || !proposalId) {
    return NextResponse.json({ error: "tenantId y proposalId requeridos" }, { status: 404 });
  }

  const rawBody = await request.json().catch(() => null);
  const validation = validateReviewBody(rawBody);
  if (!validation.ok) {
    return NextResponse.json({ error: validation.error }, { status: 422 });
  }
  const review = validation.data;

  try {
    const result = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query<ExistingProposalRow>(
        `SELECT proposal_id, new_content, review_meta
         FROM okf_merge_proposals
         WHERE proposal_id = $1`,
        [proposalId]
      );
      const existing = rows[0];
      if (!existing) {
        return { notFound: true as const };
      }

      const plan = buildReviewUpdatePlan(existing, review);

      await client.query(
        `UPDATE okf_merge_proposals
         SET status = $1,
             reviewer = $2,
             reviewed_at = CURRENT_TIMESTAMP,
             new_content = $3,
             review_meta = $4::jsonb
         WHERE proposal_id = $5`,
        [plan.status, plan.reviewer, plan.newContent, JSON.stringify(plan.reviewMeta), proposalId]
      );

      // TODO K7: append a log.md vía BundleStore cuando el compiler exponga endpoint
      // o se comparta el módulo — ver BACKEND §D2. La entrada de log.md
      // (`hitl:{email}`, accion según decision) queda pendiente de integración: el
      // panel no tiene cliente GCS y no debe añadir esa dependencia en esta WU.

      return { notFound: false as const };
    });

    if (result.notFound) {
      return NextResponse.json({ error: "Proposal no encontrada" }, { status: 404 });
    }

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al procesar review" },
      { status: 500 }
    );
  }
}
