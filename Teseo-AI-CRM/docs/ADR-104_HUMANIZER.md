# ADR-104: Implementación de Middleware Humanizer

**Status:** Proposed  
**Date:** 2026-04-29  
**Author:** Builder (via subagent)

---

## Context

El CRM Agéntico responde a mensajes de Telegram y WhatsApp con latencia prácticamente nula (~200-500ms desde que LangGraph produce la respuesta). Esto genera una percepción inmediata de "bot" que reduce la confianza del usuario y rompe la ilusión de interacción humana.

Se necesita un mecanismo que:

1. **Inyecte latencia artificial** proporcional a la longitud del texto de respuesta, simulando el tiempo que tardaría una persona en escribir.
2. **Muestre indicadores de "typing"** (`sendChatAction: typing` en Telegram, presencia de escritura en WhatsApp) durante el periodo de delay, para que el usuario perciba actividad natural.
3. **No bloquee el ciclo de request/response HTTP** — los webhooks deben seguir respondiendo `200 OK` inmediatamente a Meta/Telegram.

### Análisis de puntos de inyección

| Opción | Ubicación | Pros | Contras |
|--------|-----------|------|---------|
| A — Dentro de LangGraph | `src/graph.ts` (nodo final) | Centralizado en el grafo | Rompe la separación de concerns; LangGraph no debería manejar UX de canal; complica testing |
| B — En los handlers de salida | `src/index.ts` (antes de `sendTelegramMessage` / `sendWhatsAppMessage`) | No toca LangGraph; fire-and-forget; respeta HTTP 200 | Requiere que cada adaptador de canal soporte eventos "typing" |
| C — En los adaptadores de canal | Dentro de cada `send*Message` | Encapsulado por canal | Mezcla lógica de envío con lógica de temporización |

Se elige la **Opción B** por ser la más limpia arquitectónicamente.

---

## Decision

Implementar el **Humanizer** como un módulo independiente en `src/services/humanizer.ts`, invocado desde `src/index.ts` en los handlers de webhook de Telegram y WhatsApp, **después** de que LangGraph produce `finalReply` y **antes** de llamar a `sendTelegramMessage` / `sendWhatsAppMessage`.

### Diseño del módulo

```typescript
// src/services/humanizer.ts

interface HumanizerOptions {
  text: string;
  chatId: string | number;
  channel: 'telegram' | 'whatsapp';
  /** Velocidad de "escritura" en caracteres por segundo (default: 30) */
  charsPerSecond?: number;
  /** Delay mínimo en ms (default: 800) */
  minDelayMs?: number;
  /** Delay máximo en ms (default: 8000) */
  maxDelayMs?: number;
}

export async function humanize(options: HumanizerOptions): Promise<void> {
  const {
    text,
    chatId,
    channel,
    charsPerSecond = 30,
    minDelayMs = 800,
    maxDelayMs = 8000,
  } = options;

  const calculatedDelay = Math.round((text.length / charsPerSecond) * 1000);
  const delay = Math.min(Math.max(calculatedDelay, minDelayMs), maxDelayMs);

  // Dispara "typing" indicator según el canal
  await sendTypingIndicator(chatId, channel);

  // Espera el delay calculado (fire-and-forget desde el punto de vista del webhook)
  await sleep(delay);
}
```

### Punto de integración en `src/index.ts`

```typescript
// Dentro del handler del webhook (ya es async, fire-and-forget tras el HTTP 200)

const finalReply = await runGraph(userMessage, context);

// --- Humanizer: inyecta latencia + typing ---
await humanize({
  text: finalReply,
  chatId,
  channel: 'telegram', // o 'whatsapp'
});

await sendTelegramMessage(chatId, finalReply);
```

Como el handler ya es fire-and-forget (el HTTP 200 se envía antes de procesar), el `await humanize(...)` no bloquea la respuesta al proveedor de webhooks.

### Cálculo de latencia

| Longitud del texto | Delay (a 30 chars/s) | Delay aplicado |
|--------------------|----------------------|----------------|
| 10 chars           | 333ms                | 800ms (mínimo) |
| 100 chars          | 3,333ms              | 3,333ms        |
| 300 chars          | 10,000ms             | 8,000ms (máximo) |

Los valores de `charsPerSecond`, `minDelayMs` y `maxDelayMs` se configuran vía variables de entorno para ajuste sin redeploy.

### Typing indicators

- **Telegram:** `POST /bot<token>/sendChatAction` con `action: "typing"`. Se repite cada ~4s si el delay es largo (Telegram cancela el indicador a los 5s).
- **WhatsApp (Cloud API):** Se usa el endpoint de presencia si está disponible, o se omite si la Business API no lo soporta en el tier actual.

---

## Consequences

### Positivas

- **No rompe LangGraph:** El grafo sigue siendo puro y testeable; no conoce la existencia del humanizer.
- **Respeta HTTP 200:** El delay ocurre en el tramo fire-and-forget, después de que el webhook ya respondió al proveedor.
- **Configurable sin redeploy:** Los parámetros de velocidad y límites se leen de env vars.
- **Mejora UX:** El usuario percibe una interacción más natural y menos robótica.

### Negativas / Trade-offs

- **Requiere soporte de "typing" en cada adaptador de canal:** Si se agrega un nuevo canal (ej. Instagram, SMS), hay que implementar su indicador de typing o crear un no-op.
- **Agrega latencia real al usuario:** Aunque es intencional, hay que monitorear que no se perciba como lentitud excesiva. Se recomienda logging del delay aplicado para análisis posterior.
- **Repetición del typing indicator:** En Telegram el "typing" expira a los ~5s, por lo que delays largos requieren un loop de reenvío. Esto añade complejidad menor.

### Riesgos

- Si el proceso se interrumpe entre el `humanize()` y el `send*Message()`, el usuario verá "typing" pero nunca recibirá respuesta. Mitigación: timeout + retry en el envío.

---

## Implementation Notes

- **Archivo nuevo:** `src/services/humanizer.ts`
- **Archivos modificados:** `src/index.ts` (handlers de webhook de Telegram y WhatsApp)
- **Testing:** Unit tests para el cálculo de delay; integration tests con mocks de `sendChatAction`.
- **Feature flag:** `HUMANIZER_ENABLED=true|false` para poder desactivar en staging o debug.
