import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { PromptVersion } from '@/types/prompt';

async function fetchVersionDetail(templateId: string, versionId: string): Promise<PromptVersion> {
  const res = await fetch(`/api/prompts/${templateId}/versions/${versionId}`);
  if (!res.ok) throw new Error('Failed to fetch prompt version details');
  return res.json();
}

export function usePromptVersionDetail(templateId: string, versionId: string) {
  return useQuery({
    queryKey: queryKeys.prompts.version(templateId, versionId),
    queryFn: () => fetchVersionDetail(templateId, versionId),
    enabled: !!templateId && !!versionId,
  });
}
