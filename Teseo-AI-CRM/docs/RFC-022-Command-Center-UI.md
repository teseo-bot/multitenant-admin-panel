# RFC-022: Command Center UI — Kanban + Inbox Dual

| Campo | Valor |
|---|---|
| **ID** | RFC-022 |
| **Estado** | Draft |
| **Autor** | Builder (Arquitecto Staff, Equipo Teseo) |
| **Fecha** | 2026-04-21 |
| **Sprint** | 1.1 — CRM-Agéntico (Tenant OS) |
| **Depende de** | RFC-021 (DB Schema), ADR-117 (D&D + SSE), ADR-112 (SSE + D&D Kanban) |
| **Proyecto** | `crm-agentico-panel` |

---

## 1. Contexto y Hallazgos del Código Existente

Tras una auditoría completa de `crm-agentico-panel/`, el código tiene una base funcional pero con **5 brechas críticas** que este RFC cierra:

| # | Brecha | Archivo Afectado | Severidad |
|---|---|---|---|
| B1 | `useLeads()` devuelve datos mock (hardcoded con `setTimeout`) | `hooks/queries/use-leads.ts` | 🔴 Bloqueante |
| B2 | `useMoveLeadMutation` envía `POST /api/leads/move` (ruta inexistente) y NO envía `sort_order` | `hooks/mutations/use-move-lead.ts` | 🔴 Bloqueante |
| B3 | El tipo `Lead` en `types/lead.ts` define 7 stages (`new`, `proposal`, `negotiation`…) pero la DB (RFC-021) tiene 5 (`New`, `Contacted`, `Qualified`, `Lost`, `Won`) — case mismatch y stages fantasma | `types/lead.ts` | 🔴 Bloqueante |
| B4 | `use-sse-sync.ts` escucha `/api/threads/events` (threads). No existe un hook SSE para el Inbox de Leads (`/api/leads/[id]/messages/stream`) | `hooks/use-sse-sync.ts` | 🟡 Alto |
| B5 | No existe la vista unificada Command Center (Kanban izquierda + Inbox derecha). La ruta `(command-center)/` solo tiene `inbox/` | `app/(command-center)/` | 🟡 Alto |

### 1.1 Lo Que YA Funciona (No Tocar)

| Componente | Archivo | Estado |
|---|---|---|
| `KanbanBoard` + DndContext + DragOverlay | `components/kanban/kanban-board.tsx` | ✅ Estructura sólida, necesita rewire |
| `KanbanColumn` con `useDroppable` + `SortableContext` | `components/kanban/kanban-column.tsx` | ✅ Correcto |
| `KanbanCard` con `useSortable` | `components/kanban/kanban-card.tsx` | ✅ Correcto |
| `InboxThreadView` con burbujas y HandoffBar | `components/inbox/inbox-thread-view.tsx` | ✅ Reutilizable con adaptación |
| API Routes CRUD leads (Supabase) | `app/api/leads/route.ts`, `[id]/route.ts` | ✅ Producción |
| API SSE endpoint (LISTEN/NOTIFY + cleanup) | `app/api/leads/[id]/messages/stream/route.ts` | ✅ Producción |
| `lib/db.ts` (Pool global PG) | `lib/db.ts` | ✅ Producción |
| Auth store (Zustand) | `stores/auth-store.ts` | ✅ Producción |
| Query keys registry | `lib/query-keys.ts` | ✅ Producción |

---

## 2. Decisiones de Diseño

### 2.1 Alineación de Stages (DB ↔ Frontend)

**Decisión:** El frontend se alinea al enum de la DB (RFC-021). Se eliminan `proposal` y `negotiation`.

```
DB Enum (Fuente de Verdad)  →  Frontend (LeadStatus)
─────────────────────────────────────────────────────
'New'                       →  'New'
'Contacted'                 →  'Contacted'
'Qualified'                 →  'Qualified'
'Won'                       →  'Won'
'Lost'                      →  'Lost'
```

> **Razón:** El pipeline agéntico (Gatekeeper → SDR → Calificación → Cierre) no necesita etapas intermedias de negociación humana. Si el CEO las requiere en el futuro, se agregan al DB enum (`ALTER TYPE lead_status ADD VALUE 'Proposal' BEFORE 'Won'`) y el frontend se extiende. No al revés.

### 2.2 Cálculo de `sort_order` en Frontend (ADR-117)

El Ejecutor DEBE implementar el algoritmo de punto medio **exclusivamente en el frontend**, dentro del hook `useMoveLeadMutation`. El backend recibe el número calculado — sin lógica de ordenamiento en el servidor.

```
Algoritmo:
1. Lead se suelta entre posición A y posición B en la misma columna:
   → sort_order = (A.sort_order + B.sort_order) / 2

2. Lead se suelta al inicio de una columna (antes del primer elemento):
   → sort_order = primer_elemento.sort_order - 1024

3. Lead se suelta al final de una columna (después del último):
   → sort_order = ultimo_elemento.sort_order + 1024

4. Lead se suelta en columna vacía:
   → sort_order = 1024

5. Rebalanceo: Cuando |A - B| < 1e-10 (frontera de precisión):
   → Disparar PATCH masivo renumerando la columna con paso 1024
   → En la práctica, NUNCA sucederá con volúmenes de CRM Single-Tenant
```

### 2.3 Layout del Command Center: Resizable Split

```
┌─────────────────────────────────────────────────────────┐
│  Command Center                                         │
├───────────────────────────┬─────────────────────────────┤
│                           │                             │
│   KANBAN BOARD            │   INBOX (Thread View)       │
│   (5 columnas D&D)        │                             │
│                           │   ┌───────────────────────┐ │
│   ┌──────┐ ┌──────┐      │   │ Lead: Acme Corp       │ │
│   │ New  │ │ Cont │ ...  │   │ Canal: WhatsApp       │ │
│   │      │ │      │      │   ├───────────────────────┤ │
│   │ Card │ │ Card │      │   │ [mensajes SSE]        │ │
│   │ Card │ │      │      │   │                       │ │
│   └──────┘ └──────┘      │   │                       │ │
│                           │   ├───────────────────────┤ │
│                           │   │ [Handoff] [Compose]   │ │
│                           │   └───────────────────────┘ │
├───────────────────────────┴─────────────────────────────┤
│  react-resizable-panels (ya instalado en package.json)  │
└─────────────────────────────────────────────────────────┘
```

**Interacción Kanban → Inbox:** Click en una `KanbanCard` → setea `selectedLeadId` en un nuevo store → el panel derecho carga el Inbox de ese lead.

### 2.4 Flujo de Datos SSE para Inbox de Leads

```
PostgreSQL (NOTIFY inbox_channel, lead_id)
        │
        ▼
/api/leads/[id]/messages/stream  ← Endpoint existente (ya funciona)
        │
        ▼
useLeadSSE(leadId)               ← Hook NUEVO (similar a useSSESync pero para leads)
        │
        ▼ event: { lead_id, refresh: true }
        │
queryClient.invalidateQueries({ queryKey: queryKeys.leads.messages(leadId) })
        │
        ▼
useLeadMessages(leadId) se refetcha automáticamente
        │
        ▼
<InboxPanel> se rerenderiza con el mensaje nuevo
```

> **Nota:** El SSE endpoint actual emite `{ lead_id, refresh: true }` como señal. El hook invalida el cache y TanStack Query refetcha. No se inyecta el mensaje directamente en cache (a diferencia de `useSSESync` para threads) porque el payload SSE no contiene el contenido del mensaje — es un patrón "notify + refetch" más simple y confiable.

---

## 3. Diseño de Componentes (Árbol)

```
app/(command-center)/command-center/page.tsx        ← NUEVA ruta
  └─ <CommandCenterLayout>                          ← NUEVO
       ├─ <ResizablePanelGroup direction="horizontal">
       │    ├─ <ResizablePanel defaultSize={60}>
       │    │    └─ <KanbanBoard />                 ← EXISTENTE (rewired)
       │    ├─ <ResizableHandle />
       │    └─ <ResizablePanel defaultSize={40}>
       │         └─ <InboxPanel />                  ← NUEVO (wrapper)
       │              ├─ <InboxHeader leadId={…} />
       │              ├─ <InboxMessageList />        ← ADAPTADO de InboxThreadView
       │              └─ <InboxComposer />
       └─ <LeadSSEProvider />                       ← NUEVO (hook wrapper)
```

### 3.1 Componentes Nuevos

| Componente | Archivo | Responsabilidad |
|---|---|---|
| `CommandCenterLayout` | `components/command-center/command-center-layout.tsx` | Contenedor con `ResizablePanelGroup`. Renderiza Kanban + Inbox. |
| `InboxPanel` | `components/command-center/inbox-panel.tsx` | Panel derecho. Lee `selectedLeadId` del store. Muestra estado vacío o el thread. |
| `InboxHeader` | `components/command-center/inbox-header.tsx` | Nombre del lead, canal, ICP score, botón de cerrar panel. |
| `InboxMessageList` | `components/command-center/inbox-message-list.tsx` | Lista de mensajes con scroll infinito. Reutiliza `MessageBubble` de `inbox-thread-view.tsx`. |
| `InboxComposer` | `components/command-center/inbox-composer.tsx` | Input + Send. Llama a `useSendMessage(leadId)`. |

### 3.2 Componentes Modificados

| Componente | Cambio |
|---|---|
| `KanbanBoard` | 1) Reemplazar `COLUMNS` (7→5, alineadas a DB enum). 2) Agregar `onClick` en cards para setear `selectedLeadId`. 3) Rewire `handleDragEnd` para calcular `sort_order` (punto medio). |
| `KanbanCard` | Agregar `onClick` handler (propagado desde Board). Highlight visual cuando es el lead seleccionado. |
| `KanbanColumn` | Sin cambios estructurales. Solo recibirá leads ya ordenados por `sort_order`. |

---

## 4. Diseño de Hooks (Estado y Data Fetching)

### 4.1 Hooks Nuevos y Modificados

| Hook | Archivo | Tipo | Query Key | Endpoint |
|---|---|---|---|---|
| `useLeads()` | `hooks/queries/use-leads.ts` | **MODIFICAR** | `['leads']` | `GET /api/leads` |
| `useLeadMessages(leadId)` | `hooks/queries/use-lead-messages.ts` | **NUEVO** | `['leads', id, 'messages']` | `GET /api/leads/[id]/messages` |
| `useMoveLeadMutation()` | `hooks/mutations/use-move-lead.ts` | **MODIFICAR** | invalida `['leads']` | `PATCH /api/leads/[id]` |
| `useSendMessageMutation()` | `hooks/mutations/use-send-message.ts` | **NUEVO** | invalida `['leads', id, 'messages']` | `POST /api/leads/[id]/messages` |
| `useLeadSSE(leadId)` | `hooks/use-lead-sse.ts` | **NUEVO** | — (invalida cache) | `GET /api/leads/[id]/messages/stream` |

### 4.2 Especificación: `useLeads()` (Rewrite)

```typescript
// hooks/queries/use-leads.ts
// ELIMINAR: mock data y setTimeout
// REEMPLAZAR CON:

interface LeadsResponse {
  data: Lead[];  // Lead con sort_order incluido
}

async function fetchLeads(): Promise<Lead[]> {
  const res = await fetch('/api/leads');
  if (!res.ok) throw new Error('Failed to fetch leads');
  const json: LeadsResponse = await res.json();
  return json.data;
}

export function useLeads() {
  return useQuery<Lead[], Error>({
    queryKey: queryKeys.leads.all,
    queryFn: fetchLeads,
    staleTime: 30_000,  // 30s — el SSE empuja invalidaciones
  });
}
```

### 4.3 Especificación: `useMoveLeadMutation()` (Rewrite Completo)

Este es el hook más crítico. Debe:
1. Calcular `sort_order` con algoritmo de punto medio
2. Ejecutar mutación optimista (snapshot → update → rollback on error)
3. Enviar SOLO `{ status, sort_order }` al `PATCH /api/leads/:id`

```typescript
// hooks/mutations/use-move-lead.ts

interface MoveLeadPayload {
  leadId: string;
  newStatus: LeadStatus;          // Renombrado de newStage → newStatus
  targetIndex: number;            // Posición visual donde se soltó
  columnLeads: Lead[];            // Leads actuales de la columna destino (ya ordenados)
}

// Función pura: calcula sort_order por punto medio
function calculateSortOrder(targetIndex: number, columnLeads: Lead[]): number {
  if (columnLeads.length === 0) return 1024;

  const filtered = columnLeads; // Ya sin el lead que se mueve

  if (targetIndex === 0) {
    // Antes del primero
    return filtered[0].sort_order - 1024;
  }

  if (targetIndex >= filtered.length) {
    // Después del último
    return filtered[filtered.length - 1].sort_order + 1024;
  }

  // Entre dos elementos
  const before = filtered[targetIndex - 1].sort_order;
  const after = filtered[targetIndex].sort_order;
  return (before + after) / 2;
}

export function useMoveLeadMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, newStatus, targetIndex, columnLeads }: MoveLeadPayload) => {
      const sort_order = calculateSortOrder(targetIndex, columnLeads);

      const res = await fetch(`/api/leads/${leadId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, sort_order }),
      });

      if (!res.ok) throw new Error('Failed to move lead');
      return res.json();
    },

    onMutate: async ({ leadId, newStatus, targetIndex, columnLeads }) => {
      await queryClient.cancelQueries({ queryKey: queryKeys.leads.all });
      const snapshot = queryClient.getQueryData<Lead[]>(queryKeys.leads.all);

      if (snapshot) {
        const sort_order = calculateSortOrder(targetIndex, columnLeads);
        queryClient.setQueryData<Lead[]>(queryKeys.leads.all, (old) =>
          old?.map((lead) =>
            lead.id === leadId
              ? { ...lead, status: newStatus, sort_order }
              : lead
          ) ?? []
        );
      }

      return { snapshot };
    },

    onError: (_err, _vars, context) => {
      if (context?.snapshot) {
        queryClient.setQueryData(queryKeys.leads.all, context.snapshot);
      }
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.leads.all });
    },
  });
}
```

### 4.4 Especificación: `useLeadSSE(leadId)` (Nuevo)

```typescript
// hooks/use-lead-sse.ts
// Patrón: EventSource → invalidación de cache

export function useLeadSSE(leadId: string | null) {
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!leadId) return;

    const es = new EventSource(`/api/leads/${leadId}/messages/stream`);

    es.onmessage = (event: MessageEvent) => {
      try {
        const data = JSON.parse(event.data);
        if (data.refresh) {
          queryClient.invalidateQueries({
            queryKey: queryKeys.leads.messages(leadId),
          });
        }
      } catch { /* skip malformed */ }
    };

    es.onerror = () => {
      es.close();
      // Reconexión con backoff delegada a un setTimeout
      setTimeout(() => {
        // El efecto se reejecuta automáticamente si leadId cambia
        // Para reconexión estática, usar un ref counter
      }, 3000);
    };

    return () => es.close();
  }, [leadId, queryClient]);
}
```

> **Nota para el Ejecutor:** Implementar reconexión con un `retryCount` ref que incremente el delay exponencialmente (cap 30s). Ver patrón existente en `use-sse-sync.ts`.

### 4.5 Especificación: `useLeadMessages(leadId)` (Nuevo)

```typescript
// hooks/queries/use-lead-messages.ts

export function useLeadMessages(leadId: string | null) {
  return useQuery({
    queryKey: queryKeys.leads.messages(leadId!),
    queryFn: async () => {
      const res = await fetch(`/api/leads/${leadId}/messages`);
      if (!res.ok) throw new Error('Failed to fetch messages');
      const json = await res.json();
      return json.data as InboxMessage[];
    },
    enabled: !!leadId,
    staleTime: 10_000,
  });
}
```

### 4.6 Especificación: `useSendMessageMutation()` (Nuevo)

```typescript
// hooks/mutations/use-send-message.ts

interface SendMessagePayload {
  leadId: string;
  content: string;
  channel: 'telegram' | 'whatsapp' | 'web' | 'email';
}

export function useSendMessageMutation() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async ({ leadId, content, channel }: SendMessagePayload) => {
      const res = await fetch(`/api/leads/${leadId}/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content, channel }),
      });
      if (!res.ok) throw new Error('Failed to send message');
      return res.json();
    },
    onSuccess: (_data, { leadId }) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.leads.messages(leadId),
      });
    },
  });
}
```

---

## 5. Cambios al Store (Zustand)

### 5.1 Nuevo Store: `command-center-store.ts`

```typescript
// stores/command-center-store.ts

interface CommandCenterState {
  selectedLeadId: string | null;
  setSelectedLeadId: (id: string | null) => void;
}

export const useCommandCenterStore = create<CommandCenterState>((set) => ({
  selectedLeadId: null,
  setSelectedLeadId: (id) => set({ selectedLeadId: id }),
}));
```

> **No reutilizar** `inbox-ui-store.ts` (ese maneja `selectedThreadId` para la vista de threads existente). El Command Center tiene su propio ciclo de vida.

---

## 6. Cambios a Types

### 6.1 `types/lead.ts` (Modificar)

```typescript
// ANTES (7 stages, lowercase)
export type LeadStage = 'new' | 'contacted' | 'qualified' | 'proposal' | 'negotiation' | 'closed_won' | 'closed_lost';

// DESPUÉS (5 statuses, PascalCase, alineado a DB enum RFC-021)
export type LeadStatus = 'New' | 'Contacted' | 'Qualified' | 'Lost' | 'Won';

export interface Lead {
  id: string;
  name: string;
  company: string | null;
  email: string | null;
  phone: string | null;
  status: LeadStatus;              // Renombrado de stage → status
  source: LeadSource;              // NUEVO
  icp_score: number | null;        // NUEVO
  assigned_node: AssignedNode;     // Renombrado de assignedAgent
  sort_order: number;              // NUEVO (CRÍTICO para D&D)
  thread_id: string | null;        // NUEVO
  metadata: Record<string, any>;   // NUEVO
  created_at: string;              // Renombrado de createdAt (snake_case del API)
  updated_at: string;              // NUEVO
}

export type LeadSource = 'inbound_web' | 'inbound_telegram' | 'inbound_whatsapp' | 'outbound_hunter' | 'manual' | 'referral';
export type AssignedNode = 'gatekeeper' | 'sdr' | 'hunter' | 'admin' | 'unassigned';
```

### 6.2 `types/inbox-message.ts` (Nuevo)

```typescript
export type MessageSender = 'customer' | 'ai_agent' | 'human_admin';
export type MessageChannel = 'telegram' | 'whatsapp' | 'web' | 'email';

export interface InboxMessage {
  id: string;
  lead_id: string;
  sender: MessageSender;
  channel: MessageChannel;
  content: string;
  external_id: string | null;
  metadata: Record<string, any>;
  created_at: string;
}
```

### 6.3 `lib/query-keys.ts` (Modificar)

```typescript
// Agregar al bloque leads:
leads: {
  all:      ['leads'] as const,
  detail:   (id: string) => ['leads', id] as const,
  messages: (id: string) => ['leads', id, 'messages'] as const,  // NUEVO
},
```

---

## 7. Flujo de `handleDragEnd` (Detalle para el Ejecutor)

El `handleDragEnd` en `KanbanBoard` es el punto más complejo. Aquí está el pseudocódigo exacto:

```
handleDragEnd(event: DragEndEvent):
  1. Extraer active.id (leadId) y over.id (target)
  2. Si !over → return (drop fuera del board)

  3. Determinar newStatus:
     - Si over.id es un column id → newStatus = over.id
     - Si over.id es un lead id → newStatus = leads.find(over.id).status

  4. Si newStatus === lead actual.status Y over.id === leadId → return (no-op)

  5. Construir columnLeads:
     - Filtrar leads donde status === newStatus
     - EXCLUIR el lead que se está moviendo (active.id)
     - Ordenar por sort_order ASC

  6. Determinar targetIndex:
     - Si over.id es un column id → targetIndex = columnLeads.length (al final)
     - Si over.id es un lead id → targetIndex = índice de over.id en columnLeads

  7. Llamar moveLeadMutation.mutate({ leadId, newStatus, targetIndex, columnLeads })
```

---

## 8. Estructura de Archivos (Cambios Totales)

```
crm-agentico-panel/
├── app/
│   └── (command-center)/
│       └── command-center/
│           └── page.tsx                           ← NUEVO
├── components/
│   ├── command-center/
│   │   ├── command-center-layout.tsx              ← NUEVO
│   │   ├── inbox-panel.tsx                        ← NUEVO
│   │   ├── inbox-header.tsx                       ← NUEVO
│   │   ├── inbox-message-list.tsx                 ← NUEVO
│   │   └── inbox-composer.tsx                     ← NUEVO
│   └── kanban/
│       ├── kanban-board.tsx                       ← MODIFICAR
│       ├── kanban-card.tsx                        ← MODIFICAR (onClick)
│       └── kanban-column.tsx                      ← SIN CAMBIOS
├── hooks/
│   ├── queries/
│   │   ├── use-leads.ts                           ← REWRITE
│   │   └── use-lead-messages.ts                   ← NUEVO
│   ├── mutations/
│   │   ├── use-move-lead.ts                       ← REWRITE
│   │   └── use-send-message.ts                    ← NUEVO
│   └── use-lead-sse.ts                            ← NUEVO
├── stores/
│   └── command-center-store.ts                    ← NUEVO
├── types/
│   ├── lead.ts                                    ← MODIFICAR
│   └── inbox-message.ts                           ← NUEVO
└── lib/
    └── query-keys.ts                              ← MODIFICAR
```

---

## 9. Work Breakdown Structure (WBS Granular)

### Fase 0: Alineación de Types y Contratos (Prerequisito)
| # | Tarea | Archivo | Acción | Est. |
|---|---|---|---|---|
| 0.1 | Reescribir `LeadStage` → `LeadStatus` (5 valores PascalCase), agregar `sort_order`, `source`, `icp_score`, `assigned_node`, `thread_id`, `metadata`, `created_at`, `updated_at` al tipo `Lead` | `types/lead.ts` | MODIFICAR | 20m |
| 0.2 | Crear tipo `InboxMessage` con `MessageSender`, `MessageChannel` | `types/inbox-message.ts` | CREAR | 10m |
| 0.3 | Agregar `leads.messages(id)` a query keys | `lib/query-keys.ts` | MODIFICAR | 5m |
| 0.4 | Grep + fix todas las referencias a `lead.stage` → `lead.status` y `LeadStage` → `LeadStatus` en el codebase | Múltiples archivos | BUSCAR/REEMPLAZAR | 30m |

### Fase 1: Hooks de Data (Queries + Mutations)
| # | Tarea | Archivo | Acción | Est. | Dep. |
|---|---|---|---|---|---|
| 1.1 | Rewrite `useLeads()`: eliminar mock, llamar `GET /api/leads`, parsear `{ data: Lead[] }` | `hooks/queries/use-leads.ts` | REWRITE | 20m | 0.1 |
| 1.2 | Crear `useLeadMessages(leadId)`: `GET /api/leads/[id]/messages`, `enabled: !!leadId` | `hooks/queries/use-lead-messages.ts` | CREAR | 20m | 0.2, 0.3 |
| 1.3 | Rewrite `useMoveLeadMutation()`: implementar `calculateSortOrder()` (punto medio), usar `PATCH /api/leads/:id` con `{ status, sort_order }`, mutación optimista con snapshot/rollback | `hooks/mutations/use-move-lead.ts` | REWRITE | 45m | 0.1 |
| 1.4 | Crear `useSendMessageMutation()`: `POST /api/leads/[id]/messages` | `hooks/mutations/use-send-message.ts` | CREAR | 15m | 0.2 |
| 1.5 | Crear `useLeadSSE(leadId)`: EventSource → invalidación de `queryKeys.leads.messages(id)` con auto-reconnect | `hooks/use-lead-sse.ts` | CREAR | 30m | 0.3 |

### Fase 2: Store y Layout
| # | Tarea | Archivo | Acción | Est. | Dep. |
|---|---|---|---|---|---|
| 2.1 | Crear `useCommandCenterStore` (Zustand): `selectedLeadId`, `setSelectedLeadId` | `stores/command-center-store.ts` | CREAR | 10m | — |
| 2.2 | Crear `CommandCenterLayout`: `ResizablePanelGroup` horizontal (60/40), renderiza `<KanbanBoard>` + `<InboxPanel>` | `components/command-center/command-center-layout.tsx` | CREAR | 30m | 2.1 |
| 2.3 | Crear `page.tsx` en `app/(command-center)/command-center/` que renderiza `<CommandCenterLayout>` | `app/(command-center)/command-center/page.tsx` | CREAR | 10m | 2.2 |

### Fase 3: Rewire Kanban
| # | Tarea | Archivo | Acción | Est. | Dep. |
|---|---|---|---|---|---|
| 3.1 | Actualizar `COLUMNS` en `KanbanBoard`: 5 columnas alineadas a `LeadStatus` | `components/kanban/kanban-board.tsx` | MODIFICAR | 15m | 0.4 |
| 3.2 | Reescribir `handleDragEnd`: extraer `newStatus`, construir `columnLeads`, calcular `targetIndex`, llamar `moveLeadMutation.mutate(...)` con payload completo | `components/kanban/kanban-board.tsx` | MODIFICAR | 45m | 1.3 |
| 3.3 | Agrupar leads por `status` (no `stage`) en `leadsByColumn`, ordenar cada grupo por `sort_order` ASC | `components/kanban/kanban-board.tsx` | MODIFICAR | 15m | 0.4 |
| 3.4 | Agregar `onCardClick` a `KanbanCard`: al click, llama `setSelectedLeadId(lead.id)`. Highlight visual del card seleccionado (ring-2 ring-primary) | `components/kanban/kanban-card.tsx` | MODIFICAR | 20m | 2.1 |

### Fase 4: Panel Inbox (Lado Derecho)
| # | Tarea | Archivo | Acción | Est. | Dep. |
|---|---|---|---|---|---|
| 4.1 | Crear `InboxPanel`: lee `selectedLeadId` del store. Si null → empty state. Si existe → renderiza Header + MessageList + Composer. Invoca `useLeadSSE(selectedLeadId)` | `components/command-center/inbox-panel.tsx` | CREAR | 30m | 1.2, 1.5, 2.1 |
| 4.2 | Crear `InboxHeader`: nombre del lead, canal, ICP score badge, botón cerrar (reset `selectedLeadId`) | `components/command-center/inbox-header.tsx` | CREAR | 20m | 1.1 |
| 4.3 | Crear `InboxMessageList`: consume `useLeadMessages(leadId)`, renderiza burbujas (reutilizar lógica visual de `MessageBubble` de `inbox-thread-view.tsx`), auto-scroll al fondo | `components/command-center/inbox-message-list.tsx` | CREAR | 40m | 1.2 |
| 4.4 | Crear `InboxComposer`: Input + Button Send. Usa `useSendMessageMutation()`. Detecta `channel` del lead | `components/command-center/inbox-composer.tsx` | CREAR | 20m | 1.4 |

### Fase 5: Testing (Tester)
| # | Tarea | Est. | Dep. |
|---|---|---|---|
| 5.1 | Test unitario: `calculateSortOrder()` — punto medio, inicio, final, columna vacía | 30m | 1.3 |
| 5.2 | Test unitario: `useMoveLeadMutation` — optimistic update + rollback con `@testing-library/react-hooks` | 45m | 1.3 |
| 5.3 | Test de integración: `GET /api/leads` devuelve leads ordenados por `sort_order` | 20m | — |
| 5.4 | Test de integración: `PATCH /api/leads/:id` acepta `{ status, sort_order }` y persiste correctamente | 20m | — |
| 5.5 | Test E2E: arrastrar card de "New" a "Qualified" → verificar PATCH con sort_order → verificar posición visual post-drop | 45m | 3.2 |
| 5.6 | Test E2E: click card → panel inbox abre → enviar mensaje → verificar en DB | 30m | 4.4 |

---

## 10. Estimación Total

| Fase | Horas |
|---|---|
| Fase 0: Types y contratos | 1.1h |
| Fase 1: Hooks | 2.2h |
| Fase 2: Store y layout | 0.8h |
| Fase 3: Rewire Kanban | 1.6h |
| Fase 4: Inbox panel | 1.8h |
| Fase 5: Testing | 3.2h |
| **Total** | **~10.7h** |

---

## 11. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| El rename `stage` → `status` rompe componentes fuera del Command Center | Media | Fase 0.4 incluye grep global. El Tester debe verificar que la vista de Campaign Review no use `Lead.stage` |
| La reconexión SSE en Cloud Run serverless pierde eventos durante el cold start | Baja | El patrón "notify + refetch" tolera esto: al reconectar, `useLeadMessages` refetcha todo el timeline |
| `sort_order` DOUBLE PRECISION pierde precisión tras ~50 inserciones entre dos posiciones | Muy Baja | Implementar detección de colisión y rebalanceo. Con volúmenes Single-Tenant, nunca se alcanza |
| El `PATCH /api/leads/[id]` actual usa Supabase client, no el pool `pg` directo | Ninguno | El endpoint ya funciona con Supabase RLS. No hay conflicto; ambos escriben al mismo Cloud SQL |

---

## 12. Restricciones para el Ejecutor

1. **NO crear nuevas API routes.** Todos los endpoints necesarios ya existen (`/api/leads`, `/api/leads/[id]`, `/api/leads/[id]/messages`, `/api/leads/[id]/messages/stream`).
2. **NO modificar el SSE endpoint.** El patrón cleanup de ADR-117 ya está implementado correctamente.
3. **`calculateSortOrder()` debe ser una función pura exportable** (no inline en el hook). El Tester la necesita para unit testing.
4. **El Inbox NO debe importar de `next/navigation`** (restricción IMPACT-Command-Center-API §2). Toda la navegación de selección de lead se maneja vía Zustand store.
5. **Los `MessageBubble` se extraen como componente compartido** en `components/ui/message-bubble.tsx` para reutilizar entre `inbox-thread-view.tsx` (vista threads) y `inbox-message-list.tsx` (vista leads).

---

*Documento generado por Builder (Arquitecto Staff) — Equipo Teseo.*
*Listo para revisión del Reviewer antes de ejecución.*
*Siguiente paso: el Reviewer valida la coherencia de types, la alineación DB ↔ Frontend, y da PASS para iniciar Fase 0.*
