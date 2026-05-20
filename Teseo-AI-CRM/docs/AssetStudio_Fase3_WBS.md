# Asset Studio — Fase 3: UI/UX y Componentes Base

| Campo | Valor |
|---|---|
| **Autor** | Builder (Arquitecto Staff) — Escuadrón Teseo |
| **Fecha** | 2026-04-20 |
| **Estado** | Draft — Plan Maestro para Ejecutor |
| **Prerrequisitos** | Fase 1 (BD + Types) ✅, Fase 2 (APIs + Hooks + Store) ✅ |
| **Stack** | Next.js 14 App Router, TypeScript 5, Tailwind 3.4, Shadcn/UI, Zustand 5, TanStack Query 5, Recharts, jsdiff |

---

## 0. Inventario de lo Existente (Fases 1 & 2)

Antes de planificar componentes, este es el contrato con lo que ya existe y que el Ejecutor **NO debe recrear**:

### 0.1 Base de Datos (Fase 1) ✅
- 6 tablas con RLS: `prompt_templates`, `prompt_versions`, `ab_experiments`, `ab_variants`, `ab_impressions`, `variable_defs`
- ENUMs: `prompt_version_status`, `ab_experiment_status`, `ab_outcome`, `variable_type`
- Constraint diferido circular `active_version_id` / `winner_variant_id`

### 0.2 TypeScript Contracts (Fase 1) ✅
- `types/prompt.ts` → `PromptTemplate`, `PromptVersion`, `VariableRef`, `AgentRole`, `VersionStatus`
- `types/experiment.ts` → `ABExperiment`, `ABVariant`, `ABImpression`, `VariantStats`, `ExperimentStatus`, `ABOutcome`
- `types/variable.ts` → `VariableDef`, `VariableType`

### 0.3 API Route Handlers BFF (Fase 2) ✅
- Prompts CRUD: `api/prompts/`, `api/prompts/[templateId]/`, `api/prompts/[templateId]/versions/`, `…/[versionId]/`, `…/promote/`
- Experiments CRUD + control: `api/prompts/[templateId]/experiments/`, `…/[experimentId]/`, `…/start/`, `…/pause/`, `…/end/`, `…/cancel/`
- Variables CRUD: `api/variables/`, `api/variables/[variableId]/`
- Documents CRUD: `api/documents/`, `api/documents/upload/`, `api/documents/[docId]/`, `…/chunks/`

### 0.4 TanStack Query Hooks (Fase 2) ✅
**Queries:** `use-prompt-templates`, `use-prompt-versions`, `use-prompt-version-detail`, `use-experiments`, `use-experiment-stats`, `use-variable-defs`, `use-documents`, `use-document-chunks`
**Mutations:** `use-save-version`, `use-promote-version`, `use-archive-version`, `use-create-experiment`, `use-control-experiment`, `use-declare-winner`, `use-save-variable`, `use-upload-document`
**Cache Keys:** `lib/query-keys.ts` ya tiene `prompts`, `experiments`, `variables`, `documents`

### 0.5 Zustand Store (Fase 2) ✅
- `stores/asset-studio-store.ts` → `activeTemplateId`, `activeVersionId`, `editorContent`, `isDirty`, `compareVersionIds`, `variablePanelOpen` + acciones

### 0.6 Utilidades (Fase 2) ✅
- `lib/prompt-utils.ts` → `extractVariables()`, `interpolate()`
- `lib/schemas/prompt.ts`, `lib/schemas/experiment.ts`, `lib/schemas/variable.ts` (Zod)

### 0.7 UI Shadcn Existente ✅
Componentes ya instalados: `badge`, `button`, `card`, `dropdown-menu`, `input`, `resizable`, `scroll-area`, `separator`, `sheet`, `sidebar`, `skeleton`, `tabs`, `tooltip`, `avatar`

### 0.8 Página Placeholder ✅
- `app/(asset-studio)/prompts/page.tsx` → stub (solo `<h1>Prompts Studio</h1>`)

---

## 1. Arquitectura de Vistas y Routing

### 1.1 Mapa de Rutas (App Router)

```
app/(asset-studio)/
├── layout.tsx                          # [CREAR] Layout con Tabs: Prompts | Documents | Variables
├── page.tsx                            # [CREAR] Redirect → /prompts
│
├── prompts/
│   ├── page.tsx                        # [REESCRIBIR] Galería de templates (Server Component wrapper)
│   └── [templateId]/
│       ├── page.tsx                    # [CREAR] Editor de prompt + version timeline
│       └── experiments/
│           ├── page.tsx                # [CREAR] Lista de A/B experiments del template
│           └── [experimentId]/
│               └── page.tsx            # [CREAR] Dashboard del experiment
│
├── documents/
│   ├── page.tsx                        # [CREAR] Tabla de documentos + upload
│   └── [docId]/
│       └── page.tsx                    # [CREAR] Chunk viewer
│
└── variables/
    └── page.tsx                        # [CREAR] CRUD de variable_defs
```

### 1.2 Navegación

El `layout.tsx` del route group `(asset-studio)` proporciona tabs de primer nivel (`Prompts`, `Documents`, `Variables`) y el contenido child se renderiza debajo.

Agregar al `app-sidebar.tsx` un grupo "Asset Studio" con sub-items (Prompts, Documents, Variables) bajo un icono `FlaskConical` o `Beaker`.

---

## 2. Jerarquía de Componentes

### 2.1 Árbol Completo

```
components/asset-studio/
│
├── ─── PROMPT GALLERY ───
│   ├── prompt-gallery.tsx              # Grid responsive de PromptCards, filtros por role
│   ├── prompt-card.tsx                 # Card: name, role badge, version activa, status, updated_at
│   └── prompt-create-dialog.tsx        # Dialog: crear nuevo template (name, role, description)
│
├── ─── PROMPT EDITOR ───
│   ├── prompt-editor-layout.tsx        # Composición master-detail: timeline | editor + variable-panel
│   ├── prompt-editor.tsx               # Textarea con highlighting de {{vars}}, isDirty tracking
│   ├── prompt-preview.tsx              # Preview read-only con variables interpoladas
│   ├── prompt-diff-viewer.tsx          # Diff lado-a-lado (modal) usando jsdiff
│   ├── version-timeline.tsx            # Timeline vertical: lista de versiones con status badges
│   ├── version-badge.tsx               # Badge reutilizable: draft(gris), active(verde), testing(amber), archived(slate)
│   └── editor-toolbar.tsx              # Barra: [Save Draft] [Promote ↑] [🧪 New Test] [Compare]
│
├── ─── VARIABLE PANEL ───
│   ├── variable-panel.tsx              # Panel lateral (collapsible) con 3 secciones: matched/undefined/unused
│   ├── variable-tag.tsx                # Chip clickeable → inserta {{key}} en cursor
│   └── variable-form.tsx               # Form inline: key, label, type, default, enum_options, required
│
├── ─── A/B EXPERIMENTS ───
│   ├── experiment-list.tsx             # Tabla/lista de experiments con status badges
│   ├── experiment-setup-dialog.tsx     # Dialog: nombre, selección de versiones, traffic split, confidence
│   ├── experiment-dashboard.tsx        # Composición: stats cards + chart + actions
│   ├── experiment-stats-card.tsx       # Card KPI de una variante: impressions, rates, sentiment
│   ├── traffic-split-slider.tsx        # Slider(s) dual/triple que siempre suman 100%
│   ├── winner-badge.tsx                # Badge dinámico: Winner(green)/Loser(red)/Running(blue)/Paused(amber)
│   └── convergence-chart.tsx           # Recharts LineChart: response rate over time por variante
│
├── ─── DOCUMENTS ───
│   ├── document-table.tsx              # TanStack Table con sorting, search, status
│   ├── upload-dropzone.tsx             # Drag-and-drop con progress bar
│   └── chunk-viewer.tsx                # Lista de chunks con embedding score, highlight de texto
│
└── ─── SHARED ───
    ├── status-dot.tsx                  # Dot indicator reutilizable (green/amber/red/gray)
    ├── empty-state.tsx                 # Placeholder genérico con icon + title + description + CTA
    └── confirm-dialog.tsx              # Dialog de confirmación reutilizable (destructive actions)
```

### 2.2 Componentes Shadcn/UI Nuevos a Instalar

```bash
npx shadcn@latest add dialog textarea table select slider switch form label
# Si no están ya instalados. Verificar package.json.
```

Componentes ya existentes que se reutilizan: `badge`, `button`, `card`, `tabs`, `resizable`, `scroll-area`, `separator`, `sheet`, `skeleton`, `tooltip`, `dropdown-menu`, `input`.

---

## 3. Contratos de Props por Componente

### 3.1 Prompt Gallery

#### `prompt-gallery.tsx`
```typescript
interface PromptGalleryProps {
  // Sin props — usa hook usePromptTemplates() internamente
  // Controla filtros vía URL search params o estado local
}
// Renderiza: grid de PromptCard + botón "New Template" → PromptCreateDialog
// Filtros: role (dropdown), search (input), status (all/active/archived)
// Loading: skeleton grid (3x2)
// Empty: EmptyState con CTA "Create your first prompt template"
```

#### `prompt-card.tsx`
```typescript
interface PromptCardProps {
  template: PromptTemplate;
  activeVersion?: PromptVersion;  // Denormalizado para mostrar status sin fetch extra
  onClick: () => void;            // Navega a /prompts/[templateId]
}
// Renderiza: Card con name, RoleBadge, version badge, description truncada, updated_at relativo
// Hover: sutil shadow elevation
```

#### `prompt-create-dialog.tsx`
```typescript
interface PromptCreateDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: (template: PromptTemplate) => void;
}
// Form fields: name (input), role (select: AgentRole[]), description (textarea)
// Submit: POST /api/prompts → invalidate queryKeys.prompts.all
```

### 3.2 Prompt Editor

#### `prompt-editor-layout.tsx`
```typescript
interface PromptEditorLayoutProps {
  templateId: string;
}
// Composición:
// ResizablePanelGroup horizontal:
//   Panel izquierdo (25%): VersionTimeline
//   Panel derecho (75%):
//     EditorToolbar
//     ResizablePanelGroup horizontal:
//       Panel principal (70%): PromptEditor (o PromptPreview toggle)
//       Panel lateral (30%): VariablePanel (collapsible via store)
```

#### `prompt-editor.tsx`
```typescript
interface PromptEditorProps {
  version: PromptVersion | null;
  readOnly: boolean;                // true para versiones no-draft
  onContentChange: (content: string) => void;
}
// Textarea con:
//   - Highlighting overlay para {{variables}} (span con bg-primary/20 rounded)
//   - Variables definidas → green, no definidas → amber border
//   - isDirty tracking via Zustand store
//   - Cmd+S / Ctrl+S shortcut para save
// NO maneja persistencia (delegada al toolbar → useSaveVersion)
```

#### `prompt-preview.tsx`
```typescript
interface PromptPreviewProps {
  content: string;
  variables: VariableDef[];
  values?: Record<string, string>;  // Override values para preview interactivo
}
// Renderiza content interpolado con valores default de variables
// Inputs editables por variable para preview en tiempo real
// Zona read-only con tipografía mono y bg diferenciada
```

#### `prompt-diff-viewer.tsx`
```typescript
interface PromptDiffViewerProps {
  leftVersion: PromptVersion;
  rightVersion: PromptVersion;
  open: boolean;
  onClose: () => void;
}
// Dialog fullscreen o sheet lateral
// Usa jsdiff (diffLines) para generar hunks
// Renderiza lado-a-lado: izquierda (old, rojo), derecha (new, verde)
// Header: "v{n} → v{m}" con timestamps
```

#### `version-timeline.tsx`
```typescript
interface VersionTimelineProps {
  templateId: string;
  activeVersionId: string | null;
  selectedVersionId: string | null;
  onSelect: (versionId: string) => void;
}
// Usa usePromptVersions(templateId)
// Timeline vertical con línea conectora
// Cada item: version_number, VersionBadge, created_at, changelog preview
// Item seleccionado: highlighted bg
// Footer: [+ New Version] button
```

#### `version-badge.tsx`
```typescript
interface VersionBadgeProps {
  status: VersionStatus;
}
// Mapeo:
//   draft    → variant="outline", gris
//   active   → variant="default", verde (bg-emerald-100 text-emerald-800)
//   testing  → variant="secondary", amber (bg-amber-100 text-amber-800)
//   archived → variant="outline", slate
```

#### `editor-toolbar.tsx`
```typescript
interface EditorToolbarProps {
  templateId: string;
  version: PromptVersion | null;
  isDirty: boolean;
  onSave: () => void;
  onPromote: () => void;
  onNewTest: () => void;
  onCompare: () => void;
  onTogglePreview: () => void;
}
// Renderiza barra horizontal con:
//   Left: Template name + "v{n}" + VersionBadge
//   Right: [Preview 👁] [Compare ↔] [Save Draft 💾] [Promote ↑] [🧪 New A/B Test]
//   Save y Promote deshabilitados según estado (readOnly, !isDirty, no-draft)
```

### 3.3 Variable Panel

#### `variable-panel.tsx`
```typescript
interface VariablePanelProps {
  detectedVars: string[];          // Extraídas del editor content
  onInsertVariable: (key: string) => void;
}
// Usa useVariableDefs() para el catálogo del tenant
// Tres secciones con separadores:
//   ✅ Matched (detected + defined): VariableTags verdes
//   ⚠️ Undefined (detected pero no defined): VariableTags amber + "Define" button
//   ○  Available (defined pero no detected): VariableTags grises, clickeable para insertar
// Collapsible via useAssetStudioStore().variablePanelOpen
```

#### `variable-tag.tsx`
```typescript
interface VariableTagProps {
  variableKey: string;
  status: 'matched' | 'undefined' | 'unused';
  type?: VariableType;
  onClick: () => void;
}
// Chip con: {{key}} + type icon + status color
// Click: inserta en editor (matched/unused) o abre VariableForm (undefined)
```

#### `variable-form.tsx`
```typescript
interface VariableFormProps {
  variable?: VariableDef;          // null = create mode, defined = edit mode
  onSave: (data: Partial<VariableDef>) => void;
  onCancel: () => void;
}
// Campos: key (disabled si edit), label, type (select), default_value, required (switch)
// Si type === 'enum': campo extra enum_options (tag input, comma-separated)
// Validación: Zod schema de lib/schemas/variable.ts
// Submit: useSaveVariable mutation
```

### 3.4 A/B Experiments

#### `experiment-list.tsx`
```typescript
interface ExperimentListProps {
  templateId: string;
}
// Usa useExperiments(templateId)
// Tabla con columnas: name, status (badge), variants count, impressions, created_at, actions
// Row click → navega a /prompts/[templateId]/experiments/[experimentId]
// Empty state: "No experiments yet. Start your first A/B test."
```

#### `experiment-setup-dialog.tsx`
```typescript
interface ExperimentSetupDialogProps {
  templateId: string;
  versions: PromptVersion[];       // Versiones elegibles (no-archived)
  open: boolean;
  onOpenChange: (open: boolean) => void;
}
// Steps:
//   1. Name + confidence level (slider 0.90-0.99, default 0.95) + min impressions (number input)
//   2. Seleccionar 2-3 versiones (checkboxes de PromptVersion cards)
//   3. Traffic split (TrafficSplitSlider)
//   4. Review summary → Create
// Submit: useCreateExperiment mutation → navega al dashboard
```

#### `experiment-dashboard.tsx`
```typescript
interface ExperimentDashboardProps {
  experimentId: string;
  templateId: string;
}
// Usa useExperimentStats(experimentId)
// Layout:
//   Header: name + ExperimentStatusBadge + date range
//   Grid (2-3 cols): ExperimentStatsCard por variante
//   Chart: ConvergenceChart (response rate over time)
//   Actions bar: [Pause] [Resume] [Declare Winner ▶] [Cancel ✕]
//   Si completed: WinnerBadge destacado + "Promote winner" CTA
```

#### `experiment-stats-card.tsx`
```typescript
interface ExperimentStatsCardProps {
  stats: VariantStats;
  isWinner?: boolean;
  isLeading?: boolean;             // Tiene la mejor métrica principal
}
// Card con:
//   Header: "Variant {label}" + version_number + WinnerBadge
//   KPIs grid (2x3): impressions, response rate, positive rate, meetings, sentiment, avg response time
//   Micro bar charts (sparklines) opcionalmente
//   Highlight si isLeading (border-primary)
```

#### `traffic-split-slider.tsx`
```typescript
interface TrafficSplitSliderProps {
  variants: { label: string; versionId: string }[];
  values: number[];                // Porcentajes, siempre suman 100
  onChange: (values: number[]) => void;
}
// Para 2 variantes: un solo slider (A: n%, B: 100-n%)
// Para 3 variantes: dos sliders con auto-ajuste del tercero
// Visualización: barra horizontal segmentada con colores por variante
// Constraint: mínimo 10% por variante, incrementos de 5%
// Validación: sum === 100 (enforcement en onChange)
```

#### `convergence-chart.tsx`
```typescript
interface ConvergenceChartProps {
  experimentId: string;
}
// Usa useExperimentStats(experimentId) — datos de time series
// Recharts LineChart:
//   X: tiempo (days)
//   Y: response rate (0-100%)
//   Series: una línea por variante (A, B, C) con colores distintos
//   Tooltip: fecha + rate por variante
//   Legend: labels de variante
// Responsive container para resize
```

#### `winner-badge.tsx`
```typescript
interface WinnerBadgeProps {
  status: 'winner' | 'loser' | 'running' | 'paused' | 'cancelled';
}
// Mapeo:
//   winner    → 🏆 green badge
//   loser     → red muted badge
//   running   → blue pulse badge
//   paused    → amber badge
//   cancelled → gray strikethrough
```

### 3.5 Documents

#### `document-table.tsx`
```typescript
interface DocumentTableProps {
  // Sin props — usa useDocuments() internamente
}
// TanStack Table (manual) con columnas:
//   name, type (mime), size, chunks_count, status (processing/ready/error), uploaded_at, actions (view/delete)
// Sorting by name/date/size
// Search input (client-side filter)
// Row click → /documents/[docId]
```

#### `upload-dropzone.tsx`
```typescript
interface UploadDropzoneProps {
  onUploadComplete: () => void;    // Callback para invalidar queries
}
// Drag-and-drop zone con:
//   - Icono de upload + "Drop files here or click to browse"
//   - Tipos aceptados: .pdf, .txt, .md, .docx, .csv
//   - Max file size: 10MB
//   - Progress bar durante upload (useUploadDocument mutation con onUploadProgress)
//   - Multi-file support (cola secuencial)
// Usa react-dropzone o input[type=file] nativo con estilos custom
```

#### `chunk-viewer.tsx`
```typescript
interface ChunkViewerProps {
  docId: string;
}
// Usa useDocumentChunks(docId)
// Lista vertical de chunks:
//   Cada chunk: texto preview (truncado 200 chars, expandible), embedding score bar, metadata
//   Numbering: "Chunk 1 of N"
// Optional: search dentro de chunks (client-side highlight)
```

### 3.6 Shared Components

#### `empty-state.tsx`
```typescript
interface EmptyStateProps {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
  action?: { label: string; onClick: () => void };
}
// Centered layout: icon (48px muted) → title (h3) → description (text-muted) → optional Button
```

#### `confirm-dialog.tsx`
```typescript
interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  confirmLabel?: string;           // default "Confirm"
  variant?: 'default' | 'destructive';
  onConfirm: () => void;
}
// Dialog con Cancel + Confirm buttons
// Destructive variant: red confirm button
```

---

## 4. Data Flow por Vista

### 4.1 Prompt Gallery (`/prompts`)

```
┌─ Server Component (page.tsx) ──────────────────────────────┐
│  Prefetch: queryClient.prefetchQuery(promptTemplates)      │
│                                                             │
│  ┌─ Client: PromptGallery ────────────────────────────────┐│
│  │  usePromptTemplates() → data                           ││
│  │  useState(roleFilter, searchQuery)                     ││
│  │                                                         ││
│  │  ┌─ PromptCard (×N) ─┐  ┌─ PromptCreateDialog ─────┐ ││
│  │  │  template prop     │  │  react-hook-form + Zod    │ ││
│  │  │  onClick → router  │  │  onSubmit → POST /api/    │ ││
│  │  └────────────────────┘  │  → invalidateQueries      │ ││
│  │                           └──────────────────────────┘ ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

### 4.2 Prompt Editor (`/prompts/[templateId]`)

```
┌─ Server Component (page.tsx) ──────────────────────────────────────────────┐
│  Prefetch: versions, variableDefs                                          │
│                                                                             │
│  ┌─ Client: PromptEditorLayout ───────────────────────────────────────────┐│
│  │                                                                         ││
│  │  Zustand: useAssetStudioStore()                                        ││
│  │    ├── activeVersionId                                                  ││
│  │    ├── editorContent / isDirty                                          ││
│  │    ├── compareVersionIds                                                ││
│  │    └── variablePanelOpen                                                ││
│  │                                                                         ││
│  │  ┌─ VersionTimeline ──┐  ┌─ EditorToolbar ──────────────────────────┐ ││
│  │  │  usePromptVersions │  │  Save → useSaveVersion()                 │ ││
│  │  │  onSelect → store  │  │  Promote → usePromoteVersion()           │ ││
│  │  └────────────────────┘  │  Compare → store.openCompare()           │ ││
│  │                           └──────────────────────────────────────────┘ ││
│  │                                                                         ││
│  │  ┌─ PromptEditor ─────────────────────┐  ┌─ VariablePanel ──────────┐ ││
│  │  │  content ← store.editorContent     │  │  detectedVars ←          │ ││
│  │  │  onChange → store.updateEditor()   │  │    extractVariables()    │ ││
│  │  │  readOnly ← version.status!='draft'│  │  definedVars ←           │ ││
│  │  └────────────────────────────────────┘  │    useVariableDefs()     │ ││
│  │                                           │  onInsert → textarea     │ ││
│  │  ┌─ PromptDiffViewer (modal) ────────┐  └──────────────────────────┘ ││
│  │  │  open ← store.compareVersionIds   │                                ││
│  │  │  left/right ← fetched versions    │                                ││
│  │  └───────────────────────────────────┘                                ││
│  └─────────────────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────────────────┘
```

### 4.3 Experiment Dashboard (`/prompts/[templateId]/experiments/[experimentId]`)

```
┌─ Page ──────────────────────────────────────────────────────────┐
│  ┌─ ExperimentDashboard ──────────────────────────────────────┐│
│  │  useExperimentStats(experimentId)                          ││
│  │                                                             ││
│  │  ┌─ Header ─────────────────────────────────────────────┐ ││
│  │  │  name + StatusBadge + date range                     │ ││
│  │  └──────────────────────────────────────────────────────┘ ││
│  │                                                             ││
│  │  ┌─ StatsCard A ─┐  ┌─ StatsCard B ─┐  ┌─ StatsCard C ─┐││
│  │  │  VariantStats  │  │  VariantStats  │  │  VariantStats  │││
│  │  │  WinnerBadge?  │  │  WinnerBadge?  │  │  WinnerBadge?  │││
│  │  └────────────────┘  └────────────────┘  └────────────────┘││
│  │                                                             ││
│  │  ┌─ ConvergenceChart ──────────────────────────────────┐  ││
│  │  │  Recharts LineChart (time vs rate per variant)       │  ││
│  │  └─────────────────────────────────────────────────────┘  ││
│  │                                                             ││
│  │  Actions: [Pause] [Declare Winner] [Cancel]                ││
│  │  → useControlExperiment / useDeclareWinner mutations       ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Extensión del Zustand Store

El store existente es suficiente para el editor básico. Se necesitan dos extensiones mínimas para Fase 3:

```typescript
// Extensiones propuestas a asset-studio-store.ts

interface AssetStudioState {
  // ... existente ...

  // Nuevo — UI state para el editor
  previewMode: boolean;                    // Toggle editor ↔ preview
  editorTab: 'editor' | 'preview';        // Tab activo si se usa tabs en vez de toggle

  // Nuevo — Experiment setup wizard
  experimentSetup: {
    step: number;                          // 0-3 (wizard steps)
    selectedVersionIds: string[];
    trafficSplit: number[];
  } | null;

  // Actions nuevas
  togglePreview: () => void;
  startExperimentSetup: () => void;
  updateExperimentSetup: (partial: Partial<AssetStudioState['experimentSetup']>) => void;
  clearExperimentSetup: () => void;
}
```

**Regla invariante:** El store sigue siendo **solo UI state**. Los datos del experiment (variants, stats) viven en TanStack Query cache.

---

## 6. Unsaved Changes Guard

Componente transversal crítico para UX:

```typescript
// components/asset-studio/unsaved-changes-guard.tsx
// Hook: useBeforeUnload + router interception

// Cuando isDirty === true:
//   - beforeunload event → "You have unsaved changes"
//   - Next.js router navigation → ConfirmDialog
//   - Version timeline click (select different version) → ConfirmDialog
```

---

## 7. Responsive & Layout Breakpoints

| Breakpoint | Prompt Editor Layout | Gallery | Experiment Dashboard |
|---|---|---|---|
| `≥ 1280px` (xl) | 3 paneles: timeline + editor + variables | 3 columnas grid | 3 stats cards |
| `≥ 768px` (md) | 2 paneles: editor + variables (timeline collapsa a dropdown) | 2 columnas grid | 2 stats cards |
| `< 768px` (sm) | 1 panel: editor full (variables en sheet bottom, timeline en dropdown) | 1 columna | 1 stats card stack |

---

## 8. Work Breakdown Structure (WBS)

### Sprint 3.1 — Layout y Galería (2 días)

| # | Tarea | Tipo | Deps | Est. | Archivos |
|---|---|---|---|---|---|
| 3.1.1 | Layout `(asset-studio)/layout.tsx` con TabNavigation (Prompts, Documents, Variables) | Page | — | 2h | `app/(asset-studio)/layout.tsx` |
| 3.1.2 | Redirect page `(asset-studio)/page.tsx` → `/prompts` | Page | 3.1.1 | 15min | `app/(asset-studio)/page.tsx` |
| 3.1.3 | `empty-state.tsx` componente genérico reutilizable | UI | — | 1h | `components/asset-studio/empty-state.tsx` |
| 3.1.4 | `confirm-dialog.tsx` componente genérico reutilizable | UI | — | 1h | `components/asset-studio/confirm-dialog.tsx` |
| 3.1.5 | `version-badge.tsx` — badge de status por VersionStatus | UI | — | 30min | `components/asset-studio/version-badge.tsx` |
| 3.1.6 | `prompt-card.tsx` — card individual de template | UI | 3.1.5 | 1.5h | `components/asset-studio/prompt-card.tsx` |
| 3.1.7 | `prompt-create-dialog.tsx` — dialog de creación de template | UI | — | 2h | `components/asset-studio/prompt-create-dialog.tsx` |
| 3.1.8 | `prompt-gallery.tsx` — grid con filtros y search | UI | 3.1.6, 3.1.7, 3.1.3 | 3h | `components/asset-studio/prompt-gallery.tsx` |
| 3.1.9 | Reescribir `prompts/page.tsx` — Server Component wrapper con prefetch | Page | 3.1.8 | 1h | `app/(asset-studio)/prompts/page.tsx` |
| 3.1.10 | Actualizar `app-sidebar.tsx` — agregar grupo Asset Studio | UI | — | 30min | `components/layout/app-sidebar.tsx` |

**Subtotal:** ~13h

---

### Sprint 3.2 — Editor de Prompts (3 días)

| # | Tarea | Tipo | Deps | Est. | Archivos |
|---|---|---|---|---|---|
| 3.2.1 | `prompt-editor.tsx` — textarea con highlighting overlay de `{{vars}}` | UI | — | 5h | `components/asset-studio/prompt-editor.tsx` |
| 3.2.2 | `variable-tag.tsx` — chip clickeable con status color | UI | — | 1h | `components/asset-studio/variable-tag.tsx` |
| 3.2.3 | `variable-panel.tsx` — panel lateral matched/undefined/unused | UI | 3.2.2 | 3h | `components/asset-studio/variable-panel.tsx` |
| 3.2.4 | `version-timeline.tsx` — timeline vertical con selección | UI | 3.1.5 | 3h | `components/asset-studio/version-timeline.tsx` |
| 3.2.5 | `editor-toolbar.tsx` — barra de acciones Save/Promote/Compare/Test | UI | 3.1.5 | 2h | `components/asset-studio/editor-toolbar.tsx` |
| 3.2.6 | `prompt-preview.tsx` — preview interpolado con inputs por variable | UI | — | 2h | `components/asset-studio/prompt-preview.tsx` |
| 3.2.7 | `prompt-diff-viewer.tsx` — diff modal con jsdiff | UI | — | 4h | `components/asset-studio/prompt-diff-viewer.tsx` |
| 3.2.8 | `prompt-editor-layout.tsx` — composición master con ResizablePanelGroup | UI | 3.2.1–3.2.7 | 3h | `components/asset-studio/prompt-editor-layout.tsx` |
| 3.2.9 | `unsaved-changes-guard.tsx` — hook + dialog para isDirty | UI | — | 1.5h | `components/asset-studio/unsaved-changes-guard.tsx` |
| 3.2.10 | Extender `asset-studio-store.ts` con previewMode, experimentSetup | Store | — | 1h | `stores/asset-studio-store.ts` |
| 3.2.11 | Page `prompts/[templateId]/page.tsx` — composición completa | Page | 3.2.8–3.2.10 | 2h | `app/(asset-studio)/prompts/[templateId]/page.tsx` |

**Subtotal:** ~27.5h

---

### Sprint 3.3 — A/B Experiments UI (2.5 días)

| # | Tarea | Tipo | Deps | Est. | Archivos |
|---|---|---|---|---|---|
| 3.3.1 | `winner-badge.tsx` — badge dinámico por estado | UI | — | 30min | `components/asset-studio/winner-badge.tsx` |
| 3.3.2 | `traffic-split-slider.tsx` — slider con constraint sum=100 | UI | — | 3h | `components/asset-studio/traffic-split-slider.tsx` |
| 3.3.3 | `experiment-setup-dialog.tsx` — wizard 4 pasos | UI | 3.3.2 | 4h | `components/asset-studio/experiment-setup-dialog.tsx` |
| 3.3.4 | `experiment-stats-card.tsx` — card KPI por variante | UI | 3.3.1 | 2h | `components/asset-studio/experiment-stats-card.tsx` |
| 3.3.5 | Instalar recharts: `npm install recharts` | Setup | — | 10min | `package.json` |
| 3.3.6 | `convergence-chart.tsx` — Recharts LineChart | UI | 3.3.5 | 3h | `components/asset-studio/convergence-chart.tsx` |
| 3.3.7 | `experiment-dashboard.tsx` — composición stats + chart + actions | UI | 3.3.4, 3.3.6 | 3h | `components/asset-studio/experiment-dashboard.tsx` |
| 3.3.8 | `experiment-list.tsx` — tabla de experiments del template | UI | 3.3.1 | 2h | `components/asset-studio/experiment-list.tsx` |
| 3.3.9 | Page `experiments/page.tsx` — lista | Page | 3.3.8 | 1h | `app/(asset-studio)/prompts/[templateId]/experiments/page.tsx` |
| 3.3.10 | Page `experiments/[experimentId]/page.tsx` — dashboard | Page | 3.3.7 | 1.5h | `app/(asset-studio)/prompts/[templateId]/experiments/[experimentId]/page.tsx` |

**Subtotal:** ~20h

---

### Sprint 3.4 — Variables CRUD UI (1 día)

| # | Tarea | Tipo | Deps | Est. | Archivos |
|---|---|---|---|---|---|
| 3.4.1 | `variable-form.tsx` — form inline con type-dependent fields | UI | — | 3h | `components/asset-studio/variable-form.tsx` |
| 3.4.2 | Page `variables/page.tsx` — tabla + inline CRUD + create dialog | Page | 3.4.1 | 3h | `app/(asset-studio)/variables/page.tsx` |

**Subtotal:** ~6h

---

### Sprint 3.5 — Documents UI (1.5 días)

| # | Tarea | Tipo | Deps | Est. | Archivos |
|---|---|---|---|---|---|
| 3.5.1 | `upload-dropzone.tsx` — drag-and-drop con progress | UI | — | 4h | `components/asset-studio/upload-dropzone.tsx` |
| 3.5.2 | `document-table.tsx` — tabla con sorting y search | UI | — | 3h | `components/asset-studio/document-table.tsx` |
| 3.5.3 | `chunk-viewer.tsx` — lista de chunks expandibles | UI | — | 3h | `components/asset-studio/chunk-viewer.tsx` |
| 3.5.4 | Page `documents/page.tsx` — tabla + dropzone | Page | 3.5.1, 3.5.2 | 1.5h | `app/(asset-studio)/documents/page.tsx` |
| 3.5.5 | Page `documents/[docId]/page.tsx` — chunk viewer | Page | 3.5.3 | 1h | `app/(asset-studio)/documents/[docId]/page.tsx` |

**Subtotal:** ~12.5h

---

### Sprint 3.6 — Polish y Loading States (1 día)

| # | Tarea | Tipo | Deps | Est. | Archivos |
|---|---|---|---|---|---|
| 3.6.1 | Skeleton loaders para: gallery (3x2 cards), editor (textarea + timeline), table | UI | All | 3h | Inline en cada componente |
| 3.6.2 | Empty states para: gallery, experiments list, documents, variables, chunk viewer | UI | 3.1.3 | 2h | Inline en cada page |
| 3.6.3 | Error boundaries para cada route segment | UI | — | 1.5h | `error.tsx` en cada ruta |
| 3.6.4 | `loading.tsx` para cada ruta con skeletons | UI | 3.6.1 | 1h | `loading.tsx` en cada ruta |
| 3.6.5 | Toast notifications (Sonner) para mutaciones success/error | UI | — | 1h | `lib/toast-utils.ts` + wiring |
| 3.6.6 | Keyboard shortcuts: Cmd+S (save), Cmd+Shift+P (promote), Esc (close modals) | UX | — | 1.5h | Hook `use-editor-shortcuts.ts` |

**Subtotal:** ~10h

---

## 9. Resumen de Esfuerzo

| Sprint | Descripción | Estimación |
|---|---|---|
| 3.1 | Layout y Galería | ~13h |
| 3.2 | Editor de Prompts | ~27.5h |
| 3.3 | A/B Experiments UI | ~20h |
| 3.4 | Variables CRUD UI | ~6h |
| 3.5 | Documents UI | ~12.5h |
| 3.6 | Polish y Loading States | ~10h |
| **Total** | | **~89h** (~11 días dev, ~3 semanas) |

---

## 10. Dependencias Nuevas

```bash
# En crm-agentico-panel/
npm install recharts jsdiff
npm install -D @types/jsdiff

# Shadcn components (verificar cuáles faltan):
npx shadcn@latest add dialog textarea table select slider switch form label
```

---

## 11. Reglas para el Ejecutor

### 11.1 DO

1. **Reutilizar hooks existentes** (`hooks/queries/*`, `hooks/mutations/*`) — ya validan, cachean e invalidan correctamente.
2. **Reutilizar Zod schemas** de `lib/schemas/` para validación client-side con `react-hook-form`.
3. **Usar `extractVariables()` de `lib/prompt-utils.ts`** — no reinventar el regex.
4. **Respetar separación Store ↔ Query** — Zustand es solo para UI transient state.
5. **Usar Server Components** donde sea posible (pages que solo pasan props), `'use client'` solo en componentes interactivos.
6. **Instalar Shadcn componentes** via CLI (`npx shadcn@latest add X`) antes de usarlos.
7. **Prefetch en Server Components** usando `queryClient.prefetchQuery()` para evitar waterfalls.

### 11.2 DON'T

1. **NO crear hooks nuevos de fetch/mutation** — ya existen todos.
2. **NO duplicar tipos** — importar de `types/prompt.ts`, `types/experiment.ts`, `types/variable.ts`.
3. **NO usar Monaco Editor** — decisión D1: textarea + regex highlighting (ligero).
4. **NO poner server data en Zustand** — violación de ADR-113.
5. **NO hacer fetch en useEffect** — usar TanStack Query exclusivamente.
6. **NO ignorar RLS** — los API routes ya manejan auth via Supabase SSR, pero las mutaciones deben validar con Zod antes de enviar.

### 11.3 Orden de Ejecución Recomendado

```
3.1 (Layout/Gallery) → 3.2 (Editor) → 3.4 (Variables) → 3.3 (A/B) → 3.5 (Documents) → 3.6 (Polish)
         ↓                    ↓              ↓                ↓              ↓
     Navegar y ver       Editar prompts  Variables listas  Testear prompts  RAG assets
```

Variables (3.4) se recomienda antes de A/B (3.3) porque el variable-panel del editor ya depende de las variables definidas.

---

## 12. Riesgos Específicos de Fase 3

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Textarea highlighting se desfasa del texto real (overlay drift) | Alto — UX rota | Usar técnica `contentEditable` o `<textarea>` + `<pre>` overlay synced por scroll. Testear en Chrome/Safari/Firefox. |
| Traffic split slider permite estados inválidos | Medio — AB sesgado | Enforce sum=100 en onChange + validación server-side en Zod schema del experiment |
| Recharts bundle size impacta First Load JS | Bajo — performance | Lazy import: `const ConvergenceChart = dynamic(() => import('./convergence-chart'), { ssr: false })` |
| Diff viewer con prompts largos (>5000 chars) congela el render | Medio — UX | Virtualizar hunks con `react-window` si content > 3000 chars. Diff worker offload si es crítico. |
| isDirty false positive al cargar versión (store.editorContent !== version.content) | Medio — UX confusa | Inicializar store.editorContent **desde** version.content al seleccionar versión, y `markClean()` inmediatamente. |

---

*Builder (Arquitecto Staff) — Escuadrón Teseo | AssetStudio_Fase3_WBS v1.0 | 2026-04-20*
