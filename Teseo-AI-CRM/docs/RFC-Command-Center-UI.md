# RFC-016: Arquitectura UI del Command Center — Inbox Visual + Kanban In-House

| Campo | Valor |
|---|---|
| **Autor** | Builder (Planificador / Arquitecto Staff) — Escuadrón Teseo |
| **Fecha** | 2026-04-20 |
| **Estado** | Draft — **v2.0 (Corrección post-auditoría Learner)** |
| **Componente** | `crm-agentico-panel` → Route Group `(command-center)` |
| **Stack** | Next.js 14.2 (App Router), TypeScript 5.x, Tailwind CSS 3.4, Shadcn/UI (base-nova), **TanStack Query v5** (Server State), **Zustand 5** (Client-only UI State) |
| **Dependencias Doc** | RFC-015 (Arquitectura Frontend), ADR-100 (Mission Control), ADR-105 (Multi-Agent Config), ADR-109 (Desacoplamiento ERP), RFC-012 (UX Pipelines & HITL), **`2026-04-07-tanstack-query-migration.md`** (TeseoKDB — Migración a TanStack Query) |

---

## Changelog

| Versión | Fecha | Cambio |
|---|---|---|
| v1.0 | 2026-04-20 | Draft original |
| **v2.0** | **2026-04-20** | **Corrección post-auditoría Learner (FAIL).** Erradicado Zustand como caché de Server State. Todo Server State migrado a TanStack Query v5 (`useQuery`, `useMutation`, `queryClient.setQueryData`). Zustand reducido exclusivamente a Client-only UI State (filtros locales, selección activa). Secciones 6, 7, 8, 10, 13, 15 reescritas. Árbol de archivos (§3.1) actualizado. |

---

## 1. Resumen Ejecutivo

Este RFC define la arquitectura de componentes, contratos de datos, flujo de estado y WBS (Work Breakdown Structure) para el módulo **Command Center** del `crm-agentico-panel` (Tenant OS). El módulo se compone de dos sub-vistas principales:

1. **Inbox Visual** — Bandeja split-pane de conversaciones omnicanal con streaming SSE, controles de handoff y diferenciación visual por agente/humano/lead.
2. **Kanban In-House** — Tablero de seguimiento de leads con columnas configurables, drag-and-drop optimista y sincronización con el PostgreSQL privado del Tenant (Cloud SQL, **no** Supabase — ref. ADR-109).

### Principio Rector de Estado (ref. `2026-04-07-tanstack-query-migration.md`)

> **TanStack Query** es la única capa autorizada para Server State (fetch, caché, sincronización, mutaciones).
> **Zustand** se limita a Client-only UI State (selección activa, drafts de UI, filtros efímeros que no provienen del servidor).
> Los eventos SSE/WebSocket se inyectan al caché de TanStack Query vía `queryClient.setQueryData` / `queryClient.invalidateQueries`. Nunca a un store de Zustand.

El documento es consumible por el **Ejecutor** como especificación de implementación directa.

---

## 2. Estado Actual del Scaffold

El scaffold existente tiene la siguiente estructura funcional:

| Elemento | Estado | Notas |
|---|---|---|
| `app/(command-center)/inbox/layout.tsx` | ✅ Existe | `ResizablePanelGroup` con slot `@detail` (Parallel Route). Funcional. |
| `app/(command-center)/inbox/page.tsx` | ⚠️ Dummy | Lista hardcoded de 3 conversaciones. Sin tipado, sin filtros, sin badges de estado. |
| `app/(command-center)/inbox/@detail/` | ⚠️ Parcial | Existe `default.tsx` y `[id]/page.tsx` como placeholders. Sin thread de mensajes. |
| `app/(command-center)/kanban/` | ❌ No existe | No hay ruta, componente ni queries. |
| `components/layout/app-sidebar.tsx` | ✅ Existe | Tiene link a `/inbox`. Falta link a Kanban, iconos por módulo y badge de unread. |
| `components/ui/` | ✅ Parcial | `button`, `input`, `resizable`, `scroll-area`, `separator`, `sheet`, `sidebar`, `skeleton`, `tooltip`. Faltan: `badge`, `tabs`, `dropdown-menu`, `dialog`, `avatar`, `card`, `select`. |
| Root `layout.tsx` | ⚠️ Plano | Sidebar global sin Route Group `(dashboard)` intermedio. Sin `(auth)` segregado. Auth no implementado. |
| TanStack Query Provider | ❌ No existe | Falta `QueryClientProvider` en el árbol de componentes. |
| `lib/langgraph/` | ❌ No existe | Sin cliente HTTP ni parser SSE. |
| `types/` | ❌ No existe | Sin interfaces tipadas de dominio. |

---

## 3. Arquitectura de Componentes

### 3.1 Árbol de Archivos Target (Scope de este RFC)

Sólo se lista lo que el Ejecutor debe crear o modificar. Archivos existentes marcados con `[M]` (Modificar).

```
crm-agentico-panel/
├── app/
│   ├── (command-center)/
│   │   ├── layout.tsx                        [NEW] Shell del módulo (tabs Inbox/Kanban + topbar)
│   │   ├── page.tsx                          [NEW] Redirect → /inbox
│   │   │
│   │   ├── inbox/
│   │   │   ├── layout.tsx                    [M]   Mantener ResizablePanel, recibir @detail slot
│   │   │   ├── page.tsx                      [M]   Reemplazar dummy → InboxList server-prefetched
│   │   │   ├── loading.tsx                   [NEW] Skeleton de lista
│   │   │   └── @detail/
│   │   │       ├── default.tsx               [M]   Empty state con ilustración
│   │   │       ├── page.tsx                  [M]   Empty state (sin selección)
│   │   │       └── [threadId]/
│   │   │           ├── page.tsx              [NEW] ConversationThread + HandoffControls
│   │   │           └── loading.tsx           [NEW] Skeleton de thread
│   │   │
│   │   └── kanban/
│   │       ├── page.tsx                      [NEW] KanbanBoard (client component)
│   │       └── loading.tsx                   [NEW] Skeleton columnar
│   │
│   ├── providers.tsx                         [NEW] QueryClientProvider wrapper ("use client")
│   └── layout.tsx                            [M]   Wrap children con <Providers> (§3.2)
│
├── components/
│   ├── command-center/
│   │   ├── inbox-list.tsx                    [NEW] Lista filtrable de threads
│   │   ├── inbox-list-item.tsx               [NEW] Card de conversación con badge
│   │   ├── inbox-filters.tsx                 [NEW] Barra de filtros (canal, estado, agente)
│   │   ├── conversation-thread.tsx           [NEW] Hilo de mensajes con SSE streaming
│   │   ├── message-bubble.tsx                [NEW] Burbuja individual (agent/human/lead)
│   │   ├── handoff-controls.tsx              [NEW] Panel de acciones (Take Over, Return, etc.)
│   │   ├── thread-header.tsx                 [NEW] Header del thread (lead info + estado)
│   │   ├── kanban-board.tsx                  [NEW] Tablero con columnas D&D
│   │   ├── kanban-column.tsx                 [NEW] Columna individual con droppable
│   │   ├── kanban-card.tsx                   [NEW] Card de lead draggable
│   │   └── kanban-filters.tsx                [NEW] Filtros superiores del Kanban
│   ├── shared/
│   │   ├── topbar.tsx                        [NEW] Barra superior con breadcrumbs + search
│   │   ├── empty-state.tsx                   [NEW] Componente reutilizable de estado vacío
│   │   └── channel-badge.tsx                 [NEW] Badge de canal (WhatsApp/Email/LinkedIn/Web)
│   └── layout/
│       └── app-sidebar.tsx                   [M]   Agregar sección Kanban + unread badge
│
├── lib/
│   ├── query-client.ts                       [NEW] Configuración singleton de QueryClient
│   ├── langgraph/
│   │   ├── client.ts                         [NEW] HTTP client → LangGraph Orchestrator API
│   │   ├── events.ts                         [NEW] SSE parser + tipo de eventos
│   │   └── types.ts                          [NEW] AgentState, ThreadState, RunStatus
│   └── api/
│       ├── conversations.ts                  [NEW] Query functions (getThreads, getThread)
│       └── leads.ts                          [NEW] Query functions (getLeads, patchLead)
│
├── hooks/
│   ├── queries/
│   │   ├── use-threads.ts                    [NEW] useQuery wrapper → threads list
│   │   ├── use-thread-messages.ts            [NEW] useQuery wrapper → messages de un thread
│   │   └── use-leads.ts                      [NEW] useQuery wrapper → leads (kanban)
│   ├── mutations/
│   │   ├── use-handoff-mutation.ts           [NEW] useMutation → handoff action
│   │   └── use-move-lead-mutation.ts         [NEW] useMutation → D&D stage change (optimistic)
│   ├── use-realtime-thread.ts                [NEW] SSE hook → inyecta a queryClient
│   └── use-sse-sync.ts                       [NEW] SSE global → sync threads list cache
│
├── stores/
│   ├── inbox-ui-store.ts                     [NEW] SOLO Client UI State (filtros, selección)
│   └── kanban-ui-store.ts                    [NEW] SOLO Client UI State (filtros locales)
│
└── types/
    ├── conversation.ts                       [NEW] ThreadSummary, Message, Channel, HandoffAction
    ├── lead.ts                               [NEW] Lead, KanbanColumn, LeadStage
    └── agent.ts                              [NEW] AgentRole, AgentAction
```

### 3.2 Nota sobre Root Layout y QueryClientProvider

El `layout.tsx` raíz actual aplica `SidebarProvider` + `AppSidebar` globalmente. RFC-015 dicta segregar en `(auth)` y `(dashboard)` Route Groups. **Este RFC no ejecuta esa migración completa**, pero el Ejecutor debe:

1. Crear `app/providers.tsx` como `"use client"` component que wrappea `QueryClientProvider` (importando el singleton de `lib/query-client.ts`).
2. Modificar `app/layout.tsx` para envolver `{children}` con `<Providers>`.
3. Crear `app/(command-center)/layout.tsx` como wrapper del módulo (tabs de navegación Inbox ↔ Kanban + topbar local).
4. **No romper** el root layout existente; la migración a `(dashboard)/layout.tsx` es tarea del Sprint de Auth (fuera de alcance).

**`lib/query-client.ts` — Configuración del QueryClient:**

```typescript
import { QueryClient } from '@tanstack/react-query';

function makeQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30 * 1000,           // 30s — datos de inbox se consideran frescos
        refetchOnWindowFocus: true,      // Re-sync al volver a la tab
        retry: 2,
      },
    },
  });
}

// Singleton para SSR (evita recrear en cada request server-side)
let browserQueryClient: QueryClient | undefined;

export function getQueryClient() {
  if (typeof window === 'undefined') {
    return makeQueryClient();            // Server: siempre nuevo
  }
  if (!browserQueryClient) {
    browserQueryClient = makeQueryClient();
  }
  return browserQueryClient;             // Browser: singleton
}
```

---

## 4. Contratos de Datos (TypeScript Interfaces)

### 4.1 `types/conversation.ts`

```typescript
export type Channel = 'whatsapp' | 'email' | 'linkedin' | 'webchat';

export type ThreadStatus =
  | 'agent_active'
  | 'pending_handoff'
  | 'human_active'
  | 'resolved';

export type AgentRole = 'gatekeeper' | 'sdr' | 'hunter' | 'l1_support';

export interface ThreadSummary {
  threadId: string;
  channel: Channel;
  status: ThreadStatus;
  leadId: string;
  leadName: string;
  leadCompany: string;
  assignedAgent: AgentRole;
  assignedHuman: string | null;
  lastMessagePreview: string;
  lastMessageAt: string;          // ISO 8601
  unreadCount: number;
}

export type MessageSender = 'agent' | 'human_operator' | 'lead';

export interface Message {
  id: string;
  threadId: string;
  sender: MessageSender;
  senderName: string;
  content: string;
  channel: Channel;
  timestamp: string;              // ISO 8601
  metadata?: {
    agentRole?: AgentRole;
    confidence?: number;
    toolCalls?: string[];
  };
}

export type HandoffAction =
  | 'take_over'
  | 'return_to_agent'
  | 'resolve'
  | 'escalate';

export interface HandoffPayload {
  threadId: string;
  action: HandoffAction;
  operatorId: string;
  note?: string;
}
```

### 4.2 `types/lead.ts`

```typescript
export type LeadStage =
  | 'new'
  | 'contacted'
  | 'qualified'
  | 'proposal'
  | 'negotiation'
  | 'closed_won'
  | 'closed_lost';

export interface Lead {
  id: string;
  name: string;
  company: string;
  email: string | null;
  phone: string | null;
  stage: LeadStage;
  estimatedValue: number | null;   // MXN o USD
  currency: 'MXN' | 'USD';
  assignedAgent: AgentRole | null;
  channel: Channel;
  lastContactAt: string | null;
  createdAt: string;
  tags: string[];
}

export interface KanbanColumn {
  id: LeadStage;
  title: string;
  leads: Lead[];
  wipLimit?: number;              // Límite WIP opcional
}
```

### 4.3 `types/agent.ts`

```typescript
export interface AgentAction {
  type: 'message' | 'tool_call' | 'handoff_request' | 'state_update';
  agentRole: AgentRole;
  payload: Record<string, unknown>;
  timestamp: string;
}
```

---

## 5. Especificación de Componentes

### 5.1 Inbox Visual

#### `inbox-list.tsx` (Server Component wrapper → Client child)

- **Renderizado:** Server Component que hace `prefetchQuery` en el server usando `getQueryClient()` y envuelve al child en `<HydrationBoundary dehydratedState={dehydrate(queryClient)}>`.
- **Delegación:** Pasa control a `<InboxListClient>` (client component) que consume `useThreads()` (TanStack Query hook). Los datos llegan pre-hidratados del server; TanStack Query los adopta automáticamente en el caché del browser.
- **Filtros:** Barra superior con:
  - **Canal:** Dropdown multi-select (WhatsApp, Email, LinkedIn, Web).
  - **Estado:** Tabs tipo pill: `All | Agent Active | Pending Handoff | Human Active | Resolved`.
  - **Búsqueda:** Input de texto que filtra por `leadName` o `leadCompany`.
- **Nota sobre filtros:** Los filtros se almacenan en `inbox-ui-store` (Zustand, Client-only UI State). El filtrado se aplica client-side sobre los datos del caché de TanStack Query (no se re-fetcha por filtro de UI).
- **Sorting:** Por defecto `lastMessageAt DESC` (más reciente arriba). Click en header alterna.
- **Unread indicator:** Punto azul + badge numérico en items con `unreadCount > 0`.

#### `inbox-list-item.tsx` (Client Component)

- **Visual:** Card con:
  - Avatar con inicial de `leadCompany`.
  - `leadName` (bold) + `leadCompany` (muted).
  - `lastMessagePreview` truncado a 80 chars.
  - `ChannelBadge` (ícono + color por canal).
  - Badge de estado: verde (`agent_active`), amarillo (`pending_handoff`), azul (`human_active`), gris (`resolved`).
  - Timestamp relativo (`hace 5 min`).
- **Interacción:** Click navega a `/inbox/{threadId}` vía `next/link` — activa el slot `@detail`.
- **Active state:** Highlight con `bg-accent` cuando `threadId` coincide con la selección actual (leído de `inbox-ui-store`).

#### `conversation-thread.tsx` (Client Component — `"use client"`)

- **Responsabilidad:** Renderiza el hilo de mensajes consumiendo `useThreadMessages(threadId)` (TanStack Query) y se suscribe a SSE para nuevos mensajes en tiempo real vía `useRealtimeThread(threadId)`.
- **Datos:** `useThreadMessages` hace el fetch inicial. `useRealtimeThread` inyecta nuevos mensajes al caché TQ vía `queryClient.setQueryData`.
- **Mensajes:** Lista scrollable de `<MessageBubble>` con auto-scroll al fondo en nuevo mensaje.
- **Diferenciación visual:**

| Sender | Alineación | Color | Indicador |
|---|---|---|---|
| `lead` | Izquierda | `bg-muted` | Avatar con inicial |
| `agent` | Derecha | `bg-primary/10` | Ícono de robot + rol del agente |
| `human_operator` | Derecha | `bg-blue-500/10` | Avatar del operador |

- **Streaming:** Mensajes del agente se renderizan con efecto typewriter (token por token desde SSE).

#### `handoff-controls.tsx` (Client Component)

- **Posición:** Footer fijo del panel `@detail`.
- **Controles (contextual por `thread.status`):**

| Estado actual | Acciones disponibles |
|---|---|
| `agent_active` | **Take Over** (tomar control) · **Resolve** |
| `pending_handoff` | **Take Over** (prioridad visual: botón primario) · **Return to Agent** |
| `human_active` | **Return to Agent** · **Resolve** · **Escalate** |
| `resolved` | *Solo lectura — badge "Resolved"* |

- **Confirm dialog:** Acciones destructivas (`Resolve`, `Escalate`) requieren `Dialog` de confirmación con textarea para nota.
- **Mutación:** `useHandoffMutation()` (TanStack Query `useMutation`) ejecuta `POST /api/conversations/{threadId}/handoff` con `HandoffPayload`.
- **Optimistic Update:** El `onMutate` de `useHandoffMutation` aplica `queryClient.setQueryData` para actualizar `thread.status` instantáneamente en el caché de `['threads']`. El `onError` hace rollback restaurando el snapshot previo del caché. El `onSettled` ejecuta `queryClient.invalidateQueries({ queryKey: ['threads'] })` para re-sincronizar.

#### `thread-header.tsx` (Client Component)

- **Contenido:** Nombre del lead, empresa, canal, agente asignado, estado actual.
- **Acciones secundarias:** Botón "View Lead" que navega al Kanban filtrado por ese lead.

### 5.2 Kanban In-House

#### `kanban-board.tsx` (Client Component — `"use client"`)

- **Dependencia:** `@dnd-kit/core` + `@dnd-kit/sortable` para drag-and-drop.
- **Columnas default:** `New → Contacted → Qualified → Proposal → Negotiation → Closed Won / Closed Lost`.
- **Layout:** Scroll horizontal con columnas de ancho fijo (`w-[300px]`), height full viewport.
- **Header por columna:** Título + count de leads + indicador WIP (si `leads.length > wipLimit`, border se pone rojo).
- **Fuente de datos:** `useLeads()` (TanStack Query) — server-prefetched con `<HydrationBoundary>` desde el Server Component parent. Los filtros locales se aplican client-side desde `kanban-ui-store`.

#### `kanban-column.tsx` (Client Component)

- **Droppable zone:** Acepta drops de `KanbanCard`. Visual feedback: border punteado azul on dragover.
- **Scrollable:** `ScrollArea` interna si las cards exceden la altura.

#### `kanban-card.tsx` (Client Component)

- **Draggable:** Cada card se puede arrastrar entre columnas.
- **Contenido:**
  - Avatar (inicial) + `lead.name` + `lead.company`.
  - `estimatedValue` formateado (ej: `$50,000 MXN`).
  - `ChannelBadge` del canal de origen.
  - Tag del agente asignado.
  - Dot de último contacto (verde < 24h, amarillo < 72h, rojo > 72h).
- **Click:** Abre `Sheet` (slide-over derecho) con detalle expandido del lead (sin navegación).

#### `kanban-filters.tsx` (Client Component)

- **Filtros:** Agente asignado, rango de valor, canal, tags.
- **Persistencia:** Filtros se guardan en `kanban-ui-store` (Zustand) con middleware `persist` → `sessionStorage`. Esto es Client-only UI State (no datos del servidor).

### 5.3 Componentes Compartidos

#### `channel-badge.tsx`

- Recibe `channel: Channel`.
- Mapeo visual:

| Canal | Ícono | Color |
|---|---|---|
| `whatsapp` | `MessageCircle` (lucide) | `bg-green-500/15 text-green-600` |
| `email` | `Mail` | `bg-blue-500/15 text-blue-600` |
| `linkedin` | `Linkedin` | `bg-sky-500/15 text-sky-600` |
| `webchat` | `Globe` | `bg-purple-500/15 text-purple-600` |

#### `empty-state.tsx`

- Props: `icon: LucideIcon`, `title: string`, `description: string`, `action?: { label, onClick }`.
- Usado en: `@detail/default.tsx` ("Selecciona una conversación"), Kanban sin leads, búsqueda sin resultados.

---

## 6. Estado: TanStack Query (Server State) + Zustand (Client UI State)

### 6.1 Query Keys — Convención

```typescript
// lib/query-keys.ts (opcional, pero recomendado para DRY)
export const queryKeys = {
  threads: {
    all:    ['threads'] as const,
    detail: (id: string) => ['threads', id] as const,
    messages: (id: string) => ['threads', id, 'messages'] as const,
  },
  leads: {
    all:    ['leads'] as const,
    detail: (id: string) => ['leads', id] as const,
  },
} as const;
```

### 6.2 Query Hooks (Server State — TanStack Query)

#### `hooks/queries/use-threads.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getThreads } from '@/lib/api/conversations';
import type { ThreadSummary } from '@/types/conversation';

export function useThreads() {
  return useQuery<ThreadSummary[]>({
    queryKey: queryKeys.threads.all,
    queryFn: getThreads,
    staleTime: 30_000,                     // 30s — SSE mantiene fresco
    refetchOnWindowFocus: true,
  });
}
```

#### `hooks/queries/use-thread-messages.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getThreadMessages } from '@/lib/api/conversations';
import type { Message } from '@/types/conversation';

export function useThreadMessages(threadId: string) {
  return useQuery<Message[]>({
    queryKey: queryKeys.threads.messages(threadId),
    queryFn: () => getThreadMessages(threadId),
    enabled: !!threadId,
  });
}
```

#### `hooks/queries/use-leads.ts`

```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { getLeads } from '@/lib/api/leads';
import type { Lead } from '@/types/lead';

export function useLeads() {
  return useQuery<Lead[]>({
    queryKey: queryKeys.leads.all,
    queryFn: getLeads,
  });
}
```

### 6.3 Mutation Hooks (Server State — TanStack Query)

#### `hooks/mutations/use-handoff-mutation.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { postHandoff } from '@/lib/api/conversations';
import type { HandoffPayload, ThreadSummary, ThreadStatus } from '@/types/conversation';

export function useHandoffMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (payload: HandoffPayload) => postHandoff(payload),

    onMutate: async (payload) => {
      // 1. Cancel outgoing refetches
      await queryClient.cancelQueries({ queryKey: queryKeys.threads.all });

      // 2. Snapshot previous value
      const previousThreads = queryClient.getQueryData<ThreadSummary[]>(
        queryKeys.threads.all
      );

      // 3. Optimistically update cache
      const statusMap: Record<string, ThreadStatus> = {
        take_over: 'human_active',
        return_to_agent: 'agent_active',
        resolve: 'resolved',
        escalate: 'pending_handoff',
      };

      queryClient.setQueryData<ThreadSummary[]>(
        queryKeys.threads.all,
        (old) =>
          old?.map((t) =>
            t.threadId === payload.threadId
              ? { ...t, status: statusMap[payload.action] ?? t.status }
              : t
          ) ?? []
      );

      return { previousThreads };
    },

    onError: (_err, _payload, context) => {
      // Rollback to snapshot
      if (context?.previousThreads) {
        queryClient.setQueryData(queryKeys.threads.all, context.previousThreads);
      }
    },

    onSettled: () => {
      // Re-sync with server
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    },
  });
}
```

#### `hooks/mutations/use-move-lead-mutation.ts`

```typescript
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import { patchLeadStage } from '@/lib/api/leads';
import type { Lead, LeadStage } from '@/types/lead';

interface MoveLeadVars {
  leadId: string;
  toStage: LeadStage;
}

export function useMoveLeadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ leadId, toStage }: MoveLeadVars) =>
      patchLeadStage(leadId, toStage),

    onMutate: async ({ leadId, toStage }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.leads.all });

      const previousLeads = queryClient.getQueryData<Lead[]>(
        queryKeys.leads.all
      );

      // Optimistic: move lead to new stage
      queryClient.setQueryData<Lead[]>(
        queryKeys.leads.all,
        (old) =>
          old?.map((lead) =>
            lead.id === leadId ? { ...lead, stage: toStage } : lead
          ) ?? []
      );

      return { previousLeads };
    },

    onError: (_err, _vars, context) => {
      if (context?.previousLeads) {
        queryClient.setQueryData(queryKeys.leads.all, context.previousLeads);
      }
      // Toast de error (el componente que llama maneja esto)
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}
```

### 6.4 SSE Hooks (Bridge SSE → TanStack Query Cache)

#### `hooks/use-realtime-thread.ts`

Conecta un `EventSource` al stream de un thread específico e inyecta mensajes nuevos directamente al caché de TanStack Query.

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { Message, ThreadSummary } from '@/types/conversation';

export function useRealtimeThread(threadId: string) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!threadId) return;

    const es = new EventSource(
      `/api/conversations/stream?threadId=${threadId}`
    );

    es.addEventListener('message_new', (e) => {
      const message: Message = JSON.parse(e.data);

      // Append message to thread messages cache
      queryClient.setQueryData<Message[]>(
        queryKeys.threads.messages(threadId),
        (old) => [...(old ?? []), message]
      );

      // Update lastMessagePreview in threads list cache
      queryClient.setQueryData<ThreadSummary[]>(
        queryKeys.threads.all,
        (old) =>
          old?.map((t) =>
            t.threadId === threadId
              ? {
                  ...t,
                  lastMessagePreview: message.content.slice(0, 80),
                  lastMessageAt: message.timestamp,
                }
              : t
          ) ?? []
      );
    });

    es.addEventListener('thread_update', (e) => {
      const update: Partial<ThreadSummary> & { threadId: string } =
        JSON.parse(e.data);

      queryClient.setQueryData<ThreadSummary[]>(
        queryKeys.threads.all,
        (old) =>
          old?.map((t) =>
            t.threadId === update.threadId ? { ...t, ...update } : t
          ) ?? []
      );
    });

    es.addEventListener('agent_action', (_e) => {
      // UI indicator: "Agent is typing..." — manejado localmente por el componente
      // No requiere mutación de caché
    });

    es.addEventListener('handoff_status', (e) => {
      const { threadId: tid, status, assignedHuman } = JSON.parse(e.data);
      queryClient.setQueryData<ThreadSummary[]>(
        queryKeys.threads.all,
        (old) =>
          old?.map((t) =>
            t.threadId === tid ? { ...t, status, assignedHuman } : t
          ) ?? []
      );
    });

    es.onerror = () => {
      // Reconnect automático (EventSource lo hace nativamente)
      // Opcionalmente: invalidate para re-sync completo después de reconnect
      queryClient.invalidateQueries({
        queryKey: queryKeys.threads.messages(threadId),
      });
    };

    return () => es.close();
  }, [threadId, queryClient]);
}
```

#### `hooks/use-sse-sync.ts`

Hook global para sincronización de la lista de threads (montado en `(command-center)/layout.tsx`). Escucha un stream global que emite actualizaciones de cualquier thread.

```typescript
import { useEffect } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { ThreadSummary } from '@/types/conversation';

export function useSseSync() {
  const queryClient = useQueryClient();

  useEffect(() => {
    const es = new EventSource('/api/conversations/stream/global');

    es.addEventListener('thread_update', (e) => {
      const update: Partial<ThreadSummary> & { threadId: string } =
        JSON.parse(e.data);

      queryClient.setQueryData<ThreadSummary[]>(
        queryKeys.threads.all,
        (old) => {
          if (!old) return old;
          const exists = old.some((t) => t.threadId === update.threadId);
          if (exists) {
            return old.map((t) =>
              t.threadId === update.threadId ? { ...t, ...update } : t
            );
          }
          // Nuevo thread: invalidar para fetch completo
          queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
          return old;
        }
      );
    });

    es.onerror = () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.threads.all });
    };

    return () => es.close();
  }, [queryClient]);
}
```

### 6.5 Zustand Stores (Client-only UI State — Sin datos del servidor)

#### `stores/inbox-ui-store.ts`

```typescript
import { create } from 'zustand';
import type { Channel, ThreadStatus } from '@/types/conversation';

interface InboxUIState {
  activeThreadId: string | null;
  filters: {
    channels: Channel[];
    status: ThreadStatus | 'all';
    search: string;
  };
  // Actions
  setActiveThread: (id: string | null) => void;
  setFilter: <K extends keyof InboxUIState['filters']>(
    key: K,
    value: InboxUIState['filters'][K]
  ) => void;
  resetFilters: () => void;
}

const defaultFilters: InboxUIState['filters'] = {
  channels: [],
  status: 'all',
  search: '',
};

export const useInboxUIStore = create<InboxUIState>((set) => ({
  activeThreadId: null,
  filters: { ...defaultFilters },

  setActiveThread: (id) => set({ activeThreadId: id }),
  setFilter: (key, value) =>
    set((state) => ({
      filters: { ...state.filters, [key]: value },
    })),
  resetFilters: () => set({ filters: { ...defaultFilters } }),
}));
```

#### `stores/kanban-ui-store.ts`

```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { AgentRole, Channel } from '@/types/conversation';

interface KanbanUIState {
  filters: {
    agent: AgentRole | 'all';
    minValue: number | null;
    maxValue: number | null;
    channels: Channel[];
    tags: string[];
  };
  setFilter: <K extends keyof KanbanUIState['filters']>(
    key: K,
    value: KanbanUIState['filters'][K]
  ) => void;
  resetFilters: () => void;
}

const defaultFilters: KanbanUIState['filters'] = {
  agent: 'all',
  minValue: null,
  maxValue: null,
  channels: [],
  tags: [],
};

export const useKanbanUIStore = create<KanbanUIState>()(
  persist(
    (set) => ({
      filters: { ...defaultFilters },
      setFilter: (key, value) =>
        set((state) => ({
          filters: { ...state.filters, [key]: value },
        })),
      resetFilters: () => set({ filters: { ...defaultFilters } }),
    }),
    {
      name: 'kanban-ui-filters',
      storage: createJSONStorage(() => sessionStorage),
    }
  )
);
```

### 6.6 Diagrama de Responsabilidades

```
┌─────────────────────────────────────────────────────────┐
│                   TanStack Query v5                      │
│                  (Server State Layer)                     │
│                                                          │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │ useThreads  │  │ useLeads     │  │ useThread     │  │
│  │ (queryFn)   │  │ (queryFn)    │  │ Messages      │  │
│  └──────┬──────┘  └──────┬───────┘  └──────┬────────┘  │
│         │                │                  │           │
│  ┌──────┴──────────────┴─────────────────┴──────────┐  │
│  │          queryClient cache (in-memory)            │  │
│  │    ← setQueryData (SSE events bridge here)        │  │
│  │    ← invalidateQueries (on reconnect/settle)      │  │
│  └───────────────────────────────────────────────────┘  │
│                                                          │
│  ┌─────────────────┐   ┌────────────────────┐          │
│  │ useHandoff      │   │ useMoveLeadMutation│          │
│  │ Mutation        │   │ (optimistic D&D)   │          │
│  │ (optimistic)    │   │                    │          │
│  └─────────────────┘   └────────────────────┘          │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│                    Zustand (Stores)                       │
│              (Client-only UI State Layer)                 │
│                                                          │
│  ┌─────────────────┐   ┌────────────────────┐          │
│  │ inbox-ui-store  │   │ kanban-ui-store    │          │
│  │ • activeThread  │   │ • filters (local)  │          │
│  │ • filters (UI)  │   │   persisted →      │          │
│  │ • search text   │   │   sessionStorage   │          │
│  └─────────────────┘   └────────────────────┘          │
│                                                          │
│  ⛔ NO server data here. No threads. No leads.           │
│     No messages. No mutation results.                    │
└─────────────────────────────────────────────────────────┘
```

---

## 7. Flujos de Datos Críticos

### 7.1 SSE — Inbox en Tiempo Real (via TanStack Query Cache)

```
┌────────────────┐    GET /api/conversations/stream?threadId=X     ┌─────────────────────┐
│  Browser        │ ─────────────────────────────────────────────→ │  Next.js Route       │
│  (EventSource)  │                                                │  Handler (Edge)      │
│                 │ ←─────── event: message_new ──────────────────│                      │
│                 │ ←─────── event: thread_update ────────────────│  ↕ Proxy to          │
│                 │ ←─────── event: agent_action ─────────────────│  LangGraph           │
│                 │ ←─────── event: handoff_status ───────────────│  /threads/X/stream   │
└───────┬────────┘                                                └─────────────────────┘
        │
        ▼
┌────────────────────────────────────────────────────────────┐
│  useRealtimeThread(threadId) hook                          │
│                                                            │
│  message_new →                                             │
│    queryClient.setQueryData(['threads', id, 'messages'],   │
│      (old) => [...old, newMessage])                        │
│    queryClient.setQueryData(['threads'],                   │
│      (old) => updatePreview(old, id, newMessage))          │
│                                                            │
│  thread_update →                                           │
│    queryClient.setQueryData(['threads'],                   │
│      (old) => mergeUpdate(old, update))                    │
│                                                            │
│  handoff_status →                                          │
│    queryClient.setQueryData(['threads'],                   │
│      (old) => updateStatus(old, tid, status))              │
│                                                            │
│  onerror (disconnect) →                                    │
│    queryClient.invalidateQueries(['threads', id, 'messages']) │
└────────────────────────────────────────────────────────────┘
```

**Eventos SSE definidos:**

| Evento | Payload | Acción en UI |
|---|---|---|
| `message_new` | `Message` | `setQueryData` → append al caché de mensajes + update preview en lista |
| `thread_update` | `Partial<ThreadSummary>` | `setQueryData` → merge parcial en caché de `['threads']` |
| `agent_action` | `AgentAction` | Indicador local "Agent is typing..." (no muta caché) |
| `handoff_status` | `{ threadId, status, assignedHuman }` | `setQueryData` → actualizar estado en caché de `['threads']` |

### 7.2 Server-Side Prefetch + Hydration (Inbox)

```
1. Server Component: inbox/page.tsx
   ├── const queryClient = getQueryClient()
   ├── await queryClient.prefetchQuery({
   │     queryKey: ['threads'],
   │     queryFn: getThreads,
   │   })
   └── return (
         <HydrationBoundary state={dehydrate(queryClient)}>
           <InboxListClient />     ← "use client"
         </HydrationBoundary>
       )

2. Browser: InboxListClient mounts
   ├── const { data: threads } = useThreads()   ← data ya disponible (hydrated)
   ├── const { filters } = useInboxUIStore()     ← client UI state
   └── renders filtered threads (client-side filter over TQ cache)
```

### 7.3 Kanban D&D — Mutación Optimista (via useMutation)

```
1. User drags card "Acme Corp" from "Contacted" → "Qualified"

2. Component calls: moveLeadMutation.mutate({ leadId: 'acme-1', toStage: 'qualified' })

3. useMoveLeadMutation.onMutate:
   a. cancelQueries(['leads'])
   b. snapshot = queryClient.getQueryData(['leads'])
   c. queryClient.setQueryData(['leads'],
        (old) => old.map(l => l.id === 'acme-1' ? {...l, stage: 'qualified'} : l))
   d. return { previousLeads: snapshot }              ← UI ya refleja el cambio

4. mutationFn: PATCH /api/leads/acme-1  { stage: "qualified" }

5a. 200 OK → onSettled → invalidateQueries(['leads'])  ← re-sync silencioso
5b. 4xx/5xx → onError:
    → queryClient.setQueryData(['leads'], context.previousLeads)  ← ROLLBACK
    → toast.error("No se pudo mover el lead. Intenta de nuevo.")
```

---

## 8. Dependencias de Paquetes a Instalar

El Ejecutor debe instalar los siguientes paquetes **ausentes** en el scaffold actual:

```bash
# TanStack Query v5 — Server State management (OBLIGATORIO)
npm install @tanstack/react-query @tanstack/react-query-devtools

# Drag-and-drop para Kanban
npm install @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities

# Tabla avanzada (para uso futuro en filtros/sorting de inbox si se tabula)
npm install @tanstack/react-table

# Forms + validación (handoff dialog, kanban filters)
npm install react-hook-form zod @hookform/resolvers
```

**Shadcn/UI components a agregar:**

```bash
npx shadcn@latest add badge tabs dropdown-menu dialog avatar card select toast
```

---

## 9. Componentes Shadcn/UI — Mapeo de Uso

| Componente Shadcn | Uso en Command Center |
|---|---|
| `Badge` | Estado del thread, canal, agente, tags de lead |
| `Tabs` | Navegación Inbox ↔ Kanban en `(command-center)/layout.tsx` |
| `DropdownMenu` | Filtros de canal y agente en inbox/kanban |
| `Dialog` | Confirmación de acciones de handoff (Resolve, Escalate) |
| `Avatar` | Iniciales de lead en inbox-list-item y kanban-card |
| `Card` | Contenedor de kanban-card y lead detail en Sheet |
| `Select` | Selector de stage en edición rápida de lead |
| `Sheet` | Detalle expandido de lead desde Kanban (click en card) |
| `Toast` | Feedback de mutaciones (handoff exitoso, error de D&D, etc.) |
| `ScrollArea` | Ya instalado — inbox list, kanban columns |
| `Skeleton` | Ya instalado — loading states |
| `Resizable` | Ya instalado — split-pane del inbox |
| `Tooltip` | Ya instalado — iconos de acción |

---

## 10. Sidebar — Modificaciones Requeridas

El `app-sidebar.tsx` actual tiene una estructura plana. Debe evolucionar a secciones por módulo:

```typescript
const commandCenterItems = [
  { title: "Inbox", url: "/inbox", icon: Inbox, badge: unreadCount },
  { title: "Kanban", url: "/kanban", icon: LayoutGrid },
];

const assetStudioItems = [
  { title: "Documents", url: "/documents", icon: FileText },
  { title: "Prompts", url: "/prompts", icon: MessageSquareText },
];

const campaignReviewItems = [
  { title: "Timeline", url: "/timeline", icon: Clock },
  { title: "Audit Log", url: "/audit", icon: Shield },
];
```

Cada `SidebarGroup` corresponde a un módulo. El badge de `unreadCount` en Inbox se obtiene derivando del caché de TanStack Query:

```typescript
// Dentro del componente del sidebar (client component)
const { data: threads } = useThreads();
const unreadCount = threads?.reduce((sum, t) => sum + t.unreadCount, 0) ?? 0;
```

**Nota:** El sidebar NO lee de un store Zustand para obtener `unreadCount`. Lo deriva del caché reactivo de TanStack Query.

---

## 11. API Routes (BFF Layer) — Scope del Ejecutor

Estas rutas deben crearse como Route Handlers thin-proxy. **No contienen lógica de negocio.**

| Route | Método | Backend | Propósito |
|---|---|---|---|
| `app/api/conversations/route.ts` | `GET` | Tenant PostgreSQL | Lista de threads con filtros |
| `app/api/conversations/stream/route.ts` | `GET` | LangGraph SSE | Proxy de streaming SSE (thread específico) |
| `app/api/conversations/stream/global/route.ts` | `GET` | LangGraph SSE | Proxy de streaming SSE global (todos los threads) |
| `app/api/conversations/[threadId]/route.ts` | `GET` | Tenant PostgreSQL | Detalle de thread + mensajes |
| `app/api/conversations/[threadId]/handoff/route.ts` | `POST` | LangGraph `update_state` | Ejecutar acción de handoff |
| `app/api/leads/route.ts` | `GET` | Tenant PostgreSQL | Lista de leads (view kanban) |
| `app/api/leads/[leadId]/route.ts` | `PATCH` | Tenant PostgreSQL | Update de stage (D&D kanban) |

**Nota ADR-109:** Las queries van al PostgreSQL privado del Tenant (Cloud SQL), NO a Supabase. El cliente HTTP en `lib/api/conversations.ts` apuntará a `process.env.TENANT_API_URL` (el servicio Hono en Cloud Run del tenant) que a su vez consulta su DB local.

---

## 12. Variables de Entorno Requeridas

```env
# Tenant backend (Hono service en Cloud Run)
TENANT_API_URL=http://localhost:8787          # Dev local / Cloud Run URL en prod

# LangGraph Orchestrator
LANGGRAPH_API_URL=http://localhost:8123
LANGGRAPH_API_KEY=lsv2_...                   # Solo server-side

# Feature flags
NEXT_PUBLIC_ENABLE_KANBAN=true                # Toggle para activar/desactivar Kanban
```

---

## 13. WBS (Work Breakdown Structure)

### Sprint 1: Fundamento (Estimado: 3-4 días)

| # | Tarea | Archivos | Dependencia | Criterio de Aceptación |
|---|---|---|---|---|
| 1.1 | Definir interfaces TypeScript | `types/conversation.ts`, `types/lead.ts`, `types/agent.ts` | Ninguna | Tipos compilan sin error. Exportaciones correctas. |
| 1.2 | Instalar dependencias faltantes (**incluye `@tanstack/react-query`**) | `package.json` | Ninguna | `npm install` exitoso. Shadcn components disponibles. `@tanstack/react-query` v5 instalada. |
| 1.3 | Crear `lib/query-client.ts` + `app/providers.tsx` + montar `QueryClientProvider` en root layout | `lib/query-client.ts`, `app/providers.tsx`, `app/layout.tsx` [M] | 1.2 | `QueryClientProvider` envuelve toda la app. DevTools visibles en desarrollo. |
| 1.4 | Crear query key factory | `lib/query-keys.ts` | 1.1 | Keys tipadas para threads, leads, messages. |
| 1.5 | Crear query hooks (`useThreads`, `useThreadMessages`, `useLeads`) | `hooks/queries/use-threads.ts`, `use-thread-messages.ts`, `use-leads.ts` | 1.1, 1.3, 1.4 | Hooks compilan. `useThreads()` retorna `UseQueryResult<ThreadSummary[]>`. |
| 1.6 | Crear mutation hooks (`useHandoffMutation`, `useMoveLeadMutation`) | `hooks/mutations/use-handoff-mutation.ts`, `use-move-lead-mutation.ts` | 1.4, 1.5 | Optimistic updates con rollback. Tests unitarios del `onMutate`/`onError` pasan. |
| 1.7 | Crear Zustand UI stores (**sólo client state**) | `stores/inbox-ui-store.ts`, `stores/kanban-ui-store.ts` | 1.1 | Stores exportan filtros y selección. **Cero datos del servidor.** |
| 1.8 | Crear `lib/langgraph/client.ts` y `lib/langgraph/events.ts` | `lib/langgraph/*` | 1.1 | Cliente HTTP tipado. Parser SSE convierte stream a `AsyncIterable<SSEvent>`. |
| 1.9 | Crear `lib/api/conversations.ts` y `lib/api/leads.ts` | `lib/api/*` | 1.1, 1.8 | Funciones `getThreads()`, `getThreadMessages(id)`, `getLeads()`, `patchLeadStage()`, `postHandoff()` con tipado completo. Estas son las `queryFn` / `mutationFn`. |

### Sprint 2: Inbox Visual (Estimado: 4-5 días)

| # | Tarea | Archivos | Dependencia | Criterio de Aceptación |
|---|---|---|---|---|
| 2.1 | Crear componentes compartidos | `components/shared/channel-badge.tsx`, `empty-state.tsx`, `topbar.tsx` | 1.2 | Renderizan correctamente en page de prueba. |
| 2.2 | Implementar `inbox-list` con `<HydrationBoundary>` + `inbox-list-item` | `components/command-center/inbox-list.tsx`, `inbox-list-item.tsx` | 1.5, 1.7, 2.1 | Server prefetch + hydration. Lista consume `useThreads()`. Filtros de `inbox-ui-store` se aplican client-side sobre el caché TQ. Active state highlight. |
| 2.3 | Implementar `inbox-filters` | `components/command-center/inbox-filters.tsx` | 1.7, 2.1 | Filtros de canal, estado y búsqueda actualizan `inbox-ui-store` (Zustand UI). La lista se re-filtra reactivamente. |
| 2.4 | Refactor `inbox/page.tsx` como Server Component con prefetch | `app/(command-center)/inbox/page.tsx` | 1.3, 1.5, 2.2, 2.3 | Page hace `prefetchQuery` + `dehydrate` + `<HydrationBoundary>`. Datos reales (o mock server). |
| 2.5 | Implementar `conversation-thread` + `message-bubble` | `components/command-center/conversation-thread.tsx`, `message-bubble.tsx` | 1.5 | Thread consume `useThreadMessages(threadId)`. Diferenciación visual. Streaming SSE funciona con mock server. |
| 2.6 | Implementar `useRealtimeThread` (SSE → TQ cache bridge) | `hooks/use-realtime-thread.ts` | 1.4, 1.5 | Hook conecta EventSource, inyecta mensajes vía `queryClient.setQueryData`. Cleanup en unmount. Reconnect en error. |
| 2.7 | Implementar `useSseSync` (SSE global → threads list sync) | `hooks/use-sse-sync.ts` | 1.4, 1.5 | Hook global montado en `(command-center)/layout.tsx`. Sincroniza lista de threads vía SSE global. |
| 2.8 | Implementar `thread-header` + `handoff-controls` | `components/command-center/thread-header.tsx`, `handoff-controls.tsx` | 1.6 | Acciones de handoff usan `useHandoffMutation()`. Optimistic update + rollback. Dialog de confirmación funcional. |
| 2.9 | Implementar `@detail/[threadId]/page.tsx` | `app/(command-center)/inbox/@detail/[threadId]/page.tsx` | 2.5, 2.6, 2.8 | Parallel Route carga thread detail. Split-pane funcional. |
| 2.10 | Crear `(command-center)/layout.tsx` con Tabs + `useSseSync` | `app/(command-center)/layout.tsx` | 2.1, 2.7 | Tabs "Inbox" / "Kanban" renderizan. SSE global activo. |

### Sprint 3: Kanban In-House (Estimado: 3-4 días)

| # | Tarea | Archivos | Dependencia | Criterio de Aceptación |
|---|---|---|---|---|
| 3.1 | Implementar `kanban-board` + `kanban-column` con `<HydrationBoundary>` | `components/command-center/kanban-board.tsx`, `kanban-column.tsx` | 1.2, 1.5 | Board consume `useLeads()`. Server-prefetched. 7 columnas. DndContext funcional. |
| 3.2 | Implementar `kanban-card` | `components/command-center/kanban-card.tsx` | 3.1, 2.1 | Card muestra info del lead. Draggable funcional. |
| 3.3 | Implementar drag-and-drop optimista con `useMoveLeadMutation` | `hooks/use-kanban-dnd.ts` (orquesta D&D + mutation) | 1.6, 3.1, 3.2 | D&D mueve card entre columnas vía `useMoveLeadMutation`. PATCH falla → rollback automático del caché TQ + toast. |
| 3.4 | Implementar `kanban-filters` | `components/command-center/kanban-filters.tsx` | 1.7 | Filtros actualizan `kanban-ui-store` (Zustand UI). Cards se filtran client-side sobre el caché TQ. |
| 3.5 | Implementar `kanban/page.tsx` con prefetch | `app/(command-center)/kanban/page.tsx` | 3.1-3.4 | Page hace `prefetchQuery(['leads'])` + `<HydrationBoundary>`. Board completo. |
| 3.6 | Sheet de detalle de lead (click en card) | Usa Shadcn `Sheet` | 3.2 | Click en card abre Sheet con detalle expandido. |

### Sprint 4: API Routes + Sidebar + Polish (Estimado: 2-3 días)

| # | Tarea | Archivos | Dependencia | Criterio de Aceptación |
|---|---|---|---|---|
| 4.1 | Crear Route Handlers (BFF) | `app/api/conversations/**`, `app/api/leads/**` | 1.8, 1.9 | Endpoints responden con datos mock. SSE streaming funcional (incluye ruta global). |
| 4.2 | Actualizar `app-sidebar.tsx` | `components/layout/app-sidebar.tsx` | 2.10 | Secciones por módulo. Badge de unread **derivado del caché TQ** (`useThreads()`). Link a Kanban funcional. |
| 4.3 | Loading states (skeletons) | `loading.tsx` en cada ruta | 2.4, 3.5 | Skeletons renderizan durante carga. No flash of empty content. |
| 4.4 | Empty states | Usa `empty-state.tsx` en inbox/detail/kanban | 2.1 | Estado vacío con ilustración y CTA cuando corresponda. |
| 4.5 | Responsive / Mobile breakpoints | Todos los componentes | 3.5 | En < 768px: inbox es full-width, detail abre como Sheet. Kanban scroll horizontal. |
| 4.6 | Agregar `ReactQueryDevtools` en dev | `app/providers.tsx` | 1.3 | DevTools visible sólo en `NODE_ENV=development`. |

---

## 14. Matriz de Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| SSE no funciona en Cloud Run (cold start mata el stream) | Media | Alto | ADR-101 ya decidió `--no-cpu-throttling`. Implementar reconnect automático en `useRealtimeThread` con `invalidateQueries` post-reconnect para re-sync. |
| `@dnd-kit` incompatible con React 18 Server Components | Baja | Medio | Kanban board es 100% client component. No hay conflicto con RSC. Verificar en Sprint 3.1. |
| Latencia de queries al PostgreSQL del Tenant vía Cloud Run | Media | Medio | TanStack Query `staleTime: 30s` evita refetches innecesarios. Server-side prefetch con `<HydrationBoundary>` elimina waterfalls. Kanban usa optimistic mutations. |
| Root layout refactor rompe rutas existentes | Alta | Alto | **No se toca** el root layout (excepto insertar `<Providers>` wrapper). Migración a `(dashboard)` Route Group queda para Sprint de Auth. |
| Shadcn base-nova style no tiene todos los componentes | Baja | Bajo | Los componentes listados (`badge`, `tabs`, etc.) están disponibles en base-nova. Verificar con `npx shadcn@latest add`. |
| Hydration mismatch entre server prefetch y client render | Baja | Medio | Usar `<HydrationBoundary>` de TanStack Query. No hidratar en Zustand. `staleTime` debe ser > 0 para evitar refetch inmediato post-hydration. |

---

## 15. Criterios de Aceptación Global (Gate para Tester)

El Tester del Escuadrón debe validar antes de pasar a Reviewer:

- [ ] **`QueryClientProvider`** montado correctamente en root layout. `ReactQueryDevtools` visible en dev.
- [ ] **Inbox renderiza** threads con datos reales (o mock server) — datos vienen de `useThreads()` (TanStack Query), no de un store Zustand.
- [ ] **Server-side prefetch** funciona: el HTML del server incluye datos pre-hidratados (`<HydrationBoundary>`). No hay flash of empty.
- [ ] **Filtros** de canal, estado y búsqueda funcionan sin reload — filtros viven en `inbox-ui-store` (Zustand), se aplican client-side sobre el caché de TanStack Query.
- [ ] **Split-pane** resizable entre lista y detalle.
- [ ] **Parallel Route** `@detail` carga el thread correcto al hacer click.
- [ ] **SSE streaming** de mensajes inyecta datos vía `queryClient.setQueryData` (verificar en DevTools de TanStack Query que el caché se actualiza).
- [ ] **Handoff controls** usan `useHandoffMutation()` con optimistic update + rollback. Verificar rollback desconectando el mock server.
- [ ] **Kanban** renderiza columnas con leads de `useLeads()`.
- [ ] **Drag-and-drop** usa `useMoveLeadMutation()` con optimistic update. PATCH falla → rollback automático del caché TQ + toast.
- [ ] **Sidebar** tiene secciones por módulo y badge de unread derivado del caché TQ (`useThreads()`).
- [ ] **⛔ Zustand stores NO contienen datos del servidor.** `inbox-ui-store` sólo tiene `activeThreadId`, `filters`, `search`. `kanban-ui-store` sólo tiene filtros locales. Cero `threads[]`, cero `leads[]`, cero `messages[]` en Zustand.
- [ ] **Loading skeletons** aparecen durante carga (no flash of white).
- [ ] **Empty states** se muestran cuando no hay datos.
- [ ] **Mobile responsive** — inbox y kanban usables en < 768px.
- [ ] **Zero TypeScript errors** en `npm run build`.
- [ ] **No client-side secrets** expuestos (LANGGRAPH_API_KEY solo en Route Handlers).

---

## 16. Fuera de Alcance (Explícito)

Los siguientes items NO son parte de este RFC:

1. **Autenticación Supabase SSR** — Sprint separado (RFC-015 §4).
2. **Migración a Route Groups `(auth)` / `(dashboard)`** — Depende de Auth.
3. **Módulos Asset Studio y Campaign Review** — RFCs independientes.
4. **Integración real con LangGraph en Cloud Run** — Este RFC trabaja con mock data/server. La integración E2E es tarea del Sprint de Backend.
5. **Testing E2E (Playwright/Cypress)** — El Tester valida manualmente; E2E automatizado es Sprint posterior.
6. **Tema oscuro / Branding Teseo** — Plan existente en `plan-teseo-branding.md` y `plan-ui-contrast.md`.

---

## 17. Propuesta de Integración

Este documento debe ser aprobado por el CEO como baseline para la ejecución del Command Center. Una vez aprobado:

1. **Registrar como RFC-016 v2.0** en la secuencia documental del proyecto.
2. **El Ejecutor** inicia Sprint 1 (Fundamento) inmediatamente — la tarea 1.3 (`QueryClientProvider`) es la dependencia dura de todo lo demás.
3. **Documentar la decisión** de mantener el root layout intacto hasta el Sprint de Auth como nota en ADR-110 o un ADR-111 dedicado.
4. **Nota de auditoría:** Esta versión corrige la violación identificada por el Learner en `RFC-016-Learner-Audit.md`. La regla de `2026-04-07-tanstack-query-migration.md` queda cumplida.

---

*Builder — Escuadrón Teseo | RFC-016 v2.0 (Post-Auditoría) | 2026-04-20*
