import { useQuery } from '@tanstack/react-query';
import { Campaign } from '../../types/campaign';
import { useCampaignReviewStore } from '../../stores/campaign-review-store';

export const useCampaigns = () => {
  const filters = useCampaignReviewStore((state) => state.filters);

  return useQuery({
    queryKey: ['campaigns', filters],
    queryFn: async (): Promise<Campaign[]> => {
      // In a real app, filters would be serialized into query params.
      const searchParams = new URLSearchParams();
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.status !== 'all') searchParams.set('status', filters.status);
      
      const response = await fetch(`/api/campaigns?${searchParams.toString()}`);
      if (!response.ok) {
        throw new Error('Failed to fetch campaigns');
      }
      return response.json();
    },
  });
};
