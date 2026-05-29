import { useQuery } from '@tanstack/react-query';
import { CampaignEvent } from '../../types/campaign';

export const useCampaignEvents = (campaignId: string | null) => {
  return useQuery({
    queryKey: ['campaign', campaignId, 'events'],
    queryFn: async (): Promise<CampaignEvent[]> => {
      const response = await fetch(`/api/campaigns/${campaignId}/events`);
      if (!response.ok) {
        throw new Error('Failed to fetch campaign events');
      }
      return response.json();
    },
    enabled: !!campaignId,
  });
};
