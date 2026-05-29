/**
 * components/lead-detail/ChatPanel.tsx
 * 
 * Left column of LeadDetail: Chat history (70% height) + fixed composer.
 * 
 * Layout:
 *   ┌──────────────────────┐
 *   │  Channel tabs header  │  (WhatsApp | Telegram | Email | All)
 *   ├──────────────────────┤
 *   │                      │
 *   │  ScrollArea           │  70% of panel height
 *   │  (chronological       │  Inbound + Outbound messages interleaved
 *   │   message feed)       │
 *   │                      │
 *   ├──────────────────────┤
 *   │  Composer (fixed)     │  Text input + tool buttons
 *   │  [📎 🎤 📷] [______] │
 *   └──────────────────────┘
 * 
 * Data:
 *   - useLeadMessages(leadId) for inbox messages
 *   - useOutboundTouchpoints(leadId) for outbound touchpoints
 *   - Both merged into a single chronological timeline
 * 
 * TODO (Executor):
 *   - Import and use MessageBubble component (already exists)
 *   - Import and use OmnichannelComposer (already exists)
 *   - Merge inbound + outbound into unified timeline
 */

"use client";

import React, { useState, useMemo, useRef, useEffect } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Send,
  Paperclip,
  Bot,
  User,
  ArrowDown,
  Phone,
  Mail,
  MessageCircle,
  Globe,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useOutboundTouchpoints } from "@/hooks/queries/use-outbound-touchpoints";
import type { Lead } from "@/types/lead";
import type { OutboundTouchpoint } from "@/types/outbound";

interface ChatPanelProps {
  leadId: string;
  lead: Lead;
}

/** Unified timeline item — either an inbound message or an outbound touchpoint */
interface TimelineItem {
  id: string;
  type: "inbound" | "outbound";
  timestamp: string;
  content: string;
  sender: string;
  channel: string;
  /** For outbound: delivery status */
  status?: string;
  /** For outbound: event types (open, click, etc.) */
  events?: string[];
}

const CHANNEL_FILTERS = ["all", "whatsapp", "telegram", "email", "web"] as const;
type ChannelFilter = (typeof CHANNEL_FILTERS)[number];

const CHANNEL_ICONS: Record<string, React.ReactNode> = {
  whatsapp: <Phone className="w-3 h-3 text-green-500" />,
  telegram: <MessageCircle className="w-3 h-3 text-blue-500" />,
  email: <Mail className="w-3 h-3 text-gray-500" />,
  web: <Globe className="w-3 h-3 text-gray-400" />,
};

export function ChatPanel({ leadId, lead }: ChatPanelProps) {
  const queryClient = useQueryClient();
  const [channelFilter, setChannelFilter] = useState<ChannelFilter>("all");
  const [inputText, setInputText] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  // ─── Fetch inbound messages ───────────────────────────────────────
  const { data: messagesData } = useQuery({
    queryKey: ["leads", leadId, "messages"],
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/messages`);
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: !!leadId,
  });
  const inboundMessages = messagesData?.data ?? messagesData ?? [];

  // ─── Fetch outbound touchpoints ───────────────────────────────────
  const { data: outboundData } = useOutboundTouchpoints(leadId);

  // ─── Merge into unified timeline ──────────────────────────────────
  const timeline = useMemo<TimelineItem[]>(() => {
    const items: TimelineItem[] = [];

    // Inbound messages
    for (const msg of inboundMessages) {
      items.push({
        id: msg.id,
        type: "inbound",
        timestamp: msg.created_at,
        content: msg.content,
        sender: msg.sender,
        channel: msg.channel?.replace("inbound_", "") || "web",
      });
    }

    // Outbound touchpoints
    for (const tp of outboundData?.touchpoints ?? []) {
      items.push({
        id: tp.id,
        type: "outbound",
        timestamp: tp.executed_at || tp.scheduled_at,
        content: tp.step?.subject || `Outbound ${tp.channel} touchpoint`,
        sender: "system",
        channel: tp.channel,
        status: tp.status,
        events: tp.events?.map((e) => e.event_type) ?? [],
      });
    }

    // Sort chronologically
    items.sort(
      (a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    );

    return items;
  }, [inboundMessages, outboundData]);

  // ─── Filter by channel ────────────────────────────────────────────
  const filteredTimeline = useMemo(() => {
    if (channelFilter === "all") return timeline;
    return timeline.filter((item) => item.channel === channelFilter);
  }, [timeline, channelFilter]);

  // ─── Auto-scroll to bottom on new messages ────────────────────────
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [filteredTimeline.length]);

  // ─── Send handler (stub) ──────────────────────────────────────────
  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    // TODO (Executor): wire to actual send endpoint
    await fetch(`/api/leads/${leadId}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        lead_id: leadId,
        content: inputText,
        sender: "human_admin",
        channel: "web",
      }),
    });

    setInputText("");
    queryClient.invalidateQueries({ queryKey: ["leads", leadId, "messages"] });
  };

  return (
    <div className="flex flex-col h-full min-h-0 bg-background">
      {/* ─── Channel Filter Tabs ─────────────────────────────────── */}
      <div className="flex items-center gap-1 px-4 py-2 border-b bg-muted/10 shrink-0">
        {CHANNEL_FILTERS.map((ch) => (
          <Button
            key={ch}
            variant={channelFilter === ch ? "secondary" : "ghost"}
            size="sm"
            className="h-7 text-xs capitalize gap-1"
            onClick={() => setChannelFilter(ch)}
          >
            {ch !== "all" && CHANNEL_ICONS[ch]}
            {ch === "all" ? "Todos" : ch}
          </Button>
        ))}
        <div className="flex-1" />
        <span className="text-[10px] text-muted-foreground">
          {filteredTimeline.length} mensajes
        </span>
      </div>

      {/* ─── Message Feed (70% height scroll area) ───────────────── */}
      <ScrollArea className="flex-1 min-h-0" ref={scrollRef}>
        <div className="space-y-3 p-4 max-w-3xl mx-auto pb-4">
          {filteredTimeline.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-10">
              No hay mensajes en esta conversación.
            </div>
          ) : (
            filteredTimeline.map((item) => (
              <div key={item.id}>
                {item.type === "inbound" ? (
                  /* ── Inbound Message Bubble ── */
                  <div
                    className={cn(
                      "flex w-full",
                      item.sender === "customer"
                        ? "justify-start"
                        : "justify-end"
                    )}
                  >
                    <div
                      className={cn(
                        "max-w-[75%] rounded-xl px-4 py-2 text-sm relative",
                        item.sender === "bot" || item.sender === "ai_agent"
                          ? "bg-blue-600 text-white rounded-br-none"
                          : item.sender === "human_admin"
                            ? "bg-orange-500 text-white rounded-br-none"
                            : "bg-muted text-foreground rounded-bl-none"
                      )}
                    >
                      <div className="flex items-center gap-1.5 mb-0.5">
                        {(item.sender === "bot" ||
                          item.sender === "ai_agent") && (
                          <Bot className="w-3 h-3 opacity-60" />
                        )}
                        {item.sender === "human_admin" && (
                          <User className="w-3 h-3 opacity-60" />
                        )}
                        {CHANNEL_ICONS[item.channel]}
                      </div>
                      <p className="whitespace-pre-wrap">{item.content}</p>
                      <span className="text-[10px] mt-1 block text-right opacity-70">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                ) : (
                  /* ── Outbound Touchpoint Card ── */
                  <div className="flex justify-center">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-violet-500/10 border border-violet-200 dark:border-violet-800 text-xs">
                      <Mail className="w-3 h-3 text-violet-500" />
                      <span className="font-medium text-violet-700 dark:text-violet-300">
                        {item.content}
                      </span>
                      <Badge
                        variant="outline"
                        className="text-[9px] h-4 capitalize"
                      >
                        {item.status}
                      </Badge>
                      {(item.events?.length ?? 0) > 0 && (
                        <span className="text-[10px] text-muted-foreground">
                          {item.events?.join(", ")}
                        </span>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {new Date(item.timestamp).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </ScrollArea>

      {/* ─── Composer (fixed at bottom) ──────────────────────────── */}
      <div className="p-3 border-t bg-card shrink-0">
        <form
          className="flex items-center gap-2 max-w-3xl mx-auto"
          onSubmit={handleSend}
        >
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8 shrink-0">
            <Paperclip className="h-4 w-4" />
          </Button>
          <Input
            className="flex-1 bg-muted/50 border-none focus-visible:ring-1 h-9"
            placeholder="Escribe un mensaje..."
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
          />
          <Button
            type="submit"
            size="icon"
            className="h-8 w-8 shrink-0"
            disabled={!inputText.trim()}
          >
            <Send className="h-4 w-4" />
          </Button>
        </form>
      </div>
    </div>
  );
}
