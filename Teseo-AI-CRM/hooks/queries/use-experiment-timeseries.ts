import { useQuery } from '@tanstack/react-query';
import { TimeseriesDataPoint, ExperimentStatus } from '@/types/experiment';
import { queryKeys } from '@/lib/query-keys';

export function useExperimentTimeseries(experimentId: string | undefined, interval: string = 'day', status?: ExperimentStatus) {
  return useQuery<TimeseriesDataPoint[]>({
    queryKey: queryKeys.experiments.timeSeries(experimentId || '', interval),
    queryFn: async () => {
      if (!experimentId) throw new Error('Experiment ID is required');
      const res = await fetch(`/api/experiments/${experimentId}/timeseries?bucket=${interval}`);
      if (!res.ok) throw new Error('Failed to fetch timeseries');
      return res.json();
    },
    enabled: !!experimentId,
    refetchInterval: status === 'running' ? 60000 : false,
  });
}
