// GET /api/kdb/[tenantId]/proposals?status=pending_hitl — TRD §9
import { NextResponse } from "next/server";
import { requirePlatformAdmin } from "@/lib/auth/guards";
import { withTenant } from "@/lib/kdb/pool";

export const dynamic = "force-dynamic";

const VALID_STATUSES = [
  "pending_auto",
  "pending_hitl",
  "approved",
  "rejected",
  "applied",
] as const;

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
  const statusParam = url.searchParams.get("status") || "pending_hitl";
  if (!VALID_STATUSES.includes(statusParam as (typeof VALID_STATUSES)[number])) {
    return NextResponse.json(
      { error: `status inválido. Valores permitidos: ${VALID_STATUSES.join(", ")}` },
      { status: 422 }
    );
  }

  try {
    const proposals = await withTenant(tenantId, async (client) => {
      const { rows } = await client.query(
        `SELECT proposal_id, tenant_id, target_path, action, altitude, draft_ids,
                new_content, previous_sha256, status
         FROM okf_merge_proposals
         WHERE status = $1
         ORDER BY created_at DESC`,
        [statusParam]
      );
      return rows;
    });

    return NextResponse.json(proposals);
  } catch (err: any) {
    return NextResponse.json(
      { error: err?.message || "Error al listar proposals" },
      { status: 500 }
    );
  }
}
