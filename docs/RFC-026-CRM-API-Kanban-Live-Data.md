# RFC-026: Integración CRM-API — Kanban Live Data (Sprint 1.7)

| Campo | Valor |
|---|---|
| **ID** | RFC-026 |
| **Estatus** | Draft → Pendiente Aprobación CEO |
| **Autor** | Builder (Arquitecto Staff, Equipo Teseo) |
| **Fecha** | 21 Abril 2026 |
| **Sprint** | 1.7 — CRM-API (Kanban Live Data) |
| **Depende de** | RFC-021 (DB Schema), ADR-111 (TanStack Query), ADR-112 (SSE + D&D Kanban), AUDIT-Kanban (PASS) |

---

## 1. Contexto y Problema

El `KanbanBoard` actualmente funciona con un mecanismo dual controlado por `NEXT_PUBLIC_MOCK_MODE`:

- **`true`** → Retorna un array hardcodeado `MOCK_LEADS` en `hooks/queries/use-leads.ts` (3 leads estáticos).
- **`false`** → Invoca `GET /api/leads` que ya conecta a Supabase vía `@supabase/ssr`.

**Estado real de la infraestructura (hallazgos de auditoría):**

| Capa | Estado | Archivos |
|---|---|---|
| **DDL (PostgreSQL)** | ✅ Migración existe | `supabase/migrations/20260421000002_command_center_schema.sql` |
| **Tipos TypeScript** | ✅ Alineados con DB | `types/lead.ts` (interface `Lead`, types `LeadStatus`, `LeadSource`, `AssignedNode`) |
| **Route Handlers (API)** | ⚠️ Funcionales con bug | `app/api/leads/route.ts`, `app/api/leads/[id]/route.ts` |
| **Hook `useLeads()`** | ⚠️ Mock-gated | `hooks/queries/use-leads.ts` — contiene `MOCK_LEADS` + branch condicional |
| **Hook `useMoveLeadMutation()`** | ✅ Producción-ready | `hooks/mutations/use-move-lead.ts` — mutación optimista con rollback |
| **Componente `KanbanBoard`** | ✅ Producción-ready | `components/kanban/kanban-board.tsx` — `@dnd-kit` + TanStack Query |
| **Query Keys** | ✅ Definidas | `lib/query-keys.ts` — `queryKeys.leads.all` |

### Hallazgos Críticos

1. **Bug de typo en Zod schemas de API:** Tanto `route.ts` (POST) como `[id]/route.ts` (PATCH) tienen `compunknown` en lugar de `company`. Esto significa que el campo `company` **nunca se persiste** ni actualiza correctamente.
2. **Mock data residual:** El array `MOCK_LEADS` y el branch `NEXT_PUBLIC_MOCK_MODE` en `use-leads.ts` deben eliminarse.
3. **Sin seed data:** La tabla `leads` en Supabase probablemente está vacía. Se necesita una migración de seed o un mecanismo de inserción inicial para validar el flujo completo.

---

## 2. Objetivo del Sprint 1.7

> Conectar el `KanbanBoard` a datos reales de la tabla `leads` en Supabase/PostgreSQL. Eliminar todo mock. Asegurar que el D&D con mutaciones optimistas opera end-to-end contra la API real.

### Entregables

1. **Eliminación de MOCK_LEADS** y branch condicional en `use-leads.ts`.
2. **Fix del bug `compunknown` → `company`** en ambos Route Handlers.
3. **Seed migration** con datos de prueba realistas para desarrollo.
4. **Validación E2E:** Drag & Drop en UI → PATCH `/api/leads/:id` → Supabase update → UI refleja cambio.
5. **Rebalanceo de `sort_order`** implementado como RPC de Supabase (función PostgreSQL invocable).

---

## 3. Diseño Técnico

### 3.1 Eliminación de Mocks (`use-leads.ts`)

**Antes (actual):**
```typescript
const MOCK_LEADS: Lead[] = [ /* ... 3 items hardcoded ... */ ];

async function fetchLeads(): Promise<Lead[]> {
  if (process.env.NEXT_PUBLIC_MOCK_MODE === 'true') {
    return MOCK_LEADS;
  }
  const res = await fetch('/api/leads');
  // ...
}
```

**Después:**
```typescript
async function fetchLeads(): Promise<Lead[]> {
  const res = await fetch('/api/leads');
  if (!res.ok) throw new Error(`Failed to fetch leads: ${res.status}`);
  const json: LeadsResponse = await res.json();
  return json.data;
}

export function useLeads() {
  return useQuery<Lead[], Error>({
    queryKey: queryKeys.leads.all,
    queryFn: fetchLeads,
    staleTime: 30_000,
  });
}
```

**Racional:** El `NEXT_PUBLIC_MOCK_MODE` ya no tiene razón de existir para este módulo. Los Route Handlers ya conectan a Supabase. Eliminar el mock simplifica el código y garantiza que siempre se golpea la DB real.

### 3.2 Fix Bug `compunknown` → `company`

**Archivos afectados:**
- `app/api/leads/route.ts` (POST — `createLeadSchema`)
- `app/api/leads/[id]/route.ts` (PATCH — `updateLeadSchema`)

**Cambio:** Renombrar la propiedad `compunknown` a `company` en ambos schemas Zod.

```typescript
// ANTES (bug)
compunknown: z.string().max(255).optional(),

// DESPUÉS (fix)
company: z.string().max(255).optional(),
```

### 3.3 Estrategia D&D: Sort Order con Punto Medio (ya implementada)

La estrategia ya está correctamente implementada en `use-move-lead.ts`:

```
calculateSortOrder(targetIndex, columnLeads):
  - Lista vacía → 1024
  - Inicio → primer.sort_order - 1024
  - Final → último.sort_order + 1024
  - Medio → (anterior + siguiente) / 2
```

**Decisión de Rebalanceo:** Implementar como RPC de Supabase para invocación bajo demanda.

```sql
-- Nueva función RPC: rebalance_column
CREATE OR REPLACE FUNCTION rebalance_column(target_status lead_status)
RETURNS void AS $$
  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY sort_order) AS rn
    FROM leads
    WHERE status = target_status
  )
  UPDATE leads l
  SET sort_order = r.rn * 1024
  FROM ranked r
  WHERE l.id = r.id;
$$ LANGUAGE sql;
```

**Trigger de rebalanceo (frontend):** Si después de un `calculateSortOrder`, la distancia entre dos posiciones adyacentes cae por debajo de `1e-10`, invocar `supabase.rpc('rebalance_column', { target_status })` y luego `invalidateQueries`. En la práctica, con un Kanban de tenant único y ~100 leads por columna, esto es extremadamente raro.

### 3.4 Seed Migration (Datos de Desarrollo)

Nueva migración: `supabase/migrations/20260421100000_seed_leads_dev.sql`

```sql
-- Seed leads para desarrollo (NO ejecutar en producción)
-- Se marca como reversible con un tag en metadata
INSERT INTO leads (name, company, email, phone, status, source, icp_score, assigned_node, sort_order, metadata)
VALUES
  ('María Torres', 'Acme Corp', 'maria@acme.com', '+52-555-0001', 'New', 'inbound_web', 85.5, 'gatekeeper', 1024, '{"seed": true}'),
  ('Roberto Vega', 'CloudTech MX', 'roberto@cloudtech.mx', '+52-555-0002', 'New', 'inbound_telegram', 72.0, 'sdr', 2048, '{"seed": true}'),
  ('Lucía Ramírez', NULL, 'lucia@gmail.com', '+52-555-0003', 'Contacted', 'inbound_whatsapp', 91.0, 'sdr', 1024, '{"seed": true}'),
  ('Fernando Díaz', 'Legal MX', 'fernando@legalmx.com', NULL, 'Contacted', 'referral', 65.0, 'gatekeeper', 2048, '{"seed": true}'),
  ('Patricia Mendoza', 'StartupNow', 'patricia@startupnow.io', '+52-555-0005', 'Qualified', 'outbound_hunter', 95.0, 'admin', 1024, '{"seed": true}'),
  ('Carlos Herrera', 'TechServices', 'carlos@techservices.mx', '+52-555-0006', 'Won', 'inbound_web', 88.0, 'admin', 1024, '{"seed": true}'),
  ('Ana Gutiérrez', 'Freelancer', 'ana@freelancer.mx', '+52-555-0007', 'Lost', 'manual', 40.0, 'unassigned', 1024, '{"seed": true}')
ON CONFLICT DO NOTHING;
```

### 3.5 Tipado: Validación Zod Unificada

Actualmente los Zod schemas están duplicados entre `route.ts` y `[id]/route.ts`. Se extraerán a un módulo compartido:

**Nuevo archivo: `lib/validations/lead.ts`**

```typescript
import { z } from 'zod';

export const leadStatusEnum = z.enum(['New', 'Contacted', 'Qualified', 'Lost', 'Won']);
export const leadSourceEnum = z.enum(['inbound_web', 'inbound_telegram', 'inbound_whatsapp', 'outbound_hunter', 'manual', 'referral']);
export const assignedNodeEnum = z.enum(['gatekeeper', 'sdr', 'hunter', 'admin', 'unassigned']);

export const createLeadSchema = z.object({
  name: z.string().min(1).max(255),
  company: z.string().max(255).optional(),            // FIX: was "compunknown"
  email: z.string().email().max(320).optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  status: leadStatusEnum.default('New'),
  source: leadSourceEnum.default('inbound_web'),
  icp_score: z.number().min(0).max(100).optional(),
  assigned_node: assignedNodeEnum.default('unassigned'),
  metadata: z.record(z.string(), z.unknown()).optional().default({}),
});

export const updateLeadSchema = z.object({
  status: leadStatusEnum.optional(),
  sort_order: z.number().optional(),
  assigned_node: assignedNodeEnum.optional(),
  name: z.string().max(255).optional(),
  company: z.string().max(255).optional(),             // FIX: was "compunknown"
  email: z.string().email().max(320).optional().or(z.literal('')),
  phone: z.string().max(20).optional(),
  icp_score: z.number().min(0).max(100).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

export type CreateLeadInput = z.infer<typeof createLeadSchema>;
export type UpdateLeadInput = z.infer<typeof updateLeadSchema>;
```

---

## 4. Diagrama de Flujo (D&D End-to-End)

```
┌─────────────┐     onDragEnd      ┌───────────────────────┐
│  KanbanBoard │ ──────────────────► │ useMoveLeadMutation   │
│  (@dnd-kit)  │                    │                       │
└─────────────┘                    │ 1. cancelQueries()    │
                                   │ 2. setQueryData()     │◄── Optimistic UI update
                                   │    (snapshot saved)    │
                                   │ 3. PATCH /api/leads/  │
                                   │    :id                │
                                   └───────┬───────────────┘
                                           │
                              ┌────────────▼────────────┐
                              │  Route Handler (PATCH)   │
                              │  app/api/leads/[id]      │
                              │                          │
                              │  1. Auth check (Supabase)│
                              │  2. Zod validation       │
                              │  3. supabase.from('leads')│
                              │     .update({status,     │
                              │      sort_order})        │
                              │     .eq('id', id)        │
                              └────────────┬────────────┘
                                           │
                              ┌────────────▼────────────┐
                              │  Supabase / PostgreSQL   │
                              │  leads table             │
                              │                          │
                              │  UPDATE + trigger         │
                              │  updated_at = now()      │
                              └─────────────────────────┘
                                           │
                              ┌────────────▼────────────┐
                              │  onSettled callback      │
                              │  invalidateQueries()     │◄── Revalidates from DB
                              └─────────────────────────┘
                                           │
                              Si error  ───┤
                                           ▼
                              ┌─────────────────────────┐
                              │  onError callback        │
                              │  Restore snapshot        │◄── Rollback UI
                              └─────────────────────────┘
```

---

## 5. Archivos Impactados (Delta Completo)

| Archivo | Acción | Descripción |
|---|---|---|
| `hooks/queries/use-leads.ts` | **MODIFY** | Eliminar `MOCK_LEADS`, branch `MOCK_MODE`, dejar solo `fetch('/api/leads')` |
| `app/api/leads/route.ts` | **MODIFY** | Fix `compunknown` → `company`, importar schema de `lib/validations/lead.ts` |
| `app/api/leads/[id]/route.ts` | **MODIFY** | Fix `compunknown` → `company`, importar schema de `lib/validations/lead.ts` |
| `lib/validations/lead.ts` | **CREATE** | Zod schemas unificados (`createLeadSchema`, `updateLeadSchema`, enums) |
| `supabase/migrations/20260421100000_seed_leads_dev.sql` | **CREATE** | Seed data para desarrollo (7 leads distribuidos en 5 columnas) |
| `supabase/migrations/20260421100001_rebalance_column_rpc.sql` | **CREATE** | Función RPC `rebalance_column(target_status)` |
| `.env.local` | **MODIFY** | Eliminar `NEXT_PUBLIC_MOCK_MODE` (si existe) |

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Tabla `leads` vacía al eliminar mocks → UI muestra board vacío | Alta | Bajo | Seed migration provee datos de desarrollo |
| Bug `compunknown` causa datos corruptos en leads existentes | Media | Alto | Fix inmediato; revisar si hay rows con `company = NULL` que deberían tener valor |
| Rebalanceo de `sort_order` no ejecutado → colisiones de posición | Baja | Medio | RPC `rebalance_column` + detección en frontend cuando delta < 1e-10 |
| `NEXT_PUBLIC_MOCK_MODE` usado por otros módulos | Baja | Bajo | Grep global del proyecto para verificar que sólo `use-leads.ts` lo usa |

---

## 7. Work Breakdown Structure (WBS) — Pasos para Night Coder

### Fase 1: Fix de Bugs y Cleanup (Prerequisito)

| # | Tarea | Archivos | Criterio de Aceptación |
|---|---|---|---|
| 1.1 | Fix bug `compunknown` → `company` en `createLeadSchema` | `app/api/leads/route.ts` | Schema Zod tiene `company: z.string().max(255).optional()` |
| 1.2 | Fix bug `compunknown` → `company` en `updateLeadSchema` | `app/api/leads/[id]/route.ts` | Schema Zod tiene `company: z.string().max(255).optional()` |
| 1.3 | Grep global `NEXT_PUBLIC_MOCK_MODE` para verificar alcance | Proyecto completo | Output del grep confirma que solo `use-leads.ts` lo usa |

### Fase 2: Extracción de Schemas (DRY)

| # | Tarea | Archivos | Criterio de Aceptación |
|---|---|---|---|
| 2.1 | Crear `lib/validations/lead.ts` con schemas Zod unificados y enums | `lib/validations/lead.ts` (NUEVO) | Archivo creado con `createLeadSchema`, `updateLeadSchema`, exports tipados |
| 2.2 | Refactorizar `app/api/leads/route.ts` para importar de `lib/validations/lead.ts` | `app/api/leads/route.ts` | Eliminar schema inline, importar de `@/lib/validations/lead` |
| 2.3 | Refactorizar `app/api/leads/[id]/route.ts` para importar de `lib/validations/lead.ts` | `app/api/leads/[id]/route.ts` | Eliminar schema inline, importar de `@/lib/validations/lead` |

### Fase 3: Eliminación de Mocks

| # | Tarea | Archivos | Criterio de Aceptación |
|---|---|---|---|
| 3.1 | Eliminar `MOCK_LEADS` array y branch `MOCK_MODE` de `use-leads.ts` | `hooks/queries/use-leads.ts` | Archivo contiene solo `fetchLeads()` con `fetch('/api/leads')` y el hook `useLeads()` |
| 3.2 | Eliminar `NEXT_PUBLIC_MOCK_MODE` de `.env.local` (si existe) | `.env.local` | Variable removida o confirmada como inexistente |

### Fase 4: Migrations (Supabase)

| # | Tarea | Archivos | Criterio de Aceptación |
|---|---|---|---|
| 4.1 | Crear seed migration con 7 leads de prueba | `supabase/migrations/20260421100000_seed_leads_dev.sql` | Migración creada y ejecutable con `supabase db push` o `supabase migration up` |
| 4.2 | Crear RPC `rebalance_column` | `supabase/migrations/20260421100001_rebalance_column_rpc.sql` | Función invocable via `supabase.rpc('rebalance_column', { target_status: 'New' })` |
| 4.3 | Ejecutar migraciones en entorno local | CLI Supabase | `supabase db push` exitoso, leads visibles en Supabase Studio |

### Fase 5: Validación E2E

| # | Tarea | Método | Criterio de Aceptación |
|---|---|---|---|
| 5.1 | Verificar que `GET /api/leads` retorna los 7 leads del seed | `curl` o browser DevTools | Response 200 con `data: [...]` de 7 elementos |
| 5.2 | Verificar que el `KanbanBoard` renderiza leads reales | UI en `localhost:3000` | Board muestra leads distribuidos en columnas correctas |
| 5.3 | Verificar D&D: mover lead de "New" a "Contacted" | UI + Network tab | PATCH exitoso, UI no parpadea (optimistic), refresh mantiene posición |
| 5.4 | Verificar rollback: forzar error de red y confirmar revert | Network throttling OFF/Error | Lead regresa a posición original en UI |
| 5.5 | Verificar que `company` se persiste correctamente via POST | `curl POST /api/leads` con `company: "TestCorp"` | Lead creado con `company = "TestCorp"` en DB |

---

## 8. Decisiones de Diseño

| Decisión | Alternativa Descartada | Razón |
|---|---|---|
| Eliminar `MOCK_MODE` completamente | Mantener con feature flag | La API ya conecta a Supabase; mantener mocks agrega complejidad sin valor. Tests deben mockear a nivel de MSW o Vitest, no con env vars en producción. |
| Extraer Zod schemas a `lib/validations/` | Mantener inline en cada route | DRY; los schemas se reutilizarán en formularios del frontend (React Hook Form + Zod resolver) |
| Estrategia Punto Medio (ya implementada) | Enteros con gaps, lexicográfico (fractional indexing) | Ya está en producción y auditada. Punto medio con DOUBLE PRECISION es suficiente para el volumen esperado (~100 leads/columna). |
| RPC para rebalanceo (no trigger automático) | Trigger on UPDATE que rebalancee toda la columna | Trigger on UPDATE causaría cascadas innecesarias. RPC se invoca explícitamente solo cuando se detecta colisión (<1e-10). |
| Seed en migración separada | Seed en código TypeScript | Mantiene el seed versionado y reproducible con `supabase db reset`. Se puede excluir en producción filtrando el archivo. |

---

## 9. Dependencias y Orden de Ejecución

```
Fase 1 (Fix bugs) ──► Fase 2 (DRY schemas) ──► Fase 3 (Kill mocks) ──► Fase 4 (Migrations) ──► Fase 5 (E2E)
       │                        │                        │                       │
       └── Parallelizable ──────┘                        │                       │
                                                         └── Parallelizable ─────┘
```

**Nota:** Fases 1+2 son independientes y pueden ejecutarse en paralelo. Fase 3 depende de Fase 1 (fix de bugs) para que la API funcione correctamente. Fase 4 puede ejecutarse en paralelo con Fase 3. Fase 5 requiere todas las anteriores.

**Estimación total:** ~3 horas de ejecución para Night Coder (excluyendo tiempos de CI/deploy).

---

## 10. Post-Sprint (Siguiente Iteración)

Elementos fuera de scope de este Sprint pero que deben documentarse para Sprint 1.8+:

1. **Empty State UI:** Componente `<EmptyKanban />` cuando la tabla está vacía en producción real (no seed).
2. **Formulario de Creación de Lead:** Modal/drawer que use `createLeadSchema` con React Hook Form.
3. **SSE/Realtime:** Reconectar `LISTEN/NOTIFY` (ADR-112) para que leads creados por el Orchestrator aparezcan en el Kanban sin refresh manual.
4. **Filtros de Kanban:** UI para filtrar por `assigned_node`, `source`, rango de `icp_score`.
5. **Error Boundary:** Wrap del `KanbanBoard` con React Error Boundary para capturar fallos de red gracefully.

---

*Documento generado por Builder (Arquitecto Staff) — Equipo Teseo.*
*Pendiente: Aprobación del CEO para iniciar ejecución por Night Coder.*
