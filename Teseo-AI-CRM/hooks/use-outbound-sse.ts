/**
 * hooks/use-outbound-sse.ts
 * 
 * SSE hook for real-time outbound tracking updates.
 * Follows the same pattern as inbox SSE (ADR-112/113):
 *   - EventSource connects to /api/outbound/stream?leadId=xxx
 *   - On event, invalidates TanStack Query cache for the specific lead
 *   - No polling — push-only from pg_notify('outbound_updates')
 *
 * TODO (Executor):
 *   - Create the API route: app/api/outbound/stream/route.ts
 *   - Wire pg_notify listener on 'outbound_updates' channel
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseOutboundSSEOptions {
  /** Lead ID to filter events for. If null, SSE is not connected. */
  leadId: string | null;
  /** Additional query keys to invalidate on outbound events */
  extraQueryKeys?: readonly (readonly string[])[];
}

export function useOutboundSSE({ leadId, extraQueryKeys = [] }: UseOutboundSSEOptions) {
  const queryClient = useQueryClient();
  const eventSourceRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!leadId) return;

    const url = `/api/outbound/stream?leadId=${encodeURIComponent(leadId)}`;
    const es = new EventSource(url);
    eventSourceRef.current = es;

    es.onmessage = (event) => {
      console.log('[SSE:outbound] Event received:', event.data);

      // Invalidate outbound-specific queries for this lead
      queryClient.invalidateQueries({ queryKey: ['outbound', 'touchpoints', leadId] });
      queryClient.invalidateQueries({ queryKey: ['outbound', 'enrollments', leadId] });
      queryClient.invalidateQueries({ queryKey: ['outbound', 'events', leadId] });
      queryClient.invalidateQueries({ queryKey: ['leads', leadId] });

      // Invalidate any extra keys the consumer passed
      for (const key of extraQueryKeys) {
        queryClient.invalidateQueries({ queryKey: [...key] });
      }
    };

    es.addEventListener('touchpoint', (event) => {
      console.log('[SSE:outbound] Touchpoint event:', event.data);
      queryClient.invalidateQueries({ queryKey: ['outbound', 'touchpoints', leadId] });
    });

    es.addEventListener('tracking_event', (event) => {
      console.log('[SSE:outbound] Tracking event:', event.data);
      queryClient.invalidateQueries({ queryKey: ['outbound', 'events', leadId] });
    });

    es.onerror = (err) => {
      console.error('[SSE:outbound] Connection error, closing:', err);
      es.close();
    };

    return () => {
      es.close();
      eventSourceRef.current = null;
    };
  }, [leadId, queryClient]); // eslint-disable-line react-hooks/exhaustive-deps
}
