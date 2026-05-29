import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

interface ArchiveVersionVars {
  templateId: string;
  versionId: string;
}

async function archiveVersion({ templateId, versionId }: ArchiveVersionVars) {
  const res = await fetch(`/api/prompts/${templateId}/versions/${versionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'archived' }),
  });
  if (!res.ok) {
    const err = await res.json();
    throw new Error(err.error || 'Failed to archive version');
  }
  return res.json();
}

export function useArchiveVersion() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: archiveVersion,
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.prompts.versions(variables.templateId) });
    },
  });
}
