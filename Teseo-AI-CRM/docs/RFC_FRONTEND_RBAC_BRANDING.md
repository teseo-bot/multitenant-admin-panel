# RFC: Teseo-AI-CRM - Frontend RBAC, Branding & User Management

## 1. Contexto y Objetivo
El objetivo de este RFC es definir la arquitectura y los pasos de ejecución para solventar las discrepancias actuales entre el frontend, la base de datos (Supabase) y el tipado estricto en Teseo-AI-CRM.

**Hallazgos a resolver:**
1. **Branding:** Ausencia de infraestructura para la gestión y almacenamiento de logotipos de tenants.
2. **RBAC/Usuarios UI:** La interfaz `admin/users/page.tsx` actualmente opera con datos simulados (mocks).
3. **API de Usuarios:** El endpoint `app/api/admin/users/route.ts` realiza consultas directas e incorrectas a la tabla `users` (pública), ignorando el patrón de Supabase (`auth.users`) y su cruce con `tenant_users`.
4. **Tipos de Datos:** Existe un mismatch entre el esquema de roles en `lib/validators/user.ts` y la realidad de la base de datos.

---

## 2. Estructura de Datos Unificada para Roles

Para evitar problemas de tipado y sincronización, se debe establecer una única fuente de verdad para los roles dentro del sistema.

**Nuevo Tipado en `lib/validators/user.ts`:**
```typescript
export const UserRole = {
  OWNER: 'owner',
  ADMIN: 'admin',
  MEMBER: 'member',
} as const;

export type UserRoleType = typeof UserRole[keyof typeof UserRole];

export interface TenantUser {
  id: string; // auth.users.id
  tenant_id: string;
  role: UserRoleType;
  created_at: string;
}

export interface UserProfile extends TenantUser {
  email: string; // extraído de auth.users
  full_name: string | null; // opcional, si existe metadata
  avatar_url: string | null;
}
```
*La base de datos (PostgreSQL en Supabase) debe restringir los roles en `tenant_users` a estos valores exactos mediante un tipo ENUM o CHECK constraint.*

---

## 3. Flujo para la Subida de Logos (Supabase Storage)

La infraestructura de Branding requiere de un bucket dedicado y seguro.

1. **Bucket Config:** Crear (o usar) un bucket en Supabase Storage llamado `tenant-assets`.
2. **Políticas RLS:** 
   - `SELECT`: Público (o limitado a usuarios autenticados del mismo tenant, dependiendo del requerimiento de marca pública).
   - `INSERT`/`UPDATE`: Restringido a usuarios con rol `OWNER` o `ADMIN` en la tabla `tenant_users` para el tenant correspondiente.
3. **Flujo de Carga (Frontend):**
   - El cliente utiliza el Supabase JS Client (`supabase.storage.from('tenant-assets').upload(...)`).
   - La ruta del archivo debe seguir el patrón: `{tenant_id}/branding/logo-{timestamp}.png`.
   - Tras la carga exitosa, se obtiene la URL pública (`getPublicUrl`) y se actualiza la tabla `tenants` en el campo `logo_url`.

---

## 4. Arquitectura del Endpoint Unificado de Usuarios

El endpoint `app/api/admin/users/route.ts` debe reestructurarse bajo un enfoque de "Admin Auth Key", debido a que `auth.users` en Supabase no es accesible desde el cliente o mediante la API pública estándar sin privilegios.

**Flujo del Endpoint (GET /api/admin/users):**
1. **Verificación de Autorización:** Extraer la sesión actual y verificar que el usuario solicitante tiene rol `ADMIN` u `OWNER` en `tenant_users` del tenant activo.
2. **Instanciación del Cliente Admin:** Crear un cliente de Supabase usando el `SUPABASE_SERVICE_ROLE_KEY` para saltar RLS y poder listar usuarios.
3. **Extracción (Join en Memoria/Query):**
   - Obtener los registros de `tenant_users` para el `tenant_id` actual.
   - Usar `supabase.auth.admin.listUsers()` para obtener la lista de usuarios.
   - Hacer un *map/join* cruzando el `auth.users.id` con `tenant_users.id` para formar el array de `UserProfile`.
4. **Respuesta:** Enviar el array procesado al frontend.

---

## 5. Work Breakdown Structure (WBS) para el Ejecutor

El agente **Ejecutor** deberá seguir estrictamente estos pasos:

* **[Paso 1] Corrección de Tipos:**
  - Actualizar `lib/validators/user.ts` para que coincida con el esquema `UserRoleType` expuesto en este RFC.
  - Asegurar que cualquier dependencia que importe estos tipos (como Zod schemas) sea actualizada.

* **[Paso 2] Endpoint de API (Backend):**
  - Refactorizar `app/api/admin/users/route.ts`.
  - Eliminar las consultas directas y públicas a `users`.
  - Implementar la instancia de Service Role y cruzar `auth.admin.listUsers()` con los registros de la tabla `tenant_users` del tenant en curso.

* **[Paso 3] UI de Gestión de Usuarios (Frontend):**
  - Modificar `admin/users/page.tsx`.
  - Eliminar por completo los mocks hardcodeados.
  - Implementar la llamada asíncrona real hacia el endpoint unificado `/api/admin/users`.
  - Manejar los estados de carga (`loading`, `error`, `success`).

* **[Paso 4] Infraestructura de Branding UI (Frontend):**
  - Modificar o crear el componente de settings del Tenant (`admin/settings` o equivalente).
  - Integrar el Supabase JS client para gestionar la carga del logotipo hacia el bucket `tenant-assets` usando el path `{tenant_id}/branding/...`.
  - Actualizar el registro del `tenant` en la DB con la URL obtenida.

---

## 6. Directiva Técnica: Flexbox + ScrollArea (Overflow Prevention)

> **Regla obligatoria** — Aplica a todo componente de layout que combine Flexbox con `<ScrollArea>` (Shadcn UI / Radix).

### Problema

Cuando un contenedor `flex` (columna) envuelve directamente a un `<ScrollArea>`, el comportamiento por defecto de CSS Flexbox establece `min-height: auto` en los flex-children. Esto provoca que el hijo adopte la altura intrínseca de su contenido en lugar de respetar el espacio disponible del viewport, generando **crecimiento infinito** y rompiendo el scroll contenido.

### Regla

Todo contenedor `flex` que actúe como **padre directo** de un `<ScrollArea>` **debe** incluir una de las siguientes clases (Tailwind CSS):

| Clase | Efecto |
|---|---|
| `min-h-0` | Sobreescribe `min-height: auto` → permite que el hijo se encoja dentro del espacio flex disponible. **Opción preferida.** |
| `overflow-hidden` | Fuerza el contenedor a recortar contenido desbordado, logrando el mismo efecto de contención. |

**Ejemplo correcto:**
```tsx
{/* ✅ Correcto: min-h-0 permite que ScrollArea respete la altura del viewport */}
<div className="flex flex-col flex-1 min-h-0">
  <ScrollArea className="h-full">
    {children}
  </ScrollArea>
</div>
```

**Ejemplo incorrecto:**
```tsx
{/* ❌ Incorrecto: sin min-h-0 el contenido empuja la altura al infinito */}
<div className="flex flex-col flex-1">
  <ScrollArea className="h-full">
    {children}
  </ScrollArea>
</div>
```

### Trade-off resuelto

- **Sin la directiva:** Flexbox asume `min-height: auto`, lo que obliga al contenedor a expandirse hasta la altura intrínseca del contenido. El `<ScrollArea>` nunca activa su scroll interno porque su padre ya creció para mostrar todo, rompiendo layouts de viewport fijo (sidebars, paneles tri-columnares, inbox, kanban, etc.).
- **Con la directiva:** `min-h-0` (o `overflow-hidden`) permite que el flex-child se encoja al espacio asignado por el padre, activando correctamente el scroll interno del `<ScrollArea>` y manteniendo el layout contenido dentro del viewport.

### Aplicabilidad

Esta regla aplica a **todas las vistas del CRM** que utilicen `<ScrollArea>` dentro de layouts flex, incluyendo pero no limitado a:
- Global Layout tri-columnar (`app/layout.tsx`)
- Command Center (Kanban, Lead list)
- Inbox (split pane, message list)
- Dashboard (widgets scrollables)
- Asset Studio (paneles laterales)
- Cualquier componente futuro que combine flex + scroll
