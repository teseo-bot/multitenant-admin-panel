# RFC-005: AI Gateway Architecture & Rate Limits

## 1. Objetivo
Restaurar la documentación técnica del `fleetco-ai-gateway` (puerto 4010) extraída directamente desde el código fuente legado para evitar fallas de integración y consolidar el control FinOps (control de facturación de LLMs).

## 2. Inspección del Código (Truth from Code)
Tras inspeccionar el código fuente (`index.js`), se confirmaron las siguientes reglas arquitectónicas operativas:
- **Framework:** `fastify` con conexión persistente a `Redis`.
- **Endpoint Objetivo:** `/v1/chat/completions`
- **Autenticación (API Key Interna):** Valida el Header `Authorization` usando `GATEWAY_INTERNAL_SECRET` o por defecto el fallback vulnerable `'secret123'`. 
- **Header Obligatorio (Tenant):** El request **fallará (400)** si no se incluye el Header `X-Tenant-Id`.

## 3. Lógica FinOps y Enrutamiento Dinámico de Modelos
El Gateway actúa como un firewall financiero de protección:
- El Tenant base mockeado (`22222`) tiene un Hard Limit de `100,000` tokens mensuales almacenados en Redis.
- **Downgrade Automático:** Si el consumo del tenant supera el 90% (`90,000` tokens), el Gateway intercepta el request e impone un *Downgrade* obligatorio del modelo hacia `gpt-4o-mini`, ignorando la petición original del orquestador.
- **Bloqueo (429):** Si se superan los `100,000` tokens, el Gateway retorna un HTTP 429 (`Monthly token quota exceeded`).

## 4. Impacto en el `CRM-Agentico` (Track Primario)
El nodo SDR actualmente implementado (`src/nodes/sdr.ts`) usa `@langchain/openai` apuntando a `localhost:4010/v1` usando `AI_GATEWAY_TOKEN`.

**Deuda Técnica Encontrada:** 
LangChain por defecto no incluye el Header propietario `X-Tenant-Id`. Si se levanta el CRM ahora mismo en producción, todas las peticiones LLM colapsarán en el Gateway recibiendo un error `400: Missing X-Tenant-Id header`.

## 5. Dictamen de Resolución
Para evitar un Deadlock de integración, se debe autorizar al Ejecutor para que modifique la instanciación de `ChatOpenAI` en `Gatekeeper` y `SDR` inyectando el Header faltante a través de la propiedad `configuration.defaultHeaders`.
