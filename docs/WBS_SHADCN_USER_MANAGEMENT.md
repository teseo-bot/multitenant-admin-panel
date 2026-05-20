# WBS — Shadcn UI + Panel de Gestión de Usuarios (Control Panel Layout)

> **Decreto de referencia:** `docs/DOMAIN_BOUNDARIES.md` (22 Abril 2026)  
> **Dominio:** CRM Agéntico (`Teseo-AI-CRM`) — aislamiento total de fleetco-plus  
> **App target:** `crm-agentico-panel/`  
> **Fecha de elaboración:** 22 Abril 2026, Night Run

---

## 0. Estado Actual del Proyecto (Auditoría Pre-WBS)

| Aspecto | Estado |
|---|---|
| **Shadcn UI inicializado** | ✅ Ya existe `components.json` (style: `base-nova`, RSC: true, icons: lucide) |
| **Tailwind CSS** | ✅ Configurado con CSS variables (oklch), dark mode, sidebar tokens |
| **`globals.css`** | ✅ Importa `tw-animate-css` + `shadcn/tailwind.css` |
| **Componentes UI existentes** | 23 primitivos: avatar, badge, button, card, chart, dialog, dropdown-menu, input, label, resizable, scroll-area, select, separator, sheet, sidebar, skeleton, slider, sonner, switch, table, tabs, textarea, tooltip |
| **Layout `(dashboard)`** | ✅ Funciona como layout principal con `AppSidebar` + `SidebarInset` |
| **Layout `(auth)`** | ✅ Centrado simple para login |
| **Layout "Control Panel"** | ❌ No existe — la ruta `admin/resilience` vive dentro de `(dashboard)` |
| **Gestión de usuarios** | ❌ No existe ninguna ruta ni componente |

### Conclusión de Auditoría

**No se necesita ejecutar `npx shadcn-ui@latest init`** — Shadcn ya está inicializado y funcional. Lo que se requiere es:
1. Crear el route group `(control-panel)` con su propio layout diferenciado.
2. Añadir componentes Shadcn faltantes específicos para user management.
3. Construir el Panel de Gestión de Usuarios dentro de ese layout.
4. Migrar `admin/resilience` de `(dashboard)` a `(control-panel)`.

---

## 1. Mapeo de Layouts según Decreto

| Layout Oficial | Route Group | Propósito | Sidebar |
|---|---|---|---|
| **Mission Control** | `(dashboard)` | Operación táctica: Command Center, Inbox, Asset Studio, Campaign Review, Analytics | `AppSidebar` actual (operacional) |
| **Control Panel** | `(control-panel)` ← **NUEVO** | Administración: Gestión de Usuarios, Resilience/DLQ, Settings | `ControlPanelSidebar` nueva (admin) |

---

## 2. WBS — Estructura de Trabajo

### Fase 1: Componentes Shadcn Faltantes (instalar)

Ejecutar desde `crm-agentico-panel/`:

```bash
cd /Users/teseohome/projects/Teseo-AI-CRM/crm-agentico-panel

# Componentes requeridos para User Management que NO existen aún
npx shadcn@latest add alert-dialog    # Confirmar eliminación/desactivación de usuarios
npx shadcn@latest add breadcrumb      # Navegación en Control Panel
npx shadcn@latest add checkbox         # Selección múltiple en tabla de usuarios
npx shadcn@latest add command          # Command palette / búsqueda de usuarios
npx shadcn@latest add form             # Formularios de creación/edición (react-hook-form)
npx shadcn@latest add pagination       # Paginación de tabla de usuarios
npx shadcn@latest add popover          # Filtros y date pickers
npx shadcn@latest add radio-group      # Selección de roles
npx shadcn@latest add toast            # Notificaciones de acciones (alternativa a sonner si se prefiere)
npx shadcn@latest add toggle           # Toggle de estado activo/inactivo
npx shadcn@latest add toggle-group     # Filtros de vista
```

> **Nota:** `sonner` ya está instalado. Se pueden omitir `toast` si se prefiere mantener solo `sonner`.  
> `react-hook-form` y `zod` ya están en `package.json` — `form` los aprovecha directamente.

### Fase 2: Layout "Control Panel" — Estructura de Archivos

```
crm-agentico-panel/
├── app/
│   ├── (control-panel)/                        ← NUEVO route group
│   │   ├── layout.tsx                           ← Control Panel Layout
│   │   ├── admin/
│   │   │   ├── page.tsx                         ← Dashboard admin (overview)
│   │   │   ├── users/
│   │   │   │   ├── page.tsx                     ← Tabla de usuarios (listado principal)
│   │   │   │   ├── new/
│   │   │   │   │   └── page.tsx                 ← Crear usuario (formulario)
│   │   │   │   └── [userId]/
│   │   │   │       ├── page.tsx                 ← Detalle/edición de usuario
│   │   │   │       └── activity/
│   │   │   │           └── page.tsx             ← Log de actividad del usuario
│   │   │   └── resilience/
│   │   │       └── page.tsx                     ← Migrar desde (dashboard)/admin/resilience
│   │   └── settings/                            ← Placeholder para futuras settings
│   │       └── page.tsx
│   ├── api/
│   │   └── admin/
│   │       ├── users/
│   │       │   ├── route.ts                     ← GET (list) + POST (create)
│   │       │   └── [userId]/
│   │       │       ├── route.ts                 ← GET + PATCH + DELETE
│   │       │       └── activity/
│   │       │           └── route.ts             ← GET activity log
│   │       └── dlq/                             ← Ya existe
│   │           └── ...
├── components/
│   ├── layout/
│   │   ├── app-sidebar.tsx                      ← Ya existe (Mission Control)
│   │   └── control-panel-sidebar.tsx            ← NUEVO sidebar admin
│   └── user-management/                         ← NUEVO dominio de componentes
│       ├── users-table.tsx                      ← DataTable con columnas, filtros, paginación
│       ├── users-table-columns.tsx              ← Definición de columnas (TanStack Table)
│       ├── users-table-toolbar.tsx              ← Barra de búsqueda + filtros
│       ├── user-form.tsx                        ← Formulario crear/editar (react-hook-form + zod)
│       ├── user-detail-card.tsx                 ← Card de resumen del usuario
│       ├── user-role-badge.tsx                  ← Badge visual por rol
│       ├── user-status-toggle.tsx               ← Toggle activo/inactivo
│       ├── user-delete-dialog.tsx               ← AlertDialog de confirmación
│       ├── user-activity-log.tsx                ← Timeline de actividad
│       └── user-invite-dialog.tsx               ← Dialog para invitar usuarios
├── lib/
│   ├── validators/
│   │   └── user.ts                              ← Schemas Zod para User
│   └── api/
│       └── users.ts                             ← Client-side fetchers (TanStack Query)
├── hooks/
│   ├── use-users.ts                             ← useQuery/useMutation hooks
│   └── use-user-filters.ts                      ← Estado de filtros con URL search params
└── types/
    └── user.ts                                  ← Tipos TypeScript para User, Role, etc.
```

### Fase 3: Detalle de Componentes Clave

#### 3.1 `(control-panel)/layout.tsx`

```tsx
// Layout dedicado para administración — sidebar propia, sin mezclar con Mission Control
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ControlPanelSidebar } from "@/components/layout/control-panel-sidebar";

export default function ControlPanelLayout({ children }: { children: React.ReactNode }) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <ControlPanelSidebar />
        <SidebarInset className="min-w-0 overflow-hidden h-screen">
          {children}
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  );
}
```

#### 3.2 `control-panel-sidebar.tsx` — Navegación admin

```
Control Panel
├── Overview         → /admin
├── Users            → /admin/users
│   ├── All Users
│   └── Invite User
├── Resilience       → /admin/resilience
└── Settings         → /settings
```

Iconos sugeridos (Lucide): `Users`, `Shield`, `Settings`, `Activity`, `LayoutDashboard`

#### 3.3 `users-table.tsx` — Columnas de la tabla

| Columna | Tipo | Componente |
|---|---|---|
| Checkbox | Selección | `<Checkbox>` |
| Avatar + Nombre | Texto + imagen | `<Avatar>` + texto |
| Email | Texto | Plain text |
| Rol | Badge | `<UserRoleBadge>` (admin, operator, viewer) |
| Estado | Toggle | `<UserStatusToggle>` (activo/inactivo) |
| Última actividad | Fecha relativa | Texto |
| Acciones | Dropdown | `<DropdownMenu>` (editar, ver actividad, eliminar) |

#### 3.4 `user-form.tsx` — Schema Zod

```ts
// lib/validators/user.ts
import { z } from "zod";

export const userFormSchema = z.object({
  name: z.string().min(2, "Nombre requerido"),
  email: z.string().email("Email inválido"),
  role: z.enum(["admin", "operator", "viewer"]),
  isActive: z.boolean().default(true),
});

export type UserFormValues = z.infer<typeof userFormSchema>;
```

### Fase 4: Dependencia Adicional (TanStack Table)

```bash
cd /Users/teseohome/projects/Teseo-AI-CRM/crm-agentico-panel
npm install @tanstack/react-table
```

> `@tanstack/react-query` ya está instalado — se reutiliza para fetching.

### Fase 5: Migración de `admin/resilience`

```bash
# Mover de (dashboard) a (control-panel)
mv crm-agentico-panel/app/(dashboard)/admin \
   crm-agentico-panel/app/(control-panel)/admin
```

> Verificar que los imports relativos no se rompan. La API route (`app/api/admin/dlq/`) NO se mueve — las API routes son independientes del layout.

---

## 3. Orden de Ejecución para el Ejecutor

| # | Tarea | Dependencia | Estimación |
|---|---|---|---|
| **1** | Instalar componentes Shadcn faltantes (Fase 1) | — | 5 min |
| **2** | Instalar `@tanstack/react-table` (Fase 4) | — | 1 min |
| **3** | Crear `types/user.ts` + `lib/validators/user.ts` | — | 10 min |
| **4** | Crear `(control-panel)/layout.tsx` + `control-panel-sidebar.tsx` | #1 | 20 min |
| **5** | Migrar `admin/resilience` a `(control-panel)` (Fase 5) | #4 | 5 min |
| **6** | Crear `admin/page.tsx` (overview placeholder) | #4 | 10 min |
| **7** | Crear `lib/api/users.ts` + `hooks/use-users.ts` | #3 | 15 min |
| **8** | Crear `app/api/admin/users/` routes (CRUD) | #3 | 25 min |
| **9** | Crear componentes `user-management/` (tabla, form, dialogs) | #1, #2, #3, #7 | 45 min |
| **10** | Crear páginas de usuario: listado, nuevo, detalle, actividad | #4, #9 | 30 min |
| **11** | Actualizar `AppSidebar` con enlace a Control Panel | #4 | 5 min |
| **12** | Smoke test: navegación entre layouts, CRUD de usuarios | #10 | 15 min |

**Total estimado: ~3 horas**

---

## 4. Reglas para el Ejecutor

1. **No tocar `src/mission-control/`** — es un dominio separado.
2. **No importar nada de `(dashboard)/`** en `(control-panel)/` ni viceversa — los componentes compartidos viven en `components/ui/` (primitivos Shadcn) y `components/layout/` (sidebars).
3. **No crear layouts adicionales** fuera de los dos oficiales + auth + root.
4. **Todos los componentes de user-management son exclusivos** del dominio `components/user-management/` — no se reutilizan componentes de `asset-studio/`, `campaign-review/`, etc.
5. **CSS variables existentes** — no modificar `globals.css` a menos que se necesiten tokens nuevos específicos para Control Panel.
6. **Supabase** — las API routes de users deberán usar `@supabase/ssr` igual que las existentes para auth.
