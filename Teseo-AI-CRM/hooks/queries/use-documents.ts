import { useQuery } from '@tanstack/react-query';

export interface Document {
  id: string;
  name: string;
  file_path: string | null;
  file_type: string;
  size_bytes: number;
  status: 'processing' | 'ready' | 'error';
  error_message: string | null;
  created_at: string;
}

async function fetchDocuments(): Promise<Document[]> {
  const res = await fetch('/api/asset-studio/documents');
  if (!res.ok) throw new Error('Failed to fetch documents');
  return res.json();
}

export function useDocuments() {
  return useQuery({
    queryKey: ['asset-studio', 'documents'],
    queryFn: fetchDocuments,
    staleTime: 1000 * 60, // 1 min cache since status might change
  });
}
