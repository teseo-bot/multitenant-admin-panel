# ADR-102: Purga Dinámica de Memoria para Validación Estricta de Turnos (Gemini)

| Campo | Valor |
|---|---|
| **ID** | ADR-102 |
| **Estado** | Aprobado |
| **Fecha** | 2026-04-18 |
| **Autor** | Teseo AIDevops |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | Orquestador CRM-Agentico (LangGraph State) |

## 1. Contexto y Problema (Post-Mortem)
Durante las pruebas E2E con el modelo `gemini-2.5-flash` usando `@langchain/google-genai`, el Orquestador comenzó a fallar con el error fatal:
`400 Bad Request: Please ensure that function call turn comes immediately after a user turn or after a function response turn.`

Este error bloqueaba completamente la conversación. La causa raíz es que la API de Google Gemini impone reglas de turnos hiper-estrictas para el historial conversacional cuando se usa *Tool Calling*. A diferencia de OpenAI, Gemini prohíbe historiales donde existan múltiples mensajes del asistente (`AIMessage`) seguidos sin intercalar un `HumanMessage`, o mensajes huérfanos generados por bloqueos `try-catch` internos (ej. mensajes de fallback de red).

## 2. Decisión
Implementar un mecanismo de **Purga Dinámica y Resiliencia de Turnos** directamente en el *reducer* del historial de mensajes en LangGraph (`src/state.ts`).

1. **Filtrado de SystemMessages:** Se eliminan todos los `SystemMessage` del historial acumulado, ya que Gemini solo tolera un único System Prompt inyectado al inicio del array en el momento de la invocación.
2. **Eliminación de Fallbacks (Mensajes de Error del Bot):** Si el LLM falla por red y nuestro `try-catch` inyecta un `AIMessage` disculpándose, el reducer lo eliminará en el siguiente turno para que Gemini no lo vea como un turno inválido en el contexto del Tool Calling.
3. **Sobrescritura de Turnos Duplicados:** Se iteran los mensajes y, si se detectan dos `HumanMessage` o dos `AIMessage` seguidos (que no sean resoluciones de *tools*), se sobrescribe el anterior para mantener la alternancia estricta `Human -> AI -> Human -> AI`.

## 3. Consecuencias
- **Pros:** El bot se recupera automáticamente de fallos de red sin que el estado de LangGraph quede "corrupto" permanentemente. Se eliminan los errores HTTP 400 de Gemini, permitiendo conversaciones asíncronas y desordenadas (comunes en WhatsApp/Telegram).
- **Contras:** En escenarios de ráfagas de mensajes del usuario (ej. manda 3 mensajes de WhatsApp seguidos), el LLM solo tendrá el contexto del último mensaje de la ráfaga, ya que los anteriores se purgan para cumplir la regla de alternancia de Gemini.
