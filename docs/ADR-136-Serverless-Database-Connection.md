# ADR 136: Migración a Supabase-js (HTTP/REST) en Entornos Serverless
**Fecha:** 22 Abril 2026
**Estado:** Aceptado

## Contexto
Durante las pruebas End-to-End (UAT) en Google Cloud Run, las rutas de Server-Sent Events (SSE) del Inbox fallaban sistemáticamente arrojando errores `XX000: Tenant or user not found` y `ECONNREFUSED`. 
El análisis reveló que Google Cloud Run restringe el tráfico a IPv4. Supabase deshabilitó el acceso IPv4 directo, obligando el uso de Supavisor (Pooler). Sin embargo, el protocolo TCP de la librería `pg` utilizado para `LISTEN/NOTIFY` es incompatible arquitectónicamente con un entorno Serverless que congela CPU entre peticiones.

## Decisión
Se prohíbe el uso de conexiones persistentes TCP (`pg.Pool`) dentro de Google Cloud Run para este proyecto.
1. Se migró la ruta `/api/leads/[id]/messages` a `@supabase/supabase-js`, operando exclusivamente sobre HTTP/REST (puerto 443).
2. Se reemplazó el uso de `LISTEN/NOTIFY` en el frontend por un patrón de Short-Polling (`refetchInterval: 3000`) en React Query.
3. Por seguridad, se eliminó la variable `DATABASE_URL` (que contenía contraseñas maestras) del contenedor.

## Consecuencias
- **Positivas:** Mayor resiliencia ante el congelamiento Serverless, nula dependencia a IPv6, mejor postura de seguridad (eliminación de password maestro en favor de JWT/RLS).
- **Negativas:** El tiempo real estricto (WebSockets/SSE) queda degradado temporalmente a pseudo-tiempo real (Polling de 3 segundos), con un ligero incremento en las llamadas a base de datos.
