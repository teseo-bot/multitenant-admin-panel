# RFC-025: Command Center — UI Shell Layout & Panel Hardening

| Campo | Valor |
|---|---|
| **ID** | RFC-025 |
| **Estado** | Draft |
| **Autor** | Builder (Arquitecto Staff, Equipo Teseo) |
| **Fecha** | 2026-04-21 |
| **Sprint** | 1.5 — UI Shell (Layout Principal e Interfaz Base) |
| **Depende de** | RFC-022 (Command Center UI), ADR-112 (SSE + D&D Kanban), ADR-117 (Realtime DB) |
| **Proyecto** | `crm-agentico-panel` |

---

## 1. Objetivo

Consolidar y endurecer el layout principal del `/command-center`, convirtiendo la implementación actual (funcional pero frágil) en un **UI Shell de producción** con:

1. Persistencia de tamaño de paneles entre sesiones.
2. Comportamiento responsivo con colapso automático en pantallas pequeñas.
3. Error Boundaries aislados por panel (fallo del Kanban no mata al Inbox y viceversa).
4. Estado compartido limpio vía Zustand con slices separados.
5. Atajos de teclado para operaciones frecuentes.

---

## 2. Estado Actual (Auditoría)

### 2.1 Lo Que Existe

| Componente | Archivo | Estado |
|---|---|---|
| `CommandCenterLayout` | `components/command-center/command-center-layout.tsx` | ✅ Funcional — usa `react-resizable-panels` con 60/40 |
| `ResizablePanelGroup` wrapper (shadcn) | `components/ui/resizable.tsx` | ✅ Correcto — wrapper sobre `react-resizable-panels` v4.10 |
| `KanbanBoard` | `components/kanban/kanban-board.tsx` | ✅ Funcional — `@dnd-kit`, columnas alineadas a DB enum |
| `InboxPanel` | `components/command-center/inbox-panel.tsx` | ✅ Funcional — Header + MessageList + Composer |
| `InboxHeader` | `components/command-center/inbox-header.tsx` | ✅ Funcional — muestra lead name, badge source, ICP score |
| `InboxMessageList` | `components/command-center/inbox-message-list.tsx` | ✅ Funcional — burbujas con auto-scroll |
| `InboxComposer` | `components/command-center/inbox-composer.tsx` | ✅ Funcional |
| `useCommandCenterStore` | `stores/command-center-store.ts` | ⚠️ Mínimo — solo `selectedLeadId` |
| Paquete `react-resizable-panels` | `package.json` | ✅ v4.10.0 instalado |

### 2.2 Brechas Identificadas

| # | Brecha | Severidad | Descripción |
|---|---|---|---|
| G1 | Sin persistencia de tamaño de paneles | 🟡 Media | El usuario pierde su configuración de ancho en cada recarga |
| G2 | Sin comportamiento responsivo/mobile | 🟡 Media | En pantallas <768px ambos paneles se comprimen hasta la ilegibilidad |
| G3 | Sin Error Boundaries | 🔴 Alta | Un crash en `KanbanBoard` (ej: DnD error) derrumba todo el Command Center |
| G4 | Store minimal sin slices | 🟡 Media | El store crecerá con filtros, vista mobile, etc. Necesita estructura anticipada |
| G5 | Sin atajos de teclado | 🟢 Baja | UX power-user: toggle panels, navegar entre leads |
| G6 | Sin header unificado del Command Center | 🟡 Media | No hay barra superior con título, breadcrumbs, o controles globales |

---

## 3. Decisiones de Diseño

### 3.1 Persistencia de Paneles vía `autoSaveId`

**Decisión:** Usar la prop nativa `autoSaveId` de `react-resizable-panels` que persiste automáticamente en `localStorage`.

```tsx
<ResizablePanelGroup
  orientation="horizontal"
  autoSaveId="command-center-panels"
  className="h-full w-full"
>
```

**Razón:** `react-resizable-panels` v2+ tiene soporte nativo de persistencia via `autoSaveId`. No se requiere plumbing manual con Zustand ni `useEffect` — la librería maneja serialización y restauración internamente usando `localStorage`. Zero código custom = zero bugs de sincronización.

**Formato en localStorage:** `react-resizable-panels:command-center-panels` → JSON con porcentajes de cada panel.

---

### 3.2 Responsive: Colapso a Tabs en Mobile

**Decisión:** En pantallas `< 768px`, reemplazar el `ResizablePanelGroup` por un layout de **tabs** (`Kanban` | `Inbox`) usando el componente `Tabs` de shadcn.

```
Desktop (≥ 768px)              Mobile (< 768px)
┌──────────────┬─────────┐    ┌─────────────────────┐
│              │         │    │ [Kanban] [Inbox]     │  ← Tab bar
│   Kanban     │  Inbox  │    ├─────────────────────┤
│   (60%)      │  (40%)  │    │                     │
│              │         │    │  Contenido activo    │
│              │         │    │  (full-width)        │
└──────────────┴─────────┘    └─────────────────────┘
```

**Implementación:** Un hook `useIsMobile()` (media query `max-width: 767px`) controla el render condicional. El hook ya es estándar en proyectos shadcn; si no existe, se crea en `hooks/use-mobile.ts`.

**Razón:** Los paneles redimensionables no tienen sentido en mobile. Un tab switch es un patrón nativo de iOS/Android que el usuario ya conoce. El tab activo se guarda en `command-center-store` para que persista dentro de la sesión.

---

### 3.3 Error Boundaries por Panel

**Decisión:** Envolver cada panel (Kanban e Inbox) en un `ErrorBoundary` dedicado con UI de fallback específica por contexto.

```
CommandCenterLayout
├── ResizablePanelGroup
│   ├── ResizablePanel (60%)
│   │   └── <KanbanErrorBoundary>
│   │       └── <KanbanBoard />
│   │
│   ├── ResizableHandle
│   │
│   └── ResizablePanel (40%)
│       └── <InboxErrorBoundary>
│           └── <InboxPanel />
```

**Implementación:** Un componente genérico `PanelErrorBoundary` (class component, React exige class para error boundaries) con props:
- `panelName: string` — para logging.
- `fallback?: ReactNode` — override de la UI de error.
- `onReset?: () => void` — callback al reintentar (ej: invalidar queries).

**UI de fallback por defecto:**
```
┌─────────────────────────┐
│   ⚠️ Error en [Panel]    │
│                         │
│   Algo salió mal al     │
│   cargar este panel.    │
│                         │
│   [Reintentar]          │
└─────────────────────────┘
```

El botón "Reintentar" llama `resetErrorBoundary()` (React 19: usando `onReset` + key toggle pattern).

---

### 3.4 Extensión del Store (Zustand Slices)

**Decisión:** Expandir `command-center-store.ts` con slices lógicos usando el patrón de composición de Zustand.

```typescript
interface CommandCenterState {
  // --- Lead Selection Slice ---
  selectedLeadId: string | null;
  setSelectedLeadId: (id: string | null) => void;

  // --- Mobile View Slice ---
  activeTab: 'kanban' | 'inbox';
  setActiveTab: (tab: 'kanban' | 'inbox') => void;

  // --- Panel Collapse Slice ---
  isInboxCollapsed: boolean;
  toggleInboxCollapse: () => void;
}
```

**Razón:** No justifica aún archivos separados por slice (over-engineering). Un solo store con secciones comentadas es suficiente hasta que supere las ~15 propiedades. El `autoSaveId` maneja la persistencia de tamaño; el store solo maneja estado efímero de sesión.

---

### 3.5 Header del Command Center

**Decisión:** Añadir un header ligero (`CommandCenterHeader`) encima del `ResizablePanelGroup`.

```
┌─────────────────────────────────────────┐
│ 🎯 Command Center          [⌨️] [⚙️]   │  ← Header (h-12, sticky)
├──────────────────┬──────────────────────┤
│                  │                      │
│    Kanban        │     Inbox            │
│                  │                      │
└──────────────────┴──────────────────────┘
```

Contenido:
- Título "Command Center" con ícono.
- Badge con count de leads en `New` (derivado de `useLeads`).
- Botón de atajos de teclado (popover con referencia rápida).
- Futuro: filtros globales, búsqueda.

---

### 3.6 Atajos de Teclado (Fase Posterior)

**Decisión:** Registrar atajos vía `useEffect` + `keydown` listener en `CommandCenterLayout`. No instalar librería nueva.

| Atajo | Acción |
|---|---|
| `[` | Colapsar/expandir panel Inbox |
| `Esc` | Deseleccionar lead (limpiar inbox) |
| `↑` / `↓` | Navegar entre leads dentro de columna activa (Fase 2) |

**Nota:** Esta es la brecha G5 (prioridad baja). Se documenta aquí para que el Night Coder la implemente después del core layout. No bloquea Sprint 1.5.

---

## 4. Árbol de Componentes Final

```
app/(dashboard)/command-center/page.tsx          (Server Component — metadata)
└── CommandCenterLayout                          (Client Component — orquesta)
    ├── CommandCenterHeader                      (Client — título, badges, controles)
    │
    ├── [Desktop ≥ 768px] ResizablePanelGroup (autoSaveId="command-center-panels")
    │   ├── ResizablePanel (defaultSize=60, minSize=35)
    │   │   └── PanelErrorBoundary panelName="Kanban"
    │   │       └── KanbanBoard                  (existente, sin cambios)
    │   │
    │   ├── ResizableHandle withHandle
    │   │
    │   └── ResizablePanel (defaultSize=40, minSize=25)
    │       └── PanelErrorBoundary panelName="Inbox"
    │           └── InboxPanel                   (existente, sin cambios)
    │
    └── [Mobile < 768px] Tabs
        ├── TabsTrigger "Kanban"
        │   └── PanelErrorBoundary panelName="Kanban"
        │       └── KanbanBoard
        └── TabsTrigger "Inbox"
            └── PanelErrorBoundary panelName="Inbox"
                └── InboxPanel
```

---

## 5. Archivos a Crear/Modificar

| Acción | Archivo | Descripción |
|---|---|---|
| **Crear** | `components/command-center/command-center-header.tsx` | Header del Command Center |
| **Crear** | `components/command-center/panel-error-boundary.tsx` | Error boundary reutilizable por panel |
| **Crear** | `hooks/use-mobile.ts` | Hook `useIsMobile()` basado en media query (si no existe) |
| **Modificar** | `components/command-center/command-center-layout.tsx` | Integrar autoSaveId, responsive tabs, error boundaries, header |
| **Modificar** | `stores/command-center-store.ts` | Añadir `activeTab` y `isInboxCollapsed` |
| **Sin cambios** | `components/kanban/kanban-board.tsx` | Aislado — no se toca |
| **Sin cambios** | `components/command-center/inbox-panel.tsx` | Aislado — no se toca |
| **Sin cambios** | `components/command-center/inbox-*.tsx` | Todos los sub-componentes de Inbox intactos |

---

## 6. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|---|---|---|
| `autoSaveId` conflicto con SSR (hydration mismatch) | Media | `react-resizable-panels` maneja esto internamente con `useLayoutEffect`. Verificar con `suppressHydrationWarning` solo si hay warning en consola. |
| `useIsMobile()` flash en carga inicial | Baja | Renderizar layout desktop por default en SSR; el hook corrige en client-side. Flash es imperceptible (<16ms). |
| Error boundary no captura errores async (fetch) | N/A | Los errores de fetch se manejan por TanStack Query (`isError`). El ErrorBoundary captura errores de render/DnD. Son complementarios. |
| Tabs mobile pierden scroll position del Kanban al cambiar | Baja | Aceptable en v1. Si es problema, renderizar ambos y ocultar con `display: none` en vez de desmontarlos. |

---

## 7. Fuera de Alcance (Sprint 1.5)

- Filtros globales en el header (Sprint 2+).
- Drag & drop cross-panel (arrastrar lead del Kanban al Inbox) — no hay caso de uso.
- Notificaciones/toasts en el header.
- Persistencia server-side de preferencias de layout (localStorage es suficiente para single-device).

---

# WBS — Sprint 1.5: UI Shell

## Resumen de Ejecución

**Estimación total:** 6 tareas secuenciales.
**Dependencias externas:** Ninguna (todo es frontend, librerías ya instaladas).
**Branch:** `feat/sprint-1.5-ui-shell`

---

### Tarea 1: Hook `useIsMobile`

**Archivo:** `hooks/use-mobile.ts`

**Especificación:**
```typescript
// hooks/use-mobile.ts
import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;

export function useIsMobile(): boolean {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`);
    const onChange = () => setIsMobile(mql.matches);
    onChange(); // set initial
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
}
```

**Criterio de aceptación:**
- [ ] Retorna `true` cuando viewport < 768px.
- [ ] No causa hydration mismatch (initial state es `false` = desktop, que coincide con SSR).
- [ ] Cleanup del listener en unmount.

---

### Tarea 2: `PanelErrorBoundary`

**Archivo:** `components/command-center/panel-error-boundary.tsx`

**Especificación:**
```typescript
// Class component (React exige class para error boundaries)
interface Props {
  panelName: string;
  children: React.ReactNode;
  onReset?: () => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
}
```

**Comportamiento:**
- `componentDidCatch`: Log a consola con `panelName` y stack trace.
- UI de fallback: ícono ⚠️, mensaje contextual "Error en {panelName}", botón "Reintentar" que llama `setState({ hasError: false })` + `onReset()`.
- Usa clases de Tailwind consistentes con el design system (`bg-destructive/10`, `text-destructive`).

**Criterio de aceptación:**
- [ ] Un `throw new Error()` dentro de `KanbanBoard` muestra el fallback SIN crashear `InboxPanel`.
- [ ] El botón "Reintentar" limpia el error y re-monta el children.

---

### Tarea 3: `CommandCenterHeader`

**Archivo:** `components/command-center/command-center-header.tsx`

**Especificación:**
- Altura fija: `h-12` con `border-b`.
- Contenido izquierdo: Ícono `Target` (lucide) + texto "Command Center" (`text-lg font-semibold`).
- Contenido derecho: Badge con count de leads en status `New` (derivado de `useLeads().data`).
- `"use client"` — necesita acceso a hook `useLeads`.

**Criterio de aceptación:**
- [ ] Se renderiza encima del panel group.
- [ ] Badge muestra número correcto de leads "New".
- [ ] Responsive: texto se mantiene legible en mobile.

---

### Tarea 4: Expandir `command-center-store`

**Archivo:** `stores/command-center-store.ts`

**Especificación — estado final del store:**
```typescript
import { create } from 'zustand';

interface CommandCenterState {
  // Lead selection
  selectedLeadId: string | null;
  setSelectedLeadId: (id: string | null) => void;

  // Mobile view
  activeTab: 'kanban' | 'inbox';
  setActiveTab: (tab: 'kanban' | 'inbox') => void;

  // Panel collapse
  isInboxCollapsed: boolean;
  toggleInboxCollapse: () => void;
}

export const useCommandCenterStore = create<CommandCenterState>((set) => ({
  selectedLeadId: null,
  setSelectedLeadId: (id) => set({ selectedLeadId: id }),

  activeTab: 'kanban',
  setActiveTab: (tab) => set({ activeTab: tab }),

  isInboxCollapsed: false,
  toggleInboxCollapse: () => set((s) => ({ isInboxCollapsed: !s.isInboxCollapsed })),
}));
```

**Criterio de aceptación:**
- [ ] Tests de store: `setActiveTab('inbox')` → `getState().activeTab === 'inbox'`.
- [ ] No breaking changes — `selectedLeadId` sigue funcionando igual.

---

### Tarea 5: Refactor `CommandCenterLayout` (Core)

**Archivo:** `components/command-center/command-center-layout.tsx`

**Esta es la tarea principal.** Integra las tareas 1-4.

**Especificación del componente final:**
```tsx
"use client";

import React from 'react';
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle
} from '@/components/ui/resizable';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { KanbanBoard } from '@/components/kanban/kanban-board';
import { InboxPanel } from './inbox-panel';
import { CommandCenterHeader } from './command-center-header';
import { PanelErrorBoundary } from './panel-error-boundary';
import { useIsMobile } from '@/hooks/use-mobile';
import { useCommandCenterStore } from '@/stores/command-center-store';

export function CommandCenterLayout() {
  const isMobile = useIsMobile();
  const { activeTab, setActiveTab } = useCommandCenterStore();

  return (
    <div className="h-full w-full flex flex-col">
      <CommandCenterHeader />

      {!isMobile ? (
        <ResizablePanelGroup
          orientation="horizontal"
          autoSaveId="command-center-panels"
          className="flex-1"
        >
          <ResizablePanel defaultSize={60} minSize={35}>
            <PanelErrorBoundary panelName="Kanban">
              <KanbanBoard />
            </PanelErrorBoundary>
          </ResizablePanel>
          <ResizableHandle withHandle />
          <ResizablePanel defaultSize={40} minSize={25}>
            <PanelErrorBoundary panelName="Inbox">
              <InboxPanel />
            </PanelErrorBoundary>
          </ResizablePanel>
        </ResizablePanelGroup>
      ) : (
        <Tabs
          value={activeTab}
          onValueChange={(v) => setActiveTab(v as 'kanban' | 'inbox')}
          className="flex-1 flex flex-col"
        >
          <TabsList className="w-full justify-start px-4 shrink-0">
            <TabsTrigger value="kanban">Kanban</TabsTrigger>
            <TabsTrigger value="inbox">Inbox</TabsTrigger>
          </TabsList>
          <TabsContent value="kanban" className="flex-1 overflow-hidden mt-0">
            <PanelErrorBoundary panelName="Kanban">
              <KanbanBoard />
            </PanelErrorBoundary>
          </TabsContent>
          <TabsContent value="inbox" className="flex-1 overflow-hidden mt-0">
            <PanelErrorBoundary panelName="Inbox">
              <InboxPanel />
            </PanelErrorBoundary>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
```

**Cambios clave vs. versión actual:**
1. `autoSaveId="command-center-panels"` — persistencia gratis.
2. `minSize` ajustados: 35 (Kanban) y 25 (Inbox) — previene colapso a ilegibilidad.
3. Responsive: `useIsMobile()` switchea a `Tabs`.
4. Error boundaries envuelven cada panel.
5. `CommandCenterHeader` montado arriba.

**Criterio de aceptación:**
- [ ] Desktop: Paneles redimensionables, tamaño persiste tras F5.
- [ ] Mobile (< 768px): Se muestran tabs, switch funciona.
- [ ] Crash simulado en Kanban no afecta Inbox.
- [ ] Header visible con badge de leads "New".

---

### Tarea 6: Verificar componente `Tabs` de shadcn

**Pre-requisito de Tarea 5.**

**Acción:** Verificar si `components/ui/tabs.tsx` existe. Si no:
```bash
npx shadcn@latest add tabs
```

**Criterio de aceptación:**
- [ ] `import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'` resuelve sin error.

---

## Orden de Ejecución para el Night Coder

```
┌─────────────────────────────────────────────┐
│           Secuencia de Ejecución            │
├─────────────────────────────────────────────┤
│                                             │
│  1. git checkout -b feat/sprint-1.5-ui-shell│
│                                             │
│  2. Tarea 6 → Verificar/instalar Tabs      │
│     (pre-requisito, 1 min)                  │
│                                             │
│  3. Tarea 1 → hooks/use-mobile.ts           │
│     (independiente, 5 min)                  │
│                                             │
│  4. Tarea 2 → panel-error-boundary.tsx      │
│     (independiente, 10 min)                 │
│                                             │
│  5. Tarea 3 → command-center-header.tsx     │
│     (independiente, 10 min)                 │
│                                             │
│  6. Tarea 4 → Expandir store               │
│     (independiente, 5 min)                  │
│                                             │
│  7. Tarea 5 → Refactor layout (integra 1-6)│
│     (dependiente de todo, 15 min)           │
│                                             │
│  8. Smoke test manual:                      │
│     - npm run dev                           │
│     - Verificar desktop resize + persist    │
│     - Verificar mobile tabs                 │
│     - Simular error en kanban (throw)       │
│                                             │
│  9. git add . && git commit                 │
│     "feat(command-center): UI Shell with    │
│      resizable panels, error boundaries,    │
│      responsive tabs, and header"           │
│                                             │
└─────────────────────────────────────────────┘
```

**Tareas paralelas (sin dependencia):** 1, 2, 3, 4 pueden ejecutarse en cualquier orden.
**Tarea bloqueante:** Tarea 5 depende de todas las anteriores.

---

## 8. Siguiente Paso Post-Sprint 1.5

Una vez que el Night Coder complete la ejecución y el Tester valide:

**→ Documentar resultado en ADR-120 y avanzar a Sprint 1.6: Keyboard Shortcuts + Filtros Globales en Header.**

La decisión de alcance de Sprint 1.6 se toma en función del reporte del Tester sobre Sprint 1.5.
