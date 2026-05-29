import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { InboxMessage } from '@/types/inbox-message';

export function useLeadMessages(leadId: string | null) {
  return useQuery({
    queryKey: queryKeys.leads.messages(leadId!),
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const json = await res.json();
      return json.data as InboxMessage[];
    },
    enabled: !!leadId,
    staleTime: 10_000,
    refetchInterval: 3000,
  });
}
