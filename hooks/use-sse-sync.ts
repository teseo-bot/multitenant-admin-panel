'use client';

import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type {
  SSEEvent,
  ThreadSummary,
  Message,
  PaginatedThreads,
} from '@/types/conversation';

const SSE_ENDPOINT = '/api/threads/events';
const RECONNECT_DELAY_MS = 3_000;

/**
 * Subscribes to Server-Sent Events and injects live data directly
 * into the TanStack Query cache via `queryClient.setQueryData`.
 *
 * Auto-reconnects on disconnect.
 */
export function useSSESync() {
  const queryClient = useQueryClient();
  const sourceRef = useRef<EventSource | null>(null);
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    function connect() {
      const es = new EventSource(SSE_ENDPOINT);
      sourceRef.current = es;

      es.onmessage = (event: MessageEvent) => {
        let parsed: SSEEvent;
        try {
          parsed = JSON.parse(event.data) as SSEEvent;
        } catch {
          return; // silently skip malformed frames
        }

        switch (parsed.type) {
          case 'thread.updated': {
            const thread = parsed.payload as ThreadSummary;
            // Patch inside every cached page
            queryClient.setQueriesData<PaginatedThreads>(
              { queryKey: queryKeys.threads.all },
              (old) => {
                if (!old) return old;
                return {
                  ...old,
                  threads: old.threads.map((t) =>
                    t.threadId === thread.threadId ? { ...t, ...thread } : t,
                  ),
                };
              },
            );
            break;
          }

          case 'thread.new': {
            // Invalidate to let TQ refetch cleanly (new thread could affect sort order)
            queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
            break;
          }

          case 'message.new': {
            const msg = parsed.payload as Message;
            // Append to the messages cache for the target thread
            queryClient.setQueryData<Message[]>(
              queryKeys.threads.messages(msg.threadId),
              (old) => (old ? [...old, msg] : [msg]),
            );
            // Also bump the thread list preview
            queryClient.setQueriesData<PaginatedThreads>(
              { queryKey: queryKeys.threads.all },
              (old) => {
                if (!old) return old;
                return {
                  ...old,
                  threads: old.threads.map((t) =>
                    t.threadId === msg.threadId
                      ? {
                          ...t,
                          lastMessagePreview: msg.content.slice(0, 120),
                          lastMessageAt: msg.timestamp,
                          unreadCount: t.unreadCount + 1,
                        }
                      : t,
                  ),
                };
              },
            );
            break;
          }

          case 'handoff.completed': {
            const thread = parsed.payload as ThreadSummary;
            queryClient.setQueriesData<PaginatedThreads>(
              { queryKey: queryKeys.threads.all },
              (old) => {
                if (!old) return old;
                return {
                  ...old,
                  threads: old.threads.map((t) =>
                    t.threadId === thread.threadId ? { ...t, ...thread } : t,
                  ),
                };
              },
            );
            break;
          }
        }
      };

      es.onerror = () => {
        es.close();
        sourceRef.current = null;
        // Schedule reconnect
        reconnectTimer.current = setTimeout(connect, RECONNECT_DELAY_MS);
      };
    }

    connect();

    return () => {
      sourceRef.current?.close();
      if (reconnectTimer.current) clearTimeout(reconnectTimer.current);
    };
  }, [queryClient]);
}
