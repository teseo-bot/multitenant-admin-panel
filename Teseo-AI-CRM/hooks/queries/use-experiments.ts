import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { ABExperiment } from '@/types/experiment';

async function fetchExperiments(templateId: string): Promise<ABExperiment[]> {
  const res = await fetch(`/api/prompts/${templateId}/experiments`);
  if (!res.ok) throw new Error('Failed to fetch experiments');
  return res.json();
}

export function useExperiments(templateId: string) {
  return useQuery({
    queryKey: queryKeys.experiments.byTemplate(templateId),
    queryFn: () => fetchExperiments(templateId),
    enabled: !!templateId,
  });
}
