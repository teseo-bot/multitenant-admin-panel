import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

interface SaveVersionVars {
  templateId: string;
  content: string;
  changelog?: string;
}

async function saveVersion({ templateId, content, changelog }: SaveVersionVars) {
  const res = await fetch(`/api/prompts/${templateId}/versions`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ content, changelog }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to save version');
  }
  return res.json();
}

export function useSaveVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: saveVersion,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.versions(variables.templateId) });
    },
  });
}
