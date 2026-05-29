/**
 * hooks/queries/use-outbound-touchpoints.ts
 * 
 * Fetches outbound touchpoints for a specific lead.
 * 
 * TODO (Executor):
 *   - Create API route: app/api/leads/[id]/outbound/route.ts
 *   - Implement Supabase query with RLS-aware join
 */

import { useQuery } from '@tanstack/react-query';
import type { OutboundTouchpoint, OutboundEnrollment } from '@/types/outbound';

interface OutboundData {
  enrollments: OutboundEnrollment[];
  touchpoints: OutboundTouchpoint[];
}

export function useOutboundTouchpoints(leadId: string | null) {
  return useQuery({
    queryKey: ['outbound', 'touchpoints', leadId],
    queryFn: async (): Promise<OutboundData> => {
      if (!leadId) return { enrollments: [], touchpoints: [] };
      const res = await fetch(`/api/leads/${leadId}/outbound`);
      if (!res.ok) throw new Error('Failed to fetch outbound data');
      return res.json();
    },
    enabled: !!leadId,
  });
}
