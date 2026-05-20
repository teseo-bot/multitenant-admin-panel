# LEARNER REPORT: LangGraph Webhooks Injection

## 1. Localización del Orquestador
El orquestador de LangGraph fue localizado en el directorio físico:
`/Users/teseohome/projects/crm-agentico-orchestrator`

*(No se encontró dentro de la carpeta `Teseo-AI-CRM` directamente, sino como un proyecto hermano en el workspace).*

## 2. Estructura y Stack Tecnológico
El proyecto es una aplicación **TypeScript** que corre sobre **Node.js** utilizando el framework **Hono** para el servidor HTTP.
Usa las librerías oficiales de LangChain/LangGraph:
- `@langchain/langgraph`
- `@langchain/core`

**Nodos Principales (`src/nodes/`):**
- `gatekeeper.ts`: Enruta la intención del usuario usando `gemini-2.5-flash` con salida estructurada.
- `sdr.ts`: Agente comercial (SDR) que evalúa BANT (Budget, Authority, Need, Timeline). Utiliza tools para extraer y actualizar perfil.
- `rag.ts`: Nodo de recuperación de información.

**Herramientas (`src/tools/`):**
- `sdr.ts`: Define `updateLeadProfileTool` y `escalateToHumanTool`.
- `workspace.ts`: Integraciones a calendarios y correos.

**Entradas HTTP (`src/index.ts`):**
- Endpoints en Hono (`/api/webhook` y `/api/webhook/telegram`) que reciben los mensajes asíncronamente y ejecutan el flujo mediante `workflowApp.invoke(...)`.

## 3. Manejo de Peticiones HTTP Externas
El orquestador maneja peticiones salientes HTTP utilizando la API nativa **`fetch`** de Node.js (se verificó esto dentro de `src/services/odoo.ts` donde se usa `fetch` para hacer llamadas `jsonrpc`). No hay dependencias pesadas como `axios`.

## 4. Propuesta de Inyección del Webhook hacia Tenant OS
El objetivo es emitir eventos a `POST /api/campaigns/[id]/events` del Tenant OS.

### Punto de Inyección Ideal
Existen dos aproximaciones recomendadas para inyectar este webhook, siendo la "Opción A" la más natural en LangGraph:

**Opción A: Inyección en las Tools (Recomendada)**
Dado que el evento representa una acción concreta (como actualizar datos de un lead o escalar a un humano), el lugar más semántico y desacoplado es dentro de `src/tools/sdr.ts`.
1. Crear un servicio `src/services/tenant_os.ts` con una función `publishCampaignEvent(tenantId, campaignId, eventPayload)` usando `fetch`.
2. Invocar esta función al final del bloque `try` de herramientas clave como `updateLeadProfileTool` en `src/tools/sdr.ts`.
3. *Ventaja:* Solo se emite cuando el agente SDR toma la decisión proactiva de que algo útil ha sucedido y el estado interno cambió.

**Opción B: Observer a nivel de Grafo (Post-invoke)**
Inyectar un chequeo al final de la ejecución asíncrona dentro de los webhooks de Hono en `src/index.ts`.
1. Justo después de la llamada `const result = await workflowApp.invoke(...)`.
2. Analizar `result.messages` o el estado resultante (`result.leadProfile`).
3. Si hay cambios significativos contra el estado previo, emitir el webhook globalmente hacia el Tenant OS.
4. *Ventaja:* Desacopla completamente a LangGraph de conocer sobre `api/campaigns`.

## 5. Próximos Pasos Técnicos
- Crear el utilitario en `src/services/tenant_events.ts`.
- Inyectar el `fetch('http://[TENANT_OS_URL]/api/campaigns/[id]/events', { method: 'POST', body: ... })` con validación de reintentos (fire and forget recomendado para no bloquear el Hono webhook de Meta/Telegram).
- Asegurarse de inyectar variables de entorno (`TENANT_OS_URL`, `TENANT_API_KEY`) en el `.env` y el `docker-compose.yml` de `crm-agentico-orchestrator`.
