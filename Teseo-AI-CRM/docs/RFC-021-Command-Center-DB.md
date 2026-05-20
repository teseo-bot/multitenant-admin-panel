# RFC-021: Command Center Database Schema (Kanban & Inbox)

| Campo | Valor |
|---|---|
| **ID** | RFC-021 |
| **Estatus** | Aprobado |
| **Autor** | Builder (Arquitecto Staff, Equipo Teseo) |
| **Fecha** | 21 Abril 2026 |
| **Sprint** | 1.1 — CRM-Agéntico (Tenant OS) |
| **Depende de** | ADR-097 (Single-Tenant), ADR-109 (Desacoplamiento ERP), ADR-112 (SSE + D&D Kanban) |

---

## 1. Contexto y Objetivos

Derivado del desacoplamiento de Odoo (ADR-109) y la consolidación Single-Tenant (ADR-097), el Command Center del Tenant OS requiere persistencia propia para el **Kanban de Leads** y el **Inbox de Mensajes**.

### Ubicación de las Tablas

| Base de Datos | Servicio | Propietario |
|---|---|---|
| **Cloud SQL del Tenant** (`crm-agentico-orchestrator`) | PostgreSQL 15+ con pgvector | Tablas `leads`, `inbox_messages`, `checkpoints`, `chunks` |
| **Supabase** (Mission Control) | PostgreSQL gestionado | Catálogo de tenants, facturación, system prompts |

> **Regla:** Estas tablas viven **exclusivamente** en el Cloud SQL aislado del Tenant. Sin `tenant_id` — toda la BD le pertenece al inquilino.

---

## 2. Diseño de Base de Datos (PostgreSQL DDL)

### 2.1 Tipos Enumerados

```sql
-- ============================================================
-- RFC-021: Command Center DDL
-- Target: Cloud SQL del Tenant (crm-agentico-orchestrator)
-- Requisito: PostgreSQL 15+ (gen_random_uuid() nativo)
-- ============================================================

CREATE TYPE lead_status AS ENUM (
  'New',
  'Contacted',
  'Qualified',
  'Lost',
  'Won'
);

CREATE TYPE lead_source AS ENUM (
  'inbound_web',
  'inbound_telegram',
  'inbound_whatsapp',
  'outbound_hunter',
  'manual',
  'referral'
);

CREATE TYPE assigned_node AS ENUM (
  'gatekeeper',
  'sdr',
  'hunter',
  'admin',
  'unassigned'
);

CREATE TYPE message_sender AS ENUM (
  'customer',
  'ai_agent',
  'human_admin'
);

CREATE TYPE message_channel AS ENUM (
  'telegram',
  'whatsapp',
  'web',
  'email'
);
```

### 2.2 Tabla `leads` (Kanban)

```sql
CREATE TABLE leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Identidad
  name          VARCHAR(255) NOT NULL,
  company       VARCHAR(255),
  email         VARCHAR(320),           -- RFC 5321 max
  phone         VARCHAR(20),

  -- Pipeline
  status        lead_status   NOT NULL DEFAULT 'New',
  source        lead_source   NOT NULL DEFAULT 'inbound_web',
  icp_score     NUMERIC(5,2)  CHECK (icp_score >= 0 AND icp_score <= 100),

  -- Asignación Agéntica
  assigned_node assigned_node NOT NULL DEFAULT 'unassigned',

  -- Drag & Drop (dnd-kit) — Estrategia de Punto Medio
  -- Se usa DOUBLE PRECISION para insertar entre dos posiciones:
  --   nuevo_sort = (sort_anterior + sort_siguiente) / 2
  -- Rebalanceo global cuando |sort_a - sort_b| < 1e-10
  sort_order    DOUBLE PRECISION NOT NULL DEFAULT 0,

  -- Referencia al thread de LangGraph (para reanudar conversación)
  thread_id     TEXT UNIQUE,

  -- Metadata JSON libre para extensiones futuras (BANT, tags, etc.)
  metadata      JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Comentarios descriptivos
COMMENT ON COLUMN leads.sort_order IS 'Posición D&D dentro de su columna de status. Punto medio para inserciones.';
COMMENT ON COLUMN leads.thread_id IS 'FK lógica al thread_id del checkpointer de LangGraph.';
COMMENT ON COLUMN leads.metadata IS 'Extensible: BANT profile, tags, notas del SDR, etc.';
```

### 2.3 Tabla `inbox_messages` (Chat / Timeline)

```sql
CREATE TABLE inbox_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Emisor y Canal
  sender        message_sender  NOT NULL,
  channel       message_channel NOT NULL,

  -- Contenido
  content       TEXT NOT NULL,

  -- Referencia externa (ej. telegram message_id para dedup)
  external_id   TEXT,

  -- Metadata (attachments URLs, reaction, delivery status)
  metadata      JSONB NOT NULL DEFAULT '{}',

  -- Timestamps
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON COLUMN inbox_messages.external_id IS 'ID del mensaje en el canal origen (Telegram msg_id, WA wamid). Para dedup.';
COMMENT ON COLUMN inbox_messages.metadata IS 'Attachments, delivery_status, media_urls, etc.';
```

### 2.4 Índices Optimizados

```sql
-- ============================================================
-- Índices
-- ============================================================

-- Kanban: agrupa leads por columna, ordena por posición D&D
CREATE INDEX idx_leads_kanban
  ON leads (status, sort_order);

-- Búsqueda rápida por nodo asignado (filtro en UI)
CREATE INDEX idx_leads_assigned
  ON leads (assigned_node)
  WHERE assigned_node != 'unassigned';

-- Score ICP para filtrado/sorting en la UI
CREATE INDEX idx_leads_icp
  ON leads (icp_score DESC NULLS LAST);

-- Thread lookup (LangGraph → Lead)
-- Ya cubierto por UNIQUE constraint en thread_id, genera índice implícito

-- Timeline: carga de mensajes por lead, paginados por fecha
CREATE INDEX idx_messages_timeline
  ON inbox_messages (lead_id, created_at DESC);

-- Dedup de mensajes entrantes por external_id
CREATE INDEX idx_messages_external_id
  ON inbox_messages (external_id)
  WHERE external_id IS NOT NULL;
```

### 2.5 Trigger `updated_at`

```sql
-- ============================================================
-- Trigger automático de updated_at
-- ============================================================

CREATE OR REPLACE FUNCTION trg_fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_set_updated_at();
```

---

## 3. Estrategia Drag & Drop (Ordenamiento Optimista)

### 3.1 Algoritmo de Punto Medio

Cuando el usuario arrastra un lead entre dos posiciones:

```
sort_order_nuevo = (sort_order_superior + sort_order_inferior) / 2
```

**Inicialización:** Leads nuevos reciben `sort_order = (MAX(sort_order) en su columna) + 1024`.

**Rebalanceo:** Cuando la diferencia entre dos posiciones adyacentes cae por debajo de `1e-10` (colisión DOUBLE PRECISION), se ejecuta un rebalanceo global de la columna:

```sql
-- Rebalanceo: reasigna sort_order con paso de 1024
WITH ranked AS (
  SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order) AS rn
  FROM leads
  WHERE status = $1  -- columna afectada
)
UPDATE leads l
SET sort_order = r.rn * 1024
FROM ranked r
WHERE l.id = r.id;
```

> **Nota:** Con DOUBLE PRECISION y paso base de 1024, se toleran ~50 inserciones consecutivas entre dos posiciones antes de necesitar rebalanceo. En la práctica, el Kanban de un solo tenant nunca llega a esto.

### 3.2 Flujo de Mutación Optimista (Frontend)

1. **User drags** → `dnd-kit` emite `onDragEnd({ activeId, overId, newStatus })`
2. **Optimistic Update** → TanStack Query `setQueryData` actualiza la posición local inmediatamente
3. **PATCH** → `PATCH /api/leads/:id` con `{ status, sort_order }`
4. **Rollback** → Si el PATCH falla, TanStack Query revierte al snapshot previo via `onError`

---

## 4. Persistencia desde LangGraph (Orchestrator)

El orchestrator (`src/orchestrator`) ya tiene un pool de conexiones en `src/services/db.ts` apuntando al mismo Cloud SQL del tenant. Las tablas de este RFC coexisten con las tablas del checkpointer (`checkpoints`, `checkpoint_blobs`, `checkpoint_writes`) y las del RAG (`chunks`).

### 4.1 Flujo de Escritura por Nodo

| Nodo del Grafo | Operación SQL | Momento |
|---|---|---|
| **Gatekeeper** (ingesta) | `INSERT INTO leads` + `INSERT INTO inbox_messages` | Al recibir un webhook de un contacto nuevo. Upsert por `phone`/`email` si ya existe. |
| **Gatekeeper** (mensaje subsecuente) | `INSERT INTO inbox_messages` (sender=`customer`) | Cada mensaje entrante de un lead conocido. |
| **SDR** (calificación) | `UPDATE leads SET status='Qualified', icp_score=$1, metadata=metadata \|\| $2` | Tras completar evaluación BANT via tool-calling. |
| **SDR** (respuesta) | `INSERT INTO inbox_messages` (sender=`ai_agent`) | Cada mensaje generado por la IA. |
| **Dispatcher** (envío) | No escribe en DB — consume `inbox_messages` más reciente y lo rutea al adapter del canal. | Post-SDR/RAG. |
| **Human Admin** (handoff) | `INSERT INTO inbox_messages` (sender=`human_admin`) | Desde el endpoint `POST /api/leads/:id/messages`. |

### 4.2 Vinculación Lead ↔ Thread (LangGraph)

El campo `leads.thread_id` almacena el `thread_id` que usa el checkpointer de LangGraph. Esto permite:

1. **UI → Grafo:** Desde el Inbox, el admin puede ver exactamente dónde está la conversación del agente.
2. **Grafo → UI (SSE):** Después de cada `INSERT INTO inbox_messages`, el nodo ejecuta `NOTIFY inbox_channel, lead_id::text` para que el SSE del panel empuje el mensaje al frontend en tiempo real (ADR-112).

```typescript
// Ejemplo: dentro del nodo SDR, después de generar respuesta
async function persistAgentMessage(pool: Pool, leadId: string, content: string, channel: string) {
  const client = await pool.connect();
  try {
    await client.query(
      `INSERT INTO inbox_messages (lead_id, sender, channel, content)
       VALUES ($1, 'ai_agent', $2, $3)`,
      [leadId, channel, content]
    );
    // Dispara LISTEN/NOTIFY para SSE (ADR-112)
    await client.query(`NOTIFY inbox_channel, $1`, [leadId]);
  } finally {
    client.release();
  }
}
```

### 4.3 Init-DB (Extensión del script existente)

El DDL de este RFC se integrará al script existente `src/orchestrator/src/scripts/init-db.ts`, ejecutándose **después** del setup del checkpointer:

```typescript
// Fase 2: Command Center DDL
await client.query(`
  DO $$ BEGIN
    CREATE TYPE lead_status AS ENUM ('New','Contacted','Qualified','Lost','Won');
  EXCEPTION WHEN duplicate_object THEN NULL;
  END $$;
  -- ... (resto del DDL con guards idempotentes)
`);
```

---

## 5. Estructura de Controladores (Next.js App Router API)

Los endpoints vivirán en el futuro servicio `crm-agentico-panel` (Next.js 14 + App Router). Conectan al **mismo** Cloud SQL del tenant via un pool `pg` independiente (con usuario de servicio de solo lectura + escritura limitada).

### 5.1 Endpoints

| Método | Ruta | Uso | Query Principal |
|---|---|---|---|
| `GET` | `/api/leads` | Carga Kanban completo | `SELECT * FROM leads ORDER BY status, sort_order ASC` |
| `GET` | `/api/leads?status=New&assigned=sdr` | Kanban filtrado | Filtro dinámico por `status` y `assigned_node` |
| `POST` | `/api/leads` | Creación manual de lead | `INSERT INTO leads (...)` |
| `PATCH` | `/api/leads/:id` | D&D reposicionar / cambiar status | `UPDATE leads SET status=$1, sort_order=$2 WHERE id=$3` |
| `DELETE` | `/api/leads/:id` | Eliminar lead (soft-delete futuro) | `DELETE FROM leads WHERE id=$1` |
| `GET` | `/api/leads/:id/messages` | Timeline del Inbox (paginado) | `SELECT * FROM inbox_messages WHERE lead_id=$1 ORDER BY created_at DESC LIMIT $2 OFFSET $3` |
| `POST` | `/api/leads/:id/messages` | Intervención humana (handoff) | `INSERT INTO inbox_messages (sender='human_admin')` + `NOTIFY` |
| `GET` | `/api/leads/:id/messages/stream` | SSE para mensajes en tiempo real | `LISTEN inbox_channel` filtrado por `lead_id` |

### 5.2 Contratos de Payload

**`PATCH /api/leads/:id`** (D&D + cambio de columna):
```json
{
  "status": "Qualified",
  "sort_order": 1536.5,
  "assigned_node": "sdr"
}
```
> Todos los campos son opcionales; se actualiza solo lo enviado.

**`POST /api/leads/:id/messages`** (Handoff humano):
```json
{
  "content": "Hola, soy el ejecutivo de cuenta. ¿En qué puedo ayudarle?",
  "channel": "whatsapp"
}
```
> El `sender` se fuerza a `human_admin` en el backend. Al insertar, se dispara `NOTIFY inbox_channel` para que el SSE empuje al frontend Y se pausa el nodo AI del grafo LangGraph asociado al `thread_id` del lead.

### 5.3 Seguridad de Endpoints

| Capa | Mecanismo |
|---|---|
| Autenticación | JWT del Tenant Admin (Zustand store hidratado desde SSR, ADR-112) |
| Autorización | Innecesaria a nivel de row — es Single-Tenant, toda la BD es del inquilino |
| Rate Limiting | Cloud Run maneja concurrencia; el pool `pg` limita conexiones |
| Validación | Zod schemas en cada Route Handler |

---

## 6. Diagrama de Relaciones (ER Simplificado)

```
┌──────────────────────────────────────┐
│              leads                    │
├──────────────────────────────────────┤
│ id          UUID  PK                 │
│ name        VARCHAR(255)             │
│ company     VARCHAR(255)             │
│ email       VARCHAR(320)             │
│ phone       VARCHAR(20)              │
│ status      lead_status              │
│ source      lead_source              │
│ icp_score   NUMERIC(5,2)            │
│ assigned_node  assigned_node         │
│ sort_order  DOUBLE PRECISION         │
│ thread_id   TEXT UNIQUE  ──────────► checkpoints.thread_id
│ metadata    JSONB                    │
│ created_at  TIMESTAMPTZ              │
│ updated_at  TIMESTAMPTZ              │
└──────────┬───────────────────────────┘
           │ 1:N
           ▼
┌──────────────────────────────────────┐
│         inbox_messages               │
├──────────────────────────────────────┤
│ id          UUID  PK                 │
│ lead_id     UUID  FK → leads.id      │
│ sender      message_sender           │
│ channel     message_channel          │
│ content     TEXT                      │
│ external_id TEXT                      │
│ metadata    JSONB                    │
│ created_at  TIMESTAMPTZ              │
└──────────────────────────────────────┘
```

---

## 7. Work Breakdown Structure (WBS)

### Fase 1: Infraestructura de BD (Cloud SQL) — Ejecutor
| # | Tarea | Estimación | Dependencia |
|---|---|---|---|
| 1.1 | Agregar DDL al `init-db.ts` existente con guards idempotentes (`DO $$ ... EXCEPTION`) | 1h | — |
| 1.2 | Ejecutar migración en entorno local (Docker Compose postgres:15) | 30m | 1.1 |
| 1.3 | Crear usuario de servicio para el panel (`panel_rw`) con permisos CRUD limitados | 30m | 1.2 |
| 1.4 | Configurar `LISTEN/NOTIFY` channel `inbox_channel` para SSE | 30m | 1.2 |

### Fase 2: Capa Backend API (Next.js Panel) — Ejecutor
| # | Tarea | Estimación | Dependencia |
|---|---|---|---|
| 2.1 | Pool `pg` + wrapper en `src/panel/lib/db.ts` | 30m | 1.3 |
| 2.2 | `GET /api/leads` (lectura Kanban con filtros opcionales) | 1h | 2.1 |
| 2.3 | `PATCH /api/leads/:id` (D&D + cambio de columna + rebalanceo) | 1.5h | 2.1 |
| 2.4 | `GET /api/leads/:id/messages` (timeline paginado) | 1h | 2.1 |
| 2.5 | `POST /api/leads/:id/messages` (handoff humano + NOTIFY) | 1h | 2.1, 1.4 |
| 2.6 | `GET /api/leads/:id/messages/stream` (SSE endpoint) | 1.5h | 1.4 |
| 2.7 | Zod schemas para validación de payloads | 30m | 2.2–2.5 |

### Fase 3: Integración Agéntica (Orchestrator) — Ejecutor
| # | Tarea | Estimación | Dependencia |
|---|---|---|---|
| 3.1 | Crear `src/orchestrator/src/services/leads.ts` (funciones `upsertLead`, `updateLeadStatus`, `persistMessage`) | 1.5h | 1.2 |
| 3.2 | Integrar `persistMessage` en el nodo Gatekeeper (ingesta) | 1h | 3.1 |
| 3.3 | Integrar `updateLeadStatus` en el nodo SDR (calificación) | 1h | 3.1 |
| 3.4 | Integrar `NOTIFY inbox_channel` post-insert en todos los nodos emisores | 30m | 3.1, 1.4 |

### Fase 4: Frontend UI (Kanban + Inbox) — Ejecutor
| # | Tarea | Estimación | Dependencia |
|---|---|---|---|
| 4.1 | Hook `useLeads()` con TanStack Query + mutación optimista D&D | 2h | 2.2, 2.3 |
| 4.2 | Hook `useInbox(leadId)` con TanStack Query + SSE subscription | 2h | 2.4, 2.6 |
| 4.3 | Componente `<KanbanBoard>` con `@dnd-kit` conectado a `useLeads()` | 3h | 4.1 |
| 4.4 | Componente `<InboxTimeline>` con scroll infinito y handoff | 2h | 4.2 |

### Fase 5: Testing — Tester
| # | Tarea | Estimación | Dependencia |
|---|---|---|---|
| 5.1 | Tests unitarios para funciones `leads.ts` del orchestrator | 1h | 3.1 |
| 5.2 | Tests de integración para Route Handlers (`supertest` o similar) | 2h | 2.2–2.6 |
| 5.3 | Test E2E: webhook → Gatekeeper → inbox_messages → SSE → UI | 2h | 4.2, 3.2 |

---

## 8. Decisiones de Diseño (Justificaciones)

| Decisión | Alternativa Descartada | Razón |
|---|---|---|
| `DOUBLE PRECISION` para `sort_order` | `INTEGER` con gaps | Evita rebalanceo frecuente; ~50 inserciones consecutivas sin colisión |
| ENUMs de PostgreSQL | `VARCHAR` con CHECK | Validación a nivel de motor; menor tamaño en disco; refactorizable con `ALTER TYPE ... ADD VALUE` |
| `JSONB metadata` en ambas tablas | Columnas adicionales fijas | Extensibilidad sin migraciones. BANT, tags, delivery_status son datos semi-estructurados |
| `thread_id TEXT UNIQUE` en leads | FK formal al checkpointer | El checkpointer es de LangGraph (schema externo); FK lógica evita acoplamiento DDL |
| `external_id` en inbox_messages | Sin dedup | Los webhooks de Telegram/WhatsApp pueden duplicar mensajes; este campo permite `ON CONFLICT DO NOTHING` |
| `lead_source` como ENUM | Campo libre `VARCHAR` | Fuerza consistencia en reportes y filtros de pipeline |
| Sin `tenant_id` | Campo `tenant_id UUID` | ADR-097: Single-Tenant. Toda la BD es del inquilino. Agregar `tenant_id` es overhead innecesario |

---

## 9. Script DDL Completo (Copy-Paste Ready)

```sql
-- ============================================================
-- RFC-021: Command Center — DDL Completo
-- Target: Cloud SQL del Tenant (crm-agentico-orchestrator)
-- PostgreSQL 15+
-- Idempotente: usa DO blocks con EXCEPTION handlers
-- ============================================================

-- 1. Tipos Enumerados (idempotentes)
DO $$ BEGIN CREATE TYPE lead_status     AS ENUM ('New','Contacted','Qualified','Lost','Won'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lead_source     AS ENUM ('inbound_web','inbound_telegram','inbound_whatsapp','outbound_hunter','manual','referral'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assigned_node   AS ENUM ('gatekeeper','sdr','hunter','admin','unassigned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_sender  AS ENUM ('customer','ai_agent','human_admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_channel AS ENUM ('telegram','whatsapp','web','email'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabla leads
CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  company       VARCHAR(255),
  email         VARCHAR(320),
  phone         VARCHAR(20),
  status        lead_status   NOT NULL DEFAULT 'New',
  source        lead_source   NOT NULL DEFAULT 'inbound_web',
  icp_score     NUMERIC(5,2)  CHECK (icp_score >= 0 AND icp_score <= 100),
  assigned_node assigned_node NOT NULL DEFAULT 'unassigned',
  sort_order    DOUBLE PRECISION NOT NULL DEFAULT 0,
  thread_id     TEXT UNIQUE,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabla inbox_messages
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

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_leads_kanban       ON leads (status, sort_order);
CREATE INDEX IF NOT EXISTS idx_leads_assigned      ON leads (assigned_node) WHERE assigned_node != 'unassigned';
CREATE INDEX IF NOT EXISTS idx_leads_icp           ON leads (icp_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_timeline   ON inbox_messages (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_external   ON inbox_messages (external_id) WHERE external_id IS NOT NULL;

-- 5. Trigger updated_at
CREATE OR REPLACE FUNCTION trg_fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_set_updated_at();
```

---

*Documento generado por Builder (Arquitecto Staff) — Equipo Teseo. Listo para revisión del Reviewer antes de ejecución.*
