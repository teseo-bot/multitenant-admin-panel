# ADR-121: Lead Detail Page — Architecture Blueprint

**Status:** Proposed  
**Date:** 2026-05-06  
**Author:** Builder (sprint subagent)  
**Related:** ADR-112/113 (SSE), ADR-120 (Outbound Tracking), ProspectCanvas, inbox page

---

## Context

The Tenant OS (Teseo-AI-CRM panel, Next.js) needs a dedicated **Lead Detail** page that replaces the current split-screen approach of `ProspectCanvas` + `lead-details-sheet.tsx`. The new page must serve as the single "command center" for a lead — combining chat history, AI summaries, outbound tracking, and OSINT research into a unified view.

### Current State

- `ProspectCanvas.tsx` — bi-zonal layout with chat + tabs (attributes, client, documents). Hard-coded mock data for stepper, billing, etc.
- `lead-details-sheet.tsx` — side sheet with form fields for editing lead metadata. No chat, no AI insights.
- `inbox/page.tsx` — full inbox with SSE, chat, promote-to-pipeline. No outbound context.

### Gaps

1. No unified timeline (inbound + outbound messages interleaved)
2. No AI semantic summary panel
3. No OSINT / Hunter expediente section
4. No SSE subscription for lead-specific real-time updates
5. No reactive fields (Etapa, Valor, Etiquetas) driven by SSE

---

## Architecture

### Route

```
/leads/[id]  →  app/(dashboard)/leads/[id]/page.tsx
```

### Component Tree

```
LeadDetailPage (server component — param extraction)
  └── LeadDetail (client component — orchestrator)
        ├── LeadDetailHeader
        │     └── Lead name, status badge, source icon, ICP score, actions
        │
        └── ResizablePanelGroup (horizontal)
              ├── ChatPanel (default 65%, resizable 45-80%)
              │     ├── Channel filter tabs (All | WhatsApp | Telegram | Email | Web)
              │     ├── ScrollArea — unified timeline (inbound + outbound merged)
              │     │     ├── Inbound MessageBubble (reuses existing pattern)
              │     │     └── Outbound TouchpointCard (inline, centered, violet accent)
              │     └── Composer (fixed at bottom, 📎 input ▶)
              │
              └── SemanticPanel (default 35%, resizable 20-55%)
                    └── Tabs
                          ├── [Resumen IA]
                          │     ├── AI headline
                          │     ├── Semantic signals (sentiment, source badges)
                          │     └── Suggested action
                          │
                          ├── [Datos]
                          │     ├── Etapa (lead.status — reactive via SSE)
                          │     ├── Valor (metadata.deal_value — reactive via SSE)
                          │     ├── Etiquetas (metadata.tags — reactive via SSE)
                          │     ├── ICP Score (progress bar)
                          │     ├── Outbound Enrollments (sequence name, step, status)
                          │     └── Source + Assigned Node
                          │
                          └── [Expediente]
                                ├── OSINT entries (LinkedIn, Crunchbase, Google)
                                └── Manual search trigger
```

### Data Flow

```
                                    ┌──────────────┐
                                    │  Supabase DB  │
                                    │  (pg_notify)  │
                                    └──────┬───────┘
                                           │
                          ┌────────────────┼────────────────┐
                          ▼                ▼                ▼
                  inbox_updates    outbound_updates    lead_changes
                          │                │                │
                          └────────────────┼────────────────┘
                                           ▼
                               ┌─────────────────────┐
                               │  SSE Endpoint        │
                               │  /api/leads/[id]/    │
                               │  stream              │
                               └──────────┬──────────┘
                                          │ EventSource
                                          ▼
                               ┌─────────────────────┐
                               │  useLeadDetailSSE()  │
                               │  (React hook)        │
                               └──────────┬──────────┘
                                          │ invalidateQueries()
                                          ▼
                               ┌─────────────────────┐
                               │  TanStack Query      │
                               │  Cache               │
                               └──────────┬──────────┘
                                          │ re-fetch
                                          ▼
                             React Components re-render
```

### Hooks Created

| Hook | Purpose | Query Key |
|---|---|---|
| `useLeadDetailSSE` | Unified SSE for inbound + outbound + lead changes | N/A (invalidator) |
| `useOutboundSSE` | Outbound-only SSE (reusable elsewhere) | N/A (invalidator) |
| `useOutboundTouchpoints` | Fetch outbound data for a lead | `['outbound', 'touchpoints', leadId]` |
| `useSemanticSummary` | Fetch AI semantic summary | `['leads', leadId, 'semantic-summary']` |
| `useOsintEntries` | Fetch OSINT entries | `['leads', leadId, 'osint']` |

### Types Created

| Type | File | Purpose |
|---|---|---|
| `OutboundSequence` | `types/outbound.ts` | Cadence definition |
| `OutboundSequenceStep` | `types/outbound.ts` | Step within cadence |
| `OutboundEnrollment` | `types/outbound.ts` | Lead ↔ Sequence binding |
| `OutboundTouchpoint` | `types/outbound.ts` | Executed outbound action |
| `OutboundTrackingEvent` | `types/outbound.ts` | Engagement event |
| `LeadSemanticSummary` | `types/outbound.ts` | AI-generated summary |
| `SemanticSignal` | `types/outbound.ts` | Individual AI signal |
| `OsintEntry` | `types/outbound.ts` | Hunter research entry |

---

## What the Executor Must Build

### P0 — Required for basic functionality

1. **API Route: `app/api/leads/[id]/outbound/route.ts`** — Supabase query joining `outbound_enrollments` → `outbound_sequences` → `outbound_touchpoints` → `outbound_tracking_events` for a specific lead.
2. **API Route: `app/api/leads/[id]/stream/route.ts`** — SSE endpoint that multiplexes `inbox_updates` + `outbound_updates` + `lead_changes` pg_notify channels, filtered by `lead_id`.
3. **Run migration** `20260504000000_add_outbound_tracking.sql` against Supabase.

### P1 — Required for AI features

4. **API Route: `app/api/leads/[id]/summary/route.ts`** — Edge function or API route that calls the orchestrator to generate/retrieve a semantic summary.
5. **Orchestrator integration** — The SDR/Hunter agents should write `outbound_touchpoints` rows when they execute actions.

### P2 — Nice to have

6. **API Route: `app/api/leads/[id]/osint/route.ts`** — Either query from DB or trigger the Hunter agent for on-demand OSINT.
7. **`Skeleton` component** import (verify it exists in `components/ui/skeleton.tsx`).
8. **Navigation** — Add `/leads/[id]` link from pipeline kanban cards and inbox chat list.

---

## Consequences

### Positive

- Single, unified view for all lead context — no more switching between inbox, pipeline, and sheets.
- Real-time updates without polling (FinOps friendly).
- Resizable panels adapt to user preference.
- AI insights surface automatically as data accumulates.
- OSINT data gives sales reps competitive intelligence in-context.

### Negative

- More API routes to maintain.
- SSE multiplexing adds backend complexity.
- AI summary generation may add latency on first load (mitigated by `staleTime` in TanStack).

---

## File Manifest

```
NEW FILES:
  supabase/migrations/20260504000000_add_outbound_tracking.sql
  docs/adr/ADR-120_outbound_tracking.md
  docs/adr/ADR-121_lead_detail_architecture.md
  types/outbound.ts
  hooks/use-outbound-sse.ts
  hooks/use-lead-detail-sse.ts
  hooks/queries/use-outbound-touchpoints.ts
  hooks/queries/use-semantic-summary.ts
  hooks/queries/use-osint-entries.ts
  components/lead-detail/LeadDetail.tsx
  components/lead-detail/LeadDetailHeader.tsx
  components/lead-detail/ChatPanel.tsx
  components/lead-detail/SemanticPanel.tsx
  components/lead-detail/index.ts
  app/(dashboard)/leads/[id]/page.tsx

EXISTING FILES REFERENCED (not modified):
  components/command-center/ProspectCanvas.tsx
  components/command-center/MessageBubble.tsx
  components/command-center/OmnichannelComposer.tsx
  components/command-center/lead-details-sheet.tsx
  hooks/queries/use-lead-detail.ts
  hooks/queries/use-lead-messages.ts
  stores/command-center-store.ts
  types/lead.ts
  lib/query-keys.ts
```
