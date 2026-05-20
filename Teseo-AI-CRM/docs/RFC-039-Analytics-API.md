# RFC-039: Route Handler para Capa Analítica (Next.js)

## 1. Objetivo
Exponer de manera segura los datos generados por los RPCs de Supabase (`rpc_get_leads_by_status` y `rpc_get_conversion_metrics`) al Dashboard Frontend del Tenant OS.

## 2. Decisiones Arquitectónicas (Builder)

### 2.1. Route Handler Unificado
Se ha creado un único endpoint `GET /api/analytics` que consolida ambas llamadas a base de datos.
- **Razón:** Minimizar el número de peticiones HTTP desde el cliente (Frontend) y aprovechar el paralelismo de I/O en el servidor.
- **Mecanismo:** Uso de `Promise.all` para ejecutar ambos RPCs simultáneamente en el backend (Node.js/V8).

### 2.2. Seguridad (Zero-Trust)
- Invocación de `supabase.auth.getUser()` antes de cualquier ejecución SQL. Si la sesión no es válida, la solicitud es rechazada inmediatamente con un `HTTP 401 Unauthorized`.
- Prevención de exposición de errores internos: Los fallos de la base de datos se imprimen en los logs del servidor (Cloud Run), pero se retorna un `HTTP 500` genérico al cliente.

## 3. Implementación (Night Coder)
- Archivo creado: `/app/api/analytics/route.ts`
- Librería de base de datos: `@supabase/ssr` (mediante `@/utils/supabase/server`).
- Manejo de valores nulos implementado en `conversionMetricsReq.data[0]` por si la tabla `leads` se encuentra completamente vacía.

## 4. Próximos Pasos (Frontend)
El equipo de UI debe implementar la recolección de esta ruta a través de TanStack Query en la vista del Dashboard. Se recomienda configurar un `staleTime` agresivo (mínimo 5 minutos) en el hook del cliente para no sobrecargar la base de datos con re-peticiones analíticas por cada re-foco de ventana.
