# Learner Report - Bloque 29 (Tenant-Channel Mapping)

## 1. Contexto de la Investigación
De acuerdo a las instrucciones del Bloque 29, se ha analizado el PRD y la arquitectura propuesta para el "Conmutador Inteligente" (Tenant-Channel Mapping). El objetivo es enrutar los mensajes de los canales externos (WhatsApp, Telegram) hacia el Tenant correcto de forma dinámica, eliminando el "hardcoding" de variables y manteniendo la segregación estricta de datos (RLS).

## 2. Auditoría Topológica y Arquitectónica
- **Documentación Central:** Se validó que el diseño se apega a `RFC_TENANT_CHANNEL_MAPPING.md` y `PRD-BLOQUE29-Tenant-Channel-Mapping.md`.
- **TeseoKDB (Reglas Globales):** Se auditó la ruta `teseokdb/compiled/`. La única regla que afecta directamente el flujo es `ADR-OPENCLAW-RUNTIME-2026-04.md` la cual dicta directivas de instanciación con `context="fork"` para sub-agentes y manejo de timeouts para sesiones de larga duración.
- **Zona de Código:** Actualmente, el proyecto carece de la tabla `tenant_channels` en la base de datos y no cuenta con un manejador de webhooks (`app/api/webhooks/`) capaz de resolver esta capa en tiempo real. 

## 3. Matriz de Impacto en el Código Fuente (Archivos a Tocar)

Para que el agente Ejecutor implemente el PRD, se deberán modificar/crear los siguientes archivos:

### A. Base de Datos (Supabase)
*   **Crear:** `supabase/migrations/[timestamp]_create_tenant_channels_table.sql`
    *   **Acción:** Crear la tabla `tenant_channels` (`id`, `tenant_id`, `channel_type`, `channel_identifier`, `credentials`, `is_active`).
    *   **Restricción:** `UNIQUE(channel_type, channel_identifier)`.
    *   **Políticas RLS:** Implementar políticas de seguridad donde solo la Service Role Key o un Admin Global pueda modificar rutas, y las llamadas públicas de resolución funcionen solo en modo lectura estricto mediante un helper function (RPC) en Supabase para maximizar la velocidad.

### B. Backend (Next.js App Router / Middleware)
*   **Crear:** `app/api/webhooks/[channel]/route.ts` (o equivalentemente integrando Hono como indica `WBS-Hono-Webhook.md`).
    *   **Acción:** Endpoint que recibe los payloads de WhatsApp/Telegram.
    *   **Lógica:** Extraer `channel_type` (ej. de la URL) y `channel_identifier` (del JSON del proveedor). Consultar el mapeo dinámico.
    *   **Aislamiento:** Si la consulta arroja un `tenant_id`, inicializar el flujo subsecuente (LangGraph / Pg-Boss) inyectando este ID y creando el cliente de Supabase asumiendo la identidad de ese Tenant.
    *   **Fail-Safe:** Si no arroja un ID, descartar (HTTP 200 para evitar reintentos del proveedor, pero registrar un DROP en los logs).

*   **Crear:** `lib/tenant-resolver.ts` (Opcional / Recomendado)
    *   **Acción:** Módulo abstracto de resolución. Implementar el Cache (ej. In-memory cache simple usando Map temporal o Redis Upstash) para cumplir el requerimiento de resolución O(1) ante ráfagas de mensajes del mismo canal y evitar saturar Supabase.

### C. Mission Control (UI de Administración)
*   *Nota: Aunque la UI no se especificó como parte crítica inmediata en el PRD del Bloque 29, el Ejecutor deberá asegurar que la base de datos esté lista para exponer los endpoints CRUD de configuración.*

## 4. Consideraciones para el Ejecutor
- Seguir estrictamente las políticas de RLS ya consolidadas en `ADR-161-RLS-Bridge-TenantScopedClient.md` durante el paso de estado del request.
- No hacer hardcoding de números ni tokens; todo debe estar en la base de datos o en variables de entorno generales.