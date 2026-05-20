# RFC-032: Asset Studio — Persistencia de Canvas Layout

| Campo | Valor |
|---|---|
| **Autor** | Builder (Arquitecto Staff) — Escuadrón Teseo |
| **Fecha** | 2026-04-21 |
| **Estado** | Draft |
| **Prerequisitos** | RFC-030 (Canvas Architecture), RFC-031 (Canvas Rendering & Playback), Sprint 5.1–5.4 completados |
| **Componente** | `crm-agentico-panel` → `app/(dashboard)/asset-studio/canvas/[templateId]` |
| **Stack** | Next.js 14 App Router, Supabase (PostgreSQL + RLS), Zustand 5, TanStack Query 5, GSAP 3.15, Zod |

---

## 1. Resumen Ejecutivo

Actualmente, todas las mutaciones del Canvas (posiciones, estilos, animaciones, orden de capas) viven exclusivamente en memoria dentro del store de Zustand (`draftAttributes`, `draftNodeOrder`). Al recargar la página, los cambios se pierden. El Route Handler `POST /api/asset-studio/canvas/save` existe como stub y solo escribe una línea de changelog en `prompt_versions`.

Este RFC diseña la arquitectura completa para:

1. **Persistir** el layout editado en una columna `canvas_data JSONB` de la tabla `prompt_versions`.
2. **Refactorizar** el Route Handler para que escriba el JSON consolidado en DB.
3. **Refactorizar** el hook `use-save-canvas.ts` para construir el payload final (merge de drafts sobre layout base) antes de enviarlo a la API.
4. **Recargar** el layout guardado correctamente al abrir el Canvas.

### Problema actual

```
[Usuario edita Canvas] → draftAttributes (Zustand, RAM)
                       → clearDrafts() on save ✅
                       → POST /api/.../save → escribe solo changelog string ❌
                       → Refresh → draftAttributes = {} → cambios perdidos ❌
```

### Solución target

```
[Usuario edita Canvas] → draftAttributes (Zustand, RAM)
                       → Save: merge(layout_base, draftAttributes) → canvas_data JSON
                       → POST /api/.../save → UPDATE prompt_versions SET canvas_data = $1
                       → clearDrafts() ✅
                       → Refresh → fetch canvas_data → layout reconstituido ✅
```

---

## 2. Esquema de Base de Datos (DDL)

### 2.1 Migración: Agregar columna `canvas_data` a `prompt_versions`

**Archivo:** `supabase/migrations/20260421000000_add_canvas_data_to_prompt_versions.sql`

```sql
-- ═══════════════════════════════════════════════════════
-- Migración: Agregar canvas_data JSONB a prompt_versions
-- Sprint 5.5 — Persistencia de Canvas Layout
-- ═══════════════════════════════════════════════════════

-- 1. Agregar columna JSONB nullable (no rompe datos existentes)
ALTER TABLE prompt_versions
  ADD COLUMN IF NOT EXISTS canvas_data JSONB;

-- 2. Comentario descriptivo
COMMENT ON COLUMN prompt_versions.canvas_data IS
  'Layout completo del Canvas serializado como JSON. '
  'Estructura: { width, height, background, nodes[], nodeOrder[], metadata }. '
  'NULL = versión sin layout visual (solo texto de prompt).';

-- 3. Índice GIN para queries futuras sobre nodos específicos
CREATE INDEX IF NOT EXISTS idx_prompt_versions_canvas_data
  ON prompt_versions USING GIN (canvas_data jsonb_path_ops);

-- 4. Constraint CHECK para validar estructura mínima cuando no es NULL
ALTER TABLE prompt_versions
  ADD CONSTRAINT chk_canvas_data_structure
  CHECK (
    canvas_data IS NULL
    OR (
      canvas_data ? 'width'
      AND canvas_data ? 'height'
      AND canvas_data ? 'nodes'
      AND jsonb_typeof(canvas_data -> 'nodes') = 'array'
    )
  );
```

### 2.2 Forma del JSON `canvas_data`

El JSONB almacenado seguirá exactamente la interfaz `CanvasLayout` definida en `types/canvas.ts`, extendida con `nodeOrder` y `metadata`:

```jsonc
{
  "width": 1920,
  "height": 1080,
  "background": "#ffffff",
  "nodes": [
    {
      "id": "node-abc123",
      "type": "heading",
      "label": "Hero Title",
      "content": "Welcome to Asset Studio",
      "style": {
        "fontSize": "48px",
        "fontWeight": "bold",
        "color": "#333333"
      },
      "animation": {
        "start": 0,
        "duration": 1.5,
        "trackIndex": 0,
        "ease": "power3.out",
        "from": { "y": -50, "opacity": 0 }
      },
      "visible": true,
      "locked": false
    }
    // ... más nodos
  ],
  "nodeOrder": ["node-abc123", "node-def456", "node-ghi789"],
  "metadata": {
    "savedAt": "2026-04-21T16:00:00Z",
    "savedBy": "user-uuid",
    "editorVersion": "5.5.0",
    "totalDuration": 10.0
  }
}
```

### 2.3 Tipo TypeScript correspondiente

Extender `types/canvas.ts`:

```typescript
// Extensión para persistencia (Sprint 5.5)
export interface PersistedCanvasData extends CanvasLayout {
  nodeOrder: string[];           // Orden visual de los nodos (z-index / layer order)
  metadata: CanvasMetadata;
}

export interface CanvasMetadata {
  savedAt: string;               // ISO 8601
  savedBy: string;               // user UUID
  editorVersion: string;         // semver del editor
  totalDuration: number;         // duración total del timeline en segundos
}
```

---

## 3. Arquitectura de la API

### 3.1 Route Handler: `POST /api/asset-studio/canvas/save`

**Archivo:** `app/api/asset-studio/canvas/save/route.ts`

**Cambio principal:** Reemplazar la escritura de `changelog` (string) por la escritura de `canvas_data` (JSONB) en `prompt_versions`.

#### 3.1.1 Contrato de Request

```typescript
// Zod schema — reemplaza el schema actual
const persistedCanvasDataSchema = z.object({
  width: z.number().int().positive(),
  height: z.number().int().positive(),
  background: z.string(),
  nodes: z.array(z.object({
    id: z.string(),
    type: z.enum(['text', 'heading', 'image', 'button', 'container', 'divider']),
    label: z.string(),
    content: z.string(),
    children: z.array(z.lazy(() => z.any())).optional(), // recursivo
    style: z.record(z.string(), z.union([z.string(), z.number()])),
    animation: z.object({
      start: z.number().min(0),
      duration: z.number().positive(),
      trackIndex: z.number().int().min(0),
      ease: z.string(),
      from: z.record(z.string(), z.union([z.string(), z.number()])),
    }),
    visible: z.boolean(),
    locked: z.boolean(),
  })),
  nodeOrder: z.array(z.string()),
  metadata: z.object({
    savedAt: z.string().datetime(),
    savedBy: z.string().uuid(),
    editorVersion: z.string(),
    totalDuration: z.number().min(0),
  }),
});

const saveCanvasSchema = z.object({
  templateId: z.string().uuid(),
  canvasData: persistedCanvasDataSchema,
  generateSnapshot: z.boolean().optional().default(false),
  createNewVersion: z.boolean().optional().default(false),
});
```

#### 3.1.2 Flujo del Handler (pseudocódigo)

```
POST /api/asset-studio/canvas/save
│
├─ 1. Auth: supabase.auth.getUser() → extraer user.id y tenant_id
│
├─ 2. Validar body con Zod (saveCanvasSchema)
│
├─ 3. Verificar ownership: prompt_templates WHERE id = templateId AND tenant_id = $tenant
│     → 404 si no existe
│     → Extraer active_version_id
│
├─ 4. Decisión de versionado:
│     ├─ createNewVersion = false (default):
│     │   → UPDATE prompt_versions
│     │     SET canvas_data = $canvasData,
│     │         changelog = 'Canvas layout updated at <ISO>'
│     │     WHERE id = $active_version_id
│     │
│     └─ createNewVersion = true:
│         → SELECT MAX(version_number) FROM prompt_versions WHERE template_id = $templateId
│         → INSERT INTO prompt_versions (template_id, version_number, content, canvas_data, ...)
│         → UPDATE prompt_templates SET active_version_id = $new_version_id
│
├─ 5. (Opcional) Snapshot stub → log / futuro: Puppeteer headless
│
└─ 6. Response: { success: true, versionId, savedAt }
```

#### 3.1.3 Respuesta

```typescript
// Success (200)
{
  success: true,
  versionId: "uuid-de-la-version",
  savedAt: "2026-04-21T16:00:00Z"
}

// Error (400 | 401 | 403 | 404 | 500)
{
  error: "Descriptive error message",
  details?: ZodFormattedError  // solo en 400
}
```

### 3.2 Route Handler: `GET /api/templates/[id]` (Modificación)

El hook `useTemplate` ya hace fetch a `GET /api/templates/[id]`. Este endpoint debe extenderse para devolver `canvas_data` desde `prompt_versions`:

```
GET /api/templates/:id
│
├─ 1. Auth + tenant check
│
├─ 2. SELECT pt.*, pv.canvas_data, pv.content, pv.version_number
│     FROM prompt_templates pt
│     LEFT JOIN prompt_versions pv ON pv.id = pt.active_version_id
│     WHERE pt.id = $id AND pt.tenant_id = $tenant
│
├─ 3. Si pv.canvas_data IS NOT NULL:
│     → layout = pv.canvas_data  (JSON ya parseado por Supabase client)
│   Si pv.canvas_data IS NULL:
│     → layout = fallbackLayout  (el fallback que ya existe en use-template.ts)
│
└─ 4. Response: { id, name, layout, versionNumber, ... }
```

**Impacto en `use-template.ts`:** Ningún cambio necesario. El hook ya espera `{ id, name, layout: CanvasLayout }`. La API simplemente alimentará `layout` desde `canvas_data` en vez de retornar un mock.

---

## 4. Integración en UI

### 4.1 Refactor de `hooks/use-save-canvas.ts`

El hook actual envía `draftAttributes` sin procesar al servidor. El nuevo flujo debe:

1. **Leer** el layout base desde TanStack Query cache (`template.layout`).
2. **Leer** `draftAttributes` y `draftNodeOrder` desde Zustand.
3. **Merge** (shallow) de cada `draftAttributes[nodeId]` sobre el nodo correspondiente del layout base.
4. **Capturar** `totalDuration` del GSAP master timeline vía `window.__timelines[templateId]`.
5. **Construir** el `PersistedCanvasData` completo con metadata.
6. **Enviar** `POST /api/asset-studio/canvas/save` con `{ templateId, canvasData }`.
7. **On success:** `clearDrafts()` + invalidar TanStack Query cache.

#### 4.1.1 Pseudocódigo del merge

```typescript
function buildCanvasPayload(
  baseLayout: CanvasLayout,
  draftAttributes: Record<string, NodeAttributes>,
  draftNodeOrder: string[] | null,
  templateId: string,
  userId: string
): PersistedCanvasData {
  
  // 1. Merge de atributos sobre nodos base
  const mergedNodes = baseLayout.nodes.map(node => {
    const draft = draftAttributes[node.id];
    if (!draft) return node; // Sin cambios → mantener original
    
    return {
      ...node,
      content: draft.content ?? node.content,
      visible: draft.visible ?? node.visible,
      locked: draft.locked ?? node.locked,
      style: { ...node.style, ...draft.inlineStyles },
      animation: {
        ...node.animation,
        start: draft.animationProps?.dataStart ?? node.animation.start,
        duration: draft.animationProps?.dataDuration ?? node.animation.duration,
        trackIndex: draft.animationProps?.dataTrackIndex ?? node.animation.trackIndex,
        ease: draft.animationProps?.ease ?? node.animation.ease,
        from: draft.animationProps?.fromProps 
          ? { ...node.animation.from, ...draft.animationProps.fromProps }
          : node.animation.from,
      },
      // transform se aplica como inline styles
    };
  });

  // 2. Aplicar orden de nodos (si fue reordenado)
  const nodeOrder = draftNodeOrder ?? baseLayout.nodes.map(n => n.id);
  
  // 3. Reordenar mergedNodes según nodeOrder
  const orderedNodes = nodeOrder
    .map(id => mergedNodes.find(n => n.id === id))
    .filter(Boolean) as CanvasNodeDef[];

  // 4. Capturar duración del timeline GSAP
  const masterTl = window.__timelines?.[templateId];
  const totalDuration = masterTl?.duration?.() ?? 10.0;

  return {
    width: baseLayout.width,
    height: baseLayout.height,
    background: baseLayout.background,
    nodes: orderedNodes,
    nodeOrder,
    metadata: {
      savedAt: new Date().toISOString(),
      savedBy: userId,
      editorVersion: '5.5.0',
      totalDuration,
    },
  };
}
```

#### 4.1.2 Nuevo flujo del hook `useSaveCanvas`

```typescript
// Pseudocódigo — NO código final
export function useSaveCanvas(templateId: string) {
  const clearDrafts = useCanvasStore(s => s.clearDrafts);
  const queryClient = useQueryClient();
  
  return useMutation({
    mutationFn: async () => {
      // 1. Leer layout base del cache de TanStack Query
      const template = queryClient.getQueryData<Template>(['template', templateId]);
      if (!template?.layout) throw new Error('No base layout in cache');
      
      // 2. Leer estado transitorio de Zustand
      const { draftAttributes, draftNodeOrder } = useCanvasStore.getState();
      
      // 3. Obtener userId (del contexto de auth)
      const userId = await getCurrentUserId(); // helper existente o nuevo
      
      // 4. Construir payload consolidado
      const canvasData = buildCanvasPayload(
        template.layout, draftAttributes, draftNodeOrder, templateId, userId
      );
      
      // 5. Enviar a la API
      const res = await fetch('/api/asset-studio/canvas/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templateId, canvasData }),
      });
      
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Failed to save canvas');
      }
      
      return res.json();
    },
    onSuccess: () => {
      // 6. Limpiar drafts de Zustand
      clearDrafts();
      
      // 7. Invalidar cache para que el próximo fetch traiga canvas_data de DB
      queryClient.invalidateQueries({ queryKey: ['template', templateId] });
    },
  });
}
```

### 4.2 Refactor de `SaveCanvasButton.tsx`

Cambio menor: el hook ahora recibe `templateId` como argumento en vez de pasar `draftAttributes` directamente.

```typescript
// Pseudocódigo
export function SaveCanvasButton({ templateId }: { templateId: string }) {
  const { mutate, isPending } = useSaveCanvas(templateId);
  const hasDrafts = useCanvasStore(s => Object.keys(s.draftAttributes).length > 0);
  const hasDraftOrder = useCanvasStore(s => s.draftNodeOrder !== null);

  return (
    <Button
      onClick={() => mutate()}
      disabled={(!hasDrafts && !hasDraftOrder) || isPending}
    >
      {isPending ? 'Saving...' : 'Save Canvas'}
    </Button>
  );
}
```

### 4.3 Flujo de recarga (load)

Al montar `CanvasViewport`, el flujo actual ya funciona correctamente para la recarga:

```
1. page.tsx monta → useTemplate(templateId) dispara fetch
2. GET /api/templates/:id → devuelve { layout: canvas_data || fallback }
3. CanvasViewport recibe template.layout → renderiza nodos
4. draftAttributes = {} (limpio) → Canvas muestra layout guardado
5. GSAP reconstruye timeline desde los nodos
```

**No se requiere cambio en `CanvasViewport`** — ya consume `template.layout` como fuente de verdad y aplica `draftAttributes` como overlay. Al recargar, los drafts están vacíos y el layout viene de DB.

### 4.4 Diagrama de flujo completo

```
┌──────────────┐    ┌───────────────────┐    ┌─────────────────────┐
│  Zustand      │    │  TanStack Query   │    │  Supabase (DB)      │
│  (RAM)        │    │  (Cache)          │    │  prompt_versions    │
│               │    │                   │    │  .canvas_data JSONB │
│ draftAttrs    │    │ template.layout   │    │                     │
│ draftNodeOrder│    │                   │    │                     │
└──────┬───────┘    └────────┬──────────┘    └──────────┬──────────┘
       │                     │                          │
       │  ┌──────────────────┘                          │
       │  │                                             │
       ▼  ▼                                             │
  ┌────────────────┐                                    │
  │ buildCanvas    │                                    │
  │ Payload()      │  ← merge draftAttrs + baseLayout   │
  │                │                                    │
  └───────┬────────┘                                    │
          │ POST /api/.../save                          │
          │ { canvasData: PersistedCanvasData }         │
          ▼                                             │
  ┌────────────────┐    UPDATE ... SET canvas_data      │
  │ Route Handler  │ ─────────────────────────────────► │
  └───────┬────────┘                                    │
          │ onSuccess                                   │
          ▼                                             │
  ┌────────────────┐                                    │
  │ clearDrafts()  │  + invalidateQueries(['template']) │
  │ (Zustand)      │  → re-fetch trae canvas_data de DB│
  └────────────────┘                                    │
```

---

## 5. Consideraciones de Seguridad

### 5.1 RLS (Row-Level Security)

La política RLS existente `tenant_isolation_versions` ya protege `prompt_versions`:

```sql
CREATE POLICY "tenant_isolation_versions" ON prompt_versions
  FOR ALL USING (
    template_id IN (
      SELECT id FROM prompt_templates
      WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );
```

El Route Handler **además** verifica ownership en server-side antes del UPDATE para defensa en profundidad (ya implementado).

### 5.2 Validación del payload

- **Tamaño máximo:** Limitar el body a 2 MB (Next.js default) — suficiente para layouts complejos (~50–100 nodos).
- **Zod strict:** El schema rechaza propiedades no declaradas.
- **CHECK constraint en DB:** Valida estructura mínima (`width`, `height`, `nodes` array).

### 5.3 Concurrencia

Para Sprint 5.5, se implementa **last-write-wins** (overwrite simple). Razón: un solo usuario edita un template a la vez. Para futuro (Sprint 6+), considerar optimistic locking con `updated_at` timestamp comparison.

---

## 6. Testing Strategy

| Nivel | Qué probar | Herramienta |
|---|---|---|
| **Unit** | `buildCanvasPayload()` — merge correcto de drafts sobre layout base | Vitest |
| **Unit** | Zod schema — rechaza payloads malformados, acepta válidos | Vitest |
| **Integration** | Route Handler — auth, tenant check, INSERT/UPDATE en DB | Vitest + Supabase local |
| **E2E** | Editar nodo → Save → Refresh → verificar que cambios persisten | Playwright |
| **DB** | CHECK constraint rechaza `canvas_data` sin `nodes` array | SQL directo |

---

## 7. Work Breakdown Structure (WBS) — Sprint 5.5

| # | Tarea | Archivo(s) | Estimado | Dependencias |
|---|---|---|---|---|
| **5.5.1** | Crear migración SQL: `ALTER TABLE prompt_versions ADD COLUMN canvas_data JSONB` + constraint + índice | `supabase/migrations/20260421000000_...sql` | 1h | — |
| **5.5.2** | Ejecutar migración en entorno local (`supabase db push` o `supabase migration up`) | CLI | 0.5h | 5.5.1 |
| **5.5.3** | Extender `types/canvas.ts` con `PersistedCanvasData` y `CanvasMetadata` | `types/canvas.ts` | 0.5h | — |
| **5.5.4** | Crear función pura `buildCanvasPayload()` en `lib/canvas-payload.ts` | `lib/canvas-payload.ts` | 1.5h | 5.5.3 |
| **5.5.5** | Tests unitarios para `buildCanvasPayload()` (merge, nodeOrder, metadata, edge cases) | `__tests__/canvas-payload.test.ts` | 1h | 5.5.4 |
| **5.5.6** | Refactorizar Route Handler `POST /api/asset-studio/canvas/save`: nuevo Zod schema, UPDATE con `canvas_data` | `app/api/asset-studio/canvas/save/route.ts` | 2h | 5.5.1, 5.5.3 |
| **5.5.7** | Modificar/crear `GET /api/templates/[id]` para devolver `canvas_data` como `layout` | `app/api/templates/[id]/route.ts` | 1.5h | 5.5.1 |
| **5.5.8** | Refactorizar `hooks/use-save-canvas.ts`: integrar `buildCanvasPayload`, `clearDrafts`, `invalidateQueries` | `hooks/use-save-canvas.ts` | 1.5h | 5.5.4, 5.5.6 |
| **5.5.9** | Actualizar `SaveCanvasButton.tsx` para nuevo API del hook | `_components/SaveCanvasButton.tsx` | 0.5h | 5.5.8 |
| **5.5.10** | Test de integración del Route Handler (auth, tenant, save+reload) | `__tests__/api/canvas-save.test.ts` | 1.5h | 5.5.6, 5.5.7 |
| **5.5.11** | Test E2E: editar → guardar → recargar → verificar persistencia | `e2e/canvas-persistence.spec.ts` | 2h | 5.5.8, 5.5.9 |
| **5.5.12** | QA manual + fix de bugs | — | 1.5h | 5.5.11 |

**Total estimado: ~15 horas (~2 días de sprint)**

### Diagrama de dependencias

```
5.5.1 (DDL) ──────┬──── 5.5.6 (Route Handler POST)
                   │         │
5.5.3 (Types) ────┤    5.5.7 (Route Handler GET)
      │            │         │
      └── 5.5.4 (buildPayload)    │
            │      │         │
      5.5.5 (Unit tests)    │
            │                │
            └── 5.5.8 (use-save-canvas refactor)
                     │
               5.5.9 (SaveCanvasButton)
                     │
              5.5.10 (Integration tests)
                     │
              5.5.11 (E2E tests)
                     │
              5.5.12 (QA)
```

### Ruta Crítica

`5.5.1 → 5.5.3 → 5.5.4 → 5.5.6 → 5.5.8 → 5.5.9 → 5.5.11 → 5.5.12`

---

## 8. Riesgos y Mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| `canvas_data` JSONB demasiado grande (>1MB) para templates complejos | Lentitud en queries | Monitorear tamaño promedio; en Sprint 6+ evaluar compresión o normalizar nodos a tabla separada |
| Pérdida de datos si el usuario cierra pestaña sin guardar | UX frustrante | Sprint 6+: autosave con debounce (ej. cada 30s si hay cambios) + `beforeunload` warning |
| Schema drift entre `CanvasLayout` (TS) y CHECK constraint (SQL) | Runtime errors silenciosos | El Zod schema del Route Handler es la barrera principal; el CHECK constraint es defensa adicional |
| `window.__timelines` no disponible en SSR | Error al capturar `totalDuration` | `buildCanvasPayload` se ejecuta solo client-side; fallback a `10.0` si timeline no existe |

---

## 9. Decisiones de Diseño (ADR Inline)

### 9.1 ¿Por qué JSONB en `prompt_versions` y no una tabla separada `canvas_layouts`?

**Decisión:** JSONB en `prompt_versions.canvas_data`.

**Razón:** El layout está intrínsecamente ligado a una versión del prompt. Crear una tabla separada con FK 1:1 añade complejidad de JOIN sin beneficio real. JSONB permite queries flexibles con GIN index si se necesitan en el futuro (ej. buscar templates que usen cierto `ease`). El CHECK constraint garantiza integridad estructural.

### 9.2 ¿Por qué el merge se hace en el cliente y no en el servidor?

**Decisión:** El cliente envía el `PersistedCanvasData` completo (ya mergeado). El servidor solo valida y persiste.

**Razón:** El cliente tiene acceso al layout base (en TanStack cache), a los drafts (en Zustand), y al GSAP timeline (en `window.__timelines`). El servidor no tiene acceso al estado de GSAP. Enviar el JSON final consolidado es más simple, testeable, y evita que el servidor necesite conocer la lógica de merge.

### 9.3 ¿Por qué `createNewVersion` como flag opcional?

**Decisión:** Por defecto, `Save` actualiza la versión activa (overwrite). Opcionalmente, se puede crear una nueva versión (para A/B testing o historial).

**Razón:** El flujo más común es "guardar mis cambios". Forzar una nueva versión en cada save inflaría la tabla. El flag permite al frontend decidir (ej. un botón "Save as New Version" futuro).

---

## Apéndice A: Archivos afectados (resumen)

| Archivo | Acción |
|---|---|
| `supabase/migrations/20260421000000_add_canvas_data_to_prompt_versions.sql` | **Crear** |
| `types/canvas.ts` | **Editar** — agregar `PersistedCanvasData`, `CanvasMetadata` |
| `lib/canvas-payload.ts` | **Crear** — función `buildCanvasPayload()` |
| `app/api/asset-studio/canvas/save/route.ts` | **Refactorizar** — nuevo schema, UPDATE con canvas_data |
| `app/api/templates/[id]/route.ts` | **Editar** — devolver canvas_data como layout |
| `hooks/use-save-canvas.ts` | **Refactorizar** — integrar buildCanvasPayload + invalidateQueries |
| `_components/SaveCanvasButton.tsx` | **Editar** — pasar templateId al hook |
| `__tests__/canvas-payload.test.ts` | **Crear** |
| `__tests__/api/canvas-save.test.ts` | **Crear** |
| `e2e/canvas-persistence.spec.ts` | **Crear** |
