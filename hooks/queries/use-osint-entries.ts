/**
 * hooks/queries/use-osint-entries.ts
 * 
 * Fetches OSINT (Open Source Intelligence) entries for a lead.
 * The Hunter agent populates these via web search, LinkedIn scrape, etc.
 * 
 * TODO (Executor):
 *   - Create API route: app/api/leads/[id]/osint/route.ts
 *   - Create Supabase table or use leads.metadata.osint_entries
 */

import { useQuery } from '@tanstack/react-query';
import type { OsintEntry } from '@/types/outbound';

export function useOsintEntries(leadId: string | null) {
  return useQuery({
    queryKey: ['leads', leadId, 'osint'],
    queryFn: async (): Promise<OsintEntry[]> => {
      if (!leadId) return [];
      const res = await fetch(`/api/leads/${leadId}/osint`);
      if (!res.ok) {
        if (res.status === 404) return [];
        throw new Error('Failed to fetch OSINT entries');
      }
      return res.json();
    },
    enabled: !!leadId,
    staleTime: 120_000, // OSINT doesn't update frequently
  });
}
