# Reporte de Impacto: Command Center API Routes

## 1. Resumen Ejecutivo
El presente documento detalla el análisis de impacto para la implementación de las API Routes del Command Center según el [RFC-Command-Center-API.md](./RFC-Command-Center-API.md). La integración establecerá una arquitectura basada en Server-Sent Events (SSE) y Supabase SSR para el manejo de interrupciones (handoff) y actualizaciones en tiempo real del CRM.

## 2. Restricciones Inquebrantables (Extraídas de TeseoKDB)
Al cruzar la arquitectura propuesta con los precedentes documentados en la bóveda de conocimiento (TeseoKDB), se imponen las siguientes reglas técnicas de obligado cumplimiento:

1. **Formato y Parseo de Server-Sent Events (SSE):** 
   - *Patrón estricto:* Los flujos SSE suelen encapsular cargas dobles (p. ej., "JSON inside SSE inside JSONRPC"). El endpoint `/api/threads/events` debe asegurar que los eventos emitidos sean estandarizados (con el prefijo `data: ` y un salto de línea doble).
   - En el cliente, el parseo de la línea SSE a JSON debe contemplar el bloque de datos con validaciones ante posibles buffers incompletos o estructuras anidadas.
2. **Agnosticismo del framework en lógica de negocio (`core/` u abstracciones compartidas):**
   - Cualquier lógica aislada de estado o caché (Zustand, abstracciones de hooks) debe tener **cero dependencias de Next.js** (queda prohibido importar `next/navigation`, `next/link`, o `next/headers` en las capas ajenas a App Router).
3. **Middleware Middleware / Proxy:**
   - La base de código actualmente usa `middleware.ts` (Next.js 14). Toda la protección de Supabase SSR (verificación de JWT y establecimiento de `tenant_id`) debe aplicarse allí mediante `matcher`, y no delegarse a comprobaciones manuales dentro de cada Route Handler para garantizar la seguridad zero-trust y evitar filtraciones entre tenants.
   - Es mandatorio garantizar que las operaciones SSR o el manejo de cookies dentro de rutas API manejen los tokens respetando las directivas Edge de Supabase (uso de `@supabase/ssr`).

## 3. Estructura de Archivos (Zona de Código)
Tras revisar el directorio `/Users/teseohome/projects/Teseo-AI-CRM/crm-agentico-panel/`, se confirma que el directorio `app/api` aún no existe.

### Archivos a Crear:
1. `app/api/threads/route.ts` (Manejará `GET` y `POST`).
2. `app/api/threads/[id]/handoff/route.ts` (Manejará el `POST` para la interrupción del operador manual).
3. `app/api/threads/events/route.ts` (Manejará el `GET` devolviendo un `ReadableStream` para SSE).
4. `types/threads.ts` (o archivo similar en `/types`, para las interfaces `Thread`, `Message`, y `HandoffPayload`).

### Archivos a Modificar:
1. `middleware.ts` (Ajustar el `matcher` del edge middleware para proteger `/api/threads/:path*` y configurar la inyección de contexto Supabase SSR).
2. `package.json` (Solo si hiciera falta agregar librerías de validación como `zod` sugeridas en el RFC, aunque se asumen previamente instaladas).

## 4. Próximos Pasos (Executor)
El `Ejecutor` debe proceder exclusivamente con la creación y modificación de los archivos mencionados, respetando las rutas y las restricciones de TeseoKDB. El frontend del Command Center delegará su reactividad a los TanStack Query hooks, los cuales deberán escuchar la ruta SSE para invalidar cachés.