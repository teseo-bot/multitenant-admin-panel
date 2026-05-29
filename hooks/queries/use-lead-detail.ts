import { useQuery } from '@tanstack/react-query';
import { Lead } from '@/types/lead';
import { queryKeys } from '@/lib/query-keys';

export function useLeadDetail(leadId: string | null) {
  return useQuery({
    queryKey: leadId ? queryKeys.leads.detail(leadId) : ['leads', 'detail', null],
    queryFn: async () => {
      if (!leadId) return null;
      const res = await fetch(`/api/leads/${leadId}`);
      if (!res.ok) {
        throw new Error('Failed to fetch lead details');
      }
      const data = await res.json();
      return data.data as Lead;
    },
    enabled: !!leadId,
  });
}
