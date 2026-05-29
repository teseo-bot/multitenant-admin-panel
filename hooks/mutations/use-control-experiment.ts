import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

type Action = 'start' | 'pause' | 'cancel';

interface ControlExperimentVars {
  templateId: string;
  experimentId: string;
  action: Action;
}

async function controlExperiment({ templateId, experimentId, action }: ControlExperimentVars) {
  const res = await fetch(`/api/prompts/${templateId}/experiments/${experimentId}/${action}`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || `Failed to ${action} experiment`);
  }
  return res.json();
}

export function useControlExperiment() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: controlExperiment,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experiments.detail(variables.experimentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.experiments.byTemplate(variables.templateId) });
    },
  });
}
