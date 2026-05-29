/**
 * hooks/queries/use-semantic-summary.ts
 * 
 * Fetches the AI-generated semantic summary for a lead.
 * The summary is computed by the orchestrator and stored in leads.metadata
 * or a separate edge function.
 * 
 * TODO (Executor):
 *   - Create API route or edge function: app/api/leads/[id]/summary/route.ts
 *   - Implement AI summarization (could call orchestrator or run locally)
 */

import { useQuery } from '@tanstack/react-query';
import type { LeadSemanticSummary } from '@/types/outbound';

export function useSemanticSummary(leadId: string | null) {
  return useQuery({
    queryKey: ['leads', leadId, 'semantic-summary'],
    queryFn: async (): Promise<LeadSemanticSummary | null> => {
      if (!leadId) return null;
      const res = await fetch(`/api/leads/${leadId}/summary`);
      if (!res.ok) {
        if (res.status === 404) return null; // No summary yet
        throw new Error('Failed to fetch semantic summary');
      }
      return res.json();
    },
    enabled: !!leadId,
    staleTime: 60_000, // Summaries don't change every second
  });
}
