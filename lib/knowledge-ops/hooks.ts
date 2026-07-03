// lib/knowledge-ops/hooks.ts
// K7-W2: hooks TanStack Query para Knowledge Ops. Consumen las rutas de app/api/kdb/
// (K7-W1) — sin estado global fuera de TanStack (regla transversal UXUI).

import { useEffect, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import type { MergeProposal } from "@/lib/kdb/schemas";

/**
 * Regla transversal UXUI: "Errores API: toast con mensaje del servidor + botón
 * reintentar; nunca silenciar." Dispara un toast.error con acción de reintento cada
 * vez que `error` cambia a un valor no nulo.
 */
export function useErrorToast(error: unknown, refetch: () => void) {
  useEffect(() => {
    if (!error) return;
    const message = error instanceof Error ? error.message : "Error al consultar el servidor";
    toast.error(message, {
      action: { label: "Reintentar", onClick: () => refetch() },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [error]);
}

export interface KdbStatus {
  pipelines: {
    v2_last_run: string | null;
    v3_last_run: string | null;
    candidates_pending: number;
    drafts_staged: number;
  };
  eval_last: { score: number; run_at: string } | null;
}

async function fetchJson<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error || `Error ${res.status} al consultar ${url}`);
  }
  return res.json();
}

/** GET /api/kdb/[tenantId]/status — polling 30s (UXUI P1). */
export function useKdbStatus(tenantId: string) {
  return useQuery<KdbStatus>({
    queryKey: ["kdb", tenantId, "status"],
    queryFn: () => fetchJson<KdbStatus>(`/api/kdb/${tenantId}/status`),
    refetchInterval: 30_000,
    enabled: !!tenantId,
  });
}

/** GET /api/kdb/[tenantId]/proposals?status=pending_hitl — cola HITL de P2. */
export function usePendingProposals(tenantId: string) {
  return useQuery<MergeProposal[]>({
    queryKey: ["kdb", tenantId, "proposals", "pending_hitl"],
    queryFn: () =>
      fetchJson<MergeProposal[]>(`/api/kdb/${tenantId}/proposals?status=pending_hitl`),
    refetchInterval: 30_000,
    enabled: !!tenantId,
  });
}

export interface ReviewPayload {
  proposalId: string;
  decision: "approved" | "rejected";
  corrected_content?: string;
  reviewer: string;
  reason?: string;
}

/** POST /api/kdb/[tenantId]/proposals/[proposalId]/review con optimistic update. */
export function useReviewProposal(tenantId: string) {
  const queryClient = useQueryClient();
  const queryKey = ["kdb", tenantId, "proposals", "pending_hitl"];

  return useMutation({
    mutationFn: async (payload: ReviewPayload) => {
      const res = await fetch(
        `/api/kdb/${tenantId}/proposals/${payload.proposalId}/review`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            decision: payload.decision,
            corrected_content: payload.corrected_content,
            reviewer: payload.reviewer,
            reason: payload.reason,
          }),
        }
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body?.error || `Error ${res.status} al enviar revisión`);
      }
      return res.json() as Promise<{ ok: true }>;
    },
    onMutate: async (payload) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<MergeProposal[]>(queryKey);
      queryClient.setQueryData<MergeProposal[]>(queryKey, (old) =>
        (old ?? []).filter((p) => p.proposal_id !== payload.proposalId)
      );
      return { previous };
    },
    onError: (_err, _payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
      queryClient.invalidateQueries({ queryKey: ["kdb", tenantId, "status"] });
    },
  });
}

// K7-W3: Hooks para P3 (Browser) y P4 (Evals)

export interface ConceptMetadata {
  path: string;
  frontmatter: Record<string, unknown>;
  updated_at: string;
}

export interface ConceptContentData {
  frontmatter: Record<string, unknown>;
  body: string;
  log_entries: string[];
}

export interface EvalRun {
  id: string;
  tenant_id: string;
  run_at: string;
  score: number;
  details: Record<string, unknown>;
  model_version: string;
}

export interface EvalData {
  runs: EvalRun[];
  questions_count: number;
}

/** GET /api/kdb/[tenantId]/concepts?system=&q= — lista de conceptos (P3 browser). */
export function useConcepts(
  tenantId: string,
  opts?: { system?: string; q?: string }
) {
  const queryKey = useMemo(
    () => ["kdb", tenantId, "concepts", opts?.system ?? "", opts?.q ?? ""],
    [tenantId, opts?.system, opts?.q]
  );

  return useQuery<ConceptMetadata[]>({
    queryKey,
    queryFn: () => {
      const params = new URLSearchParams();
      if (opts?.system) params.set("system", opts.system);
      if (opts?.q) params.set("q", opts.q);
      return fetchJson<ConceptMetadata[]>(
        `/api/kdb/${tenantId}/concepts?${params.toString()}`
      );
    },
    enabled: !!tenantId,
    staleTime: 30_000,
  });
}

/** GET /api/kdb/[tenantId]/concepts/content?path= — contenido de un concepto (P3 viewer). */
export function useConceptContent(
  tenantId: string,
  path: string | null
) {
  return useQuery<ConceptContentData>({
    queryKey: ["kdb", tenantId, "concepts", "content", path ?? ""],
    queryFn: () =>
      fetchJson<ConceptContentData>(
        `/api/kdb/${tenantId}/concepts/content?path=${encodeURIComponent(path || "")}`
      ),
    enabled: !!tenantId && !!path,
    staleTime: 30_000,
  });
}

/** GET /api/kdb/[tenantId]/evals — datos de evaluaciones (P4 evals). */
export function useEvals(tenantId: string) {
  return useQuery<EvalData>({
    queryKey: ["kdb", tenantId, "evals"],
    queryFn: () => fetchJson<EvalData>(`/api/kdb/${tenantId}/evals`),
    enabled: !!tenantId,
    staleTime: 60_000,
  });
}
