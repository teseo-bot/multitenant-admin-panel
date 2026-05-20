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