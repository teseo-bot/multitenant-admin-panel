import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { PromptTemplate } from '@/types/prompt';

async function fetchTemplates(): Promise<PromptTemplate[]> {
  const res = await fetch('/api/prompts');
  if (!res.ok) throw new Error('Failed to fetch prompt templates');
  return res.json();
}

export function usePromptTemplates() {
  return useQuery({
    queryKey: queryKeys.prompts.all,
    queryFn: fetchTemplates,
  });
}
