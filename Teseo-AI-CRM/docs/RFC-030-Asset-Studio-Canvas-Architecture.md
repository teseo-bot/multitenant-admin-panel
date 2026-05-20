# RFC-030: Asset Studio Canvas Architecture (Fase 5)

## 1. Resumen Ejecutivo
Este documento define la arquitectura para la Fase 5 del Asset Studio dentro del Tenant OS. El objetivo es proporcionar un entorno de edición visual (Canvas) y la infraestructura de validación mediante Snapshots, siguiendo el estándar declarativo de HyperFrames. La arquitectura segrega de manera estricta el estado del servidor (TanStack Query) del estado transitorio de la interfaz de usuario (Zustand), utilizando GSAP como único motor de animación.

## 2. Arquitectura de Rutas (Next.js App Router)
Se extenderá el Route Group `(asset-studio)` para alojar el entorno de edición visual sin interferir con las rutas existentes de gestión y A/B testing.

```text
app/(dashboard)/(asset-studio)/
├── canvas/
│   ├── [templateId]/
│   │   ├── page.tsx                 # Entrada principal del editor Canvas
│   │   ├── layout.tsx               # Layout principal (Sidebar, Área de Trabajo, Paneles)
│   │   ├── _components/
│   │   │   ├── CanvasViewport.tsx   # Contenedor de HyperFrames y orquestador GSAP
│   │   │   ├── PropertiesPanel.tsx  # Editor de atributos visuales (conectado a Zustand)
│   │   │   ├── TimelineScrubber.tsx # Control de tiempo (sincronizado con GSAP)
│   │   │   └── LayerManager.tsx     # Gestión de jerarquía (DOM / Z-Index)
```

## 3. Arquitectura de Estado: Interfaz Zustand (`canvas-store.ts`)
Conforme a la regla de hierro, este Store **solo** manejará el estado transitorio (UI y Reproductor). Los datos persistentes del Canvas provienen exclusivamente de TanStack Query.

```typescript
import { create } from 'zustand';

interface NodeAttributes {
  cssClasses: string[];
  inlineStyles: Record<string, string>;
  animationProps: {
    dataStart: number;
    dataDuration: number;
    dataTrackIndex: number;
  };
}

interface CanvasEditorState {
  // --- Player State ---
  currentTime: number;
  isPlaying: boolean;
  
  // --- Editor State ---
  selectedNodeId: string | null;
  hoveredNodeId: string | null;
  
  // --- Transient Drafts (Mutaciones pre-guardado) ---
  // Mantiene los cambios visuales aplicados por el usuario antes de ser enviados por TanStack Mutation
  draftAttributes: Record<string, NodeAttributes>;

  // --- Actions ---
  play: () => void;
  pause: () => void;
  seek: (time: number) => void;
  selectNode: (nodeId: string | null) => void;
  setHoveredNode: (nodeId: string | null) => void;
  
  // Actualización parcial de atributos de un nodo específico
  updateDraftAttributes: (nodeId: string, attributes: Partial<NodeAttributes>) => void;
  
  // Limpieza al cambiar de vista o después de guardar exitosamente
  clearDrafts: () => void;
}

export const useCanvasStore = create<CanvasEditorState>((set) => ({
  currentTime: 0,
  isPlaying: false,
  selectedNodeId: null,
  hoveredNodeId: null,
  draftAttributes: {},

  play: () => set({ isPlaying: true }),
  pause: () => set({ isPlaying: false }),
  seek: (time) => set({ currentTime: time }),
  selectNode: (nodeId) => set({ selectedNodeId: nodeId }),
  setHoveredNode: (nodeId) => set({ hoveredNodeId: nodeId }),
  
  updateDraftAttributes: (nodeId, attributes) => set((state) => ({
    draftAttributes: {
      ...state.draftAttributes,
      [nodeId]: {
        ...(state.draftAttributes[nodeId] || {}),
        ...attributes,
      }
    }
  })),
  
  clearDrafts: () => set({ draftAttributes: {} })
}));
```

## 4. Reglas de Renderizado y Ciclo de Vida (HyperFrames & GSAP)
1. **Layout Before Animation**: El componente `CanvasViewport` debe maquetar el *Hero Frame* (estado final) utilizando estrictamente `Flexbox` o `CSS Grid`.
2. **Prohibición de Layout Absoluto Global**: No se utilizará `position: absolute` en el flujo principal del layout para prevenir colapsos.
3. **Orquestación de GSAP**: 
   - Las transiciones animarán *hacia* (to) o *desde* (from) el Hero Frame.
   - Todo Timeline GSAP inicializado dentro del Canvas se registrará en `window.__timelines["<canvas-id>"]` para permitir el barrido temporal del `TimelineScrubber`.

## 5. Work Breakdown Structure (WBS) - Granular Sprints

### Sprint 5.1: Scaffold y Enrutamiento Base
- **Objetivo**: Inicializar la estructura de directorios y proteger la ruta del editor.
- **Tareas**:
  - Crear la estructura en `app/(dashboard)/(asset-studio)/canvas/[templateId]`.
  - Crear los *placeholders* visuales (Layout, Sidebar, Viewport vacío).
  - Asegurar la validación RLS y el chequeo de Tenant ID en el Server Component previo al paso de datos al cliente.

### Sprint 5.2: Estado UI (Zustand) y Server State (TanStack)
- **Objetivo**: Conectar el esqueleto con los datos base sin violar la segregación de estado.
- **Tareas**:
  - Implementar `canvas-store.ts` (Zustand) para control de Playback y Selección.
  - Construir Custom Hooks (`useTemplateQuery`, `useTemplateMutation`) de TanStack Query para fetchear el HTML/CSS base desde Supabase (`prompt_versions`).
  - Integrar la población inicial del Canvas a partir del query (Server Data), manteniendo el editor en blanco de manera determinista hasta que los datos resuelvan.

### Sprint 5.3: Motor GSAP e Integración HyperFrames (Canvas DOM)
- **Objetivo**: Dar vida al Canvas procesando reglas de HyperFrames.
- **Tareas**:
  - Crear el procesador de atributos (`data-start`, `data-duration`).
  - Configurar el contexto de GSAP con limpieza en `useEffect`.
  - Registrar las animaciones de los nodos montados en `window.__timelines`.

### Sprint 5.4: Interfaz de Edición (Properties y Timeline)
- **Objetivo**: Interacción bidireccional en el Panel Lateral.
- **Tareas**:
  - Enlazar el `PropertiesPanel` al store de Zustand (`draftAttributes`).
  - Sincronizar el componente `TimelineScrubber` con el tiempo maestro de GSAP.
  - Habilitar el *Preview* en tiempo real mutando propiedades CSS locales en memoria antes de guardar.

### Sprint 5.5: Persistencia, Snapshots y BFF
- **Objetivo**: Cierre del ciclo, guardado y validación visual.
- **Tareas**:
  - Consolidar `draftAttributes` en un Payload JSON/HTML.
  - Implementar Route Handler `POST /api/asset-studio/canvas/save` para persistir la versión en la DB.
  - Implementar mecanismo de Snapshot (generación de imagen/preview) como evento derivado del guardado, subiendo el asset a Supabase Storage.
