# Reporte de Impacto: Estado de los Guards de Autenticación (RBAC) y Rutas Protegidas

**Fecha:** 25 de Abril de 2026
**Agente:** Learner
**Objetivo:** Investigar el estado actual de los guards de autenticación (RBAC), rutas protegidas en el frontend y cómo se consumen los roles desde Supabase en el proyecto Teseo-AI-CRM.

---

## 1. Middleware de Autenticación Frontend (`middleware.ts` & `utils/supabase/middleware.ts`)
- **Protección Básica (Autenticado vs No Autenticado):** El middleware está interceptando rutas para verificar la existencia del usuario (`supabase.auth.getUser()`). 
  - Protege un conjunto de prefijos: `/command-center`, `/asset-studio`, `/campaign-review`.
  - Redirige al login a usuarios no autenticados y al `/command-center` a usuarios ya autenticados que intentan entrar al login.
- **Vulnerabilidad de RBAC:** El middleware **no implementa controles de acceso basados en roles (RBAC)**. Cualquier usuario autenticado (sin importar si es `member`, `admin` u `owner`) puede acceder a cualquier ruta protegida en el cliente.

## 2. Consumo de Roles en la Interfaz (UI) y Enrutamiento Frontend
- **Fuente de Verdad Desincronizada en el Cliente:**
  El layout principal (`app/(dashboard)/layout.tsx`) inyecta el rol del usuario utilizando la metadata de autenticación: 
  `role: user.user_metadata?.role || "user"`
  Esto es problemático porque el rol real y específico por inquilino (tenant) reside en la tabla `tenant_users`. Usar `user_metadata` puede llevar a discrepancias si el rol cambia en base de datos y la sesión JWT no se ha forzado a refrescarse.
- **Ausencia de Guards en Rutas Frontend (Layouts/Pages):** 
  No existen restricciones de layouts (como `layout.tsx` de páginas específicas de administración) que lean el rol y devuelvan un `notFound()` o `redirect()` si el usuario no tiene los permisos suficientes.
- **Filtrado del Sidebar Inoperante:**
  El componente `AppSidebar.tsx` tiene lógica preparada para filtrar items del menú basándose en el rol (`item.allowedRoles.includes(user.role)`), **pero** el archivo de configuración `components/layout/menu-items.ts` no define `allowedRoles` para ningún enlace. En consecuencia, todos los enlaces son visibles para todos los roles.

## 3. Consumo de Roles en el Backend (API Routes)
- **Implementación Segura y Correcta:**
  A diferencia del frontend, las rutas de API (ej. `app/api/admin/users/route.ts`, `app/api/tenant/config/route.ts`) validan correctamente el RBAC. 
  Para cada petición, el backend cruza el ID del usuario autenticado contra la tabla `tenant_users`:
  ```typescript
  const { data: currentTenantUser } = await supabase
    .from("tenant_users")
    .select("tenant_id, role")
    .eq("user_id", currentUserId)
    .single();
  ```
  Y valida estrictamente contra la enumeración `UserRole` (`admin`, `owner`, `member`).

## 4. Impacto y Riesgos
- **Riesgo de UI/UX y Fuga de Contexto:** Un usuario con rol `member` puede acceder libremente a páginas destinadas a administradores o dueños del tenant (como configuración de tenant o la ruta visual de `/tenants`). 
- **Impacto de Seguridad Mitigado por el Backend:** Si un `member` intenta realizar una acción destructiva o de administración en estas páginas, el API de backend denegará la operación con un error HTTP 403, ya que la validación en el servidor es sólida. Sin embargo, mostrar UI no autorizada degrada la experiencia y expone la estructura de la aplicación.
- **Inconsistencia de Datos:** Confiar en `user.user_metadata.role` en la UI versus consultar `tenant_users` en el backend puede provocar estados fantasma donde un usuario degradado a `member` en base de datos aún ve la UI de `admin` hasta que su token JWT caduque o se vuelva a autenticar.

---

## Recomendaciones para Siguientes Pasos (Builder/Ejecutor)
1. **Actualizar el Layout/Middleware para obtener el rol real:** Utilizar `tenant_users` como la única fuente de la verdad para el estado de la UI (mediante un fetch al servidor en el layout del dashboard, o usando JWT custom claims administrados vía Supabase Hooks).
2. **Definir Guards en Layouts Restringidos:** Añadir validación de roles en el Server Component `layout.tsx` de las rutas que son solo de administración (ej. `/tenants`, `/admin`), aplicando redirecciones (HTTP 403 / 404).
3. **Poblar `allowedRoles` en el Sidebar:** Modificar `menu-items.ts` para que herramientas de administración solo sean visibles para los roles correspondientes.