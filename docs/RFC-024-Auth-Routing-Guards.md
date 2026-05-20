# RFC-024: Ruteo y Navegación E2E — Login UI & Route Guards

| Campo | Valor |
|-------|-------|
| **Sprint** | 1.4 |
| **Autor** | Builder (Planificador) |
| **Fecha** | 2026-04-21 |
| **Estado** | DRAFT → Pendiente aprobación Teseo |
| **Proyecto** | `crm-agentico-panel` (Next.js 14 App Router) |
| **Dependencias** | `@supabase/ssr@0.10.2`, `@supabase/supabase-js@2.103.3` |

---

## 1. Problema

| # | Gap | Severidad |
|---|-----|-----------|
| G-1 | `/command-center` y todas sus sub-rutas (`/inbox`, kanban, etc.) **no están protegidas** en `middleware.ts`. Solo `/inbox`, `/prompts` y `/timeline` tienen guard, y esas rutas viven dentro de `/command-center/` así que el guard raíz nunca aplica. | **Crítica** |
| G-2 | `app/auth/login/page.tsx` es un stub de QA con credenciales hardcodeadas. No existe formulario de login real. | **Crítica** |
| G-3 | `app/layout.tsx` renderiza `<AppSidebar>` incondicionalmente — la sidebar aparece en la página de login. | **Alta** |
| G-4 | No existe ruta `/auth/callback` para manejar el intercambio de código OAuth/Magic Link de Supabase. | **Media** |
| G-5 | No hay lógica de `redirectTo` (regresar al usuario a la URL original tras autenticarse). | **Media** |
| G-6 | Metadata del layout raíz sigue con el placeholder de `create-next-app`. | **Baja** |

---

## 2. Decisiones Arquitectónicas

### 2.1 Estrategia de Protección: Middleware-First (Edge)

```
Request → middleware.ts (Edge) → getUser() → ¿autenticado?
  ├─ SÍ  → NextResponse.next() (pasa al App Router)
  └─ NO  → redirect /auth/login?redirectTo={pathname}
```

**Justificación:** El middleware de Next.js corre en el Edge antes de que React se renderice. Proteger aquí garantiza que ningún RSC (React Server Component) de rutas protegidas se ejecute para usuarios anónimos. Esto es más seguro y eficiente que guards a nivel de componente.

### 2.2 Layout Split con Route Groups

```
app/
├── (auth)/                    ← Route Group: Layout SIN sidebar
│   ├── layout.tsx             ← Layout limpio (solo children, fondo brand)
│   └── auth/
│       ├── login/page.tsx     ← Login UI real
│       └── callback/route.ts  ← OAuth code exchange
├── (dashboard)/               ← Route Group: Layout CON sidebar
│   ├── layout.tsx             ← AppSidebar + Providers
│   ├── command-center/
│   │   ├── page.tsx
│   │   └── inbox/...
│   ├── asset-studio/...
│   └── campaign-review/...
├── layout.tsx                 ← Root: html, body, fonts, ThemeProvider
├── providers.tsx              ← React Query, etc.
└── page.tsx                   ← Landing / redirect a /command-center
```

**Justificación:** Usar Route Groups `(auth)` y `(dashboard)` permite layouts radicalmente distintos sin duplicar lógica. La sidebar nunca se monta en rutas de auth. Next.js App Router maneja esto nativamente sin hack alguno.

### 2.3 Flujo de Auth Completo

```
┌────────────┐     ┌──────────────┐     ┌────────────────┐
│  /auth/login │────▶│ signInWith*  │────▶│ /auth/callback │
│  (Form UI)   │     │ (Supabase)   │     │ (code exchange)│
└────────────┘     └──────────────┘     └───────┬────────┘
                                                │
                                      redirect to redirectTo
                                      or /command-center
```

### 2.4 Reglas de Middleware (Actualizadas)

```typescript
// Rutas protegidas (requieren sesión)
const PROTECTED_PREFIXES = [
  '/command-center',
  '/asset-studio',
  '/campaign-review',
];

// Rutas públicas explícitas (nunca redirigir)
const PUBLIC_PREFIXES = [
  '/auth',
  '/api',  // API routes manejan su propia auth
];
```

Lógica:
1. Si la ruta es pública → `next()`.
2. Si no hay `user` y ruta es protegida → redirect a `/auth/login?redirectTo={pathname}`.
3. Si hay `user` y ruta es `/auth/login` → redirect a `/command-center`.
4. Default → `next()`.

---

## 3. Componentes a Crear/Modificar

| # | Archivo | Acción | Descripción |
|---|---------|--------|-------------|
| C-1 | `middleware.ts` | **Modificar** | Actualizar `isProtectedRoute` con los prefijos completos. Agregar lógica `redirectTo`. |
| C-2 | `app/(auth)/layout.tsx` | **Crear** | Layout limpio sin sidebar. Fondo con branding Teseo. |
| C-3 | `app/(auth)/auth/login/page.tsx` | **Crear** | Formulario real: email + password, botón submit, manejo de errores, link a signup futuro. |
| C-4 | `app/(auth)/auth/callback/route.ts` | **Crear** | Route Handler GET que intercambia `code` por sesión y redirige. |
| C-5 | `app/(dashboard)/layout.tsx` | **Crear** | Mover lógica actual de `app/layout.tsx` (Sidebar, Tooltip) aquí. |
| C-6 | `app/layout.tsx` | **Modificar** | Reducir a shell mínimo: `<html>`, `<body>`, `<Providers>`, `{children}`. |
| C-7 | `app/page.tsx` | **Modificar** | Redirect incondicional a `/command-center` (el middleware se encarga de auth). |
| C-8 | `app/(dashboard)/command-center/**` | **Mover** | Relocar archivos existentes bajo route group `(dashboard)`. |
| C-9 | `app/(dashboard)/asset-studio/**` | **Mover** | Relocar bajo `(dashboard)`. |
| C-10 | `app/(dashboard)/campaign-review/**` | **Mover** | Relocar bajo `(dashboard)`. |
| C-11 | `app/auth/login/page.tsx` | **Eliminar** | Stub actual de QA. Reemplazado por C-3. |

---

## 4. Especificación de Componentes Clave

### 4.1 Login Page (`C-3`)

```
┌─────────────────────────────────┐
│          [Logo Teseo]           │
│                                 │
│  ┌───────────────────────────┐  │
│  │ Email                     │  │
│  └───────────────────────────┘  │
│  ┌───────────────────────────┐  │
│  │ Password          [👁]    │  │
│  └───────────────────────────┘  │
│                                 │
│  [     Iniciar Sesión      ]    │
│                                 │
│  ─── Error message area ───     │
│                                 │
└─────────────────────────────────┘
```

- **Client Component** (`'use client'`).
- Usa `createClient()` de `utils/supabase/client.ts`.
- `signInWithPassword({ email, password })`.
- En éxito: `router.push(redirectTo || '/command-center')`.
- Lee `redirectTo` de `searchParams`.
- Validación con Zod (email format, password min 6 chars).
- UI con shadcn `<Input>`, `<Button>`, `<Card>`.
- Estado de loading en botón.

### 4.2 Auth Callback (`C-4`)

```typescript
// app/(auth)/auth/callback/route.ts
import { NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  const redirectTo = searchParams.get('redirectTo') ?? '/command-center'

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)
    if (!error) {
      return NextResponse.redirect(`${origin}${redirectTo}`)
    }
  }

  return NextResponse.redirect(`${origin}/auth/login?error=auth_callback_failed`)
}
```

### 4.3 Middleware Actualizado (`C-1`)

```typescript
const PROTECTED_PREFIXES = ['/command-center', '/asset-studio', '/campaign-review']
const AUTH_ROUTES = ['/auth/login', '/auth/callback']

// ... después de getUser():

const pathname = request.nextUrl.pathname

// Si es ruta de auth y usuario autenticado → redirigir al dashboard
if (user && AUTH_ROUTES.some(r => pathname.startsWith(r))) {
  const url = request.nextUrl.clone()
  url.pathname = '/command-center'
  return NextResponse.redirect(url)
}

// Si es ruta protegida y no autenticado → login con redirectTo
if (!user && PROTECTED_PREFIXES.some(p => pathname.startsWith(p))) {
  const url = request.nextUrl.clone()
  url.pathname = '/auth/login'
  url.searchParams.set('redirectTo', pathname)
  return NextResponse.redirect(url)
}
```

---

## 5. Work Breakdown Structure (WBS)

> Cada tarea es atómica y verificable. El Night Coder ejecuta en orden estricto.

### Fase A: Reestructuración de Route Groups (Filesystem)

| WBS | Tarea | Archivos | Criterio de Aceptación |
|-----|-------|----------|----------------------|
| A-1 | Crear directorio `app/(dashboard)/` y mover `command-center/`, `asset-studio/`, `campaign-review/` dentro. | Directorios | `next dev` compila sin errores. Rutas siguen respondiendo en las mismas URLs. |
| A-2 | Crear `app/(dashboard)/layout.tsx` extrayendo `SidebarProvider`, `TooltipProvider`, `AppSidebar` del layout raíz actual. | `app/(dashboard)/layout.tsx` | El layout solo envuelve children con sidebar+tooltip. |
| A-3 | Simplificar `app/layout.tsx` a shell mínimo: `<html>`, `<body>`, `<Providers>`, `{children}`. Eliminar imports de Sidebar/Tooltip. | `app/layout.tsx` | El root layout no importa AppSidebar ni SidebarProvider. |
| A-4 | Crear directorio `app/(auth)/` y `app/(auth)/layout.tsx` con layout limpio (centrado, sin sidebar, fondo con gradiente oscuro). | `app/(auth)/layout.tsx` | Layout renderiza children centrados sin sidebar. |
| A-5 | Verificar que `next dev` compila y las rutas existentes (`/command-center`, `/asset-studio`, `/campaign-review`) siguen funcionando. | — | Smoke test manual: 3 rutas responden 200. |

### Fase B: Login UI

| WBS | Tarea | Archivos | Criterio de Aceptación |
|-----|-------|----------|----------------------|
| B-1 | Crear `app/(auth)/auth/login/page.tsx` con formulario completo (email, password, submit, error display). Usar shadcn `Card`, `Input`, `Button`, `Label`. | `app/(auth)/auth/login/page.tsx` | Formulario renderiza. Campos validan con Zod. |
| B-2 | Implementar lógica de `signInWithPassword` en el formulario. En éxito: `router.push(redirectTo)`. En error: mostrar mensaje. | Mismo archivo | Login con credenciales válidas redirige. Login con credenciales inválidas muestra error. |
| B-3 | Eliminar `app/auth/login/page.tsx` (stub anterior). | Eliminación | Archivo no existe en disco. |
| B-4 | Crear `app/(auth)/auth/callback/route.ts` para intercambio de código OAuth. | `app/(auth)/auth/callback/route.ts` | GET con `?code=...` intercambia sesión y redirige. |

### Fase C: Middleware & Route Guards

| WBS | Tarea | Archivos | Criterio de Aceptación |
|-----|-------|----------|----------------------|
| C-1 | Actualizar `middleware.ts` → `updateSession()` con la nueva lógica de `PROTECTED_PREFIXES` y `AUTH_ROUTES`. Incluir `redirectTo` en el query string. | `utils/supabase/middleware.ts` | `/command-center` sin sesión → redirect a `/auth/login?redirectTo=/command-center`. |
| C-2 | Verificar que `/auth/login` con sesión activa redirige a `/command-center`. | — | Test manual: usuario logueado que visita `/auth/login` es redirigido. |
| C-3 | Verificar que `/asset-studio` y `/campaign-review` sin sesión redirigen a login. | — | Test manual: ambas rutas redirigen. |

### Fase D: Pulido y Metadata

| WBS | Tarea | Archivos | Criterio de Aceptación |
|-----|-------|----------|----------------------|
| D-1 | Actualizar `app/page.tsx` (landing) para hacer redirect a `/command-center`. | `app/page.tsx` | `/` redirige a `/command-center` (y middleware aplica guard si no hay sesión). |
| D-2 | Actualizar metadata en `app/layout.tsx`: título "Teseo CRM", descripción real. | `app/layout.tsx` | `<title>` muestra "Teseo CRM". |
| D-3 | Smoke test E2E completo del flujo: anónimo → guard → login → form → submit → redirect → command-center con sidebar. | — | Flujo completo sin errores en consola. |

---

## 6. Orden de Ejecución para Night Coder

```
A-1 → A-2 → A-3 → A-4 → A-5 (checkpoint: build OK)
  ↓
B-1 → B-2 → B-3 → B-4 (checkpoint: login funcional)
  ↓
C-1 → C-2 → C-3 (checkpoint: guards activos)
  ↓
D-1 → D-2 → D-3 (checkpoint: sprint completo)
```

**Estimación total:** 13 tareas atómicas. ~2-3 horas de ejecución para Night Coder.

---

## 7. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Mitigación |
|--------|-------------|------------|
| Imports rotos al mover archivos a route groups | Alta | Los `@/` aliases no cambian. Solo paths relativos entre archivos movidos juntos. Verificar en A-5. |
| Parallel routes (`@detail`) rompen con nueva estructura | Media | Mover el directorio `inbox/` completo incluyendo `@detail/`. Next.js resuelve parallel routes relativo al segment. |
| `cookies()` / `headers()` warnings en Next 14 async | Baja | Ya están usando `await cookies()` en server.ts. Mantener patrón. |
| Variables de entorno Supabase no configuradas en dev | Baja | Verificar `.env.local` tiene `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY` antes de A-5. |

---

## 8. Fuera de Alcance (Sprint Futuro)

- OAuth social (Google, GitHub) — requiere configuración en Supabase Dashboard.
- Registro de nuevos usuarios (signup).
- Recuperación de contraseña (forgot password).
- Role-Based Access Control (RBAC) a nivel de UI.
- Session refresh automático con heartbeat en client.

---

**Siguiente paso:** Documentar decisión en este RFC y autorizar al Ejecutor (Night Coder) para iniciar Fase A.
