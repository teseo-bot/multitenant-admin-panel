import { useQuery } from '@tanstack/react-query';

export interface DashboardSummary {
  leads: {
    total: number;
    conversionRate: string;
  };
  finops: {
    totalCostUsd: string;
    currency: string;
  };
  handoffs: {
    pending: number;
  };
}

export function useDashboardSummary() {
  return useQuery<DashboardSummary, Error>({
    queryKey: ['dashboard', 'summary'],
    queryFn: async () => {
      const response = await fetch('/api/dashboard/summary');
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard summary');
      }
      return response.json();
    },
    // ADR-138: Caché defensiva de 5 minutos para proteger la BD
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000, 
    refetchOnWindowFocus: false,
  });
}
