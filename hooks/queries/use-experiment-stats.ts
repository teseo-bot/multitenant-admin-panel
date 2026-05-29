import { useQuery } from '@tanstack/react-query';
import { VariantStats, ExperimentStatus } from '@/types/experiment';
import { queryKeys } from '@/lib/query-keys';

export function useExperimentStats(experimentId: string | undefined, status?: ExperimentStatus) {
  return useQuery<VariantStats[]>({
    queryKey: queryKeys.experiments.stats(experimentId || ''),
    queryFn: async () => {
      if (!experimentId) throw new Error('Experiment ID is required');
      const res = await fetch(`/api/experiments/${experimentId}/stats`);
      if (!res.ok) throw new Error('Failed to fetch stats');
      return res.json();
    },
    enabled: !!experimentId,
    refetchInterval: status === 'running' ? 30000 : false,
  });
}
