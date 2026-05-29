import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { Lead } from '@/types/lead';

interface LeadsResponse {
  data: Lead[];
}

async function fetchLeads(): Promise<Lead[]> {
  const res = await fetch('/api/leads');
  if (!res.ok) throw new Error('Failed to fetch leads');
  const json: LeadsResponse = await res.json();
  return json.data;
}

export function useLeads() {
  return useQuery<Lead[], Error>({
    queryKey: queryKeys.leads.all,
    queryFn: fetchLeads,
    staleTime: 30_000,
    refetchInterval: 5000,
  });
}
