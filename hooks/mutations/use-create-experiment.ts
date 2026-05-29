import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

interface VariantSetup {
  versionId: string;
  trafficPct: number;
  label: string;
}

interface CreateExperimentVars {
  templateId: string;
  name: string;
  minImpressions?: number;
  confidenceLevel?: number;
  variants: VariantSetup[];
}

async function createExperiment(vars: CreateExperimentVars) {
  const { templateId, ...body } = vars;
  const res = await fetch(`/api/prompts/${templateId}/experiments`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to create experiment');
  }
  return res.json();
}

export function useCreateExperiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: createExperiment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experiments.byTemplate(variables.templateId) });
    },
  });
}
