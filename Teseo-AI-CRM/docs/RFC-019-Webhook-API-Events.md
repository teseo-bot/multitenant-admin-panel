# RFC-019: Webhook API para Eventos de Campaña (LangGraph a CRM)

## 1. Objetivo y Contexto
Los orquestadores del backend en LangGraph (agentes Python/TS como SDR, Gatekeeper y Hunter) necesitan reportar en tiempo real todas las acciones que realizan durante una campaña (mensajes, llamadas a herramientas, cambios de estado, etc.). Este RFC define la arquitectura del webhook `POST /api/campaigns/[id]/events` que recibirá, validará y almacenará de forma segura estos eventos en la base de datos Supabase, soportando autenticación M2M (Machine-to-Machine) e idempotencia para evitar duplicados en caso de reintentos de red.

## 2. Esquemas de Petición y Respuesta (Zod)

El cuerpo de las peticiones deberá cumplir un contrato estricto validado por Zod antes de tocar la base de datos.

**Request Body Schema (Zod):**
```typescript
import { z } from 'zod';

export const CampaignEventCreateSchema = z.object({
  eventType: z.enum([
    'message_sent', 'message_received', 'tool_call', 
    'handoff_request', 'handoff_completed', 'lead_qualified', 
    'lead_lost', 'state_change', 'error', 'manual_override'
  ]),
  agentRole: z.string().min(1, "El rol del agente es requerido"),
  threadId: z.string().uuid().optional(),
  leadId: z.string().uuid().optional(),
  payload: z.record(z.any()).default({}),
  occurredAt: z.string().datetime().optional() // ISO 8601
});
```

**Headers Requeridos:**
- `Authorization: Bearer <TOKEN_O_SERVICE_KEY>`
- `X-Idempotency-Key: <UUID_O_HASH_UNICO>`

**Response Schemas:**
- **201 Created:** `{ "success": true, "data": { "id": "uuid-del-evento" } }`
- **400 Bad Request:** `{ "success": false, "error": "Validation Error", "issues": [...] }`
- **401 Unauthorized:** `{ "success": false, "error": "Unauthorized" }`
- **409 Conflict (Idempotent success):** `{ "success": true, "message": "Event already processed", "data": { "id": "uuid-existente" } }`
- **500 Internal Error:** `{ "success": false, "error": "Internal Server Error" }`

## 3. Seguridad y Autenticación M2M
A diferencia del frontend donde existe una sesión de usuario (`supabase.auth.getUser()`), las peticiones automatizadas de los agentes no tienen una sesión de usuario estándar.

**Flujo de Autorización Híbrida:**
1. Extraer el token del header `Authorization`.
2. **Validación M2M:** Si el token coincide con una variable de entorno segura como `M2M_API_KEY` (recomendado) o `SUPABASE_SERVICE_ROLE_KEY` del backend, se otorga acceso inmediato (bypassing `auth.getUser()`).
3. **Instancia de BD:** Al ser una petición validada como M2M, se utilizará el Supabase Admin Client (`createClient` con `service_role_key`) para insertar el evento. Dado que esto ignora las políticas RLS (`tenant_isolation_campaign_events`), el código debe validar programáticamente que el `campaign_id` exista antes de insertar.

## 4. Idempotencia
La naturaleza distribuida de LangGraph puede generar reintentos de red. Debemos asegurar que un evento reportado dos veces no se duplique en `campaign_events`.

**Estrategia:**
1. El cliente LangGraph debe enviar un header `X-Idempotency-Key` (ej. hash del contenido o ID único del mensaje/acción).
2. Se almacenará este valor dentro de la base de datos.
   - *Aproximación recomendada:* El Ejecutor debe crear una migración añadiendo la columna `idempotency_key` a la tabla `campaign_events` con una restricción `UNIQUE(campaign_id, idempotency_key)`.
   - *Alternativa (si no hay migración):* Extraer la key e insertarla explícitamente en el JSONB `payload: { _idempotency_key: "..." }`.
3. Si el webhook intercepta un error de restricción de unicidad al insertar (o encuentra la llave en una consulta previa), responderá con un HTTP 409 (Conflict) pero retornará `success: true` para que el orquestador lo marque como procesado.

## 5. Work Breakdown Structure (WBS) - Desglose para el Ejecutor

**Fase 1: Preparación de Base de Datos**
- [ ] Crear migración SQL en `supabase/migrations/` (ej. `20260421000001_add_idempotency_key.sql`) para agregar la columna `idempotency_key` (VARCHAR) a `public.campaign_events`.
- [ ] Añadir un constraint de unicidad: `UNIQUE(campaign_id, idempotency_key)`.
- [ ] Actualizar el archivo `types/supabase.ts` (generado) o actualizar las interfaces TS locales con el nuevo campo.

**Fase 2: Validaciones y Esquemas**
- [ ] Crear el archivo `crm-agentico-panel/lib/schemas/campaign-events.ts`.
- [ ] Implementar `CampaignEventCreateSchema` utilizando Zod, asegurando estrictamente los `eventType` permitidos.

**Fase 3: Desarrollo del Webhook**
- [ ] Crear/Modificar `crm-agentico-panel/app/api/campaigns/[id]/events/route.ts`.
- [ ] Implementar middleware o bloque de seguridad para extraer el Bearer Token y validar M2M (comparar contra `process.env.M2M_API_KEY` o `SUPABASE_SERVICE_ROLE_KEY`).
- [ ] Extraer y validar el header `X-Idempotency-Key`. Si no existe, retornar error 400.
- [ ] Validar `params.id` (UUID de la campaña) y el body de la petición usando el esquema Zod de la Fase 2.

**Fase 4: Inserción y Manejo de Errores**
- [ ] Instanciar Supabase Admin Client.
- [ ] Verificar la existencia de la campaña en la tabla `campaigns` (como mitigación al bypass de RLS).
- [ ] Intentar la inserción en `campaign_events`.
- [ ] Capturar errores de tipo *Unique Violation* (PG Code `23505`) en `idempotency_key` y devolver un 409.
- [ ] Retornar los códigos HTTP especificados en la sección de esquemas.