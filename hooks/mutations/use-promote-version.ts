import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

interface PromoteVersionVars {
  templateId: string;
  versionId: string;
}

async function promoteVersion({ templateId, versionId }: PromoteVersionVars) {
  const res = await fetch(`/api/prompts/${templateId}/versions/${versionId}/promote`, {
    method: 'POST',
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to promote version');
  }
  return res.json();
}

export function usePromoteVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: promoteVersion,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.versions(variables.templateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.detail(variables.templateId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.all });
    },
  });
}
