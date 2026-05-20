'use client';

import { useInfiniteQuery, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { createClient } from '@/utils/supabase/client';
import { queryKeys } from '@/lib/query-keys';
import type {
  ThreadFilters,
  PaginatedThreads,
  ThreadSummary,
  Message,
} from '@/types/conversation';

// ── Fetchers ────────────────────────────────────────────────

async function fetchThreads(
  filters: ThreadFilters,
  cursor?: string,
): Promise<PaginatedThreads> {
  const params = new URLSearchParams();
  if (filters.status) params.set('status', filters.status);
  if (filters.channel) params.set('channel', filters.channel);
  if (filters.assignedAgent) params.set('assigned_node', filters.assignedAgent);

  const res = await fetch(`/api/leads?${params.toString()}`);
  if (!res.ok) throw new Error(`Failed to fetch leads: ${res.status}`);
  
  const json = await res.json();
  const leads = json.data || [];

  const threads: ThreadSummary[] = leads.map((lead: any) => {
    // Sort inbox_messages by created_at DESC to get the latest
    const messages = lead.inbox_messages || [];
    messages.sort((a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastMsg = messages[0];

    return {
      id: lead.id,
      threadId: lead.thread_id || lead.id,
      status: lead.status === 'Won' || lead.status === 'Lost' ? 'resolved' : 'active',
      updatedAt: lead.updated_at,
      leadName: lead.name,
      channel: lastMsg?.channel || 'web',
      lastMessageAt: lastMsg?.created_at || lead.created_at,
      lastMessagePreview: lastMsg?.content ? lastMsg.content.substring(0, 50) : '',
      unreadCount: 0,
      leadCompany: lead.company || '',
      assignedAgent: lead.assigned_node || 'unassigned'
    };
  });

  return { threads, nextCursor: undefined };
}

async function fetchMessages(leadId: string): Promise<Message[]> {
  const res = await fetch(`/api/leads/${leadId}/messages`);
  if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
  const json = await res.json();
  const inboxMessages = json.data || [];

  return inboxMessages.map((msg: any) => ({
    threadId: msg.lead_id,
    id: msg.id,
    content: msg.content,
    createdAt: msg.created_at,
    sender: msg.sender,
    senderName: msg.sender === 'customer' ? 'Customer' : msg.sender === 'ai_agent' ? 'AI Agent' : 'Human',
    timestamp: msg.created_at,
    metadata: msg.metadata
  }));
}

// ── Hooks ───────────────────────────────────────────────────

export function useThreads(filters: ThreadFilters = {}) {
  return useInfiniteQuery<PaginatedThreads, Error>({
    queryKey: [...queryKeys.threads.all, filters],
    queryFn: ({ pageParam }) =>
      fetchThreads(filters, pageParam as string | undefined),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (lastPage) => lastPage.nextCursor ?? undefined,
    staleTime: 30_000,
    refetchInterval: 3000,
  });
}

export function useThreadList(filters: ThreadFilters = {}) {
  const query = useThreads(filters);
  const threads: ThreadSummary[] = query.data?.pages.flatMap((p) => p.threads) ?? [];
  return { ...query, threads };
}

export function useMessages(threadId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!threadId) return;
    
    const supabase = createClient();
    const channel = supabase
      .channel(`messages-${threadId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inbox_messages',
          filter: `lead_id=eq.${threadId}`,
        },
        () => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.threads.messages(threadId),
          });
          queryClient.invalidateQueries({
            queryKey: queryKeys.threads.all,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [threadId, queryClient]);

  return useQuery<Message[], Error>({
    queryKey: queryKeys.threads.messages(threadId ?? ''),
    queryFn: () => fetchMessages(threadId!),
    enabled: Boolean(threadId),
    refetchInterval: false, // Desactivar polling
  });
}
