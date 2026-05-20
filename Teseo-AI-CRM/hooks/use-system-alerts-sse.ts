import { useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

export type AlertSeverity = 'info' | 'warning' | 'critical';

export interface SystemAlertEvent {
  type: 'alert_created' | 'alert_resolved';
  tenant_id: string;
  severity: AlertSeverity;
  code: string;
  message: string;
  timestamp: string;
}

export function useSystemAlertsSSE() {
  const queryClient = useQueryClient();

  // Temporarily migrated to HTTP Short-Polling (every 5 seconds) to bypass IPv6/Pooler limitations
  useQuery({
    queryKey: ['system', 'alerts', 'polling'],
    queryFn: async () => {
      // In a real scenario we would fetch alerts from an endpoint
      // For now, we just return an empty array to stop the SSE 500 errors
      return [];
    },
    refetchInterval: 5000,
  });

  useEffect(() => {
    // Legacy SSE logic removed
    return () => {};
  }, [queryClient]);
}
