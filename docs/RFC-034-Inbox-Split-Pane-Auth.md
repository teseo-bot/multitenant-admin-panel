# RFC-034 — Inbox UI Split-Pane y Auth Injection

| Campo | Valor |
|-------|-------|
| **Autor** | Builder (Arquitecto) |
| **Fecha** | 2026-04-21 |
| **Estado** | Draft |
| **Prioridad** | Alta — Deuda técnica UI/UX por orden del CEO |
| **Dependencias** | `react-resizable-panels ^4.10.0` (ya instalado), Supabase Auth SSR, Zustand stores |

---

## 1  Contexto y Motivación

El **Inbox** del Command Center tiene actualmente dos capas superpuestas que conviven sin estar integradas:

| Capa | Archivos | Estado |
|------|----------|--------|
| **Legacy (parallel routes)** | `app/(dashboard)/command-center/inbox/layout.tsx` + `@detail/` slots | Placeholder — `@detail/[id]/page.tsx` muestra HTML estático sin datos reales |
| **Nueva (InboxWorkspace)** | `components/inbox/inbox-workspace.tsx` → `InboxList` + `InboxThreadView` | Funcional con datos vivos vía TanStack Query + SSE |

La página `inbox/page.tsx` ya resolvió la inyección de auth **a nivel de Server Component**, pasando `operatorId` al `InboxClientProvider` → `auth-store` Zustand. Sin embargo, el layout de parallel routes (`layout.tsx`) sigue montado como wrapper externo con su propio `ResizablePanelGroup`, creando un **doble split-pane anidado** que nunca se usa realmente.

**Objetivo**: Eliminar la capa legacy, consolidar el split-pane en `InboxWorkspace`, y documentar el patrón de auth injection para que sea replicable en otros módulos.

---

## 2  Análisis del Estado Actual

### 2.1  Auth Injection — Ya Resuelto ✅

El `// TODO: inject from auth context` que existía en `inbox-thread-view.tsx` **ya fue resuelto**. La cadena actual es:

```
inbox/page.tsx (Server Component)
  └─ supabase.auth.getUser() → operatorId = user.id
     └─ <InboxClientProvider operatorId={operatorId}>
          └─ useAuthStore.setState({ operatorId })  // hidratación síncrona
             └─ <InboxWorkspace>
                  └─ <InboxThreadView>
                       └─ HandoffBar → useAuthStore(s => s.operatorId)  ✅
```

**Evaluación**: Este patrón es correcto y seguro para SSR/CSR:
- El `operatorId` se extrae server-side via cookies (Supabase SSR).
- Se inyecta al store Zustand de forma síncrona antes del primer render del árbol client.
- `useRef(initialized)` previene re-hidrataciones.

**Riesgo identificado**: Si `InboxClientProvider` se monta en un contexto donde `operatorId` cambia (logout/login sin full navigation), el `useRef` bloquea la actualización. Recomendación: usar `useEffect` con cleanup, o aceptar el trade-off (full page refresh en logout ya lo cubre).

### 2.2  Layout Split-Pane — Tiene Deuda ⚠️

**Problema**: Existen dos `ResizablePanelGroup` compitiendo:

1. **`inbox/layout.tsx`** (parallel routes) — RSC layout con slots `{children}` + `{detail}`.
2. **`inbox-workspace.tsx`** (client) — Contiene el split real `InboxList | InboxThreadView`.

El layout.tsx monta el panel group y luego dentro, `page.tsx` → `InboxWorkspace` monta **otro** panel group. El resultado es un split-pane dentro de un split-pane que visualmente funciona porque el panel exterior ocupa el 100% con el slot `{detail}` nunca mostrando el componente real de thread view.

**Los archivos `@detail/` son dead code**: `@detail/[id]/page.tsx` tiene HTML placeholder estático que nunca se usa porque `InboxThreadView` maneja la selección via Zustand store, no via URL params.

### 2.3  DUMMY_CONVERSATIONS

Grep confirma: **no existe** ninguna constante `DUMMY_CONVERSATIONS` en el codebase actual. Los componentes `InboxList` e `InboxThreadView` ya consumen datos reales vía `useThreadList()` y `useMessages()` respectivamente. Esta deuda ya fue pagada en iteraciones anteriores.

---

## 3  Diseño Arquitectónico

### 3.1  Eliminación de Parallel Routes (Simplificación)

El pattern de Next.js parallel routes (`@detail/`) se justifica cuando la URL debe reflejar el estado de selección (`/inbox/abc-123`). En nuestro caso, la selección es client-side via Zustand (`selectedThreadId`), por lo que los parallel routes son overhead innecesario.

**Decisión**: Eliminar la capa de parallel routes y dejar `InboxWorkspace` como único orquestador del layout.

#### Estructura objetivo:

```
app/(dashboard)/command-center/inbox/
├── page.tsx          ← Server Component (auth gate + provider)
└── layout.tsx        ← ELIMINAR o reducir a pass-through simple
    @detail/          ← ELIMINAR directorio completo
```

#### Nuevo `layout.tsx` (minimal):

```tsx
export default function InboxLayout({ children }: { children: React.ReactNode }) {
  return <div className="h-full w-full">{children}</div>;
}
```

O directamente eliminar `layout.tsx` si el layout padre ya provee el contenedor.

### 3.2  InboxWorkspace — Split-Pane Consolidado (Sin Cambios Necesarios)

El componente `inbox-workspace.tsx` **ya implementa correctamente** el patrón split-pane:

```tsx
<ResizablePanelGroup orientation="horizontal">
  <ResizablePanel defaultSize={30} minSize={20} maxSize={40}>
    <InboxList />
  </ResizablePanel>
  <ResizableHandle withHandle />
  <ResizablePanel defaultSize={70}>
    <InboxThreadView />
  </ResizablePanel>
</ResizablePanelGroup>
```

Usa `react-resizable-panels` (ya en `package.json` como `^4.10.0`), con shadcn/ui wrappers (`components/ui/resizable`). El mismo patrón se usa exitosamente en el Kanban.

### 3.3  Responsive: Mobile Drawer/Stack

El `inbox-ui-store` ya tiene el estado `detailOpen` y la acción `setDetailOpen`, pero **ningún componente lo consume para mobile**.

**Diseño para móvil**:

```
┌─────────────────────────┐
│  [Desktop ≥768px]       │
│  ResizablePanelGroup    │
│  ┌──────┬──────────────┐│
│  │ List │  ThreadView  ││
│  └──────┴──────────────┘│
└─────────────────────────┘

┌─────────────────────────┐
│  [Mobile <768px]        │
│  Stack: List visible    │
│  ┌─────────────────────┐│
│  │ InboxList (full)    ││
│  │ onClick → open sheet││
│  └─────────────────────┘│
│                         │
│  Sheet/Drawer overlay:  │
│  ┌─────────────────────┐│
│  │ InboxThreadView     ││
│  │ ← Back button       ││
│  └─────────────────────┘│
└─────────────────────────┘
```

**Implementación**: Modificar `InboxWorkspace` para detectar mobile con el hook `useIsMobile()` existente en `hooks/use-mobile.ts` (breakpoint: 768px) y renderizar condicionalmente:

- **Desktop**: `ResizablePanelGroup` (actual, sin cambios).
- **Mobile**: `InboxList` a full width + shadcn `Sheet` (side="right", fullscreen) que muestra `InboxThreadView` cuando `detailOpen === true`.

El trigger `detailOpen` ya se activa en `selectThread()` del store:
```ts
selectThread: (threadId) =>
  set({ selectedThreadId: threadId, detailOpen: threadId !== null }),
```

### 3.4  Diagrama de Dependencias

```
inbox/page.tsx (RSC)
  │
  ├── createClient() → supabase.auth.getUser() → operatorId
  │
  └── <InboxClientProvider operatorId={operatorId}>
        │
        └── useAuthStore.setState({ operatorId })
              │
              └── <InboxWorkspace>  (client)
                    │
                    ├── useIsMobile()
                    │
                    ├── [Desktop] ResizablePanelGroup
                    │     ├── InboxList  → useThreadList() → /api/threads
                    │     │     └── onClick → useInboxUIStore.selectThread(id)
                    │     └── InboxThreadView → useMessages(threadId) → /api/threads/:id/messages
                    │           └── HandoffBar → useAuthStore(s => s.operatorId)
                    │
                    └── [Mobile] InboxList + Sheet
                          └── InboxThreadView (inside Sheet)
                                └── ← Back → setDetailOpen(false)
```

---

## 4  Archivos a Deprecar / Eliminar

| Archivo | Acción | Razón |
|---------|--------|-------|
| `app/(dashboard)/command-center/inbox/layout.tsx` | **Simplificar** a pass-through o **eliminar** | Double-nesting de ResizablePanelGroup |
| `app/(dashboard)/command-center/inbox/@detail/` (directorio completo) | **Eliminar** | Dead code — parallel routes no consumidos |
| `app/(dashboard)/command-center/inbox/@detail/default.tsx` | **Eliminar** | Parte del parallel route muerto |
| `app/(dashboard)/command-center/inbox/@detail/page.tsx` | **Eliminar** | Empty state duplicado (ya en InboxThreadView) |
| `app/(dashboard)/command-center/inbox/@detail/[id]/page.tsx` | **Eliminar** | Placeholder estático nunca usado |
| `app/(dashboard)/command-center/inbox/default.tsx` | **Eliminar** | Solo re-exporta page.tsx para parallel route |
| `components/command-center/inbox-panel.tsx` | **Evaluar deprecación** | Legacy panel que usa `command-center-store` en vez de `inbox-ui-store` |
| `components/command-center/inbox-header.tsx` | **Evaluar deprecación** | Parte del flujo legacy `InboxPanel` |
| `components/command-center/inbox-message-list.tsx` | **Evaluar deprecación** | Parte del flujo legacy `InboxPanel` |
| `components/command-center/inbox-composer.tsx` | **Evaluar deprecación** | Parte del flujo legacy `InboxPanel` |

---

## 5  Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|-------------|---------|------------|
| Eliminar parallel routes rompe alguna ruta deep-link | Baja | Medio | Verificar que ningún enlace externo apunta a `/inbox/<id>`. Si sí, añadir redirect. |
| `useRef(initialized)` en `InboxClientProvider` no actualiza en hot login switch | Baja | Bajo | Aceptable: login/logout hace full navigation. Documentar. |
| Sheet mobile no tiene lazy loading de mensajes | Media | Bajo | `useMessages` ya tiene `enabled: Boolean(threadId)` — solo fetcha cuando hay selección. |
| `inbox-panel.tsx` legacy se usa en otra ruta | Baja | Alto | Buscar imports antes de eliminar. Grep actual muestra 0 imports fuera de sí mismo. |

---

## 6  Work Breakdown Structure (WBS)

### Fase 1 — Cleanup: Eliminar Dead Code (Est. 1-2h)

| # | Tarea | Archivos | Criterio de Aceptación |
|---|-------|----------|----------------------|
| 1.1 | Verificar que `@detail/` no tiene imports externos | `grep -r "@detail" --include='*.tsx'` | 0 resultados fuera del directorio |
| 1.2 | Eliminar directorio `@detail/` completo | `app/(dashboard)/command-center/inbox/@detail/` | Directorio no existe |
| 1.3 | Eliminar `default.tsx` | `app/(dashboard)/command-center/inbox/default.tsx` | Archivo no existe |
| 1.4 | Simplificar `layout.tsx` a pass-through o eliminar | `app/(dashboard)/command-center/inbox/layout.tsx` | Sin `ResizablePanelGroup` duplicado |
| 1.5 | Verificar build (`pnpm build`) y que `/inbox` sigue funcionando | — | Build exitoso, página carga sin errores |

### Fase 2 — Mobile Responsive: Sheet/Drawer (Est. 2-3h)

| # | Tarea | Archivos | Criterio de Aceptación |
|---|-------|----------|----------------------|
| 2.1 | Importar `useIsMobile` en `InboxWorkspace` | `components/inbox/inbox-workspace.tsx` | Hook importado y llamado |
| 2.2 | Extraer render desktop a sub-componente interno o condicional | `inbox-workspace.tsx` | `ResizablePanelGroup` solo en `!isMobile` |
| 2.3 | Implementar vista mobile: `InboxList` full + `Sheet` con `InboxThreadView` | `inbox-workspace.tsx` | En viewport <768px: lista ocupa 100%, thread abre en Sheet |
| 2.4 | Conectar `Sheet open` a `detailOpen` del store | `inbox-workspace.tsx` + `inbox-ui-store.ts` | Sheet se abre/cierra con selección de thread |
| 2.5 | Añadir botón "← Volver" en header de `InboxThreadView` (solo mobile) | `inbox-thread-view.tsx` | Botón visible solo en mobile, cierra sheet |
| 2.6 | Test manual: resize browser entre mobile/desktop, verificar transiciones | — | Sin flickering, estado preservado |

### Fase 3 — Hardening Auth Pattern (Est. 30min)

| # | Tarea | Archivos | Criterio de Aceptación |
|---|-------|----------|----------------------|
| 3.1 | Añadir guard en `HandoffBar`: si `!operatorId`, mostrar mensaje o deshabilitar | `inbox-thread-view.tsx` | Botones deshabilitados si no hay auth |
| 3.2 | Documentar patrón RSC→ClientProvider→Zustand en comentario JSDoc | `inbox-client-provider.tsx` | Comentario explica la cadena de hidratación |

### Fase 4 — Deprecación Legacy (Est. 1h)

| # | Tarea | Archivos | Criterio de Aceptación |
|---|-------|----------|----------------------|
| 4.1 | Grep imports de `inbox-panel.tsx`, `inbox-header.tsx`, `inbox-message-list.tsx`, `inbox-composer.tsx` | — | Documentar si hay consumidores |
| 4.2 | Si no hay consumidores: eliminar los 4 archivos legacy | `components/command-center/inbox-*.tsx` | Archivos eliminados |
| 4.3 | Si hay consumidores: marcar con `@deprecated` y crear issue de migración | — | Deprecation notice en cada archivo |
| 4.4 | Build final + smoke test | — | `pnpm build` exitoso, inbox funcional |

### Resumen de Esfuerzo

| Fase | Estimación | Riesgo |
|------|-----------|--------|
| 1 — Cleanup | 1-2h | Bajo |
| 2 — Mobile | 2-3h | Medio |
| 3 — Auth Hardening | 30min | Bajo |
| 4 — Deprecación Legacy | 1h | Bajo |
| **Total** | **4.5-6.5h** | — |

---

## 7  Decisiones Arquitectónicas

| Decisión | Alternativa Descartada | Razón |
|----------|----------------------|-------|
| Selección via Zustand store (client-side) | URL params con parallel routes | La selección de thread no necesita ser bookmarkable. Zustand es más rápido y evita waterfalls de RSC. |
| `react-resizable-panels` para desktop | CSS Grid con `resize` | Ya adoptado en Kanban, consistencia visual, handle arrastrable nativo. |
| shadcn `Sheet` para mobile | CSS transform slide-in custom | Sheet ya está en el design system, soporta gestos, backdrop, y accesibilidad. |
| Auth via RSC → Zustand bridge | `useSession()` client-side | Evita flash de loading state. El operatorId está disponible desde el primer render. |

---

## 8  Fuera de Alcance

- **Envío de mensajes**: El `handleSend` en `InboxThreadView` tiene un TODO para conectar a una mutation. Esto es scope de otro RFC.
- **URL-based thread selection**: Si en el futuro se necesita deep-linking a threads (`/inbox?thread=abc`), se puede añadir sync bidireccional URL↔Store sin volver a parallel routes.
- **Lógica de grafos LangGraph**: Este RFC se limita a UI/UX. La integración con el event bridge (RFC-033) es posterior.
- **Filtros avanzados** (por canal, agente, status): El store ya los soporta pero la UI de filtros no está implementada. Scope separado.

---

## Apéndice A — Inventario de Archivos del Inbox

```
crm-agentico-panel/
├── app/(dashboard)/command-center/inbox/
│   ├── page.tsx                    ← CONSERVAR (auth gate)
│   ├── layout.tsx                  ← SIMPLIFICAR
│   ├── default.tsx                 ← ELIMINAR
│   └── @detail/                    ← ELIMINAR (completo)
│       ├── default.tsx
│       ├── page.tsx
│       └── [id]/page.tsx
├── components/inbox/
│   ├── inbox-client-provider.tsx   ← CONSERVAR (auth bridge)
│   ├── inbox-workspace.tsx         ← MODIFICAR (mobile responsive)
│   ├── inbox-list.tsx              ← CONSERVAR
│   └── inbox-thread-view.tsx       ← MINOR MODS (back button mobile, auth guard)
├── components/command-center/
│   ├── inbox-panel.tsx             ← DEPRECAR
│   ├── inbox-header.tsx            ← DEPRECAR
│   ├── inbox-message-list.tsx      ← DEPRECAR
│   └── inbox-composer.tsx          ← DEPRECAR
├── stores/
│   ├── inbox-ui-store.ts           ← CONSERVAR (ya tiene detailOpen)
│   └── auth-store.ts               ← CONSERVAR
├── hooks/
│   ├── queries/use-threads.ts      ← CONSERVAR
│   └── use-mobile.ts               ← CONSUMIR en InboxWorkspace
└── types/
    └── conversation.ts             ← CONSERVAR
```
