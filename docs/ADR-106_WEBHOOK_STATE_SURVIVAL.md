# ADR-106: Supervivencia de Estado en Webhooks y Hardcoding de LLMs

## Contexto (Mayo 1, 2026)
Durante las pruebas E2E en local (ngrok -> Puerto 8080 del Orquestador), el sistema experimentó una serie de fallos críticos que rompieron el *Zero-Trust Pipeline*.

1. **Desajuste de Puertos:** El orquestador intentaba levantar en el puerto 3000 internamente, mientras Docker esperaba el 8080 (Cloud Run).
2. **Amnesia de Estado en LangGraph:** Los mensajes orgánicos de Telegram/WhatsApp llegaban sin `campaignId`. La lógica de inyección pasaba `{ campaignId: null }` al invocador. Los *reducers* de LangGraph (`right !== undefined ? right : left`) aceptaban el `null` como válido y sobrescribían destructivamente el estado histórico del tenant_id y campaignId, provocando el aborto del Webhook Dispatcher en cada iteración multi-turno.
3. **Crasheo de Salida (Empty Text):** Las salidas silenciosas del LLM (Tool Calling sin texto final) producían errores 400 en la API de Telegram.
4. **Error 400 de Tool Calling en Gemini:** Identificamos que el historial se corrompía porque `gemini-2.5-flash` rechazaba el ordenamiento de los mensajes de herramientas (`function call turn comes immediately after a user turn`).
5. **Hardcoding de LLMs:** Todos los nodos (`investigator`, `rag`, `gatekeeper`, `sdr`) tenían anclado explícitamente `gemini-2.5-flash` a nivel código fuente.

## Decisión Técnica
1. **Reducers Estrictos:** El `GraphState` (`src/state.ts`) debe usar reducers que ignoren el nulo `(right !== undefined && right !== null) ? right : left`.
2. **Fallback de Contexto:** `setupContextNode` asume `"default"` si `campaignId` no existe.
3. **Validación de Capa (Telegram/WA):** Se inyecta un validador de cadena vacía `!finalReply.trim()` en los webhooks para disparar un mensaje de rescate.
4. **Migración Forzosa a Gemini 3.1 Pro:** Queda prohibido el uso de la versión 2.5. Toda llamada al modelo debe ser refactorizada para delegar o sobreescribir con `gemini-3.1-pro-preview`.

## Estado: Aprobado (Aplicado localmente, pendiente refactor Gemini).
