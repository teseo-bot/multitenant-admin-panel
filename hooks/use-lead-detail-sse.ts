/**
 * hooks/use-lead-detail-sse.ts
 * 
 * Unified SSE hook for the Lead Detail page.
 * Subscribes to BOTH inbound (inbox_updates) and outbound (outbound_updates)
 * channels and invalidates the relevant TanStack Query keys.
 *
 * This replaces per-page inline EventSource code with a reusable hook.
 *
 * Reactive fields pushed via SSE:
 *   - "Etapa" (lead.status changes)
 *   - "Valor" (metadata.deal_value changes)
 *   - "Etiquetas" (metadata.tags changes)
 *   - New inbound messages
 *   - New outbound touchpoints / tracking events
 *
 * TODO (Executor):
 *   - Create unified stream endpoint or compose from existing ones
 *   - Add typed event parsing (currently raw JSON)
 */

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';

interface UseLeadDetailSSEOptions {
  leadId: string | null;
}

/**
 * SSE event shape from the backend.
 * The backend should emit JSON with at least these fields.
 */
interface SSELeadEvent {
  table: string;       // 'inbox_messages' | 'outbound_touchpoints' | 'outbound_tracking_events' | 'leads'
  action: string;      // 'INSERT' | 'UPDATE'
  tenant_id: string;
  lead_id: string;
  id: string;
  /** Optional: changed fields for partial UI updates */
  changed?: Record<string, unknown>;
}

export function useLeadDetailSSE({ leadId }: UseLeadDetailSSEOptions) {
  const queryClient = useQueryClient();
  const esRef = useRef<EventSource | null>(null);

  useEffect(() => {
    if (!leadId) return;

    // Single SSE endpoint that multiplexes inbox + outbound for a specific lead
    const url = `/api/leads/${encodeURIComponent(leadId)}/stream`;
    const es = new EventSource(url);
    esRef.current = es;

    es.onmessage = (event) => {
      try {
        const data: SSELeadEvent = JSON.parse(event.data);
        console.log('[SSE:lead-detail] Event:', data.table, data.action);

        // Always refresh lead detail on any event
        queryClient.invalidateQueries({ queryKey: ['leads', leadId] });

        switch (data.table) {
          case 'inbox_messages':
            queryClient.invalidateQueries({ queryKey: ['leads', leadId, 'messages'] });
            queryClient.invalidateQueries({ queryKey: ['inbox'] });
            break;

          case 'outbound_touchpoints':
            queryClient.invalidateQueries({ queryKey: ['outbound', 'touchpoints', leadId] });
            break;

          case 'outbound_tracking_events':
            queryClient.invalidateQueries({ queryKey: ['outbound', 'events', leadId] });
            break;

          case 'leads':
            // Lead metadata changed (stage, value, tags) — already invalidated above
            break;

          default:
            console.warn('[SSE:lead-detail] Unknown table:', data.table);
        }
      } catch (err) {
        console.warn('[SSE:lead-detail] Failed to parse event:', event.data);
      }
    };

    es.onerror = () => {
      console.error('[SSE:lead-detail] Connection lost, will retry on remount');
      es.close();
    };

    return () => {
      es.close();
      esRef.current = null;
    };
  }, [leadId, queryClient]);
}
