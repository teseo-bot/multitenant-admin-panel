'use client';

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type {
  HandoffPayload,
  HandoffAction,
  ThreadSummary,
  PaginatedThreads,
} from '@/types/conversation';

// ── Fetcher ─────────────────────────────────────────────────

async function performHandoff(payload: HandoffPayload): Promise<ThreadSummary> {
  const res = await fetch(`/api/leads/${payload.threadId}/handoff`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Handoff failed: ${res.status}`);
  return res.json() as Promise<ThreadSummary>;
}

// ── Status derivation ───────────────────────────────────────

function deriveOptimisticStatus(action: HandoffAction): ThreadSummary['status'] {
  switch (action) {
    case 'take_over':
      return 'human_active';
    case 'return_to_agent':
      return 'agent_active';
    case 'resolve':
      return 'resolved';
    case 'escalate':
      return 'pending_handoff';
    default:
      return 'active';
  }
}

// ── Hook ────────────────────────────────────────────────────

export function useHandoff() {
  const queryClient = useQueryClient();

  return useMutation<ThreadSummary, Error, HandoffPayload, { previous: unknown }>({
    mutationFn: performHandoff,

    onMutate: async (payload) => {
      const leadId = payload.threadId;
      await queryClient.cancelQueries({ queryKey: queryKeys.leads.all });
      const previous = queryClient.getQueryData(queryKeys.leads.detail(leadId));
      return { previous };
    },

    onError: (_err, payload, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKeys.leads.detail(payload.threadId), context.previous);
      }
    },

    onSettled: () => {
      // Invalidate both leads list and the specific lead detail
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}
