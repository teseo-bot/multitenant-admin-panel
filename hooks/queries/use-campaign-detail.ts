import { useQuery } from '@tanstack/react-query';
import { Campaign } from '../../types/campaign';

export const useCampaignDetail = (id: string | null) => {
  return useQuery({
    queryKey: ['campaign', id],
    queryFn: async (): Promise<Campaign> => {
      const response = await fetch(`/api/campaigns/${id}`);
      if (!response.ok) {
        throw new Error('Failed to fetch campaign details');
      }
      return response.json();
    },
    enabled: !!id,
  });
};
