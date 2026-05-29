import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { Lead } from '@/types/lead';
import { z } from 'zod';
import { updateLeadSchema } from '@/lib/validations/lead';

type UpdateLeadPayload = z.infer<typeof updateLeadSchema>;

export function useUpdateLead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, data }: { leadId: string; data: UpdateLeadPayload }) => {
      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        throw new Error('Failed to update lead');
      }

      const json = await res.json();
      return json.data as Lead;
    },
    onMutate: async ({ leadId, data }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.leads.all });
      await queryClient.cancelQueries({ queryKey: queryKeys.leads.detail(leadId) });

      const previousLeads = queryClient.getQueryData<Lead[]>(queryKeys.leads.all);
      const previousDetail = queryClient.getQueryData<Lead>(queryKeys.leads.detail(leadId));

      if (previousLeads) {
        queryClient.setQueryData<Lead[]>(queryKeys.leads.all, (old) => {
          if (!old) return [];
          return old.map(lead => lead.id === leadId ? { ...lead, ...data } : lead);
        });
      }

      if (previousDetail) {
        queryClient.setQueryData<Lead>(queryKeys.leads.detail(leadId), {
          ...previousDetail,
          ...data,
        });
      }

      return { previousLeads, previousDetail };
    },
    onError: (err, { leadId }, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(queryKeys.leads.all, context.previousLeads);
      }
      if (context?.previousDetail) {
        queryClient.setQueryData(queryKeys.leads.detail(leadId), context.previousDetail);
      }
    },
    onSettled: (data, error, { leadId }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.detail(leadId) });
    },
  });
}
