# RFC-031: Asset Studio — Canvas Rendering & Playback Controls

| Campo | Valor |
|---|---|
| **Autor** | Builder (Arquitecto Staff) — Escuadrón Teseo |
| **Fecha** | 2026-04-21 |
| **Estado** | Draft |
| **Prerequisitos** | RFC-030 (Canvas Architecture), Sprint 5.1 (scaffold), Sprint 5.2 (state engines) |
| **Componente** | `crm-agentico-panel` → `app/(dashboard)/asset-studio/canvas/[templateId]` |
| **Stack** | Next.js 14 App Router, GSAP 3.15 + @gsap/react 2.1, Zustand 5, TanStack Query 5, Shadcn/UI, Tailwind CSS |

---

## 1. Resumen Ejecutivo

Este RFC define el diseño técnico para transformar el Canvas central y la barra de Playback (Timeline) del Asset Studio de sus actuales **placeholders funcionales** a componentes interactivos de producción. El alcance cubre:

1. **Canvas Viewport** — Renderizado de nodos HyperFrame desde datos de DB, selección/hover interactivo, live-preview de ediciones, y orquestación completa de GSAP Timeline.
2. **Playback Bar (Timeline)** — Controles de reproducción profesionales, scrubbing preciso, marcadores de track, loop, y visualización multi-track.
3. **Layer Panel** — Árbol jerárquico de nodos con visibilidad, reordenamiento drag-and-drop, y lock.
4. **Integración bidireccional** — Sincronización en tiempo real entre PropertiesPanel ↔ Canvas ↔ Timeline ↔ LayerPanel.

### Lo que ya existe (Sprint 5.1 + 5.2)

| Artefacto | Estado | Ubicación |
|---|---|---|
| `use-canvas-store.ts` | ✅ Completo | `hooks/use-canvas-store.ts` |
| `use-template.ts` | ✅ Básico (TanStack Query) | `hooks/use-template.ts` |
| `use-save-canvas.ts` | ✅ Mutation hook | `hooks/use-save-canvas.ts` |
| `CanvasViewport.tsx` | ⚠️ Scaffold con nodos dummy | `_components/CanvasViewport.tsx` |
| `TimelineScrubber.tsx` | ⚠️ Range input básico | `_components/TimelineScrubber.tsx` |
| `PropertiesPanel.tsx` | ⚠️ Campos estáticos | `_components/PropertiesPanel.tsx` |
| `SaveCanvasButton.tsx` | ✅ Funcional | `_components/SaveCanvasButton.tsx` |
| Layer Panel | ❌ Solo placeholder texto | `page.tsx` inline `<aside>` |
| `window.__timelines` | ✅ Registrado | `global.d.ts` + CanvasViewport |
| Route `POST /api/asset-studio/canvas/save` | ⚠️ Stub (guarda changelog) | `api/asset-studio/canvas/save/route.ts` |

### Lo que NO cubre este RFC
- Generación de snapshots reales (servidor headless) → Sprint 5.5
- Persistencia definitiva del canvas layout en DB (columna `canvas_data jsonb`) → Sprint 5.5
- Integración con LangGraph orchestrator → Sprint 6+

---

## 2. Arquitectura de Componentes — Target

```
page.tsx (Server Component — fetch template via RSC)
│
├─ <header> ─── SaveCanvasButton + UndoRedo + ZoomControls
│
├─ <aside left> ── LayerPanel.tsx (NEW)
│   └── LayerTree (drag-and-drop reorder, visibility toggle, lock)
│
├─ <main>
│   ├─ CanvasViewport.tsx (UPGRADE)
│   │   ├── CanvasNode.tsx (NEW — per-node wrapper)
│   │   ├── SelectionOverlay.tsx (NEW — bounding box + handles)
│   │   └── HoverHighlight.tsx (NEW — outline on hover)
│   │
│   └─ PlaybackBar.tsx (RENAME + UPGRADE from TimelineScrubber)
│       ├── TransportControls.tsx (NEW — play/pause/stop/loop)
│       ├── TimelineRuler.tsx (NEW — tick marks + time labels)
│       ├── TrackLanes.tsx (NEW — multi-track visualization)
│       └── Playhead.tsx (NEW — draggable current-time indicator)
│
└─ <aside right> ── PropertiesPanel.tsx (UPGRADE)
    ├── StyleSection (bg, opacity, border, padding, typography)
    ├── AnimationSection (start, duration, ease, from-props)
    ├── TransformSection (scale, rotate, translate)
    └── ContentSection (text, image src, alt)
```

---

## 3. Diseño del Canvas Viewport (Upgrade)

### 3.1 Flujo de Datos: DB → Canvas

```
useTemplate(templateId)
  │  TanStack Query → GET /api/templates/:id
  │  Returns: { id, name, layout: CanvasLayout }
  │
  ▼
CanvasViewport receives layout as prop
  │
  ├── Builds CanvasNode[] from layout.nodes
  │   Each node: { id, type, content, children[], style, animation }
  │
  ├── Renders nodes recursively via <CanvasNode>
  │   - Applies base styles from DB (layout.nodes[n].style)
  │   - Overlays draftAttributes from Zustand (if any edits pending)
  │   - Sets data-start, data-duration, data-track-index attributes
  │
  └── useGSAP builds master Timeline from rendered DOM
      - Registers in window.__timelines[templateId]
      - Starts paused (controlled by PlaybackBar)
```

### 3.2 Tipo `CanvasLayout` (nuevo contrato para `use-template`)

```typescript
// types/canvas.ts

export interface CanvasLayout {
  /** Viewport dimensions for the design */
  width: number;
  height: number;
  /** Background color/gradient of the canvas */
  background: string;
  /** Ordered list of top-level nodes */
  nodes: CanvasNodeDef[];
}

export interface CanvasNodeDef {
  id: string;
  /** Semantic type: text, heading, image, button, container, divider */
  type: 'text' | 'heading' | 'image' | 'button' | 'container' | 'divider';
  /** Display name in LayerPanel */
  label: string;
  /** Text content or image src depending on type */
  content: string;
  /** Nested children (only for type=container) */
  children?: CanvasNodeDef[];
  /** CSS properties (camelCase) */
  style: Record<string, string | number>;
  /** Animation config for GSAP */
  animation: {
    start: number;      // seconds
    duration: number;   // seconds
    trackIndex: number; // which track lane
    ease: string;       // GSAP ease string e.g. "power3.out"
    from: Record<string, string | number>; // GSAP .from() props
  };
  /** UI meta */
  visible: boolean;
  locked: boolean;
}
```

### 3.3 Componente `CanvasNode` (nuevo)

Responsabilidades:
- Renderizar un nodo individual según su `type`.
- Escuchar `onClick` → `selectNode(id)` y `onMouseEnter/Leave` → `setHoveredNode(id | null)`.
- Aplicar merge de estilos: `baseStyle` (DB) + `draftAttributes[id].inlineStyles` (Zustand).
- Renderizar children recursivamente para nodos `container`.
- Añadir `data-node-id`, `data-start`, `data-duration`, `data-track-index` para GSAP.

```
Props:
  node: CanvasNodeDef
  depth: number (para indentación en capas)

State derivado de Zustand:
  isSelected = selectedNodeId === node.id
  isHovered = hoveredNodeId === node.id
  draft = draftAttributes[node.id]

Renderizado condicional por type:
  heading  → <h1>–<h6> según style.fontSize
  text     → <p>
  image    → <img> con lazy loading
  button   → <button> con variant styling
  container → <div> con children map
  divider  → <hr>
```

### 3.4 Selection & Hover Overlays

| Componente | Trigger | Visual |
|---|---|---|
| `HoverHighlight` | `hoveredNodeId !== null && hoveredNodeId !== selectedNodeId` | Outline `2px dashed hsl(var(--primary)/0.5)` sobre el nodo |
| `SelectionOverlay` | `selectedNodeId !== null` | Outline `2px solid hsl(var(--primary))` + 4 corner handles (futuro resize) |

Ambos se posicionan con `position: absolute` **dentro** del CanvasViewport (no violando la regla de layout absoluto global del RFC-030 — estos son overlays sobre un container relativo).

Implementación: `useEffect` que observa `selectedNodeId`/`hoveredNodeId` y calcula `getBoundingClientRect()` del nodo target relativo al container.

### 3.5 Zoom & Pan

| Feature | Implementación |
|---|---|
| Zoom In/Out | CSS `transform: scale(zoomLevel)` en el canvas container interno |
| Zoom to Fit | Calcula ratio `containerSize / canvasSize` y aplica |
| Pan | `overflow: auto` en el wrapper externo cuando zoom > fit |
| Controles UI | Botones `+` / `−` / `Fit` en el header + `Cmd+Scroll` |

Nuevo state en `useCanvasStore`:
```typescript
zoomLevel: number;       // default 1.0
setZoomLevel: (level: number) => void;
zoomIn: () => void;      // clamp max 3.0
zoomOut: () => void;     // clamp min 0.25
zoomToFit: () => void;   // needs container ref
```

---

## 4. Diseño del PlaybackBar (Upgrade de TimelineScrubber)

### 4.1 Problemas del TimelineScrubber actual

1. **Range input nativo** — No permite visualización multi-track ni marcadores.
2. **Polling de 500ms** para detectar el timeline — Race condition en mount.
3. **No hay stop/reset** — Solo play/pause.
4. **No hay loop** — El timeline termina y queda en el último frame.
5. **No hay indicadores visuales** de dónde empiezan/terminan las animaciones de cada nodo.

### 4.2 Arquitectura del PlaybackBar

```
PlaybackBar.tsx (container)
├── TransportControls.tsx
│   ├── ⏮ Skip to Start
│   ├── ▶/⏸ Play/Pause  
│   ├── ⏹ Stop (reset to 0)
│   ├── 🔁 Loop toggle
│   └── Speed selector (0.5x, 1x, 2x)
│
├── TimelineRuler.tsx
│   ├── Tick marks cada 0.5s (minor) y 1s (major)
│   ├── Time labels (0.0, 1.0, 2.0...)
│   └── Total duration label
│
├── TrackLanes.tsx
│   ├── Lane per trackIndex (agrupación visual)
│   │   └── TrackSegment per node
│   │       ├── Color-coded por node type
│   │       ├── Width = (duration / totalDuration) * 100%
│   │       ├── Left offset = (start / totalDuration) * 100%
│   │       ├── Label = node.label (truncated)
│   │       └── Click → selectNode(id)
│   └── Scrollable si > 3 tracks
│
└── Playhead.tsx
    ├── Vertical line at currentTime position
    ├── Draggable (onDrag → seek + tl.time())
    └── Follows RAF during playback
```

### 4.3 Sincronización GSAP ↔ Store (Mejora)

El problema actual: el RAF loop en TimelineScrubber llama `seek()` en cada frame, lo cual genera muchas re-renders de Zustand.

**Solución: Dual-layer sync**

```
GSAP Timeline (source of truth during playback)
    │
    ├── RAF loop → updates a ref (no re-render)
    │   └── playheadRef.current = tl.time()
    │
    ├── Every 100ms (throttled) → seek(tl.time())
    │   └── This updates Zustand for PropertiesPanel/TrackLanes
    │
    └── On pause/stop/scrub → immediate seek(time)
        └── Full sync to Zustand
```

Esto reduce los re-renders de ~60fps a ~10 updates/sec durante playback, mientras el Playhead se mueve suavemente vía ref.

### 4.4 State additions en `useCanvasStore`

```typescript
// Nuevas propiedades
isLooping: boolean;
playbackSpeed: number;       // 0.5 | 1 | 2
totalDuration: number;       // calculado del timeline

// Nuevas acciones
stop: () => void;            // pause + seek(0)
toggleLoop: () => void;
setPlaybackSpeed: (speed: number) => void;
setTotalDuration: (duration: number) => void;
```

---

## 5. Diseño del Layer Panel (Nuevo)

### 5.1 Estructura

```
LayerPanel.tsx
├── LayerHeader (título + collapse all/expand all)
└── LayerTree.tsx
    └── LayerItem.tsx (recursive)
        ├── Expand/Collapse toggle (si tiene children)
        ├── Type icon (T for text, 🖼 for image, etc.)
        ├── Label (editable on double-click)
        ├── 👁 Visibility toggle → node.visible
        ├── 🔒 Lock toggle → node.locked
        └── Drag handle (dnd-kit)
```

### 5.2 Drag-and-Drop

Utilizamos `@dnd-kit/core` + `@dnd-kit/sortable` (ya disponible en el proyecto via Shadcn).

- Reorder dentro del mismo nivel → cambia `z-index` / orden en `CanvasLayout.nodes[]`
- Mover a otro container → reparent en el tree
- Resultado se persiste en `draftAttributes` o en un nuevo `draftLayout` en el store.

### 5.3 State additions en `useCanvasStore`

```typescript
// Nuevo: draft del tree ordering (independiente de draftAttributes per-node)
draftNodeOrder: string[] | null;  // null = use DB order
reorderNodes: (fromIndex: number, toIndex: number) => void;
```

### 5.4 Visibilidad y Lock

| Estado | Efecto en Canvas | Efecto en Properties |
|---|---|---|
| `visible: false` | `opacity: 0.15` + no GSAP animation | Panel muestra "(hidden)" |
| `locked: true` | No seleccionable via click | Panel muestra readonly fields |
| `visible: false` + `locked: true` | No renderizado (display: none) | No seleccionable en LayerPanel |

---

## 6. Upgrade del Properties Panel

### 6.1 Secciones expandibles

El panel actual tiene campos planos. Se reorganiza en secciones colapsables:

```
PropertiesPanel.tsx
├── NodeInfo (id, type, label — readonly)
├── ContentSection (text content, image src, alt text)
├── StyleSection
│   ├── Layout (display, flexDirection, gap, padding, margin)
│   ├── Typography (fontFamily, fontSize, fontWeight, color, lineHeight, textAlign)
│   ├── Background (backgroundColor, backgroundImage, gradient)
│   ├── Border (borderWidth, borderColor, borderRadius, borderStyle)
│   └── Effects (opacity, boxShadow, filter)
├── TransformSection (translateX/Y, scaleX/Y, rotate)
├── AnimationSection
│   ├── Start Time (linked to TrackSegment position)
│   ├── Duration
│   ├── Ease (dropdown: power1–4 .in/.out/.inOut, elastic, bounce, back, linear)
│   ├── From Properties (the GSAP .from() initial state)
│   │   └── Quick presets: fade-in, slide-up, slide-left, scale-up, blur-in
│   └── Preview Animation (plays just this node's tween in isolation)
└── DangerZone (delete node — with confirmation)
```

### 6.2 Live Preview Flow

```
User edits property in PropertiesPanel
  │
  ├── updateDraftAttributes(nodeId, { inlineStyles: {...} })
  │   └── Zustand store updates
  │
  ├── CanvasNode re-renders with merged styles
  │   └── User sees change immediately on canvas
  │
  └── No DB write yet (deferred to SaveCanvasButton)
```

### 6.3 Extensión de `NodeAttributes` en `use-canvas-store`

```typescript
export interface NodeAttributes {
  cssClasses: string[];
  inlineStyles: Record<string, string>;
  animationProps: {
    dataStart: number;
    dataDuration: number;
    dataTrackIndex: number;
    ease: string;                          // NEW
    fromProps: Record<string, string | number>; // NEW
  };
  transform: {                              // NEW
    translateX: number;
    translateY: number;
    scaleX: number;
    scaleY: number;
    rotate: number;
  };
  content: string | null;                   // NEW — text/src override
  visible: boolean;                         // NEW
  locked: boolean;                          // NEW
}
```

---

## 7. Integración end-to-end: Señales entre componentes

```
┌─────────────┐      selectNode(id)       ┌──────────────┐
│  LayerPanel  │─────────────────────────→ │CanvasViewport│
│              │← ─ ─ ─ selectedNodeId ─ → │              │
└──────┬───────┘                           └──────┬───────┘
       │                                          │
       │  selectNode(id)                          │ selectNode(id)
       │  setHoveredNode(id)                      │ setHoveredNode(id)
       ▼                                          ▼
┌─────────────────────────── Zustand ──────────────────────────┐
│  useCanvasStore                                               │
│  selectedNodeId | hoveredNodeId | draftAttributes | isPlaying │
│  currentTime | zoomLevel | isLooping | playbackSpeed          │
└──────┬────────────────────────────────────────────┬──────────┘
       │                                            │
       │ read selectedNodeId + draftAttributes      │ read currentTime + isPlaying
       ▼                                            ▼
┌──────────────┐                            ┌─────────────┐
│PropertiesPanel│                           │ PlaybackBar  │
│              │──── updateDraftAttributes →│             │
│              │                            │── seek/play/pause →
└──────────────┘                            └─────────────┘
                                                    │
                                                    │ tl.time(t) / tl.play() / tl.pause()
                                                    ▼
                                            ┌─────────────┐
                                            │GSAP Timeline │
                                            │(master)      │
                                            └─────────────┘
```

---

## 8. Reglas de Renderizado (Consolidación RFC-030)

| # | Regla | Enforcement |
|---|---|---|
| R1 | **Layout Before Animation** — El Hero Frame (estado final) se maqueta con Flexbox/Grid ANTES de que GSAP toque nada | CanvasNode aplica estilos base; GSAP solo anima `.from()` |
| R2 | **No position:absolute global** — Solo para overlays (selection, hover) dentro del canvas container | Lint rule + code review |
| R3 | **GSAP cleanup** — Todo timeline registrado en `window.__timelines` se mata en cleanup del `useGSAP` | Ya implementado, mantener |
| R4 | **Single master timeline** — Un solo `gsap.timeline()` por canvas, todos los tweens como children | CanvasViewport es el único que crea el timeline |
| R5 | **Store como proxy, GSAP como truth** durante playback | RAF actualiza playhead ref; throttled sync a Zustand |
| R6 | **Draft merge** — Canvas renderiza `merge(dbStyle, draftStyle)` nunca solo draft | CanvasNode implementa merge explícito |

---

## 9. Work Breakdown Structure (WBS)

### Sprint 5.3: Canvas DOM Interactivo + Motor GSAP Real

**Objetivo:** Reemplazar nodos dummy con renderizado desde DB y hacer el canvas clickeable/hoverable.

| # | Tarea | Tipo | Dep. | Est. | Criterio de Aceptación |
|---|---|---|---|---|---|
| 5.3.1 | Definir `types/canvas.ts` — `CanvasLayout`, `CanvasNodeDef` | Types | — | 1h | Types compilando, exportados |
| 5.3.2 | Actualizar `use-template.ts` — fetch retorna `CanvasLayout` tipado, fallback a layout mock si DB vacía | Hook | 5.3.1 | 2h | Query retorna data tipada; loading/error states |
| 5.3.3 | Crear `CanvasNode.tsx` — renderizado recursivo por type, merge de estilos DB + draft, data-attributes para GSAP | Component | 5.3.1 | 4h | Renderiza heading, text, image, button, container, divider; children recursivos |
| 5.3.4 | Upgrade `CanvasViewport.tsx` — consumir `CanvasLayout` del query, renderizar `CanvasNode` tree en vez de nodos dummy | Component | 5.3.2, 5.3.3 | 3h | Viewport muestra nodes de DB; fallback a mock si no hay data |
| 5.3.5 | Implementar click → `selectNode` y hover → `setHoveredNode` en `CanvasNode` | Interaction | 5.3.3 | 1.5h | Click selecciona, hover resalta; solo si `!locked` |
| 5.3.6 | Crear `SelectionOverlay.tsx` + `HoverHighlight.tsx` — bounding box visual | Component | 5.3.5 | 3h | Outline visible en nodo seleccionado/hovered; se reposiciona en scroll/resize |
| 5.3.7 | Rebuild GSAP processor en CanvasViewport — leer `animation` de `CanvasNodeDef`, construir master timeline con `.from()` por nodo | GSAP | 5.3.4 | 3h | Timeline se construye correctamente; play reproduce las animaciones |
| 5.3.8 | Implementar Zoom/Pan — `zoomLevel` en store, transform CSS, botones UI, Cmd+Scroll | Feature | 5.3.4 | 3h | Zoom 0.25x–3.0x, zoom-to-fit funciona, pan con overflow |
| 5.3.9 | Añadir `zoomLevel`, `zoomIn`, `zoomOut`, `zoomToFit` a `useCanvasStore` | Store | — | 0.5h | Acciones en store, clamp correcto |

**Estimación Sprint 5.3: ~21h (~3 días dev)**

---

### Sprint 5.4A: PlaybackBar Profesional

**Objetivo:** Reemplazar el range input con un timeline visual multi-track con transport controls.

| # | Tarea | Tipo | Dep. | Est. | Criterio de Aceptación |
|---|---|---|---|---|---|
| 5.4A.1 | Crear `TransportControls.tsx` — play/pause/stop/loop/speed | Component | — | 2h | Botones funcionales, speed selector dropdown |
| 5.4A.2 | Crear `TimelineRuler.tsx` — ticks cada 0.5s/1s, labels de tiempo, responsive al ancho | Component | — | 3h | Ruler se escala con el container; ticks y labels legibles |
| 5.4A.3 | Crear `Playhead.tsx` — línea vertical draggable, sigue RAF durante play | Component | — | 2.5h | Playhead se mueve suavemente; drag funciona; snap a posición al soltar |
| 5.4A.4 | Crear `TrackLanes.tsx` + `TrackSegment.tsx` — visualización de segmentos por nodo/track | Component | 5.3.1 | 4h | Segmentos posicionados correctamente; color por type; click selecciona nodo |
| 5.4A.5 | Crear `PlaybackBar.tsx` — composer que integra TransportControls + Ruler + TrackLanes + Playhead | Component | 5.4A.1–4 | 2h | Layout correcto; todos los sub-componentes sincronizados |
| 5.4A.6 | Implementar dual-layer sync (RAF ref + throttled Zustand) | Logic | 5.4A.3 | 2h | Playhead suave a 60fps; PropertiesPanel actualiza a ~10/sec; no jank |
| 5.4A.7 | Añadir `isLooping`, `playbackSpeed`, `totalDuration`, `stop`, `toggleLoop`, `setPlaybackSpeed`, `setTotalDuration` a `useCanvasStore` | Store | — | 1h | Store compilando; acciones correctas |
| 5.4A.8 | Reemplazar `TimelineScrubber` import en `page.tsx` por `PlaybackBar` | Wiring | 5.4A.5 | 0.5h | Page usa el nuevo componente; sin regresiones |
| 5.4A.9 | Eliminar polling de 500ms para detección de timeline; usar callback ref pattern | Fix | 5.4A.6 | 1h | No más setInterval; timeline se detecta en mount |

**Estimación Sprint 5.4A: ~18h (~2.5 días dev)**

---

### Sprint 5.4B: Layer Panel + Properties Panel Upgrade

**Objetivo:** Panel de capas funcional con drag-and-drop y Properties Panel con secciones completas.

| # | Tarea | Tipo | Dep. | Est. | Criterio de Aceptación |
|---|---|---|---|---|---|
| 5.4B.1 | Crear `LayerItem.tsx` — fila con icono de tipo, label editable, visibility toggle, lock toggle, drag handle | Component | 5.3.1 | 3h | Toggles funcionales; label editable on double-click |
| 5.4B.2 | Crear `LayerTree.tsx` — recursive render de LayerItems, expand/collapse para containers | Component | 5.4B.1 | 2h | Árbol renderiza correctamente; expand/collapse funciona |
| 5.4B.3 | Crear `LayerPanel.tsx` — header + LayerTree, click → `selectNode` | Component | 5.4B.2 | 1.5h | Selección sincroniza con Canvas; hovered en LayerPanel resalta en Canvas |
| 5.4B.4 | Implementar drag-and-drop reorder con `@dnd-kit/sortable` | Feature | 5.4B.2 | 3h | Reorder funciona; resultado se persiste en draftNodeOrder |
| 5.4B.5 | Añadir `draftNodeOrder`, `reorderNodes` a `useCanvasStore` | Store | — | 0.5h | Store compila; reorder actualiza el array |
| 5.4B.6 | Upgrade `PropertiesPanel.tsx` — reorganizar en secciones colapsables (Content, Style, Transform, Animation, DangerZone) | Component | — | 4h | Todas las secciones renderan; collapse/expand funcional |
| 5.4B.7 | Implementar ease dropdown con presets visuales en AnimationSection | Component | 5.4B.6 | 2h | Dropdown muestra ease curves; selección actualiza GSAP |
| 5.4B.8 | Implementar animation presets (fade-in, slide-up, slide-left, scale-up, blur-in) | Feature | 5.4B.7 | 2h | Presets aplican fromProps correctos; preview visible en canvas |
| 5.4B.9 | Extender `NodeAttributes` con `transform`, `content`, `visible`, `locked`, `ease`, `fromProps` | Store | — | 1h | Types compilando; backwards compatible |
| 5.4B.10 | Reemplazar `<aside>` placeholder en page.tsx por `<LayerPanel>` | Wiring | 5.4B.3 | 0.5h | Panel integrado en layout |
| 5.4B.11 | Implementar visibility/lock effect en CanvasNode — hidden nodes `opacity: 0.15`, locked nodes no-click | Logic | 5.4B.1, 5.3.3 | 1.5h | Nodos hidden aparecen tenues; locked no seleccionables |

**Estimación Sprint 5.4B: ~21h (~3 días dev)**

---

### Sprint 5.4C: Integración y Polish

**Objetivo:** Asegurar que Canvas, PlaybackBar, LayerPanel y PropertiesPanel funcionan como sistema integrado.

| # | Tarea | Tipo | Dep. | Est. | Criterio de Aceptación |
|---|---|---|---|---|---|
| 5.4C.1 | Undo/Redo stack — implementar con array de snapshots del draftAttributes en store | Feature | All 5.4B | 4h | Cmd+Z undo; Cmd+Shift+Z redo; max 50 entries |
| 5.4C.2 | Keyboard shortcuts — Space (play/pause), Delete (delete node), Cmd+A (select all), Escape (deselect) | Feature | All 5.4A | 2h | Shortcuts funcionales; no conflicto con inputs |
| 5.4C.3 | GSAP Timeline rebuild on layout change — cuando draftAttributes cambian `start`/`duration`/`ease`, rebuild el timeline sin flash | Logic | 5.3.7, 5.4A | 3h | Cambiar start time en PropertiesPanel re-posiciona el tween; smooth transition |
| 5.4C.4 | Responsive layout — PlaybackBar collapsa a mini-mode en viewports < 1024px | CSS | 5.4A.5 | 2h | TrackLanes se ocultan; solo ruler + transport en mobile |
| 5.4C.5 | Loading states — skeleton para Canvas mientras template carga; empty state si no hay nodes | UX | 5.3.4 | 1.5h | Skeleton visible durante fetch; empty state con CTA "Add first element" |
| 5.4C.6 | Error boundaries — wrap CanvasViewport en ErrorBoundary; si GSAP falla, no crashea la página | Reliability | 5.3.7 | 1h | Error boundary muestra fallback UI; reporta error |
| 5.4C.7 | Accessibility — aria-labels en transport controls, keyboard nav en LayerPanel, focus management | A11y | All | 2h | Tab navigation funcional; screen reader labels presentes |
| 5.4C.8 | Integration smoke test — E2E: load template → play → scrub → select node → edit property → save | Test | All | 3h | Test pasa en CI; cubre happy path completo |

**Estimación Sprint 5.4C: ~18.5h (~2.5 días dev)**

---

## 10. Resumen de Estimaciones

| Sprint | Nombre | Estimación | Acumulado |
|---|---|---|---|
| 5.3 | Canvas DOM Interactivo + Motor GSAP | 21h (~3d) | 3d |
| 5.4A | PlaybackBar Profesional | 18h (~2.5d) | 5.5d |
| 5.4B | Layer Panel + Properties Upgrade | 21h (~3d) | 8.5d |
| 5.4C | Integración y Polish | 18.5h (~2.5d) | 11d |
| **Total** | | **78.5h** | **~11 días dev** |

**Nota:** Los sprints 5.4A y 5.4B pueden ejecutarse en **paralelo** si hay 2 ejecutores disponibles, reduciendo el timeline a ~8 días.

---

## 11. Dependencias de Paquetes

```bash
# Ya instalado:
# gsap ^3.15.0, @gsap/react ^2.1.2, zustand, @tanstack/react-query, @dnd-kit/core, @dnd-kit/sortable

# No se requieren dependencias nuevas para este RFC.
# Si se desea throttle preciso para dual-layer sync:
# Alternativa: usamos requestAnimationFrame nativo + Date.now() check (zero-dep)
```

---

## 12. Riesgos y Mitigaciones

| # | Riesgo | Impacto | Prob. | Mitigación |
|---|---|---|---|---|
| R1 | **GSAP timeline rebuild flicker** — rebuild del timeline durante edición causa flash visual | Alto | Media | Usar `tl.clear()` + re-add tweens en vez de kill+recreate; mantener `paused: true` durante rebuild |
| R2 | **Performance con muchos nodos (>50)** — re-renders excesivos en Canvas | Medio | Baja | `React.memo` en CanvasNode; selector granular de Zustand por nodeId; virtualización si >100 nodos |
| R3 | **Drag-and-drop en tree profundo** — dnd-kit puede tener issues con nested sortable contexts | Medio | Media | Usar `@dnd-kit/sortable` con `SortableContext` por nivel; fallback a flat list con indent visual si bloquea |
| R4 | **Playhead jitter** — RAF + throttled Zustand puede causar visual desync | Bajo | Baja | Playhead se mueve puramente con `ref.current` + CSS transform; Zustand solo para datos no-visuales |
| R5 | **Template sin layout data en DB** — `use-template` retorna null layout | Medio | Alta (en dev) | Fallback a mock layout robusto con 3-5 nodos demo; mostrar banner "Using sample layout" |
| R6 | **Zustand store crecimiento** — muchas propiedades nuevas en un solo store | Bajo | Media | Si supera 20 acciones, slice pattern: `createCanvasSlice`, `createPlaybackSlice`, `createLayerSlice` |

---

## 13. Decisiones de Diseño

| # | Decisión | Alternativas Consideradas | Elección | Justificación |
|---|---|---|---|---|
| D1 | Playhead rendering | Canvas 2D / SVG / CSS div | **CSS div** con `transform: translateX()` | Más simple, performante para una línea vertical, no necesitamos Canvas 2D |
| D2 | Track segments rendering | `<canvas>` bitmap / SVG / HTML divs | **HTML divs** con Tailwind | Permite click handlers nativos, tooltips, y styling trivial; <50 segmentos no justifica canvas |
| D3 | Undo/Redo approach | Command pattern / Snapshot array / Immer patches | **Snapshot array** de draftAttributes | Simple, predictable, suficiente para <50 undo levels; Immer añade dep innecesaria |
| D4 | Style merge strategy | Deep merge / Shallow merge / CSS variables | **Shallow merge** DB + draft | Predictable; draft siempre gana para keys presentes; no hay herencia compleja |
| D5 | Overlays positioning | Absolute within canvas / Portal / SVG overlay | **Absolute within canvas container** | Container es `position: relative`; overlays no rompen flow del layout principal |

---

## 14. Criterios de Éxito (Definition of Done)

- [ ] Canvas renderiza nodos desde datos de `useTemplate` (TanStack Query)
- [ ] Click en nodo → selección visible (bounding box) + Properties Panel muestra datos
- [ ] Hover en nodo → highlight outline
- [ ] PlaybackBar muestra tracks por nodo con segmentos posicionados correctamente
- [ ] Play/Pause/Stop/Loop/Speed controles funcionales
- [ ] Scrubbing del playhead sincroniza GSAP timeline + Canvas visual
- [ ] LayerPanel muestra árbol de nodos con visibility/lock toggles
- [ ] Drag-and-drop reorder en LayerPanel actualiza orden visual en Canvas
- [ ] Editar propiedad en PropertiesPanel → cambio visible inmediato en Canvas
- [ ] Cambiar `start`/`duration` en PropertiesPanel → GSAP timeline se reconstruye sin flash
- [ ] Undo/Redo funciona para todas las ediciones de draft
- [ ] Zoom/Pan funcional con controles UI y shortcuts
- [ ] Loading skeletons y empty states presentes
- [ ] Zero errores de consola en flujo normal
- [ ] Smoke test E2E pasa

---

*Builder (Arquitecto Staff) — Escuadrón Teseo | RFC-031-Asset-Studio-Canvas v1.0 | 2026-04-21*
# Reporte de Impacto y Análisis de Contexto — Sprint 5.3: Canvas DOM y Motor GSAP

Este documento define el análisis técnico para la implementación del Sprint 5.3 detallado en el **RFC-031**. Analiza las directrices para el motor GSAP, la estructura de componentes React, y la gestión de estado con Zustand/TanStack Query.

## 1. Visión General del Impacto
El objetivo principal del Sprint 5.3 es transformar el placeholder actual del `CanvasViewport` en un motor de renderizado anidado (árbol de componentes) basado en un esquema definido (`CanvasLayout`), habilitando interacciones en el canvas y conectando las propiedades de animación reales al motor GSAP.

---

## 2. Archivos a Crear y Modificar (Impacto Estructural)

### A. Nuevos Archivos a Crear
1. **`crm-agentico-panel/types/canvas.ts`**
   - **Objetivo:** Definir contratos estrictos `CanvasLayout` y `CanvasNodeDef`.
   - **Detalle:** Definir tipos (text, heading, image, button, container, divider), el esquema de `style` (Record<string, string | number>), y configuración GSAP (`animation: { start, duration, trackIndex, ease, from }`).

2. **`crm-agentico-panel/app/(dashboard)/asset-studio/canvas/[templateId]/_components/CanvasNode.tsx`**
   - **Objetivo:** Componente que dibuja de forma recursiva un nodo del DOM basado en el esquema.
   - **Funciones clave:**
     - Hacer merge de los estilos base (DB) con `draftAttributes[id].inlineStyles` desde Zustand.
     - Emitir handlers `onClick` (`selectNode`) y `onMouseEnter`/`Leave` (`setHoveredNode`).
     - Renderizar hijos recursivamente si `type === 'container'`.
     - Inyectar selectores para GSAP: `data-start`, `data-duration`, `data-track-index`.

3. **`crm-agentico-panel/app/(dashboard)/asset-studio/canvas/[templateId]/_components/SelectionOverlay.tsx`** y **`HoverHighlight.tsx`**
   - **Objetivo:** UI visual para indicar el estado del store (boundingBox del nodo sin afectar el DOM flow).
   - **Restricción:** Ubicación interna en el Canvas viewport usando `position: absolute` basándose en el cálculo del `getBoundingClientRect()` relativo al container padre.

### B. Archivos a Modificar
1. **`crm-agentico-panel/hooks/use-template.ts`**
   - Actualizar para retornar la promesa tipada a `CanvasLayout` (en vez de `any`).
   - Añadir manejo de un fallback robusto en caso de base de datos vacía.

2. **`crm-agentico-panel/hooks/use-canvas-store.ts`**
   - Incorporar el estado de Zoom y Paneo exigido por el RFC-031: `zoomLevel`, y funciones `setZoomLevel`, `zoomIn`, `zoomOut`, `zoomToFit`.

3. **`crm-agentico-panel/app/(dashboard)/asset-studio/canvas/[templateId]/_components/CanvasViewport.tsx`**
   - **Refactor Profundo:** Consumir el layout real del TanStack Query, reemplazar `displayNodes` dummy por el mapeo de la raíz hacia `<CanvasNode />`.
   - **Rebuild del Timeline GSAP:** Leer las propiedades `animation.from` desde los metadatos de los nodos y configurar los tweens de `.from()`.
   - **Añadir el engine de Zoom:** Aplicar el wrapper para `transform: scale(zoomLevel)` e interacciones de paneo.

---

## 3. Reglas Inquebrantables de GSAP y React (Flickering Prevention)
La investigación sobre el sistema base revela vulnerabilidades críticas de rendimiento (flickering, layouts rotos, repintado en loop). Para evitar fallos en el motor `GSAP 3.15` con `@gsap/react`, el Ejecutor **deberá seguir estas reglas estrictas**:

### Regla 1: Prevención del Conflicto de "Transform" (GSAP vs CSS)
- **Razón:** GSAP anima propiedades de transformación individualmente (e.g., `x`, `y`, `scale`). Si un elemento tiene un estilo en CSS usando `transform` nativo (ej. `transform: translate(-50%, -50%)`), GSAP **sobrescribirá y destruirá** esa regla.
- **Ley inquebrantable:** ESTÁ ESTRICTAMENTE PROHIBIDO utilizar atributos `transform` CSS para diagramar layouts o realizar centrados. Todo centrado debe usar Flexbox (`display: flex; justify-content: center; align-items: center;`) u otras propiedades de grid/box model.

### Regla 2: "Layout Before Animation" y Uso exclusivo de `gsap.from()`
- **Razón:** El DOM renderizado por CSS y React debe representar la visualización en su estado **"Completamente Visible/Estado Final"** (Frame Hero).
- **Ley inquebrantable:** GSAP solo interviene para mutar la "llegada" de la animación. Únicamente se usará `tl.from(...)` para configurar la animación de entrada. Nunca utilizar animaciones de salida (`gsap.to( {opacity: 0} )`) a menos que el RFC explícitamente apruebe una transición terminal de escena.

### Regla 3: Reconstrucción del Timeline sin *Flicker*
- **Razón:** Al editar propiedades en tiempo real (ej. cambiando `start` o `duration`), el hook `useGSAP` se vuelve a disparar. Si se mata la línea de tiempo e inicializa de nuevo incorrectamente, el DOM experimenta FOUC (Flash of Unstyled Content).
- **Ley inquebrantable:**
  1. El timeline maestro debe instanciarse con `paused: true`.
  2. En el ciclo de actualización / limpieza, preferir el uso de `tl.clear()` + re-agregar tweens manteniendo la posición del playhead, y no forzar una regeneración que corrompa la visibilidad nativa temporalmente.
  3. `tl.play(0)` arbitrario en los `useEffect` de `CanvasViewport` debe desaparecer. La responsabilidad del *playback* recae en un futuro `PlaybackBar`, el Canvas es reactivo a la instrucción de estado.

### Regla 4: Prioridad de Mergeo en `CanvasNode`
- **Razón:** El lienzo (Canvas) nunca muestra únicamente el borrador (`draft`).
- **Ley inquebrantable:** Dentro de `<CanvasNode />`, las propiedades estables del esquema (`node.style`) deben hacer un shallow/deep merge continuo con `draftAttributes[node.id].inlineStyles` proveniente de Zustand. El `draft` siempre prevalecerá sobre el layout base para permitir *Live Preview*.