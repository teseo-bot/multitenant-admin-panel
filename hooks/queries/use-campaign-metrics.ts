import { useQuery } from '@tanstack/react-query';
import { CampaignMetrics } from '../../types/campaign';

export const useCampaignMetrics = (campaignId: string | null) => {
  return useQuery({
    queryKey: ['campaign', campaignId, 'metrics'],
    queryFn: async (): Promise<CampaignMetrics> => {
      const response = await fetch(`/api/campaigns/${campaignId}/metrics`);
      if (!response.ok) {
        throw new Error('Failed to fetch campaign metrics');
      }
      return response.json();
    },
    enabled: !!campaignId,
  });
};
