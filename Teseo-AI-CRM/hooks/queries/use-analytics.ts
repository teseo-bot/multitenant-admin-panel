import { useQuery } from '@tanstack/react-query';
import { createClient } from '@/utils/supabase/client';

export interface LeadsByStatus {
  status: string;
  total: number;
}

export interface ConversionMetrics {
  total_leads: number;
  won_leads: number;
  lost_leads: number;
  avg_conversion_rate: number;
}

export interface AnalyticsPayload {
  leadsByStatus: LeadsByStatus[];
  conversionMetrics: ConversionMetrics;
}

export function useAnalytics() {
  return useQuery({
    queryKey: ['analytics-dashboard'],
    queryFn: async (): Promise<AnalyticsPayload> => {
      const response = await fetch('/api/analytics');
      if (!response.ok) {
        throw new Error('Failed to fetch analytics data');
      }
      return response.json();
    },
    // Stale time agresivo para evitar llamadas constantes a la BD (RFC-038 - Riesgos)
    staleTime: 1000 * 60 * 5, // 5 minutos
    refetchOnWindowFocus: false,
  });
}
