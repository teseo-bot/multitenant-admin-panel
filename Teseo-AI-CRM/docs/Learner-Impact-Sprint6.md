# Learner Impact Report - Sprint 6: Puente de Eventos Asíncronos (Supabase -> LangGraph)

**Fecha:** 21 de Abril de 2026
**Autor:** Learner (Subagent)
**Contexto:** Preparación para RFC-033 (Asignación autónoma de SDR e Inicialización de Grafos LangGraph desde webhooks de Supabase).

## 1. Objetivo de la Investigación
Identificar el estado actual del proyecto (Supabase/Next.js y el orquestador Hono/LangGraph), así como las directivas previas (RFCs, ADRs) que impactan directamente el diseño del puente de eventos que notificará a LangGraph cuando un nuevo Lead se inserte en la base de datos para iniciar su flujo.

---

## 2. Impacto de Arquitecturas Pre-existentes (Directivas KDB & Docs)

El Builder deberá diseñar el RFC-033 respetando las siguientes convenciones y patrones arquitectónicos ya aprobados:

### A. Gestión de Estado y Concurrencia (RFC-003)
- **Contexto:** `RFC-003-LANGGRAPH-ORCHESTRATOR.md` define que el estado efímero se maneja mediante `PostgresCheckpointer` y requiere de un `thread_id` único por contexto.
- **Impacto para RFC-033:** Al recibir el webhook de Supabase para un nuevo Lead, el orquestador LangGraph deberá encargarse de generar (o adoptar) este `thread_id` e invocar el grafo de inicio, persistiendo la llave en la tabla de `leads` para subsecuentes conversaciones.

### B. Arquitectura de Hono Reverse Webhook y Seguridad (RFC-012)
- **Contexto:** `RFC-012_LangGraph_Reverse_Webhook.md` instauró el patrón "Push" desde el CRM al Orquestador (Cloud Run) a través de un endpoint protegido en la app Hono (`POST /api/internal/config`) validado mediante un middleware Server-to-Server usando `INTERNAL_API_KEY`.
- **Impacto para RFC-033:** El puente para asignar agentes en Leads deberá reciclar esta topología creando una ruta similar (ej. `POST /api/internal/leads/assign`) en Hono, protegida por el mismo middleware de autenticación (Bearer Token) para asegurar que solo Supabase gatille la asignación.

### C. Idempotencia y Política Fail-Safe (RFC-019, RFC-020, ADR-116)
- **Contexto:** Documentos previos abordaron la comunicación LangGraph $\rightarrow$ CRM. Se exigió que todo webhook enviara un `X-Idempotency-Key` y usara promesas flotantes (fire-and-forget) para no bloquear.
- **Impacto para RFC-033:** Para la dirección contraria (Supabase $\rightarrow$ LangGraph), Supabase enviará repetidas notificaciones si falla la red. LangGraph debe implementar un escudo de idempotencia al recibir el payload, validando si el `lead_id` ya tiene un `thread_id` iniciado (ej. `lead_id` y su estado) para no spawnear dos SDRs o corromper el checkpointer.

---

## 3. Estado Actual de la Base de Datos (Next.js/Supabase)

Al revisar el esquema actual (`20260421000002_command_center_schema.sql`), se extraen las siguientes observaciones clave:

1. **Estructura de la Tabla `leads`:**
   - La tabla soporta la arquitectura requerida: cuenta con la columna `assigned_node` que es un `ENUM ('gatekeeper','sdr','hunter','admin','unassigned')` con valor por defecto `'unassigned'`.
   - Posee una columna vital: `thread_id TEXT UNIQUE`, la cual se correlaciona con la exigencia de memoria de `RFC-003`.
   - Maneja el ciclo de vida vía `status` (`'New'`, `'Contacted'`, etc.).

2. **Ausencia Actual de Database Webhooks / Triggers de Red:**
   - Actualmente **no existen triggers** en las migraciones de Supabase (ni llamadas a `pg_net.http_post`, ni configuraciones nativas de Database Webhooks en el proyecto) para notificar inserciones de la tabla `leads` hacia sistemas externos.
   - Solo existen triggers `BEFORE UPDATE` básicos para refrescar la columna `updated_at` (`trg_leads_updated_at`).

---

## 4. Consideraciones Obligatorias para el Builder en RFC-033

Basado en la investigación, el Builder debe responder y definir los siguientes puntos en el RFC-033:

1. **Mecanismo de Webhook en Supabase:** 
   - Definir si se utilizará la extensión `pg_net` de PostgreSQL dentro de un Trigger asíncrono (`AFTER INSERT ON leads WHERE assigned_node = 'unassigned'`), o si se configurará mediante la abstracción "Database Webhooks" nativa de Supabase.
   - Definir qué secretos (ej. `INTERNAL_API_KEY`) se inyectarán en la BD para firmar la petición http de salida hacia LangGraph (Hono).

2. **Capa de Idempotencia en Hono (LangGraph):**
   - Cómo evitar la ejecución duplicada del sub-grafo del SDR. Se recomienda comprobar que `assigned_node` siga en `'unassigned'` y que `thread_id` sea nulo antes de ejecutar `workflow.invoke(...)`.

3. **Retroalimentación (Loop de Cierre):**
   - Inmediatamente después de que LangGraph genere el estado inicial y el `thread_id`, el orquestador debe realizar una llamada al CRM (utilizando el cliente diseñado en `RFC-020`) para mutar la tabla de `leads`, cambiando `assigned_node = 'sdr'` y guardando el nuevo `thread_id`.

4. **Escalamiento y Dead-Letter Queue (Resiliencia):**
   - Definir la estrategia si el contenedor de LangGraph en Cloud Run está en escalamiento en frío (Cold Start) o inalcanzable. ¿Se confía en la política de retries predeterminada de Supabase pg_net (que tiene límites), o se requerirá un patrón Outbox en la DB?