# Reporte Técnico de Ingestión y Webhooks (Bloque 17)

## 1. Análisis de Reglas de Ingestión (Knowledge Base)
De acuerdo a las reglas definidas en la base de conocimiento (`/Users/teseohome/Documents/teseokdb/compiled/meeting_webhooks_md_1776376891803.md`):
- **Webhook-Driven Ingestion:** Se prioriza un modelo de ingesta basado en eventos en tiempo real (push) como punto de partida.
- **Centralized Ingestion Gateway:** Todo tráfico debe entrar a través de un gateway de hooks centralizado (en este caso el CRM proxy), el cual simplifica la configuración externa, valida firmas, y normaliza los datos (Data Transformation & Normalization Layer) antes de desencadenar al agente.
- **Seguridad y Orquestación:** Obligación de usar validación de firmas (HMAC) para prevenir falsificaciones. Un "agente" se encarga de recibir el webhook, manejar estado/bloqueos, aplicar reglas de negocio y delegar.

## 2. Archivos que manejan la entrada y dependencias
Actualmente la arquitectura de entrada está dividida en dos componentes principales: el gateway proxy en *Mission Control* y el servidor Hono en el *Orquestador*.

- **Proxy / Gateway (Mission Control):** `src/mission-control/src/app/api/webhooks/tenant/[id]/[channel]/route.ts`
  - Recibe la petición externa, identifica al tenant (`id`), resuelve la URL del orquestador en caché/Supabase y redirige la petición a la ruta `/api/webhook/{channel}`.
- **Recepción en Orquestador:** `src/orchestrator/src/index.ts`
  - Contiene el servidor Hono con los endpoints de entrada (`/api/webhook`, `/api/webhook/telegram`, `/api/webhook/email`, `/api/webhook/web`).
  - Cada endpoint valida firmas, adquiere un lock de hilo (Checkpointer Lock) para evitar condiciones de carrera, usa un Adapter para normalizar y llama a LangGraph asíncronamente con un Callback de FinOps.
- **Adaptadores:** `src/orchestrator/src/adapters/factory.ts`
  - Transforma el payload propietario de cada canal en un `GenericMessage` unificado.
- **Grafo LangGraph y Nodo de Entrada:** `src/orchestrator/src/graph.ts` y `src/orchestrator/src/nodes/hydrate_context.ts`
  - El entrypoint del grafo es la transición `START -> hydrate`.
  - El nodo `hydrateContextNode` extrae la configuración del tenant (prompts y modelo) buscando en la caché o en la BD, usando `state.genericMessage?.metadata?.tenantId` inyectado previamente.

## 3. Dónde y cómo conectar los nuevos Webhooks (Formularios, Telegram, WhatsApp)

Considerando que Mission Control proxy envía el tráfico a `/api/webhook/{channel}`, se deben realizar las siguientes acciones en `src/orchestrator/src/index.ts` y `adapters`:

### WhatsApp
- **Situación:** En `index.ts`, la ruta principal para Meta está expuesta solo como `app.post('/api/webhook', ...)`.
- **Ajuste:** Para coincidir con el proxy (`channel = whatsapp`), se debe crear un alias o renombrar a `app.post('/api/webhook/whatsapp', ...)`.
- **Conexión LangGraph:** La llamada a `workflowApp.invoke()` seguirá operando como `fire-and-forget`, pero se requiere garantizar que `genericMsg.metadata.tenantId` se propague adecuadamente para que el nodo `hydrate` funcione por tenant.

### Telegram
- **Situación:** Ya existe `app.post('/api/webhook/telegram', ...)` que encaja perfecto con la estructura del CRM Proxy.
- **Ajuste:** Verificar que el proxy no purgue o descarte el header `x-telegram-bot-api-secret-token` necesario para la validación de seguridad. La conexión al grafo de LangGraph funciona mediante `chatId` en lugar de número telefónico.

### Formularios (Nuevo Canal)
- **Situación:** No existe un endpoint para manejar formularios.
- **Ajustes y Conexión:**
  1. Crear `app.post('/api/webhook/forms', ...)` en `src/orchestrator/src/index.ts`.
  2. Implementar un `FormsAdapter` en la fábrica para transformar JSON estándar de formularios (ej. Tally, Typeform) en un `GenericMessage`. El `senderId` o `thread_id` en LangGraph debería ser el email o teléfono proveniente del lead para rastreabilidad.
  3. Ejecutar `workflowApp.invoke(...)` pasando los datos del formulario estructurados (ej. como un mensaje de sistema o de instrucción implícita para que el `gatekeeper` decida rutearlo hacia `campaign` o `sdr` directamente).
  4. Responder rápidamente con un status 200 OK para evitar reintentos del webhook del proveedor.

## Conclusión
El pipeline de entrada cumple rigurosamente con los patrones de la base de conocimiento: separación de gateway/proxy, normalización de payload e invocación inteligente basada en eventos. Para finalizar el Bloque 17, el esfuerzo reside en alinear la URL de WhatsApp con la lógica del CRM proxy e implementar la ruta y el Adapter correspondiente para `Formularios` en el orquestador.