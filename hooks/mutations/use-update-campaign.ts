import { useMutation, useQueryClient } from '@tanstack/react-query';
import { UpdateCampaignPayload, Campaign } from '../../types/campaign';

interface UpdateCampaignParams {
  id: string;
  data: UpdateCampaignPayload;
}

export const useUpdateCampaign = () => {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ id, data }: UpdateCampaignParams): Promise<Campaign> => {
      const response = await fetch(`/api/campaigns/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      
      if (!response.ok) {
        throw new Error('Failed to update campaign');
      }
      return response.json();
    },
    onSuccess: (_, { id }) => {
      queryClient.invalidateQueries({ queryKey: ['campaign', id] });
      queryClient.invalidateQueries({ queryKey: ['campaigns'] });
    },
  });
};
