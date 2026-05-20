/**
 * components/lead-detail/LeadDetail.tsx
 * 
 * ┌─────────────────────────────────────────────────────────────────────┐
 * │  LEAD DETAIL — Master Layout                                       │
 * │                                                                     │
 * │  ┌─────────────────────────────┬───────────────────────────────┐   │
 * │  │                             │  Semantic Summary Panel       │   │
 * │  │                             │  ┌─────────────────────────┐ │   │
 * │  │   CHAT FRAME (70% h)       │  │ AI Headline             │ │   │
 * │  │                             │  │ Signals []              │ │   │
 * │  │   ScrollArea + Messages     │  │ Suggested Action        │ │   │
 * │  │   (inbound + outbound      │  └─────────────────────────┘ │   │
 * │  │    chronological)           │                               │   │
 * │  │                             │  Reactive Fields (SSE)       │   │
 * │  │                             │  ┌─────────────────────────┐ │   │
 * │  │                             │  │ Etapa  │ Valor │ Tags   │ │   │
 * │  │                             │  └─────────────────────────┘ │   │
 * │  │                             │                               │   │
 * │  │                             │  Expediente / Hunter (OSINT) │   │
 * │  │                             │  ┌─────────────────────────┐ │   │
 * │  ├─────────────────────────────┤  │ Web search results      │ │   │
 * │  │  COMPOSER (fixed bottom)    │  │ LinkedIn data           │ │   │
 * │  │  ┌───────────────────────┐  │  │ Company intel           │ │   │
 * │  │  │ Input + Tools bar     │  │  └─────────────────────────┘ │   │
 * │  │  └───────────────────────┘  │                               │   │
 * │  └─────────────────────────────┴───────────────────────────────┘   │
 * └─────────────────────────────────────────────────────────────────────┘
 * 
 * Architecture:
 * - Left column (~65-70%): Chat history + fixed composer at bottom
 * - Right column (~30-35%): Tabbed panel with Semantic Summary, Reactive Fields, Expediente
 * - SSE subscription via useLeadDetailSSE for real-time updates
 * - TanStack Query for all data fetching (no direct Supabase client in components)
 * 
 * ADR References: ADR-112/113 (SSE), ADR-120 (Outbound Tracking)
 */

"use client";

import React from "react";
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from "@/components/ui/resizable";
import { Loader2 } from "lucide-react";

import { useLeadDetail } from "@/hooks/queries/use-lead-detail";
import { useLeadDetailSSE } from "@/hooks/use-lead-detail-sse";

import { ChatPanel } from "./ChatPanel";
import { SemanticPanel } from "./SemanticPanel";
import { LeadDetailHeader } from "./LeadDetailHeader";

interface LeadDetailProps {
  leadId: string;
}

export function LeadDetail({ leadId }: LeadDetailProps) {
  // ─── Data Layer ─────────────────────────────────────────────────────
  const { data: lead, isLoading } = useLeadDetail(leadId);

  // ─── SSE: Real-time updates for this lead ───────────────────────────
  useLeadDetailSSE({ leadId });

  // ─── Loading State ──────────────────────────────────────────────────
  if (isLoading) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="flex h-[calc(100vh-6rem)] items-center justify-center text-muted-foreground">
        Lead no encontrado.
      </div>
    );
  }

  // ─── Render ─────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] w-full overflow-hidden">
      {/* Top Bar: Lead name, status badge, quick actions */}
      <LeadDetailHeader lead={lead} />

      {/* Main Content: Resizable two-column layout */}
      <ResizablePanelGroup
        direction="horizontal"
        className="flex-1 min-h-0 border rounded-b-xl overflow-hidden"
      >
        {/* ─── LEFT: Chat Frame (default ~65%) ─────────────────────── */}
        <ResizablePanel defaultSize={65} minSize={45} maxSize={80}>
          <ChatPanel leadId={leadId} lead={lead} />
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* ─── RIGHT: Semantic + Expediente Panel (default ~35%) ──── */}
        <ResizablePanel defaultSize={35} minSize={20} maxSize={55}>
          <SemanticPanel leadId={leadId} lead={lead} />
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
