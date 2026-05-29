import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { PromptVersion } from '@/types/prompt';

async function fetchVersions(templateId: string): Promise<PromptVersion[]> {
  const res = await fetch(`/api/prompts/${templateId}/versions`);
  if (!res.ok) throw new Error('Failed to fetch prompt versions');
  return res.json();
}

export function usePromptVersions(templateId: string) {
  return useQuery({
    queryKey: queryKeys.prompts.versions(templateId),
    queryFn: () => fetchVersions(templateId),
    enabled: !!templateId,
  });
}
