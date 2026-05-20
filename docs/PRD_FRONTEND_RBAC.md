# PRD: Frontend RBAC Guards & UI Synchronization

**Proyecto:** Teseo-AI-CRM
**Agente Responsable:** Builder
**Fecha:** 25 de Abril de 2026

---

## 1. Objetivo y Alcance
Implementar controles de acceso basados en roles (RBAC) en el frontend (UI y Enrutamiento) para asegurar que solo los usuarios autorizados (`admin`, `owner`, `member`) puedan visualizar layouts, páginas y elementos de navegación específicos. Se elimina la dependencia de `user_metadata` desincronizada a favor de la tabla `tenant_users`.

## 2. Solución Arquitectónica

### 2.1 Principios de Diseño (SOLID y DRY)
- **Single Responsibility Principle (SRP):** La lógica de obtención y validación del rol se centraliza en un único servicio (`utils/server/rbac.ts`). Los componentes UI (Sidebar) solo consumen, no calculan reglas de acceso.
- **Don't Repeat Yourself (DRY):** Las validaciones de los layouts no se copian y pegan; se implementa una función unificada (`enforceRoleAccess`) que evalúa el rol de la base de datos contra los roles permitidos.
- **Inversion of Control:** El componente de Sidebar recibe la estructura ya declarada y evaluada, delegando las configuraciones al manifiesto `menu-items.ts`.

### 2.2 Fuente de Verdad para Roles
En los Server Components, se consultará de forma asíncrona a `tenant_users` basándose en el ID de usuario del JWT activo. Esto garantiza el estado real de la base de datos en cada navegación principal del servidor. 

### 2.3 Patrones a Implementar
1. **Utility HOC / Validador Server-Side:** En Next.js App Router (Server Components), el patrón más eficiente es invocar una función asíncrona al principio del `layout.tsx` o `page.tsx` protegido. Si falla, invoca `redirect('/unauthorized')` o `notFound()`.
2. **Sidebar Condicional:** Declarar explícitamente `allowedRoles?: UserRole[]` en la tipificación de `menu-items.ts`. Modificar la hidratación del menú en `AppSidebar` usando la misma función de obtención de rol.

---

## 3. Work Breakdown Structure (WBS) - Ejecutor

A continuación se desglosan las tareas para el Ejecutor. Ninguna tarea requiere modificar triggers ni bases de datos.

### Fase 1: Capa de Servicio (Core RBAC)
1. **Crear enumeraciones/tipos de Rol (si no existen globalmente):**
   - Archivo: `types/rbac.ts` (o existente).
   - Tipos: `type UserRole = "owner" | "admin" | "member";`
2. **Crear utilidad Server-Side para RBAC:**
   - Archivo: `utils/server/rbac.ts`.
   - Función `getTenantRole(userId: string): Promise<UserRole | null>`: Realiza un `select` a la tabla `tenant_users` devolviendo el rol.
   - Función `enforceRoleAccess(allowedRoles: UserRole[]): Promise<void>`: Obtiene el `userId` de la sesión de Supabase, obtiene el rol con `getTenantRole`, e invoca `redirect('/unauthorized')` si no está en `allowedRoles`.

### Fase 2: Sincronización de UI (Sidebar y Menú)
1. **Actualizar el Manifiesto del Menú:**
   - Archivo: `components/layout/menu-items.ts`.
   - Acción: Agregar la propiedad `allowedRoles: ['owner', 'admin']` (y otras combinaciones) a las rutas que son solo de administración (ej. configuración, gestión de usuarios, inquilinos). Las vistas generales pueden omitir el parámetro o incluir `member`.
2. **Sincronizar el Dashboard Layout:**
   - Archivo: `app/(dashboard)/layout.tsx`.
   - Acción: Reemplazar la extracción `role: user.user_metadata?.role` por la llamada asíncrona a `getTenantRole(user.id)`. Pasar este rol verídico al componente `AppSidebar`.

### Fase 3: Protección de Layouts y Rutas
1. **Crear la vista de No Autorizado:**
   - Archivo: `app/unauthorized/page.tsx` o usar un `not-found.tsx` personalizado.
   - Acción: Pantalla simple que informe sobre falta de permisos y botón para volver al Dashboard principal.
2. **Proteger Rutas de Administración (Guards en Layouts):**
   - Archivo(s): `app/(dashboard)/admin/layout.tsx` (y cualquier otra ruta detectada solo para Admins/Owners).
   - Acción: Al inicio de cada Server Component protegido, inyectar:
     ```typescript
     await enforceRoleAccess(['owner', 'admin']);
     ```
   - Si no cumple, el flujo es redirigido automáticamente a `/unauthorized` antes de renderizar la UI.

---

**Criterios de Aceptación:**
- Ningún usuario `member` puede ver los menús de administración en la barra lateral.
- Intentar acceder manualmente (URL directa) a un layout de administración rechaza la conexión redirigiendo al usuario en el servidor.
- El rol se obtiene siempre de la base de datos `tenant_users` en el servidor, no del `user_metadata` del cliente.