# RFC: Extracción y Acoplamiento del Patrón GlobalLayout (Tri-Columnar)

| Campo | Valor |
|-------|-------|
| **ID** | RFC-GlobalLayout-TriColumnar |
| **Estado** | DRAFT |
| **Autor** | Builder (Arquitecto Staff, Equipo Teseo) |
| **Fecha** | 2026-04-22 |
| **Proyecto Origen** | `fleetco-plus` (Vite + React Router DOM) |
| **Proyecto Destino** | `Teseo-AI-CRM/src/mission-control` (Next.js 16 App Router) |
| **Depende de** | ADR-119 (Auth Routing Guards), ADR-120 (Command Center UI Shell), RFC-024 (Auth Guards), RFC-025 (UI Shell Layout) |

---

## 1. Objetivo

Extraer el **patrón arquitectónico GlobalLayout** del repositorio `fleetco-plus` y diseñar su acoplamiento limpio al **Command Center del Tenant OS** (`mission-control`), transformando el layout actual de 2 columnas (Sidebar estática 256px + Content) en un **layout tri-columnar** con sidebar colapsable, top bar contextual, y menú horizontal de módulos.

### 1.1 Restricción Cardinal

> **CERO IMPACTO DESTRUCTIVO** sobre el Auth Guard actual (Middleware Edge + Supabase SSR + Route Groups `(auth)/(dashboard)`).

---

## 2. Anatomía del Patrón Origen (fleetco-plus)

### 2.1 Componentes Extraídos

```
fleetco-plus/src/components/layout/
├── GlobalLayout.tsx          ← Orquestador principal (Tri-Columnar)
├── Layout.tsx                ← Clon funcional (legacy, no migrar)
├── Sidebar.tsx               ← Col-1: Sidebar fija, colapsable (260px → 64px)
├── TopBar.tsx                ← Col-2/Header: Barra superior sticky (h-16, 64px)
├── menuItems.tsx             ← Definición de menú con roles y submenús
├── types.ts                  ← MenuItem / SubMenuItem interfaces
├── components/
│   ├── HorizontalMenu.tsx    ← Sub-navegación contextual por módulo
│   ├── SidebarMenuItem.tsx   ← Ítem individual con accordion y submenús
│   ├── SidebarLogo.tsx       ← Logo tenant-aware (full/collapsed)
│   └── SidebarFooter.tsx     ← Avatar + Settings + Logout
└── hooks/
    ├── usePageTitle.ts       ← Título dinámico basado en pathname
    └── useModuleDetection.ts ← Flags de módulo activo para HorizontalMenu
```

### 2.2 Estructura Visual del Patrón

```
┌──────────────────────────────────────────────────────────────────┐
│                        VIEWPORT (100vw × 100vh)                  │
├──────────┬───────────────────────────────────────────────────────┤
│          │  COL-2: TopBar (sticky, h-16, z-30)                   │
│          │  ┌─────────────────────────────────────────────────┐  │
│          │  │ PageTitle │ SearchBar │ Notifications │ Actions │  │
│  COL-1:  │  └─────────────────────────────────────────────────┘  │
│  Sidebar │  ┌─────────────────────────────────────────────────┐  │
│  (fixed) │  │ HorizontalMenu (contextual, sticky, z-20)      │  │
│  260px   │  └─────────────────────────────────────────────────┘  │
│  ↕ 64px  │  ┌─────────────────────────────────────────────────┐  │
│          │  │                                                 │  │
│  Logo    │  │  COL-3: Content Area (<Outlet/> / {children})   │  │
│  Nav     │  │  overflow-y: auto, p-6                          │  │
│  Footer  │  │                                                 │  │
│          │  │  (Aquí vive el Command Center: Kanban + Inbox)  │  │
│          │  │                                                 │  │
│          │  └─────────────────────────────────────────────────┘  │
└──────────┴───────────────────────────────────────────────────────┘
```

### 2.3 Dimensiones y Tokens del Patrón

| Token | Valor | CSS Variable |
|-------|-------|-------------|
| Sidebar expandido | `260px` | — (inline style) |
| Sidebar colapsado | `64px` | — (inline style) |
| TopBar height | `64px` (`h-16`) | — |
| Transición sidebar | `var(--transition-slow)` | Definida en tema |
| Content padding | `p-6` (24px) | Tailwind |
| Sidebar z-index | `z-40` | — |
| TopBar z-index | `z-30` | — |
| HorizontalMenu z-index | `z-20` | — |
| Sidebar position | `fixed left-0 top-0` | — |
| Content margin-left | `260px` / `64px` (dinámico) | — |

### 2.4 Dependencias Funcionales del Patrón

| Dependencia | Origen | Decisión Destino |
|-------------|--------|-----------------|
| `react-router-dom` (`Outlet`, `Link`, `useLocation`, `NavLink`) | Vite SPA | **Reemplazar** con Next.js App Router (`children`, `next/link`, `usePathname`) |
| `useAuth()` (Context) | `AuthContext` custom | **Reemplazar** con Supabase SSR (`getUser()` server-side) |
| `useTenantStore` (Zustand) | Zustand store | **Mantener** — Zustand ya está en `mission-control` (RFC-025) |
| `useTheme` (custom provider) | ThemeProvider | **Reemplazar** con `next-themes` (ya instalado en `mission-control`) |
| shadcn/ui (`Tooltip`, `Avatar`, `Sheet`) | Radix + shadcn | **Instalar** los componentes faltantes en `mission-control` |
| `lucide-react` | Iconos | ✅ Ya disponible en `mission-control` |

---

## 3. Análisis del Sistema Destino (mission-control)

### 3.1 Estado Actual del Layout

```
mission-control/src/
├── app/
│   ├── layout.tsx            ← Root Layout (HTML shell + Sidebar condicional por auth)
│   ├── page.tsx              ← Redirect → /dashboard
│   ├── login/                ← Auth (no tiene Route Group aún)
│   ├── dashboard/page.tsx
│   ├── tenants/
│   ├── finops/page.tsx
│   └── alerts/page.tsx
├── components/
│   ├── Sidebar.tsx           ← Sidebar estática (w-64, hidden md:flex)
│   └── ui/                   ← shadcn components
├── lib/
│   ├── supabase.ts           ← Browser client
│   └── supabase-server.ts    ← Server client
└── middleware.ts              ← Auth Guard Edge (Supabase getUser)
```

### 3.2 Auth Guard Actual — ZONA INTOCABLE

El middleware actual (`middleware.ts`) opera como **Edge Guard** con la siguiente lógica:

```
Request → middleware.ts
  ├── getUser() via Supabase SSR cookie
  ├── !user && !isLoginPage → redirect('/login')
  ├── user && isLoginPage → redirect('/tenants')
  └── else → NextResponse.next()
```

**Matcher:** `/((?!api|_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt).*)`

> ⚠️ **REGLA INQUEBRANTABLE:** Este middleware NO se modifica. Toda la lógica de layout se implementa DEBAJO del middleware, en la capa de Layout Components del App Router.

### 3.3 Root Layout Actual

El `app/layout.tsx` actual hace una bifurcación server-side:
- **Con usuario:** Renderiza `<Sidebar />` + content
- **Sin usuario:** Renderiza solo `{children}` (para login)

Esta lógica de bifurcación **debe preservarse** pero se adaptará para usar Route Groups.

### 3.4 Brechas Detectadas vs ADR-119

El ADR-119 documentó que el destino final debería usar **Route Groups** `(auth)` y `(dashboard)`. Sin embargo, la implementación actual en `mission-control` **NO ha aplicado Route Groups aún** — el `layout.tsx` raíz sigue haciendo la bifurcación condicionalmente. Este RFC asume que las Route Groups se implementarán como prerequisito (ver WBS §5.1).

---

## 4. Decisiones Arquitectónicas

### 4.1 Estrategia de Migración: Adapter Pattern

**NO se hace un port 1:1.** Se crea un **Adapter** que traduce los patrones de React Router DOM hacia Next.js App Router:

| Concepto fleetco-plus | Concepto mission-control |
|-----------------------|--------------------------|
| `<Outlet />` | `{children}` (Server Component layout prop) |
| `useLocation().pathname` | `usePathname()` (from `next/navigation`) |
| `<Link to={...}>` | `<Link href={...}>` (from `next/link`) |
| `useNavigate()` | `useRouter().push()` (from `next/navigation`) |
| `useAuth()` context | `getUser()` server-side + client hook wrapping Supabase |
| `ProtectedRoute` wrapper | Middleware Edge (ya existe) — NO duplicar |

### 4.2 Sidebar como Client Component Aislado

La Sidebar requiere `useState` (collapse toggle), `usePathname` (active detection), y event handlers. Por tanto:

- **`"use client"`** obligatorio.
- Se instancia dentro del `(dashboard)/layout.tsx` como child de un RSC.
- El RSC padre obtiene `user` via `getUser()` server-side y lo pasa como prop para evitar waterfall.

### 4.3 TopBar como Client Component

Similar a la Sidebar: necesita estado (modales, notificaciones) y hooks de navegación.

- Se instancia dentro del content area del layout.
- Recibe `user` y `pageTitle` como props (pageTitle puede derivarse del segmento activo vía `useSelectedLayoutSegment`).

### 4.4 Menú Horizontal — Implementación Diferida

El `HorizontalMenu` de fleetco-plus está atado a módulos específicos de flotas (Gastos, Combustible, Mantenimiento). En el contexto del CRM Tenant OS, los módulos son distintos (Command Center, Asset Studio, Campaign Review, Analytics).

**Decisión:** El slot del HorizontalMenu se incluye en el layout como un `{horizontalNav}` (parallel route o slot hijo), pero su implementación concreta se delega a un sprint posterior. El layout debe reservar el espacio pero no requiere contenido inmediato.

### 4.5 Persistencia del Collapse State

**Decisión:** Usar `localStorage` directamente (igual que `react-resizable-panels` en RFC-025) para persistir el estado collapsed/expanded de la sidebar.

```
Key: "mission-control:sidebar-expanded"
Value: "true" | "false"
```

No usar Zustand para esto — es estado de UI local sin necesidad de sincronización cross-component.

### 4.6 Mobile Strategy: Sheet Drawer

Replicar el patrón de fleetco-plus: en `< md` (768px), la sidebar se oculta (`hidden md:flex`) y un botón hamburguesa abre un `Sheet` (shadcn) con la navegación completa.

---

## 5. Plan de Inyección — Puntos de Contacto

### 5.1 Reestructuración de Carpetas (Prerequisito)

```
ANTES:
app/
├── layout.tsx          ← Bifurcación condicional (user ? sidebar : bare)
├── login/page.tsx
├── dashboard/page.tsx
├── tenants/...
└── ...

DESPUÉS:
app/
├── layout.tsx          ← Root puro: html, body, fonts, ThemeProvider, Toaster
├── (auth)/
│   ├── layout.tsx      ← Layout limpio sin sidebar
│   └── login/
│       ├── page.tsx
│       └── actions.ts
├── (dashboard)/
│   ├── layout.tsx      ← ★ AQUÍ SE INYECTA EL GLOBAL LAYOUT TRI-COLUMNAR ★
│   ├── page.tsx        ← redirect → /dashboard
│   ├── dashboard/page.tsx
│   ├── tenants/...
│   ├── finops/page.tsx
│   ├── alerts/page.tsx
│   ├── command-center/...   (futuro)
│   └── asset-studio/...    (futuro)
└── api/
    └── webhooks/...
```

### 5.2 Mapa de Archivos Nuevos

```
src/
├── components/
│   ├── layout/                        ← NUEVO: Paquete del GlobalLayout
│   │   ├── GlobalLayout.tsx           ← Orquestador tri-columnar (Client Component)
│   │   ├── AppSidebar.tsx             ← Sidebar colapsable (Client Component)
│   │   ├── AppTopBar.tsx              ← Top bar con título + acciones (Client Component)
│   │   ├── SidebarMenuItem.tsx        ← Item de menú con accordion
│   │   ├── SidebarFooter.tsx          ← Usuario + Settings + Logout
│   │   ├── SidebarLogo.tsx            ← Logo con estados expanded/collapsed
│   │   ├── HorizontalMenuSlot.tsx     ← Placeholder para menú contextual (futuro)
│   │   ├── menu-items.ts             ← Definición de navegación del CRM
│   │   ├── types.ts                   ← MenuItem / SubMenuItem interfaces
│   │   └── hooks/
│   │       ├── use-sidebar-state.ts   ← useState + localStorage persistence
│   │       ├── use-page-title.ts      ← Título dinámico por pathname
│   │       └── use-module-detection.ts← Flags de módulo activo
│   └── Sidebar.tsx                    ← ELIMINAR (reemplazado por AppSidebar)
└── app/
    ├── layout.tsx                     ← MODIFICAR: Purgar a shell puro
    ├── (auth)/
    │   ├── layout.tsx                 ← NUEVO
    │   └── login/                     ← MOVER desde app/login/
    └── (dashboard)/
        ├── layout.tsx                 ← NUEVO: Importa GlobalLayout
        └── [todas las rutas actuales] ← MOVER desde app/
```

### 5.3 Diagrama de Flujo Auth + Layout

```
HTTP Request
    │
    ▼
middleware.ts (Edge)  ←── NO SE TOCA
    │
    ├── !user → redirect /login
    │              │
    │              ▼
    │         (auth)/layout.tsx → login/page.tsx
    │              (sin sidebar, sin topbar)
    │
    └── user → NextResponse.next()
                   │
                   ▼
              (dashboard)/layout.tsx
                   │
                   ▼
              ┌─ GlobalLayout (Client Component) ─┐
              │                                    │
              │  ┌──────────┐ ┌─────────────────┐  │
              │  │ AppSidebar│ │ AppTopBar        │  │
              │  │ (fixed)  │ │ (sticky)         │  │
              │  │          │ ├─────────────────┤  │
              │  │          │ │ HorizontalSlot   │  │
              │  │          │ ├─────────────────┤  │
              │  │          │ │ {children}       │  │
              │  │          │ │ (page content)   │  │
              │  └──────────┘ └─────────────────┘  │
              └────────────────────────────────────┘
```

---

## 6. Contrato de la Interfaz — Props y Tipos

### 6.1 GlobalLayout

```typescript
// components/layout/GlobalLayout.tsx
"use client"

interface GlobalLayoutProps {
  children: React.ReactNode;
  user: {
    id: string;
    email: string;
    name?: string;
    role?: string;
    avatar_url?: string;
  };
}
```

### 6.2 AppSidebar

```typescript
interface AppSidebarProps {
  expanded: boolean;
  onToggle: () => void;
  user: {
    name?: string;
    email: string;
    role?: string;
  };
}
```

### 6.3 AppTopBar

```typescript
interface AppTopBarProps {
  expanded: boolean;
  onToggleSidebar: () => void;
  title: string;
  user: {
    name?: string;
    email: string;
  };
}
```

### 6.4 MenuItem (adaptado)

```typescript
// types.ts
import { LucideIcon } from 'lucide-react';

export interface MenuItem {
  name: string;
  icon: LucideIcon;
  href: string;           // Cambiado de 'path' a 'href' (convención Next.js)
  subPaths?: string[];
  subMenus?: SubMenuItem[];
  open?: boolean;
  allowedRoles?: string[];
}

export interface SubMenuItem {
  name: string;
  href: string;
  icon?: LucideIcon;
  allowedRoles?: string[];
}
```

---

## 7. Menú de Navegación Adaptado al CRM

```typescript
// menu-items.ts
import {
  LayoutDashboard,
  Users,
  CircleDollarSign,
  BellRing,
  Command,
  Palette,
  BarChart3,
  Inbox,
  Settings,
} from "lucide-react";

export const crmMenuItems: MenuItem[] = [
  {
    name: "Dashboard",
    icon: LayoutDashboard,
    href: "/dashboard",
  },
  {
    name: "Command Center",
    icon: Command,
    href: "/command-center",
    subMenus: [
      { name: "Kanban", href: "/command-center" },
      { name: "Inbox", href: "/command-center/inbox" },
    ],
  },
  {
    name: "Tenants",
    icon: Users,
    href: "/tenants",
  },
  {
    name: "Asset Studio",
    icon: Palette,
    href: "/asset-studio",
  },
  {
    name: "Analytics",
    icon: BarChart3,
    href: "/analytics",
  },
  {
    name: "FinOps",
    icon: CircleDollarSign,
    href: "/finops",
  },
  {
    name: "Alerts",
    icon: BellRing,
    href: "/alerts",
  },
];
```

---

## 8. Riesgos y Mitigaciones

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|--------|-------------|---------|------------|
| R1 | Romper el Auth Guard al mover rutas a Route Groups | Alta | Crítico | El middleware usa matchers por path, no por Route Group. Mover `login/` a `(auth)/login/` no cambia el path URL. **Test E2E obligatorio post-migración.** |
| R2 | Hydration mismatch por `localStorage` en SSR | Media | Medio | Usar `useEffect` + `useState` con default `true`. El primer render server asume sidebar expandida; el client reconcilia en mount. |
| R3 | Flash de contenido sin sidebar en primer render | Media | Bajo | El RSC `(dashboard)/layout.tsx` renderiza el shell estático; `GlobalLayout` monta como Client Component. Usar `suppressHydrationWarning` si necesario. |
| R4 | `Sidebar.tsx` actual tiene dependencias no mapeadas | Baja | Medio | Auditoría completa en WBS §5.2 antes de eliminar el archivo viejo. |
| R5 | Missing shadcn components (Tooltip, Avatar, Sheet) | Baja | Bajo | Ejecutar `npx shadcn@latest add tooltip avatar sheet` en WBS §5.3. |

---

## 9. Reglas de Convivencia (Auth Guard ↔ Layout)

1. **`middleware.ts` es READONLY.** Ningún paso del WBS lo modifica.
2. **`app/layout.tsx` se simplifica** pero NO se elimina su renderizado. Se convierte en shell HTML puro.
3. **La bifurcación auth/no-auth** se delega a Route Groups, NO a condicionales en el layout raíz.
4. **`(dashboard)/layout.tsx`** obtiene `user` via `getUser()` SSR. Si no hay user, el middleware ya habrá redirigido — pero como defensa en profundidad, se agrega un `redirect('/login')` como fallback.
5. **Los paths URL NO cambian.** `/dashboard`, `/tenants`, `/login` siguen siendo exactamente los mismos. Solo cambia la organización interna de carpetas.

---

## 10. WBS — Work Breakdown Structure

### Fase 0: Prerequisitos (No-Code Changes)

| # | Tarea | Entrada | Salida | Riesgo |
|---|-------|---------|--------|--------|
| 0.1 | Backup del estado actual (git branch `pre-global-layout`) | Repo limpio | Branch de referencia | Ninguno |
| 0.2 | Verificar que `middleware.ts` tests pasan (manual: acceder sin cookie → redirect) | Browser | Confirmación PASS | Ninguno |
| 0.3 | Instalar shadcn components faltantes: `tooltip`, `avatar`, `sheet` | `npx shadcn@latest add tooltip avatar sheet` | Archivos en `components/ui/` | Bajo |

### Fase 1: Reestructuración Route Groups (Auth Guard Safe)

| # | Tarea | Detalle | Archivos Afectados |
|---|-------|---------|--------------------|
| 1.1 | Crear `app/(auth)/layout.tsx` | Shell limpio: `<main className="flex-1 flex flex-col">{children}</main>` | **NUEVO** |
| 1.2 | Mover `app/login/` → `app/(auth)/login/` | Mover `page.tsx` y `actions.ts` intactos. URL `/login` no cambia. | **MOVER** (2 archivos) |
| 1.3 | Crear `app/(dashboard)/layout.tsx` | RSC que obtiene user server-side y renderiza `<GlobalLayout user={user}>{children}</GlobalLayout>`. Fallback redirect si no user. | **NUEVO** |
| 1.4 | Mover rutas protegidas a `(dashboard)/` | `dashboard/`, `tenants/`, `finops/`, `alerts/`, `page.tsx` → dentro de `(dashboard)/` | **MOVER** (5+ archivos/carpetas) |
| 1.5 | Purgar `app/layout.tsx` | Eliminar la bifurcación `user ? sidebar : bare`. Dejar solo: `<html>`, `<body>`, fonts, `<Toaster>`, `{children}` | **MODIFICAR** |
| 1.6 | Mover `app/api/` a `app/api/` (sin Route Group) | Las API routes NO van dentro de Route Groups. Verificar que permanezcan en `app/api/` | **VERIFICAR** (no mover) |
| **🧪** | **Test Gate 1:** Navegar a `/login` → renderiza login sin sidebar. Navegar a `/dashboard` sin cookie → redirect a `/login`. Navegar a `/dashboard` con cookie → renderiza dashboard (aún con sidebar vieja en este punto). | | |

### Fase 2: Scaffolding del Paquete Layout

| # | Tarea | Detalle | Archivos Afectados |
|---|-------|---------|--------------------|
| 2.1 | Crear directorio `components/layout/` | Estructura base del paquete | **NUEVO** directorio |
| 2.2 | Crear `types.ts` | Interfaces `MenuItem`, `SubMenuItem` adaptadas (href en vez de path) | **NUEVO** |
| 2.3 | Crear `menu-items.ts` | Definición de navegación CRM (Dashboard, Command Center, Tenants, Asset Studio, Analytics, FinOps, Alerts) | **NUEVO** |
| 2.4 | Crear `hooks/use-sidebar-state.ts` | Hook con `useState` + `useEffect` para persistencia en `localStorage` | **NUEVO** |
| 2.5 | Crear `hooks/use-page-title.ts` | Mapeo pathname → título usando `usePathname()` de Next.js | **NUEVO** |
| 2.6 | Crear `hooks/use-module-detection.ts` | Flags de módulo activo (command-center, asset-studio, etc.) | **NUEVO** |

### Fase 3: Implementación de Componentes

| # | Tarea | Detalle | Origen (fleetco-plus) |
|---|-------|---------|-----------------------|
| 3.1 | Implementar `SidebarLogo.tsx` | Adaptar para tenant-aware (si hay tenant store) o logo estático "Mission Control". Quitar `useTenantStore` de fleetco y usar prop o constante. | `SidebarLogo.tsx` |
| 3.2 | Implementar `SidebarMenuItem.tsx` | Port del componente accordion. Reemplazar `Link`/`useNavigate` de React Router con `next/link` + `useRouter`. `useLocation` → `usePathname`. | `SidebarMenuItem.tsx` |
| 3.3 | Implementar `SidebarFooter.tsx` | Adaptar logout a Server Action (form + `logout()` action). Reemplazar `useAuth()` con prop `user`. `Link to` → `Link href`. | `SidebarFooter.tsx` |
| 3.4 | Implementar `AppSidebar.tsx` | Integrar Logo + MenuItems + Footer. `fixed left-0 top-0 h-screen z-40`. Width: `260px ↔ 64px`. Role-based filtering via `user.role` prop. | `Sidebar.tsx` |
| 3.5 | Implementar `AppTopBar.tsx` | Barra sticky h-16 con título dinámico. Omitir SearchBar, ChecklistButton, FleetcoAssistant (no aplican al CRM). Slots para notificaciones futuras. | `TopBar.tsx` |
| 3.6 | Implementar `HorizontalMenuSlot.tsx` | Componente placeholder que renderiza `null` por defecto. Acepta `items` prop para activación futura. | `HorizontalMenu.tsx` |
| 3.7 | Implementar `GlobalLayout.tsx` | Orquestador `"use client"`. Compone: `AppSidebar` (fixed) + content area con `margin-left` dinámico + `AppTopBar` (sticky) + `HorizontalMenuSlot` + `{children}`. | `GlobalLayout.tsx` |

### Fase 4: Integración y Wiring

| # | Tarea | Detalle |
|---|-------|---------|
| 4.1 | Conectar `(dashboard)/layout.tsx` con `GlobalLayout` | RSC obtiene `user` → pasa a `<GlobalLayout>`. Los `{children}` son las páginas del App Router. |
| 4.2 | Adaptar logout flow | El `SidebarFooter` usa un `<form action={logout}>` pattern (Server Action) en vez de `onClick={logout}` del AuthContext de fleetco. Reutilizar `app/(auth)/login/actions.ts#logout`. |
| 4.3 | Eliminar `components/Sidebar.tsx` (viejo) | Reemplazado por `components/layout/AppSidebar.tsx`. Verificar que ningún otro archivo lo importe. |
| 4.4 | Ajustar estilos globales | Agregar CSS variables si se necesitan (`--transition-slow`, colores del sidebar). Verificar Tailwind config para `dark:` variants. |
| 4.5 | Mobile responsive wiring | Implementar `Sheet` drawer para `< md`. Botón hamburguesa en header mobile. |

### Fase 5: Verificación y QA

| # | Tarea | Criterio de Aceptación |
|---|-------|----------------------|
| 5.1 | **Auth Guard Integrity Test** | `/dashboard` sin cookie → redirect `/login` ✅. `/login` con cookie → redirect `/tenants` ✅. `middleware.ts` sin cambios (diff = 0 líneas). |
| 5.2 | **Layout Rendering Test** | Sidebar visible en todas las rutas protegidas. Sidebar AUSENTE en `/login`. TopBar muestra título correcto por ruta. |
| 5.3 | **Collapse/Expand Test** | Click en toggle → sidebar colapsa a 64px. Content area se expande. Estado persiste tras refresh (localStorage). |
| 5.4 | **Navigation Test** | Todos los links del menú navegan correctamente. Active state se marca correctamente. Accordion de submenús funciona. |
| 5.5 | **Mobile Test** | En `< 768px`: sidebar oculta, hamburguesa visible, Sheet se abre con navegación completa. |
| 5.6 | **Role-Based Test** | Si `user.role` no incluye un menuItem.allowedRoles, ese item no aparece. |
| 5.7 | **Dark Mode Test** | Sidebar respeta `dark:` variants. Logo cambia según tema (si implementado). |
| 5.8 | **Zero Console Errors** | No hydration warnings, no missing key warnings, no import errors. |

---

## 11. Orden de Ejecución (Secuencia del Ejecutor)

```
Fase 0 (Prereqs)
  └── 0.1 → 0.2 → 0.3

Fase 1 (Route Groups)           ← CRÍTICA: Auth Guard integrity
  └── 1.1 → 1.2 → 1.3 → 1.4 → 1.5 → 1.6
  └── 🧪 Test Gate 1

Fase 2 (Scaffolding)            ← Parallelizable con Fase 1 post Test Gate
  └── 2.1 → 2.2 → 2.3 → 2.4 → 2.5 → 2.6

Fase 3 (Components)             ← Depende de Fase 2
  └── 3.1 ┐
      3.2 ├── Parallelizables (componentes hoja)
      3.3 ┘
  └── 3.4 → (depende de 3.1, 3.2, 3.3)
  └── 3.5 → (depende de 2.5)
  └── 3.6 → (independiente)
  └── 3.7 → (depende de 3.4, 3.5, 3.6)

Fase 4 (Integration)            ← Depende de Fase 1 + Fase 3
  └── 4.1 → 4.2 → 4.3 → 4.4 → 4.5

Fase 5 (QA)                     ← Depende de Fase 4
  └── 5.1 → 5.2 → 5.3 → 5.4 → 5.5 → 5.6 → 5.7 → 5.8
```

---

## 12. Estimación de Esfuerzo

| Fase | Tareas | Complejidad | Estimación |
|------|--------|-------------|------------|
| 0 | 3 | Trivial | 10 min |
| 1 | 6 + test | Media-Alta (riesgo auth) | 45 min |
| 2 | 6 | Baja | 20 min |
| 3 | 7 | Alta (port + adaptation) | 90 min |
| 4 | 5 | Media | 30 min |
| 5 | 8 | Media | 30 min |
| **Total** | **35 tareas** | | **~4 horas** |

---

## 13. Apéndice A: Archivos de Referencia en fleetco-plus

Todos los archivos fuente para el port están en:

```
/Users/teseohome/projects/fleetco-plus/src/components/layout/
```

El Ejecutor debe leer estos archivos como referencia, pero **nunca copiar/pegar directamente** — cada componente requiere adaptación a Next.js App Router, `next/link`, `next/navigation`, y Supabase SSR.

---

## 14. Apéndice B: Checklist del Ejecutor (Pre-Flight)

- [ ] `git checkout -b feat/global-layout-tri-columnar`
- [ ] `middleware.ts` — anotar checksum SHA antes de empezar
- [ ] `npx shadcn@latest add tooltip avatar sheet` — confirmar instalación
- [ ] Confirmar que `/login` funciona E2E antes de iniciar Fase 1
- [ ] Confirmar que `/dashboard` + cookie funciona E2E antes de iniciar Fase 1
- [ ] Al finalizar Fase 1: `diff middleware.ts` === 0 cambios
- [ ] Al finalizar Fase 5: todos los tests pasan

---

*Documento generado por Builder — Cero Código Implementado. Este RFC es un blueprint para consumo del Ejecutor.*
