# RFC-027: Inbox Dual — Live Data & Messaging (Sprint 1.8)

| Campo | Valor |
|---|---|
| **ID** | RFC-027 |
| **Estatus** | Draft → Pendiente Aprobación CEO |
| **Autor** | Builder (Arquitecto Staff, Equipo Teseo) |
| **Fecha** | 21 Abril 2026 |
| **Sprint** | 1.8 — Inbox Dual (Live Data & Messaging) |
| **Depende de** | RFC-021 (DB Schema), RFC-023 (Inbox Composer), RFC-026 (Kanban Live Data), ADR-111 (TanStack Query), ADR-117 (SSE + Realtime) |

---

## 1. Contexto y Problema

El Sprint 1.7 (RFC-026) conectó exitosamente el `KanbanBoard` a datos reales de Supabase, eliminando `MOCK_LEADS` y corrigiendo el bug `compunknown`. El `InboxPanel` (panel derecho del Command Center) es el siguiente componente que debe migrar de datos mock a datos reales.

### 1.1 Estado Actual del InboxPanel (Auditoría de Código)

| Capa | Estado | Archivo | Notas |
|---|---|---|---|
| **DDL `inbox_messages`** | ⚠️ Definido en RFC-021 pero sin archivo de migración en `supabase/migrations/` | — | La tabla existe en DB (el Route Handler POST inserta correctamente), pero no hay migración versionada. |
| **Route Handler GET** | ✅ Producción | `app/api/leads/[id]/messages/route.ts` | Auth Supabase SSR, paginación `limit/offset`, `ORDER BY created_at DESC`. |
| **Route Handler POST** | ✅ Producción | `app/api/leads/[id]/messages/route.ts` | Validación Zod, check de existencia del lead (404), NOTIFY `inbox_channel`. |
| **SSE Stream** | ✅ Producción | `app/api/leads/[id]/messages/stream/route.ts` | `LISTEN inbox_channel`, cleanup en `abort`, keepalive, backoff exponencial. |
| **Hook `useLeadSSE`** | ✅ Producción | `hooks/use-lead-sse.ts` | Invalida `queryKeys.leads.messages(leadId)` al recibir refresh. |
| **Hook `useLeadMessages`** | ⚠️ **MOCK-GATED** | `hooks/queries/use-lead-messages.ts` | Contiene `MOCK_MESSAGES` + branch `NEXT_PUBLIC_MOCK_MODE`. Último vestigio de datos mock en el pipeline del Inbox. |
| **Hook `useSendMessageMutation`** | ✅ Producción | `hooks/mutations/use-send-message.ts` | Mutación optimista completa (`onMutate`/`onError`/`onSettled`), derivación de canal, flag `_optimistic` en metadata. |
| **`InboxComposer`** | ✅ Producción | `components/command-center/inbox-composer.tsx` | `<Textarea>`, `Shift+Enter` = newline, `isPending` disabled state, `Loader2` spinner. |
| **`InboxMessageList`** | ✅ Producción | `components/command-center/inbox-message-list.tsx` | `MessageBubble` con styling optimista (`opacity-60`, icono `Clock`), scroll-to-bottom. |
| **`InboxHeader`** | ✅ Producción | `components/command-center/inbox-header.tsx` | Funcional y completo. |
| **`InboxPanel`** | ✅ Orquestación | `components/command-center/inbox-panel.tsx` | SSE + Header + MessageList + Composer. Correcto. |
| **Store Zustand** | ✅ Producción | `stores/command-center-store.ts` | `selectedLeadId`, `setSelectedLeadId`. |
| **Query Keys** | ✅ Definidas | `lib/query-keys.ts` | `queryKeys.leads.messages(id)` ya existe. |
| **Tipos** | ✅ Alineados | `types/inbox-message.ts` | `InboxMessage`, `MessageSender`, `MessageChannel`. |
| **Seed Data** | ❌ No existe | — | `inbox_messages` vacía. Sin datos para validación visual. |

### 1.2 Hallazgo Crítico: Orden de Mensajes (Sort Mismatch)

El Route Handler GET retorna mensajes con `ORDER BY created_at DESC` (más recientes primero). Sin embargo, el `InboxMessageList` renderiza con `messages.map()` directo (sin `.reverse()`), y el `scrollEndRef` está al final del array — asumiendo orden **ascendente** (más antiguos primero, scroll hacia abajo = mensajes más nuevos).

**Consecuencia:** Con datos reales (a diferencia de mocks que están en orden ASC), los mensajes más recientes aparecerán arriba y el auto-scroll irá al mensaje más antiguo. El `useSendMessageMutation` tiene un heurístico para detectar DESC vs ASC, pero es frágil.

**Solución:** Cambiar el Route Handler GET a `ORDER BY created_at ASC` (alineado con la convención estándar de chat: antiguos arriba, nuevos abajo) o hacer `.reverse()` en el hook. Se opta por **cambiar a ASC en el backend** porque:
1. Elimina ambigüedad para todos los consumidores del endpoint.
2. La mutación optimista ya appends al final del array (convención ASC).
3. La paginación futura (scroll-up para cargar más) trabajará nativamente con `cursor > last_created_at` en ASC.

### 1.3 Hallazgo Secundario: Dual Inbox System

Coexisten dos sistemas de mensajería en el proyecto:

| Sistema | Tabla DB | API | UI Components | Store |
|---|---|---|---|---|
| **Lead Messages** (Command Center) | `inbox_messages` | `/api/leads/[id]/messages` | `InboxPanel`, `InboxMessageList`, `InboxComposer` | `command-center-store` (`selectedLeadId`) |
| **Threads** (Inbox Workspace) | `threads` + `messages` | `/api/threads` | `InboxList`, `InboxThreadView`, `InboxWorkspace` | `inbox-ui-store` (`selectedThreadId`) |

**Decisión para Sprint 1.8:** NO se unifican. Son dominios distintos:
- **Lead Messages** = timeline de interacciones con un lead del CRM (multicanal, vinculado al pipeline de ventas).
- **Threads** = conversaciones del sistema de soporte/agentes (handoff, escalamiento).

Este RFC se enfoca **exclusivamente** en el sistema Lead Messages del Command Center.

---

## 2. Objetivo del Sprint 1.8

> Conectar el `InboxPanel` y sus subcomponentes (`InboxMessageList`, `InboxComposer`) a la tabla `inbox_messages` en PostgreSQL. Eliminar todo mock. Validar el ciclo completo: UI → POST → DB → NOTIFY → SSE → UI con datos reales.

### Entregables

1. **Eliminación de `MOCK_MESSAGES`** y branch condicional en `use-lead-messages.ts`.
2. **Fix del sort order** en el GET handler: `ASC` en lugar de `DESC`.
3. **Migración DDL** versionada para `inbox_messages` (formalizar lo que ya existe en DB).
4. **Seed migration** con mensajes de prueba vinculados a los leads del seed de RFC-026.
5. **Schema Zod extraído** para mensajes (paralelismo con `lib/validations/lead.ts` de RFC-026).
6. **Validación E2E:** Seleccionar lead en Kanban → ver mensajes reales en Inbox → enviar → ver respuesta optimista → confirmar persistencia.

---

## 3. Diseño Técnico

### 3.1 Eliminación de Mocks (`use-lead-messages.ts`)

**Antes (actual):**
```typescript
const MOCK_MESSAGES: Record<string, InboxMessage[]> = {
  'mock-lead-1': [ /* ... 2 items hardcoded ... */ ],
};

export function useLeadMessages(leadId: string | null) {
  return useQuery({
    queryKey: queryKeys.leads.messages(leadId!),
    queryFn: async () => {
      if (process.env.NEXT_PUBLIC_MOCK_MODE === 'true') {
        return MOCK_MESSAGES[leadId!] || [];
      }
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

**Después:**
```typescript
import { useQuery } from '@tanstack/react-query';
import { queryKeys } from '@/lib/query-keys';
import type { InboxMessage } from '@/types/inbox-message';

async function fetchLeadMessages(leadId: string): Promise<InboxMessage[]> {
  const res = await fetch(`/api/leads/${leadId}/messages`);
  if (!res.ok) throw new Error(`Failed to fetch messages: ${res.status}`);
  const json = await res.json();
  return json.data as InboxMessage[];
}

export function useLeadMessages(leadId: string | null) {
  return useQuery<InboxMessage[], Error>({
    queryKey: queryKeys.leads.messages(leadId!),
    queryFn: () => fetchLeadMessages(leadId!),
    enabled: !!leadId,
    staleTime: 10_000,
  });
}
```

**Racional:** Idéntico a la limpieza de `use-leads.ts` en RFC-026. El `NEXT_PUBLIC_MOCK_MODE` ya no tiene consumers en el proyecto.

### 3.2 Fix Sort Order en GET Handler

**Archivo:** `app/api/leads/[id]/messages/route.ts`

**Cambio:**
```sql
-- ANTES
ORDER BY created_at DESC

-- DESPUÉS
ORDER BY created_at ASC
```

**Impacto:** La `InboxMessageList` renderiza el array secuencialmente con `scrollEndRef` al final. Con ASC, los mensajes más recientes quedan abajo (patrón estándar de chat). La mutación optimista en `useSendMessageMutation` ya appends al final, eliminando la necesidad del heurístico DESC/ASC.

**Simplificación derivada en `use-send-message.ts`:** El bloque que detecta `isDesc` y decide si prepend o append se puede simplificar a siempre `[...previousMessages, optimisticMsg]`. Sin embargo, para minimizar delta en este sprint, se deja el heurístico (es defensivo y no causa daño).

### 3.3 Migración DDL para `inbox_messages`

La tabla existe en la base de datos (el Route Handler POST inserta correctamente), pero no hay archivo de migración versionado en `supabase/migrations/`. Se crea uno idempotente:

**Nuevo archivo:** `supabase/migrations/20260421200000_inbox_messages_schema.sql`

```sql
-- ============================================================
-- RFC-027: Inbox Messages DDL (idempotent)
-- Formaliza la tabla inbox_messages ya existente en DB.
-- Source of truth: RFC-021 §2.3
-- ============================================================

-- Types (IF NOT EXISTS for idempotency)
DO $$ BEGIN
  CREATE TYPE message_sender AS ENUM ('customer', 'ai_agent', 'human_admin');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE message_channel AS ENUM ('telegram', 'whatsapp', 'web', 'email');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

CREATE TABLE IF NOT EXISTS inbox_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sender        message_sender  NOT NULL,
  channel       message_channel NOT NULL,
  content       TEXT NOT NULL,
  external_id   TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indices (IF NOT EXISTS)
CREATE INDEX IF NOT EXISTS idx_messages_timeline
  ON inbox_messages (lead_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_messages_external_id
  ON inbox_messages (external_id)
  WHERE external_id IS NOT NULL;

-- RLS (enable but allow all for single-tenant)
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

DO $$ BEGIN
  CREATE POLICY "Allow all for authenticated"
    ON inbox_messages
    FOR ALL
    TO authenticated
    USING (true)
    WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
```

### 3.4 Seed Migration para Mensajes

**Nuevo archivo:** `supabase/migrations/20260421200001_seed_inbox_messages_dev.sql`

Los mensajes se vinculan a los leads del seed de RFC-026 (Sprint 1.7) mediante subconsulta por nombre. Esto evita hardcodear UUIDs.

```sql
-- ============================================================
-- RFC-027: Seed inbox_messages para desarrollo
-- Depende de: seed_leads_dev (RFC-026)
-- ============================================================

-- Mensajes para María Torres (New, inbound_web)
INSERT INTO inbox_messages (lead_id, sender, channel, content, metadata, created_at)
SELECT l.id, s.sender::message_sender, s.channel::message_channel, s.content, s.metadata::jsonb, s.ts::timestamptz
FROM leads l
CROSS JOIN (VALUES
  ('customer', 'web', 'Hola, me interesa conocer más sobre Teseo AI para mi empresa.', '{"seed": true}', now() - interval '2 hours'),
  ('ai_agent', 'web', '¡Hola María! Con gusto. Teseo AI es una plataforma de agentes inteligentes para CRM. ¿En qué industria opera Acme Corp?', '{"seed": true, "confidence": 0.92}', now() - interval '1 hour 55 minutes'),
  ('customer', 'web', 'Estamos en manufactura. Necesitamos automatizar el seguimiento de leads.', '{"seed": true}', now() - interval '1 hour 50 minutes'),
  ('ai_agent', 'web', 'Perfecto. Nuestro módulo SDR automatiza la calificación y seguimiento. ¿Te gustaría agendar una demo?', '{"seed": true, "confidence": 0.88}', now() - interval '1 hour 45 minutes')
) AS s(sender, channel, content, metadata, ts)
WHERE l.name = 'María Torres'
  AND l.metadata->>'seed' = 'true'
ON CONFLICT DO NOTHING;

-- Mensajes para Lucía Ramírez (Contacted, inbound_whatsapp)
INSERT INTO inbox_messages (lead_id, sender, channel, content, metadata, created_at)
SELECT l.id, s.sender::message_sender, s.channel::message_channel, s.content, s.metadata::jsonb, s.ts::timestamptz
FROM leads l
CROSS JOIN (VALUES
  ('customer', 'whatsapp', 'Vi su anuncio en LinkedIn. ¿Qué planes manejan?', '{"seed": true}', now() - interval '5 hours'),
  ('ai_agent', 'whatsapp', 'Hola Lucía, gracias por contactarnos. Tenemos 3 planes según el volumen de leads. ¿Cuántos leads manejan al mes?', '{"seed": true, "confidence": 0.95}', now() - interval '4 hours 55 minutes'),
  ('customer', 'whatsapp', 'Aproximadamente 200-300 al mes.', '{"seed": true}', now() - interval '4 hours 50 minutes'),
  ('human_admin', 'whatsapp', 'Lucía, te paso con nuestro equipo de ventas para darte una cotización personalizada. Te contactarán en breve.', '{"seed": true}', now() - interval '4 hours 30 minutes')
) AS s(sender, channel, content, metadata, ts)
WHERE l.name = 'Lucía Ramírez'
  AND l.metadata->>'seed' = 'true'
ON CONFLICT DO NOTHING;

-- Mensajes para Roberto Vega (New, inbound_telegram)
INSERT INTO inbox_messages (lead_id, sender, channel, content, metadata, created_at)
SELECT l.id, s.sender::message_sender, s.channel::message_channel, s.content, s.metadata::jsonb, s.ts::timestamptz
FROM leads l
CROSS JOIN (VALUES
  ('customer', 'telegram', 'Buenas tardes, ¿tienen integración con Telegram para atención al cliente?', '{"seed": true}', now() - interval '3 hours'),
  ('ai_agent', 'telegram', 'Hola Roberto. Sí, Teseo AI se integra nativamente con Telegram, WhatsApp y Web. El bot puede calificar leads, responder FAQs y escalar a un humano cuando sea necesario.', '{"seed": true, "confidence": 0.91}', now() - interval '2 hours 55 minutes')
) AS s(sender, channel, content, metadata, ts)
WHERE l.name = 'Roberto Vega'
  AND l.metadata->>'seed' = 'true'
ON CONFLICT DO NOTHING;

-- Mensajes para Patricia Mendoza (Qualified, outbound_hunter)
INSERT INTO inbox_messages (lead_id, sender, channel, content, metadata, created_at)
SELECT l.id, s.sender::message_sender, s.channel::message_channel, s.content, s.metadata::jsonb, s.ts::timestamptz
FROM leads l
CROSS JOIN (VALUES
  ('human_admin', 'email', 'Hola Patricia, soy Jorge de Teseo AI. Vi que StartupNow está creciendo rápido. ¿Tienen un CRM para gestionar su pipeline?', '{"seed": true}', now() - interval '1 day'),
  ('customer', 'email', 'Hola Jorge, usamos spreadsheets todavía. Estamos buscando algo más profesional.', '{"seed": true}', now() - interval '23 hours'),
  ('human_admin', 'email', 'Perfecto timing. Te envío una propuesta con precios especiales para startups. ¿Tienes 30 min esta semana para una demo?', '{"seed": true}', now() - interval '22 hours'),
  ('customer', 'email', 'Sí, el jueves a las 10am me funciona.', '{"seed": true}', now() - interval '21 hours'),
  ('human_admin', 'email', 'Confirmado. Te envío la invitación de Google Meet.', '{"seed": true}', now() - interval '20 hours 30 minutes')
) AS s(sender, channel, content, metadata, ts)
WHERE l.name = 'Patricia Mendoza'
  AND l.metadata->>'seed' = 'true'
ON CONFLICT DO NOTHING;
```

### 3.5 Schema Zod Extraído para Mensajes

**Nuevo archivo:** `lib/validations/message.ts`

```typescript
import { z } from 'zod';

export const messageChannelEnum = z.enum(['telegram', 'whatsapp', 'web', 'email']);
export const messageSenderEnum = z.enum(['customer', 'ai_agent', 'human_admin']);

export const createMessageSchema = z.object({
  content: z.string().min(1, 'Content is required').max(4000, 'Message too long'),
  channel: messageChannelEnum,
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export type CreateMessageInput = z.infer<typeof createMessageSchema>;
export type MessageChannel = z.infer<typeof messageChannelEnum>;
export type MessageSender = z.infer<typeof messageSenderEnum>;
```

El Route Handler POST importará de este módulo en lugar de definir el schema inline.

---

## 4. Diagrama de Secuencia (Ciclo Completo E2E)

```
┌──────────┐  click lead   ┌──────────────┐    ┌──────────────┐    ┌──────────┐
│ Kanban   │ ─────────────► │ Zustand      │    │ InboxPanel   │    │ Supabase │
│ Board    │                │ selectedLeadId│───►│ (re-render)  │    │ (PG)     │
└──────────┘                └──────────────┘    └──────┬───────┘    └────┬─────┘
                                                       │                 │
                                                       │  useLeadMessages│
                                                       │  (TanStack Q)  │
                                                       ├────────────────►│
                                                       │  GET /api/leads │
                                                       │  /:id/messages  │
                                                       │                 │
                                                       │  SELECT * FROM  │
                                                       │  inbox_messages │
                                                       │  WHERE lead_id= │
                                                       │  ORDER BY ASC   │
                                                       │◄────────────────┤
                                                       │                 │
                                                       │  Render bubbles │
                                                       │  + scroll to    │
                                                       │    bottom        │
                                                       │                 │
                                              ┌────────┴────────┐       │
                                              │  useLeadSSE     │       │
                                              │  EventSource    │       │
                                              │  LISTEN inbox_ch│───────┤
                                              └─────────────────┘       │
                                                                        │
         ┌─────────────────── SEND FLOW ──────────────────────┐        │
         │                                                     │        │
    ┌────┴─────┐    mutate()    ┌───────────────┐             │        │
    │ Composer │ ──────────────►│ useSendMessage │             │        │
    │ (Enter)  │                │ Mutation       │             │        │
    └──────────┘                │                │             │        │
                                │ onMutate:      │             │        │
                                │  snapshot cache│             │        │
                                │  inject optim. │             │        │
                                │  msg (0.6 op.) │             │        │
                                │                │             │        │
                                │ POST /api/leads│             │        │
                                │ /:id/messages  ├────────────────────►│
                                │                │             │  INSERT│
                                │                │             │  +     │
                                │                │             │NOTIFY  │
                                │                │             │        │
                                │ onSettled:     │             │  SSE   │
                                │ invalidateQ()  │◄───────────refetch──┤
                                │ (idempotent)   │             │        │
                                └────────────────┘             │        │
         └─────────────────────────────────────────────────────┘        │
```

---

## 5. WBS (Work Breakdown Structure) — Pasos Atómicos para Night Coder

### Fase 1: Migración DDL + Seed (Backend/DB)

| # | Tarea | Archivo(s) | Criterio de Aceptación |
|---|---|---|---|
| 1.1 | Crear migración DDL idempotente para `inbox_messages` (tipos ENUM + tabla + índices + RLS). | `supabase/migrations/20260421200000_inbox_messages_schema.sql` **(NUEVO)** | `supabase db push` exitoso. `\dt inbox_messages` confirma tabla. |
| 1.2 | Crear seed migration con mensajes para 4 leads del seed RFC-026 (María, Lucía, Roberto, Patricia). | `supabase/migrations/20260421200001_seed_inbox_messages_dev.sql` **(NUEVO)** | Migración exitosa. `SELECT count(*) FROM inbox_messages` retorna ≥ 15 rows. |
| 1.3 | Ejecutar ambas migraciones en entorno local. | CLI | `supabase db push` o equivalente sin errores. |

### Fase 2: Fix Sort Order + Extracción Zod (Backend)

| # | Tarea | Archivo(s) | Criterio de Aceptación |
|---|---|---|---|
| 2.1 | Cambiar `ORDER BY created_at DESC` → `ORDER BY created_at ASC` en el GET handler. | `app/api/leads/[id]/messages/route.ts` | `curl GET /api/leads/:id/messages` retorna mensajes con `created_at` ascendente (más antiguo primero). |
| 2.2 | Crear `lib/validations/message.ts` con schemas Zod extraídos (`createMessageSchema`, enums, tipos). | `lib/validations/message.ts` **(NUEVO)** | Archivo creado con exports tipados. Compila sin errores. |
| 2.3 | Refactorizar POST handler: importar `createMessageSchema` de `@/lib/validations/message` y eliminar schema inline. | `app/api/leads/[id]/messages/route.ts` | Schema inline removido. Import funcional. POST sigue retornando 201/400/404 correctamente. |

### Fase 3: Eliminación de Mocks (Frontend)

| # | Tarea | Archivo(s) | Criterio de Aceptación |
|---|---|---|---|
| 3.1 | Eliminar `MOCK_MESSAGES` record y branch `NEXT_PUBLIC_MOCK_MODE` de `use-lead-messages.ts`. Dejar solo `fetchLeadMessages()` con `fetch('/api/leads/${leadId}/messages')` y el hook `useLeadMessages()`. | `hooks/queries/use-lead-messages.ts` | Archivo contiene ≤20 líneas. Zero references a `MOCK` o `MOCK_MODE`. |
| 3.2 | Grep global `NEXT_PUBLIC_MOCK_MODE` para confirmar que no hay más consumers en el proyecto. | Proyecto completo | `grep -rn NEXT_PUBLIC_MOCK_MODE --include="*.ts" --include="*.tsx" | grep -v node_modules` retorna 0 resultados. |
| 3.3 | Eliminar `NEXT_PUBLIC_MOCK_MODE` de `.env.local` y `.env.example` si existe. | `.env*` | Variable removida o confirmada como inexistente en ambos archivos. |

### Fase 4: Validación E2E (QA)

| # | Tarea | Método | Criterio de Aceptación |
|---|---|---|---|
| 4.1 | Verificar que `GET /api/leads/:id/messages` retorna mensajes del seed en orden ASC. | `curl` con UUID de un lead del seed. | Response 200 con `data: [...]`, `created_at` ascendente. |
| 4.2 | Verificar que al hacer click en un lead del Kanban, el `InboxPanel` muestra sus mensajes reales. | UI en `localhost:3000`. | Panel derecho muestra las burbujas de chat con sender correcto (customer/ai_agent/human_admin), timestamp formateado, y scroll al fondo. |
| 4.3 | Verificar envío de mensaje: escribir texto → Enter → mensaje aparece con `opacity-60` + icono Clock → tras ~200ms aparece con opacidad completa y timestamp real. | UI + Network tab (sin throttling). | Ciclo completo sin errores en console. |
| 4.4 | Verificar envío con Network throttled (Slow 3G): mensaje optimista visible inmediatamente, confirmación llega después. | UI + Network throttled. | UX de latencia cero percibida. |
| 4.5 | Verificar rollback: desconectar Network → enviar → toast de error aparece → mensaje optimista desaparece. | UI + Network offline en DevTools. | Toast "No se pudo enviar el mensaje" + rollback visual. |
| 4.6 | Verificar SSE bidireccional: abrir 2 tabs del mismo lead → enviar en tab A → mensaje aparece en tab B sin refresh. | 2 tabs del browser. | Mensaje visible en ambas tabs en <2s. |
| 4.7 | Verificar lead sin mensajes: seleccionar un lead del seed que no tiene mensajes (Carlos, Ana, Fernando). | UI. | Inbox muestra lista vacía (sin errores, sin skeleton infinito). |
| 4.8 | Verificar que la `InboxMessageList` muestra correctamente los 3 tipos de sender con sus estilos diferenciados. | UI visual. | `customer` = fondo muted (izquierda), `ai_agent` = fondo blue/10 (derecha), `human_admin` = fondo primary (derecha). |

---

## 6. Archivos Impactados (Delta Completo)

| Archivo | Acción | Fase | Descripción |
|---|---|---|---|
| `supabase/migrations/20260421200000_inbox_messages_schema.sql` | **CREATE** | 1.1 | DDL idempotente para `inbox_messages` |
| `supabase/migrations/20260421200001_seed_inbox_messages_dev.sql` | **CREATE** | 1.2 | Seed data: ~15 mensajes para 4 leads |
| `app/api/leads/[id]/messages/route.ts` | **MODIFY** | 2.1, 2.3 | Fix sort order ASC + import schema externo |
| `lib/validations/message.ts` | **CREATE** | 2.2 | Zod schemas + tipos para mensajes |
| `hooks/queries/use-lead-messages.ts` | **MODIFY** | 3.1 | Kill `MOCK_MESSAGES` + `MOCK_MODE` branch |

**Total de archivos nuevos:** 3
**Total de archivos modificados:** 2
**Total de archivos sin cambios:** `inbox-composer.tsx`, `inbox-message-list.tsx`, `inbox-panel.tsx`, `inbox-header.tsx`, `use-send-message.ts`, `use-lead-sse.ts`, `types/inbox-message.ts`, `lib/query-keys.ts`, `stores/command-center-store.ts`

---

## 7. Orden de Ejecución

```
Fase 1 (DDL + Seed)
    │
    ├── 1.1 Migración DDL inbox_messages
    ├── 1.2 Seed messages
    └── 1.3 Ejecutar migraciones
         │
         ▼
Fase 2 (Backend Fixes)           ◄── Depende de que la tabla tenga datos
    │
    ├── 2.1 Fix sort ASC
    ├── 2.2 Crear lib/validations/message.ts
    └── 2.3 Refactorizar POST handler
         │
         ▼
Fase 3 (Kill Mocks)             ◄── Depende de que el GET retorne datos reales
    │
    ├── 3.1 Limpiar use-lead-messages.ts
    ├── 3.2 Grep global MOCK_MODE
    └── 3.3 Limpiar .env
         │
         ▼
Fase 4 (E2E Validation)         ◄── Depende de todas las anteriores
    │
    └── 4.1 → 4.8 Tests manuales
```

**Estimación total:** ~1.5 horas de ejecución limpia para Night Coder (el grueso del trabajo de RFC-023 ya fue implementado en sprints anteriores — Composer, mutación optimista, MessageBubble styling, route handler hardening).

---

## 8. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Seed leads de RFC-026 no existen en DB (Sprint 1.7 no ejecutado) | Baja | 🔴 Seed messages falla por FK | El seed usa `WHERE l.metadata->>'seed' = 'true'` con `ON CONFLICT DO NOTHING`. Si no hay leads, simplemente no inserta (fail-safe). Ejecutar primero el seed de RFC-026. |
| `inbox_messages` DDL colisiona con tabla ya existente | Media | 🟡 Error de migración | DDL usa `CREATE TABLE IF NOT EXISTS` y `DO $$ ... EXCEPTION WHEN duplicate_object` para idempotencia total. |
| Cambio de ASC rompe la lógica de `useSendMessageMutation` heurístico | Muy baja | 🟡 Duplicados visuales | El heurístico detecta ASC y appends al final. Con ASC explícito, el heurístico coincide y funciona correctamente. |
| `inbox_messages` vacía en producción futura (sin seed) | Esperado | 🟢 UX vacía | La `InboxMessageList` ya muestra skeleton durante loading y vacío sin errores cuando `messages = []`. Comportamiento correcto. |

---

## 9. Decisiones de Diseño

| Decisión | Alternativa Descartada | Razón |
|---|---|---|
| `ORDER BY ASC` en GET | Mantener DESC + `.reverse()` en frontend | Elimina ambigüedad. Convención estándar de chat. Paginación futura con cursor funciona nativamente. |
| DDL idempotente (`IF NOT EXISTS`) | DDL estricto que falla si ya existe | La tabla fue creada manualmente en sprints anteriores. Idempotencia permite ejecutar la migración sin riesgo. |
| NO unificar Lead Messages con Threads | Migrar todo a un solo modelo | Dominios distintos (CRM pipeline vs soporte/agentes). Unificar forzaría compromisos en ambos schemas. Sprint 1.8 no es el momento. |
| Zod schema extraído a `lib/validations/` | Mantener inline | Consistencia con RFC-026 (`lib/validations/lead.ts`). DRY para cuando se necesite reutilizar en formularios frontend. |
| Seed por subconsulta `WHERE name =` | Seed con UUIDs hardcoded | Resiliente a cambios de UUID entre `db reset`. Vinculación por nombre + flag `seed: true` en metadata. |

---

## 10. Deuda Técnica Identificada (Fuera de Scope)

Elementos detectados durante la auditoría que NO se abordan en este sprint pero deben documentarse:

1. **Paginación infinita en el Inbox:** Actualmente `useLeadMessages` trae los primeros 50 mensajes. Para leads con historial largo, se necesita scroll-up + `useInfiniteQuery` con cursor-based pagination.
2. **Indicador de "escribiendo..." (typing indicator):** El SSE channel podría transmitir eventos de `typing_start`/`typing_stop` cuando el AI agent está procesando.
3. **Attachments (imágenes, PDFs):** El campo `metadata` de `inbox_messages` soporta `media_urls` según RFC-021, pero no hay UI para renderizar attachments en `MessageBubble`.
4. **Unificación Lead Messages ↔ Threads:** Cuando el sistema madure, evaluar si ambos sistemas deben converger en un modelo unificado con vistas diferenciadas.
5. **Empty State con CTA:** Cuando un lead no tiene mensajes, mostrar un `<EmptyInbox />` con botón "Enviar primer mensaje" que focus el Composer.
6. **Reconciliación del heurístico ASC/DESC:** Una vez confirmado que el GET retorna ASC en producción, simplificar `use-send-message.ts` eliminando la detección `isDesc`.

---

*Documento generado por Builder (Arquitecto Staff) — Equipo Teseo.*
*Pendiente: Aprobación del CEO para iniciar ejecución por Night Coder.*
