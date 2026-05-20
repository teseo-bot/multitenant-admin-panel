# RFC-020: Estrategia de Webhooks de LangGraph hacia Tenant OS

## 1. Resumen
Este documento define la arquitectura y el diseño para la emisión de webhooks desde el orquestador de LangGraph (Node.js/TypeScript) hacia el sistema core (Tenant OS). El objetivo es notificar eventos clave del negocio (ej. `LEAD_UPDATED`, `ESCALATED_TO_HUMAN`) que ocurren durante la interacción del agente.

## 2. Análisis de Alternativas (Opción A vs Opción B)

El Learner propuso dos caminos:
- **Opción A:** Inyectar la llamada de red directamente en cada Tool de LangGraph (ej. `updateLeadProfileTool`).
- **Opción B:** Implementar un Observer/Hook centralizado al finalizar la ejecución del grafo en `src/index.ts`.

### Evaluación:
- **Opción A** rompe el Principio de Responsabilidad Única (SRP) al mezclar la lógica de la herramienta (ej. parseo y mutación de estado) con la lógica de red/notificación. Además, rompe el principio DRY, ya que tendríamos que replicar el manejo de reintentos, logs de errores, y generación de `X-Idempotency-Key` en múltiples herramientas.
- **Opción B** es la **ganadora**. Centralizar el envío permite que las Tools sean funciones puras o de mutación simple. El orquestador, al terminar su ejecución, puede evaluar el estado final o el historial de mensajes (`result.messages`) para determinar qué eventos de negocio sucedieron y emitirlos en bloque o individualmente.

## 3. Diseño del Cliente HTTP (Tenant OS Client)

Se creará un servicio dedicado para aislar la comunicación HTTP con el Tenant OS.

**Características Clave:**
- **Cliente Nativo:** Uso de `fetch` nativo de Node.js, evitando dependencias innecesarias como Axios.
- **Seguridad:** Inyección del token M2M en los headers (`Authorization: Bearer <M2M_API_KEY>`).
- **Idempotencia:** Cada evento emitido debe incluir un header `X-Idempotency-Key` generado con `crypto.randomUUID()` nativo. Esto asegura que si hay un reintento por falla de red, el Tenant OS no duplique la acción.
- **Resiliencia (Manejo de fallos):** Implementación de una política de retries con exponential backoff (ej. 3 reintentos) para soportar caídas temporales de red, dado que el Tenant OS es un sistema crítico.

## 4. Estructura de Desglose de Trabajo (WBS) para el Ejecutor

Las tareas a realizar en el repositorio `/Users/teseohome/projects/crm-agentico-orchestrator`:

### Tarea 1: Configuración y Variables de Entorno
- **Archivo:** `.env.example`, `docker-compose.yml` (si aplica), y archivo de validación de variables (ej. `src/config/env.ts` o equivalente).
- **Acción:** Añadir las variables `TENANT_OS_URL` y `M2M_API_KEY`.

### Tarea 2: Servicio Cliente de Tenant OS
- **Archivo:** `src/services/tenant_os.ts` (Nuevo).
- **Acción:**
  - Exportar una función/clase `publishCampaignEvent(tenantId, campaignId, eventPayload)`.
  - Implementar la llamada `fetch` hacia `${TENANT_OS_URL}/api/campaigns/${campaignId}/events`.
  - Incluir headers: `Authorization`, `Content-Type`, y `X-Idempotency-Key` (usando `crypto.randomUUID()`).
  - Implementar lógica de reintentos (ej. 3 intentos, backoff 500ms).

### Tarea 3: Observer / Dispatcher de Eventos
- **Archivo:** `src/services/webhook_dispatcher.ts` o `src/services/tenant_events.ts` (Nuevo).
- **Acción:**
  - Crear una función `dispatchEvents(finalState)` o `dispatchEventsFromResult(result)`.
  - Esta función analizará `result.messages` buscando invocaciones a herramientas clave (como `updateLeadProfileTool` o `escalateToHumanTool`) o verificando diffs en `result.leadProfile`.
  - Por cada evento detectado, formatear el payload y llamar a `publishCampaignEvent`.

### Tarea 4: Integración en el Entrypoint (Hono)
- **Archivo:** `src/index.ts`
- **Acción:**
  - Importar el `dispatcher`.
  - Dentro de los endpoints (ej. `/api/webhook`), después de invocar a LangGraph (`const result = await workflowApp.invoke(...)`), llamar al `dispatcher(result)`.
  - **Crítico:** Ejecutar el dispatcher de manera asíncrona sin bloquear la respuesta de Hono (ej. `dispatcher(result).catch(console.error)` o usar la abstracción adecuada de promesas flotantes), garantizando así tiempos de respuesta bajos (fire-and-forget).

## 5. Criterios de Aceptación
- Las herramientas (`src/tools/`) quedan libres de dependencias de `fetch` hacia el Tenant OS.
- Todas las peticiones al Tenant OS llevan UUIDs únicos por evento en `X-Idempotency-Key`.
- Si el Tenant OS responde con HTTP 5xx, el cliente reintenta al menos 3 veces.
- Los tests o la validación estática de tipos pasan correctamente.
