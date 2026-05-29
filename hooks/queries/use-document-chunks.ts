import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';

async function fetchDocumentChunks(docId: string): Promise<any[]> {
  const res = await fetch(`/api/documents/${docId}/chunks`);
  if (!res.ok) throw new Error('Failed to fetch document chunks');
  return res.json();
}

export function useDocumentChunks(docId: string) {
  return useQuery({
    queryKey: queryKeys.documents.chunks(docId),
    queryFn: () => fetchDocumentChunks(docId),
    enabled: !!docId,
  });
}
