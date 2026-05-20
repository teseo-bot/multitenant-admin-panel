# Contexto de Implementación: Fase 2 - Asset Studio (Teseo AI CRM)

Este documento contiene el contexto destilado y las rutas exactas para que el Ejecutor implemente la Fase 2 del Asset Studio (Capa de Acceso a Datos y Manejo de Estado), sin alucinaciones, respetando el RFC-015 y las convenciones establecidas en nuestra Knowledge Base.

## 1. Rutas Exactas de Implementación

### API Route Handlers (BFF Thin-Layer)
Directorio base: `/crm-agentico-panel/app/api/`

**Prompts & Versiones:**
- `app/api/prompts/route.ts` (GET: list templates, POST: create template)
- `app/api/prompts/[templateId]/route.ts` (GET: template detail, PATCH: update)
- `app/api/prompts/[templateId]/versions/route.ts` (GET: list versions, POST: create version)
- `app/api/prompts/[templateId]/versions/[versionId]/route.ts` (GET: detail)
- `app/api/prompts/[templateId]/versions/[versionId]/promote/route.ts` (POST: promote to active)

**A/B Experiments:**
- `app/api/prompts/[templateId]/experiments/route.ts` (GET: list, POST: create)
- `app/api/prompts/[templateId]/experiments/[experimentId]/route.ts` (GET: detail + stats)
- `app/api/prompts/[templateId]/experiments/[experimentId]/start/route.ts` (POST)
- `app/api/prompts/[templateId]/experiments/[experimentId]/pause/route.ts` (POST)
- `app/api/prompts/[templateId]/experiments/[experimentId]/end/route.ts` (POST: end & declare winner)
- `app/api/prompts/[templateId]/experiments/[experimentId]/cancel/route.ts` (POST)

**Variables y Documentos:**
- `app/api/variables/route.ts` (GET, POST)
- `app/api/variables/[variableId]/route.ts` (GET, PATCH, DELETE)
- `app/api/documents/route.ts` (GET)
- `app/api/documents/upload/route.ts` (POST)
- `app/api/documents/[docId]/route.ts` (GET, DELETE)
- `app/api/documents/[docId]/chunks/route.ts` (GET)

### TanStack Query Hooks (Server State)
Directorio base: `/crm-agentico-panel/hooks/`

**Extensión de llaves de cache:**
- `/crm-agentico-panel/lib/query-keys.ts` (Se debe actualizar añadiendo sub-objetos `prompts`, `experiments`, `variables`, `documents`).

**Queries (`/crm-agentico-panel/hooks/queries/`):**
- `use-prompt-templates.ts`
- `use-prompt-versions.ts`
- `use-prompt-version-detail.ts`
- `use-experiments.ts`
- `use-experiment-stats.ts`
- `use-variable-defs.ts`
- `use-documents.ts`
- `use-document-chunks.ts`

**Mutations (`/crm-agentico-panel/hooks/mutations/`):**
- `use-save-version.ts`
- `use-promote-version.ts`
- `use-archive-version.ts`
- `use-create-experiment.ts`
- `use-control-experiment.ts`
- `use-declare-winner.ts`
- `use-save-variable.ts`
- `use-upload-document.ts`

### Zustand Store (UI State)
- Archivo a crear: `/crm-agentico-panel/stores/asset-studio-store.ts`

---

## 2. Restricciones y Convenciones Extraídas

1. **Separación Estricta entre Server State y UI State:**
   - **TanStack Query (v5):** Es el único dueño del servidor. Debe encargarse de toda la persistencia, data fetching, mutations y caching.
   - **Zustand (v5):** Se encarga *exclusivamente* del estado UI (selecciones activas, texto del editor modificado pero no guardado `isDirty`, estado de modales y paneles laterales).
   - **Regla Inquebrantable:** *Zero Zustand stores with server data*. Ningún store de Zustand debe importar funciones API ni tener llamadas como `api.save()`. Todas las llamadas a las API Routes de Next.js deben ocurrir dentro de Hooks de React Query (`useMutation`).

2. **Backend-for-Frontend (BFF) y Validación:**
   - Los API Route Handlers de Next.js (`app/api/`) funcionan como proxies delgados. No contienen lógica pesada, solo adaptan datos entre el frontend y Supabase (Database).
   - Todos los inputs en mutaciones (ej. POST / PATCH) deben ser validados estáticamente usando **`zod`** antes de insertar en Supabase, y preferiblemente con un schema compartido en `lib/schemas/prompt.ts`.

3. **Arquitectura UI (Single Responsibility Principle):**
   - El editor debe construirse en componentes separados y granulares: el `prompt-editor` es puramente para escribir texto y aplicar highlighting básico a las variables (`{{var}}`). El `variable-panel` se actualiza de manera reactiva derivando su estado desde las variables detectadas en el texto usando un utility de regex centralizado (`lib/prompt-utils.ts`).

---

## 3. Estructura Base Recomendada para `asset-studio-store.ts`

```typescript
// /crm-agentico-panel/stores/asset-studio-store.ts
import { create } from 'zustand';

interface AssetStudioState {
  // Editor State
  activeTemplateId: string | null;
  activeVersionId: string | null;
  editorContent: string;                // Dirty state del textarea (Local)
  isDirty: boolean;
  compareVersionIds: [string, string] | null; // Tupla para el diff viewer

  // UI Panels
  variablePanelOpen: boolean;

  // Actions
  setActiveTemplate: (id: string) => void;
  setActiveVersion: (id: string) => void;
  updateEditorContent: (content: string) => void;
  markClean: () => void;
  openCompare: (v1: string, v2: string) => void;
  closeCompare: () => void;
  toggleVariablePanel: () => void;
  reset: () => void;
}

export const useAssetStudioStore = create<AssetStudioState>((set) => ({
  activeTemplateId: null,
  activeVersionId: null,
  editorContent: '',
  isDirty: false,
  compareVersionIds: null,
  variablePanelOpen: true,

  setActiveTemplate: (id) => set({ activeTemplateId: id }),
  setActiveVersion: (id) => set({ activeVersionId: id }),
  updateEditorContent: (content) => set({ editorContent: content, isDirty: true }),
  markClean: () => set({ isDirty: false }),
  openCompare: (v1, v2) => set({ compareVersionIds: [v1, v2] }),
  closeCompare: () => set({ compareVersionIds: null }),
  toggleVariablePanel: () => set((state) => ({ variablePanelOpen: !state.variablePanelOpen })),
  reset: () => set({
    activeTemplateId: null,
    activeVersionId: null,
    editorContent: '',
    isDirty: false,
    compareVersionIds: null,
    variablePanelOpen: true,
  }),
}));
```
