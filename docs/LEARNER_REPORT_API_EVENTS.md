# Reporte de Investigación: Contexto para Webhook POST /api/campaigns/[id]/events

**Rol:** Learner (Investigador de Contexto / RAG Engineer)
**Objetivo:** Mapear la base de código actual para preparar la creación del webhook `POST /api/campaigns/[id]/events`.

## 1. Almacenamiento de Eventos de Campaña (Base de Datos)
Tras inspeccionar las migraciones de Supabase (específicamente `supabase/migrations/20260421000000_campaign_review_schema.sql`), se identificó que los eventos se almacenan en la tabla `public.campaign_events`.
La estructura y reglas principales son:
- **Campos Clave:** `id` (UUID), `campaign_id` (UUID, FK a campaigns), `event_type` (TEXT), `agent_role` (TEXT), `thread_id` (UUID), `lead_id` (UUID), `payload` (JSONB, default `{}`), `occurred_at` (TIMESTAMPTZ).
- **Restricciones (`event_type`):** Debe ser estrictamente uno de: `'message_sent'`, `'message_received'`, `'tool_call'`, `'handoff_request'`, `'handoff_completed'`, `'lead_qualified'`, `'lead_lost'`, `'state_change'`, `'error'`, `'manual_override'`.
- **Seguridad (RLS):** RLS está activo con la política `"tenant_isolation_campaign_events"`, que verifica de forma jerárquica a través del join con la tabla `campaigns` que el `tenant_id` de la campaña padre coincida con `current_setting('app.tenant_id', true)`.

## 2. Esquemas Zod e Interfaces TS
- **Interfaces TS:** En el archivo `crm-agentico-panel/types/campaign.ts` están definidas correctamente las interfaces `CampaignEvent` y los literales `CampaignEventType`.
- **Esquemas Zod:** No se encontraron esquemas de validación Zod preexistentes para las peticiones de eventos. Será necesario crear un Zod Schema en el Route Handler (o en la carpeta `lib/schemas`) para validar el body de las peticiones POST (`eventType`, `payload`, `agentRole`, etc.).

## 3. Seguridad SSR y Autenticación M2M (LangGraph)
- **Manejo SSR:** El flujo de autenticación de Next.js pasa por `crm-agentico-panel/utils/supabase/server.ts`, el cual captura automáticamente el header `Authorization` (Bearer token) y lo inyecta en el cliente de Supabase SSR.
- **Validación actual (Bloqueante para M2M):** El método `GET /api/campaigns/[id]/events` existente usa `await supabase.auth.getUser()`. Esta validación es estricta para usuarios logueados (operadores) e impide llamadas automatizadas (M2M) desde un orquestador que no sea un usuario de Supabase.
- **Impacto para el Webhook POST:** Los agentes de LangGraph realizarán peticiones M2M para inyectar eventos (p. ej. `tool_call` o `message_sent`). 
  * **Acción requerida para el Ejecutor:** El método `POST` debe soportar autorización M2M. Dado que el orquestador (`src/orchestrator/`) tiene acceso al `SUPABASE_SERVICE_ROLE_KEY` (como se observa en sus archivos `.env`), el webhook debe validar si el token Bearer recibido coincide con la llave de servicio y, de ser así, hacer un bypass explícito (bypassing `auth.getUser()`) o utilizar un token de API dedicado para agentes. Al usar el service role, la inserción ignora el RLS o requiere inyectar manualmente el rol si fuera necesario.

## Conclusión y Recomendación para el Ejecutor
El agente Ejecutor está listo para proceder. Deberá:
1. Exportar la función `POST` en `crm-agentico-panel/app/api/campaigns/[id]/events/route.ts`.
2. Validar con Zod el cuerpo del request antes de realizar cualquier interacción con Supabase.
3. Incorporar soporte de autenticación híbrido (usuario validado por `getUser` OR validación estricta de Service Role Key en el header `Authorization`) para posibilitar el registro de eventos por parte de los agentes LangGraph.
4. Asegurar la inserción en `campaign_events` con el `campaign_id` provisto en los `params`.