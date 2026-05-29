import { useQuery } from '@tanstack/react-query';
import { fetchFinancialSummary, FinOpsSummary } from '@/lib/finops-service';

export function useFinOpsSummary() {
  return useQuery<FinOpsSummary[], Error>({
    queryKey: ['finops_summary'],
    queryFn: fetchFinancialSummary,
    // Short-polling cada 60 segundos para mantener la vista fresca
    // sin saturar la cuota de peticiones HTTP en serverless.
    refetchInterval: 60000,
  });
}
