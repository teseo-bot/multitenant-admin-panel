import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { Lead, LeadStatus } from '@/types/lead';

interface MoveLeadPayload {
  leadId: string;
  newStatus: LeadStatus;
  targetIndex: number;
  columnLeads: Lead[];
}

export function calculateSortOrder(targetIndex: number, columnLeads: Lead[]): number {
  if (columnLeads.length === 0) return 1024;

  const filtered = columnLeads;

  if (targetIndex === 0) {
    return filtered[0].sort_order - 1024;
  }

  if (targetIndex >= filtered.length) {
    return filtered[filtered.length - 1].sort_order + 1024;
  }

  const before = filtered[targetIndex - 1].sort_order;
  const after = filtered[targetIndex].sort_order;
  return (before + after) / 2;
}

export function useMoveLeadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, newStatus, targetIndex, columnLeads }: MoveLeadPayload) => {
      const sort_order = calculateSortOrder(targetIndex, columnLeads);

      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, sort_order }),
      });

      if (!res.ok) throw new Error('Failed to move lead');
      return res.json();
    },

    onMutate: async ({ leadId, newStatus, targetIndex, columnLeads }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.leads.all });
      const snapshot = queryClient.getQueryData<Lead[]>(queryKeys.leads.all);

      if (snapshot) {
        const sort_order = calculateSortOrder(targetIndex, columnLeads);
        queryClient.setQueryData<Lead[]>(queryKeys.leads.all, (old) =>
          old?.map((lead) =>
            lead.id === leadId
              ? { ...lead, status: newStatus, sort_order }
              : lead
          ) ?? []
        );
      }

      return { snapshot };
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(queryKeys.leads.all, context.snapshot);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}
