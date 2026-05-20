import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

interface DeclareWinnerVars {
  templateId: string;
  experimentId: string;
  winnerVariantId: string;
}

async function declareWinner({ templateId, experimentId, winnerVariantId }: DeclareWinnerVars) {
  const res = await fetch(`/api/prompts/${templateId}/experiments/${experimentId}/end`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ winnerVariantId }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to declare winner');
  }
  return res.json();
}

export function useDeclareWinner() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: declareWinner,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.experiments.detail(variables.experimentId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.experiments.byTemplate(variables.templateId) });
      // Because declaring a winner promotes a version to active
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.versions(variables.templateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.detail(variables.templateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.all });
    },
  });
}
