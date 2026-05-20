# RFC: UAT Deadlock — Database Schema Desync

**Fecha:** 2026-04-22  
**Autor:** Builder (subagent)  
**Severidad:** 🔴 Crítica — bloquea UAT completo  
**Estado:** Draft → Pendiente de ejecución

---

## 1. Resumen Ejecutivo

El entorno UAT está completamente bloqueado por dos problemas de desincronización entre el esquema de la base de datos y el código del frontend:

| # | Problema | Impacto |
|---|---------|---------|
| **P1** | El frontend Inbox (`use-threads.ts`, `/api/threads/route.ts`) consulta tablas `threads` y `messages` que **nunca fueron creadas** por ninguna migración. El esquema real usa `leads` + `inbox_messages`. | 500 en toda la UI de Inbox |
| **P2** | El trigger `notify_langgraph_new_lead` (migración `20260421170500`) referencia `NEW.tenant_id` en la tabla `leads`, pero `leads` **no tiene columna `tenant_id`**. El seed de Asset Studio (`20260421220000`) inserta `schema_name` en `tenants`, columna que **tampoco existe**. | `supabase db reset` falla → no se puede hacer Auth → app inaccesible |

---

## 2. Análisis Detallado

### 2.1 P1 — Frontend Threads vs. DB inbox_messages

**Estado actual del esquema (migraciones):**

- `20260421000002_command_center_schema.sql` crea:
  - Tabla `leads` (PK `id`, columnas: name, company, email, phone, status, source, icp_score, assigned_node, sort_order, thread_id, metadata, created_at, updated_at)
  - Tabla `inbox_messages` (PK `id`, FK `lead_id → leads(id)`, columnas: sender, channel, content, external_id, metadata, created_at)
  - Enums: `lead_status`, `lead_source`, `assigned_node`, `message_sender`, `message_channel`

- **No existe** ninguna migración que cree tablas `threads` ni `messages`.

**Código frontend que referencia tablas fantasma:**

| Archivo | Tabla inexistente | Qué hace |
|---------|-------------------|----------|
| `hooks/queries/use-threads.ts` | — | Llama a `/api/threads` y `/api/threads/:id/messages` |
| `app/api/threads/route.ts` (GET) | `threads`, `messages` | `SELECT ... FROM threads t LEFT JOIN messages m ON t.id = m.thread_id` |
| `app/api/threads/route.ts` (POST) | `threads`, `messages` | `INSERT INTO threads ...`, `INSERT INTO messages ...` |
| `app/api/threads/events/route.ts` | — | SSE listener (indirecto, depende de datos de threads) |
| `components/inbox/inbox-list.tsx` | — | Usa `useThreadList()` de use-threads.ts |
| `components/inbox/inbox-thread-view.tsx` | — | Usa `useMessages()` de use-threads.ts |
| `types/conversation.ts` | — | Define `ThreadSummary`, `PaginatedThreads`, `Message` con shape de threads |
| `lib/query-keys.ts` | — | Define `queryKeys.threads.*` |

**Código frontend CORRECTO (ya migrado, pero no conectado al Inbox principal):**

| Archivo | Tabla real | Qué hace |
|---------|-----------|----------|
| `hooks/queries/use-lead-messages.ts` | `inbox_messages` (vía Supabase) | Usa `/api/leads/:id/messages` |
| `app/api/leads/[id]/messages/route.ts` | `inbox_messages` | GET/POST contra `inbox_messages` con Supabase client |
| `components/command-center/inbox-panel.tsx` | — | **Deprecated** pero usa el path correcto (`useLeadMessages`) |
| `components/command-center/inbox-message-list.tsx` | `inbox_messages` | **Deprecated** pero usa `InboxMessage` type correcto |
| `types/inbox-message.ts` | — | Define `InboxMessage` con shape correcto (sender: customer/ai_agent/human_admin) |

**Conclusión P1:** Existen **dos generaciones** de código de Inbox. La generación nueva (command-center/) ya usa `inbox_messages` correctamente. La generación que realmente se renderiza (components/inbox/) sigue atada a `threads`/`messages`.

### 2.2 P2 — Seed & Trigger Failures (tenant_id / schema_name)

**Problema A: Trigger `notify_langgraph_new_lead`**

```sql
-- En 20260421170500_langgraph_event_bridge.sql líneas 55-56, 70:
INSERT INTO public.lead_assignment_outbox (lead_id, tenant_id, ...)
VALUES (NEW.id, NEW.tenant_id, ...);
--                  ^^^^^^^^^^^^
-- leads NO tiene columna tenant_id
```

La tabla `leads` (definida en `20260421000002`) tiene estas columnas:
`id, name, company, email, phone, status, source, icp_score, assigned_node, sort_order, thread_id, metadata, created_at, updated_at`

→ **No hay `tenant_id`**. El trigger falla al insertar cualquier lead.

**Problema B: Seed de Asset Studio**

```sql
-- En 20260421220000_seed_asset_studio.sql línea 17:
INSERT INTO tenants (id, name, schema_name)
VALUES (gen_random_uuid(), 'Teseo Dev Tenant', 'tenant_teseo');
--                          ^^^^^^^^^^^^
-- tenants solo tiene: id, name, status, created_at
--                     (+ orchestrator_url, api_key_vault_id de migración 20260418000001)
```

→ `schema_name` no existe en `tenants`. El seed falla con `column "schema_name" does not exist`.

---

## 3. Plan de Ejecución Granular

### Fase A: Corregir Seeds y Triggers (desbloquear `supabase db reset`)

> **Prioridad: INMEDIATA** — sin esto no hay base de datos funcional.

#### A.1 — Corregir seed de Asset Studio (`20260421220000_seed_asset_studio.sql`)

**Línea 17, cambiar:**
```sql
-- ANTES:
INSERT INTO tenants (id, name, schema_name) 
VALUES (gen_random_uuid(), 'Teseo Dev Tenant', 'tenant_teseo')

-- DESPUÉS:
INSERT INTO tenants (id, name, status)
VALUES (gen_random_uuid(), 'Teseo Dev Tenant', 'active')
```

Eliminar `schema_name` y usar `status` (columna real del enum `tenant_status`).

#### A.2 — Agregar columna `tenant_id` a tabla `leads` O corregir el trigger

**Opción recomendada:** Agregar `tenant_id` a `leads` ya que el modelo multi-tenant lo requiere (el trigger, el outbox, y el payload del webhook lo usan).

Crear nueva migración `20260422160000_add_tenant_id_to_leads.sql`:

```sql
-- Agrega tenant_id a leads para completar el modelo multi-tenant
ALTER TABLE leads
  ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill: asociar leads existentes (del seed) al primer tenant disponible
UPDATE leads SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;

-- Hacer NOT NULL después del backfill
ALTER TABLE leads ALTER COLUMN tenant_id SET NOT NULL;

-- Índice para filtrado por tenant
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads (tenant_id);
```

#### A.3 — Corregir `seed-auth-user.js`

El script actual inserta en `auth.users` sin crear un tenant asociado. Hay que asegurarse de que exista al menos un tenant **antes** de ejecutar otros seeds que dependan de él.

**Cambio:** Agregar al script (antes del insert en `auth.users`):

```js
// Asegurar que existe un tenant de desarrollo
await client.query(`
  INSERT INTO tenants (id, name, status)
  VALUES ('10000000-0000-0000-0000-000000000001', 'Dev Tenant', 'active')
  ON CONFLICT (id) DO NOTHING;
`);
```

Y actualizar el seed de leads (`20260421100000`) para incluir `tenant_id`:

```sql
-- Declarar el tenant de dev
DO $$
DECLARE v_tid UUID;
BEGIN
  SELECT id INTO v_tid FROM tenants LIMIT 1;
  
  INSERT INTO leads (tenant_id, name, company, email, phone, status, source, icp_score, assigned_node, sort_order) VALUES
  (v_tid, 'Jorge García', 'Teseo', 'jorge@teseo.lat', '555-0100', 'New', 'inbound_web', 95, 'sdr', 1000),
  (v_tid, 'Ana López', 'TechCorp', 'ana@techcorp.com', '555-0101', 'Contacted', 'inbound_telegram', 80, 'gatekeeper', 2000),
  -- ... (mismo patrón para todos los rows)
  ;
END $$;
```

### Fase B: Rewirar el Frontend Inbox (eliminar dependencia a `threads`/`messages`)

> **Prioridad: ALTA** — sin esto el Inbox no muestra datos.

#### B.1 — Reemplazar `use-threads.ts` → redirigir a lead-based queries

El hook `use-threads.ts` debe dejar de existir o ser un wrapper delgado. El Inbox debe consumir leads como agrupador y `inbox_messages` como mensajes.

**Archivo: `hooks/queries/use-threads.ts`**

Reescribir completamente para:
1. `useThreads()` → Llamar a `/api/leads` (que ya existe y funciona) en vez de `/api/threads`
2. `useMessages(threadId)` → Llamar a `/api/leads/${leadId}/messages` (que ya existe y lee `inbox_messages`)
3. Mapear la respuesta de `leads` al shape `ThreadSummary` que esperan los componentes

**Mapeo de campos (leads → ThreadSummary):**

| ThreadSummary field | Fuente en `leads` / `inbox_messages` |
|--------------------|------------------------------------|
| `id` | `leads.id` |
| `threadId` | `leads.thread_id` (o `leads.id` como fallback) |
| `status` | Derivar de `leads.status` + `leads.assigned_node` |
| `leadName` | `leads.name` |
| `channel` | Último `inbox_messages.channel` del lead |
| `lastMessageAt` | `MAX(inbox_messages.created_at)` del lead |
| `lastMessagePreview` | Último `inbox_messages.content` (truncado) |
| `unreadCount` | Calcular (requiere tracking — puede ser 0 inicialmente) |
| `leadCompany` | `leads.company` |
| `assignedAgent` | `leads.assigned_node` |
| `updatedAt` | `leads.updated_at` |

#### B.2 — Actualizar `/api/threads/route.ts`

**Opción A (recomendada):** Eliminar el archivo y hacer que el frontend llame a `/api/leads` directamente.

**Opción B:** Reescribir para que sea un proxy que consulte `leads` + `inbox_messages` y devuelva el shape de `PaginatedThreads`.

Si se elige Opción B, el GET debe cambiar de:
```sql
SELECT ... FROM threads t LEFT JOIN messages m ON t.id = m.thread_id
```
A:
```sql
SELECT l.*, 
  (SELECT content FROM inbox_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message,
  (SELECT created_at FROM inbox_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_message_at,
  (SELECT channel FROM inbox_messages WHERE lead_id = l.id ORDER BY created_at DESC LIMIT 1) as last_channel,
  (SELECT count(*) FROM inbox_messages WHERE lead_id = l.id) as message_count
FROM leads l
ORDER BY last_message_at DESC NULLS LAST
```

#### B.3 — Actualizar `types/conversation.ts`

Alinear el type `Message` con `InboxMessage`:

| Campo actual (`Message`) | Campo real (`InboxMessage`) |
|--------------------------|----------------------------|
| `threadId` | `lead_id` |
| `text` | (eliminar, usar `content`) |
| `createdAt` | `created_at` |
| `sender`: `'lead' \| 'agent' \| ...` | `sender`: `'customer' \| 'ai_agent' \| 'human_admin'` |
| `senderName` | Derivar del enum sender |
| `timestamp` | `created_at` |
| `content` | `content` ✅ |

#### B.4 — Actualizar componentes de Inbox

**`components/inbox/inbox-list.tsx`:**
- Cambiar `useThreadList()` → nueva versión que consulta leads
- Actualizar el mapeo de `CHANNEL_ICON` para incluir `'web'` y `'telegram'` (enums reales del DB)
- Ajustar `StatusDot` para mapear `lead_status` (`New`, `Contacted`, etc.) en vez de `ThreadStatus`

**`components/inbox/inbox-thread-view.tsx`:**
- Cambiar `useMessages(threadId)` → `useLeadMessages(leadId)` (hook que ya existe y funciona)
- Actualizar `MessageBubble` para usar sender enum: `'customer'`, `'ai_agent'`, `'human_admin'` en vez de `'lead'`, `'agent'`

#### B.5 — Limpiar query keys

En `lib/query-keys.ts`, el namespace `threads` puede eliminarse o aliasearse a `leads` para evitar confusión.

#### B.6 — Eliminar archivos obsoletos (post-migración)

- `app/api/threads/route.ts` — reemplazado por `/api/leads`
- `app/api/threads/events/route.ts` — SSE ya existe en `/api/leads/[id]/messages/stream/`
- Los componentes en `components/command-center/` marcados como `@deprecated` pueden servir como referencia de la implementación correcta

---

## 4. Orden de Ejecución

```
1. A.1  Corregir seed_asset_studio (schema_name → status)          [1 línea]
2. A.2  Nueva migración: tenant_id en leads                        [~10 líneas SQL]
3. A.3  Actualizar seed_leads_dev para incluir tenant_id            [~15 líneas SQL]  
4. A.3b Actualizar seed-auth-user.js para crear tenant primero      [~5 líneas JS]
5.      Ejecutar `supabase db reset` → VALIDAR que pasa limpio      [checkpoint]
6. B.1  Reescribir use-threads.ts                                   [~60 líneas TS]
7. B.2  Reescribir /api/threads/route.ts (o eliminar + redirigir)   [~80 líneas TS]
8. B.3  Actualizar types/conversation.ts                            [~20 líneas TS]
9. B.4  Actualizar inbox-list.tsx y inbox-thread-view.tsx            [~30 líneas TS]
10. B.5 Limpiar query-keys.ts                                       [~5 líneas TS]
11.     Build + smoke test en browser                                [checkpoint]
12. B.6 Eliminar archivos obsoletos                                  [cleanup]
```

---

## 5. Archivos Afectados (Resumen)

### Migraciones SQL (crear/editar):
| Archivo | Acción |
|---------|--------|
| `supabase/migrations/20260422160000_add_tenant_id_to_leads.sql` | **CREAR** |
| `supabase/migrations/20260421220000_seed_asset_studio.sql` | **EDITAR** línea 17 |
| `supabase/migrations/20260421100000_seed_leads_dev.sql` | **EDITAR** completo (agregar tenant_id) |

### Scripts de Seeding:
| Archivo | Acción |
|---------|--------|
| `crm-agentico-panel/seed-auth-user.js` | **EDITAR** (agregar tenant insert) |

### Frontend TypeScript:
| Archivo | Acción |
|---------|--------|
| `hooks/queries/use-threads.ts` | **REESCRIBIR** |
| `app/api/threads/route.ts` | **REESCRIBIR o ELIMINAR** |
| `types/conversation.ts` | **EDITAR** (alinear types) |
| `components/inbox/inbox-list.tsx` | **EDITAR** (cambiar hook + mapeo) |
| `components/inbox/inbox-thread-view.tsx` | **EDITAR** (cambiar hook + sender enum) |
| `lib/query-keys.ts` | **EDITAR** (limpiar namespace threads) |
| `app/api/threads/events/route.ts` | **ELIMINAR** (post-migración) |

---

## 6. Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Otros módulos referencian `threads` | Grep exhaustivo hecho: solo Inbox + handoff route. Handoff usa `thread_id` como campo de `leads`, no como tabla. |
| SSE events dejan de funcionar | El SSE en `threads/events` ya estaba roto. El SSE en `leads/[id]/messages/stream` es la ruta funcional. |
| `tenant_id` NOT NULL rompe inserts existentes sin tenant | El backfill en la migración lo cubre. Seeds actualizados antes del NOT NULL. |
| `lead_assignment_outbox.tenant_id` FK no declarada | La columna existe pero no tiene FK constraint explícito. Es solo un UUID suelto. No bloquea. |
