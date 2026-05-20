# RFC-023: Inbox Composer — Layout y Mutación de Cierre de Ciclo UI/DB

| Campo | Valor |
|---|---|
| **ID** | RFC-023 |
| **Estado** | Draft |
| **Autor** | Builder (Arquitecto Staff, Equipo Teseo) |
| **Fecha** | 2026-04-21 |
| **Sprint** | 1.1 — CRM-Agéntico (Tenant OS) |
| **Depende de** | RFC-021 (DB Schema), RFC-022 (Command Center UI), ADR-117 (SSE + D&D) |
| **Proyecto** | `crm-agentico-panel` |

---

## 1. Contexto y Auditoría del Estado Actual

El Command Center ya cuenta con:
- ✅ `InboxComposer` en `components/command-center/inbox-composer.tsx` — componente funcional básico.
- ✅ `useSendMessageMutation` en `hooks/mutations/use-send-message.ts` — llama `POST /api/leads/[id]/messages`.
- ✅ Route Handler `POST /api/leads/[id]/messages` — inserta en `inbox_messages`, dispara `NOTIFY inbox_channel`.
- ✅ `useLeadSSE` con reconexión exponencial — invalida `queryKeys.leads.messages(leadId)` al recibir refresh.
- ✅ `InboxMessageList` con `MessageBubble` diferenciada por sender (customer / ai_agent / human_admin).
- ✅ Componente `Textarea` de shadcn/ui disponible en `components/ui/textarea.tsx`.

### 1.1 Brechas Identificadas

| # | Brecha | Severidad | Archivo Afectado |
|---|---|---|---|
| G1 | El Composer usa `<Input>` (single-line) en lugar de `<Textarea>` multi-línea. No hay auto-resize. | 🟡 UX | `inbox-composer.tsx` |
| G2 | No existe indicador visual de "enviando" (spinner/disabled state del textarea, no solo del botón). | 🟡 UX | `inbox-composer.tsx` |
| G3 | No hay mutación optimista en `useSendMessageMutation` — el mensaje aparece solo después del refetch SSE, causando latencia percibida de ~200-500ms. | 🟡 UX | `use-send-message.ts` |
| G4 | El Route Handler `POST` no valida que el `lead_id` exista en la tabla `leads` antes de insertar. Un UUID válido pero inexistente genera FK violation (Supabase lo atrapa, pero el error es opaco: 500). | 🔴 Robustez | `app/api/leads/[id]/messages/route.ts` |
| G5 | El campo `error` del catch en el Route Handler asume `error.message` sin type-guard, TypeScript lo marca como `unknown`. | 🟡 TypeScript | `app/api/leads/[id]/messages/route.ts` |
| G6 | No hay feedback visual de error al usuario si el envío falla (toast). | 🟡 UX | `inbox-composer.tsx` |
| G7 | `handleKeyDown` captura `Enter` sin `shiftKey`, pero sobre un `<Input>` esto es irrelevante. Sobre `<Textarea>`, `Enter` = send, `Shift+Enter` = newline — comportamiento estándar de chat que necesita implementarse. | 🟡 UX | `inbox-composer.tsx` |

### 1.2 Lo Que NO Se Toca

| Componente | Archivo | Razón |
|---|---|---|
| `InboxPanel` | `components/command-center/inbox-panel.tsx` | Orquestación correcta: SSE + Header + MessageList + Composer. |
| `InboxMessageList` + `MessageBubble` | `components/command-center/inbox-message-list.tsx` | Lógica de renderizado sólida con scroll-to-bottom. |
| `InboxHeader` | `components/command-center/inbox-header.tsx` | Funcional y completo. |
| `useLeadSSE` | `hooks/use-lead-sse.ts` | Reconexión con backoff exponencial, patrón correcto. |
| `useLeadMessages` | `hooks/queries/use-lead-messages.ts` | Query con `enabled: !!leadId`, `staleTime: 10s`. Correcto. |
| Route Handler `GET` messages | `app/api/leads/[id]/messages/route.ts` | Paginación con offset/limit, auth Supabase SSR. |
| SSE Stream endpoint | `app/api/leads/[id]/messages/stream/route.ts` | LISTEN/NOTIFY con cleanup y keepalive. Producción. |
| `queryKeys` registry | `lib/query-keys.ts` | Ya tiene `leads.messages(id)`. |
| DB Schema | `inbox_messages` (RFC-021) | Estable. No requiere migración. |

---

## 2. Decisiones de Diseño

### 2.1 Textarea Multi-Línea con Auto-Resize (No Rich Editor)

**Decisión:** Reemplazar `<Input>` por el `<Textarea>` de shadcn/ui existente. Sin editor rich-text (TipTap, Slate, etc.).

**Razón:**
1. El canal de salida es Telegram/WhatsApp/Web — todos interpretan texto plano (o Markdown básico que no necesita WYSIWYG).
2. El `<Textarea>` de shadcn/ui ya tiene `field-sizing-content` (auto-resize nativo CSS) con `min-h-16`.
3. Un rich editor añade ~80KB de bundle y complejidad de estado para cero ganancia funcional en este Sprint.

**Configuración del Textarea:**
- `min-h-[40px]` (override a shadcn default de `min-h-16`)
- `max-h-[160px]` con `overflow-y: auto` (limitar expansión a ~6 líneas)
- `resize-none` (prevenir resize manual)
- Focus ring heredado de shadcn

### 2.2 Mutación: Route Handler (No Server Action)

**Decisión:** Mantener el Route Handler `POST /api/leads/[id]/messages` existente. No migrar a Server Action.

**Razón:**
1. El Route Handler ya existe, está probado y tiene validación Zod + Auth Supabase SSR.
2. El `useSendMessageMutation` de TanStack Query ya apunta a este endpoint. Server Actions requieren `useActionState` o un wrapper diferente, rompiendo el patrón de mutación optimista con `onMutate/onError/onSettled`.
3. El NOTIFY de Postgres necesita el `pool` de `pg` (conexión directa), que solo está disponible en Route Handlers (server-side). Server Actions podrían accederlo, pero el handler ya lo hace correctamente.

### 2.3 Mutación Optimista en el Composer

**Decisión:** Añadir `onMutate` al `useSendMessageMutation` para inyectar el mensaje localmente en el cache de TanStack Query antes de que el backend responda.

**Flujo:**
```
[User clicks Send]
    │
    ▼ onMutate: snapshot cache → inject optimistic message (with temp id)
    │
    ├─ POST /api/leads/:id/messages  (background)
    │     │
    │     ├─ 201 → onSuccess: invalidateQueries (SSE también invalidará, es idempotente)
    │     │
    │     └─ 4xx/5xx → onError: rollback cache from snapshot → show toast
    │
    └─ Textarea se limpia inmediatamente (UX: zero-latency)
```

**Formato del mensaje optimista (inyectado en cache):**
```typescript
const optimisticMsg: InboxMessage = {
  id: crypto.randomUUID(),   // temp — será reemplazado por invalidation
  lead_id: leadId,
  sender: 'human_admin',
  channel: detectedChannel,
  content: content.trim(),
  external_id: null,
  metadata: { _optimistic: true },  // flag para styling opcional (opacity reducida)
  created_at: new Date().toISOString(),
};
```

### 2.4 Validación de Existencia del Lead en el Backend

**Decisión:** Antes del `INSERT INTO inbox_messages`, el Route Handler verificará que el lead existe con un query ligero.

**Implementación:** Reutilizar el cliente Supabase que ya está autenticado:
```sql
SELECT id FROM leads WHERE id = $1 LIMIT 1
```
Si no existe, retornar `404 { error: "Lead not found" }` antes de intentar el INSERT.

---

## 3. WBS (Work Breakdown Structure)

### Fase 1: Upgrade del Componente InboxComposer (Frontend)

| # | Tarea | Archivo | Estimación | Dependencia |
|---|---|---|---|---|
| 1.1 | Reemplazar `<Input>` por `<Textarea>` de shadcn/ui con auto-resize constraints (`min-h-[40px]`, `max-h-[160px]`, `resize-none`) | `components/command-center/inbox-composer.tsx` | 15min | — |
| 1.2 | Actualizar `handleKeyDown` para `<textarea>`: `Enter` sin `Shift` = submit, `Shift+Enter` = newline | `components/command-center/inbox-composer.tsx` | 10min | 1.1 |
| 1.3 | Añadir estado visual de "enviando": `isPending` deshabilita el Textarea + aplica `opacity-50` + muestra `Loader2` (animate-spin) en el botón en lugar de `Send` | `components/command-center/inbox-composer.tsx` | 10min | 1.1 |
| 1.4 | Integrar toast de error con `sonner` (`toast.error('No se pudo enviar el mensaje')`) en el callback `onError` del `mutate()` | `components/command-center/inbox-composer.tsx` | 10min | 1.3 |

### Fase 2: Mutación Optimista (Hook)

| # | Tarea | Archivo | Estimación | Dependencia |
|---|---|---|---|---|
| 2.1 | Añadir `onMutate` a `useSendMessageMutation`: snapshot de `queryKeys.leads.messages(leadId)` → inyectar mensaje optimista al final del array | `hooks/mutations/use-send-message.ts` | 20min | — |
| 2.2 | Añadir `onError`: rollback al snapshot previo | `hooks/mutations/use-send-message.ts` | 5min | 2.1 |
| 2.3 | Mover `onSettled` con `invalidateQueries` (ya existe en `onSuccess` — mover a `onSettled` para cubrir también errores) | `hooks/mutations/use-send-message.ts` | 5min | 2.1 |
| 2.4 | Refactor de la interfaz `SendMessagePayload` para incluir el `channel` como campo derivable del lead (no requerido del caller) — centralizar la lógica de detección de canal en el hook | `hooks/mutations/use-send-message.ts` | 15min | 2.1 |

### Fase 3: Hardening del Route Handler (Backend)

| # | Tarea | Archivo | Estimación | Dependencia |
|---|---|---|---|---|
| 3.1 | Añadir validación de existencia del lead (`SELECT id FROM leads WHERE id = $1`) antes del INSERT. Retornar 404 si no existe. | `app/api/leads/[id]/messages/route.ts` | 10min | — |
| 3.2 | Corregir type-guard del `catch`: `error instanceof Error ? error.message : 'Internal Server Error'` en ambos handlers (GET y POST) | `app/api/leads/[id]/messages/route.ts` | 5min | — |
| 3.3 | Envolver el bloque `pg_notify` en el mismo try/catch del INSERT (actualmente es un try/catch separado que puede silenciar fallos). Loguear pero no fallar el request si NOTIFY falla. | `app/api/leads/[id]/messages/route.ts` | 10min | 3.1 |

### Fase 4: Estilo Opcional del Mensaje Optimista (Frontend)

| # | Tarea | Archivo | Estimación | Dependencia |
|---|---|---|---|---|
| 4.1 | En `MessageBubble`, detectar `metadata._optimistic === true` y aplicar `opacity-60` + icono de reloj (`Clock` de lucide) en lugar del timestamp | `components/command-center/inbox-message-list.tsx` | 10min | 2.1 |
| 4.2 | Verificar que al llegar el refetch (SSE o invalidation), el mensaje optimista se reemplaza limpiamente por el mensaje real (sin duplicados). Esto ocurre naturalmente porque `invalidateQueries` reemplaza todo el array. | Test manual | 10min | 4.1 |

---

## 4. Diagrama de Secuencia (Ciclo Completo)

```
┌──────────┐    ┌───────────────┐    ┌─────────────┐    ┌──────────┐    ┌──────────┐
│ Textarea │    │  TanStack     │    │ Route       │    │ Supabase │    │ SSE      │
│ (UI)     │    │  Mutation     │    │ Handler     │    │ (PG)     │    │ Stream   │
└────┬─────┘    └──────┬────────┘    └──────┬──────┘    └────┬─────┘    └────┬─────┘
     │                 │                    │                │              │
     │  Enter/Click    │                    │                │              │
     ├────────────────►│                    │                │              │
     │                 │ onMutate:          │                │              │
     │                 │ inject optimistic  │                │              │
     │  Clear textarea │ message to cache   │                │              │
     │◄────────────────┤                    │                │              │
     │                 │                    │                │              │
     │  Show optimistic│  POST /messages    │                │              │
     │  bubble (0.6op) ├───────────────────►│                │              │
     │                 │                    │  Validate Zod  │              │
     │                 │                    │  Check lead    │              │
     │                 │                    │  exists        │              │
     │                 │                    ├───────────────►│              │
     │                 │                    │  INSERT msg    │              │
     │                 │                    ├───────────────►│              │
     │                 │                    │                │              │
     │                 │                    │  pg_notify     │              │
     │                 │                    │  'inbox_ch'    │              │
     │                 │                    ├───────────────►│──────event──►│
     │                 │                    │                │              │
     │                 │    201 Created     │                │              │
     │                 │◄───────────────────┤                │              │
     │                 │                    │                │  SSE: refresh│
     │                 │ onSettled:         │                │              │
     │                 │ invalidateQueries  │◄───────────────────refetch───┤
     │                 │ (idempotent with   │                │              │
     │                 │  SSE invalidation) │                │              │
     │  Re-render with │                    │                │              │
     │  real message   │                    │                │              │
     │  (full opacity) │                    │                │              │
     │◄────────────────┤                    │                │              │
```

---

## 5. Contratos y Schemas

### 5.1 Schema Zod del POST (Ya Existente — Sin Cambios)

```typescript
const postMessageSchema = z.object({
  content: z.string().min(1, "Content is required"),
  channel: z.enum(['telegram', 'whatsapp', 'web', 'email']),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});
```

### 5.2 Interfaz de Payload de Mutación (Propuesta de Refactor)

```typescript
// ANTES (actual):
interface SendMessagePayload {
  leadId: string;
  content: string;
  channel: 'telegram' | 'whatsapp' | 'web' | 'email';
}

// DESPUÉS (propuesta — canal derivado):
interface SendMessagePayload {
  leadId: string;
  content: string;
  channel?: MessageChannel;  // Opcional: si no se pasa, el hook lo deriva del lead.source
}
```

> **Nota:** La derivación canal ← source actualmente vive en `InboxComposer`. Moverla al hook centraliza la lógica y evita que cada caller tenga que conocer el mapping `source → channel`.

### 5.3 Response Contracts

**201 Created (éxito):**
```json
{
  "data": {
    "id": "uuid",
    "lead_id": "uuid",
    "sender": "human_admin",
    "channel": "whatsapp",
    "content": "Texto del mensaje",
    "external_id": null,
    "metadata": {},
    "created_at": "2026-04-21T16:00:00.000Z"
  }
}
```

**400 Validation Error:**
```json
{
  "error": [{ "code": "too_small", "path": ["content"], "message": "Content is required" }]
}
```

**404 Lead Not Found (NUEVO):**
```json
{
  "error": "Lead not found"
}
```

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Doble aparición del mensaje (optimistic + SSE refetch antes de `onSettled`) | Baja | 🟡 Visual glitch | `invalidateQueries` reemplaza todo el array — el mensaje optimista desaparece y se muestra el real. Si hay race condition temporal, el `id` temporal vs real los diferencia. |
| `field-sizing-content` no soportado en Safari <17.4 | Baja (Safari 17.4 = Sept 2023) | 🟡 Textarea no auto-resize | Fallback CSS: `min-height + overflow-y: auto`. El textarea funciona, solo no auto-resize. Aceptable para este Sprint. |
| El `pg` pool falla silenciosamente en NOTIFY (ya ocurre hoy) | Media | 🟡 Mensaje llega tarde (solo via polling/refetch) | Fase 3.3 mejora el logging. El `onSettled: invalidateQueries` del hook garantiza que el cache se actualice aunque el SSE no dispare. |
| Lead eliminado entre que el usuario abre el Inbox y envía | Muy baja | 🔴 Error 500 → 404 | Fase 3.1 añade la validación. El frontend muestra toast de error. |

---

## 7. Criterios de Aceptación (Tester)

| # | Criterio | Método de Verificación |
|---|---|---|
| AC-1 | El textarea permite multi-línea con `Shift+Enter` y envía con `Enter` solo. | Test manual en Chrome + Safari. |
| AC-2 | El textarea se auto-redimensiona hasta un máximo de ~6 líneas y luego muestra scroll. | Test manual visual. |
| AC-3 | Al enviar, el mensaje aparece inmediatamente en el chat con opacidad reducida (optimistic). | Test manual: enviar con Network throttled a Slow 3G. |
| AC-4 | Tras confirmación del backend, el mensaje se muestra con opacidad completa y timestamp real. | Test manual: verificar transición optimistic → real. |
| AC-5 | Si el POST falla (simular con Network offline), el mensaje optimistic desaparece y se muestra toast de error. | Test manual con DevTools Network offline. |
| AC-6 | Enviar a un `lead_id` inexistente retorna 404 (no 500). | `curl -X POST /api/leads/00000000-0000-0000-0000-000000000000/messages` |
| AC-7 | El SSE sigue disparando el refetch tras el envío (el ciclo UI → DB → NOTIFY → SSE → UI completo funciona). | Abrir 2 tabs: enviar en una, verificar que aparece en la otra. |

---

## 8. Archivos Impactados (Inventario para el Ejecutor)

| Archivo | Acción | Fases |
|---|---|---|
| `components/command-center/inbox-composer.tsx` | **Modificar** | 1.1, 1.2, 1.3, 1.4 |
| `hooks/mutations/use-send-message.ts` | **Modificar** | 2.1, 2.2, 2.3, 2.4 |
| `app/api/leads/[id]/messages/route.ts` | **Modificar** | 3.1, 3.2, 3.3 |
| `components/command-center/inbox-message-list.tsx` | **Modificar** | 4.1 |
| `types/inbox-message.ts` | Sin cambios | — |
| `lib/query-keys.ts` | Sin cambios | — |
| `hooks/use-lead-sse.ts` | Sin cambios | — |

**Total de archivos nuevos:** 0
**Total de archivos modificados:** 4

---

## 9. Orden de Ejecución Recomendado

```
Fase 3 (Backend Hardening)      ← Independiente, puede ir primero
    │
    ▼
Fase 2 (Mutación Optimista)     ← Depende de que el backend esté robusto
    │
    ▼
Fase 1 (Upgrade Composer UI)    ← Depende de Fase 2 para el callback de error
    │
    ▼
Fase 4 (Styling Optimista)      ← Depende de Fase 2 para el flag _optimistic
```

**Estimación total:** ~2h de ejecución limpia.

---

## 10. Siguiente Paso

Integrar este RFC al sprint backlog del Command Center. El Ejecutor debe comenzar por la **Fase 3** (hardening del Route Handler) dado que es independiente y reduce superficie de error antes de tocar el frontend. Documentar la decisión en el ADR index (`ARCHITECTURE_INDEX.md`) como dependencia cumplida de RFC-022 §3.1 (`InboxComposer`).
