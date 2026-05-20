# 🔴 Diagnóstico Arquitectónico: Corrupción del Historial de Mensajes en Gemini
**Proyecto:** `crm-agentico-orchestrator`  
**Fecha:** 2026-04-29  
**Autor:** Builder/Learner Agent  
**Severidad:** CRÍTICA — Producción Caída (Cloud Run)  
**Errores Objetivo:**
```
[400 Bad Request] Please ensure that function call turn comes immediately after a user turn or after a function response turn.
[400 Bad Request] Please ensure that function response turn comes immediately after a function call turn.
```

---

## 1. Contexto Técnico: La Regla Estricta de Gemini

La API de Gemini (`gemini-2.5-flash` / `gemini-2.5-pro`) impone una gramática **estricta** de turnos para conversaciones con tool-calling:

```
[SystemMessage] → HumanMessage → AIMessage(con tool_calls) → ToolMessage(s) → AIMessage → HumanMessage → ...
```

**Reglas inquebrantables:**
1. Un `AIMessage` con `tool_calls` DEBE ser inmediatamente seguido por uno o más `ToolMessage`.
2. Un `ToolMessage` NUNCA puede aparecer sin que le anteceda un `AIMessage` con `tool_calls`.
3. La secuencia NO puede iniciar con un `AIMessage(tool_calls)` sin que haya antes un `HumanMessage` o un `ToolMessage`.

Cualquier violación lanza un `400 Bad Request`. El historial de mensajes del estado LangGraph (`state.messages`) está siendo corrompido antes de pasarse a Gemini, violando estas reglas en producción.

---

## 2. Inventario de Bugs — Root Causes Confirmadas

### 🔴 BUG #1 (CRÍTICO): `enrichmentNode` usa `...state` → duplica el historial completo

**Archivo:** `src/nodes/enrichment.ts`, línea 31

```typescript
// ❌ CÓDIGO ACTUAL — INCORRECTO
return {
  ...state,              // ← ESTO esparce TODOS los campos del estado, incluyendo `messages`
  extracted_entities: {
    ...state.extracted_entities,
    bant: bantResult
  }
};
```

**¿Por qué es fatal?**

El reducer de `messages` en `state.ts` es aditivo:
```typescript
reducer: (left, right) => {
  const newMessages = Array.isArray(right) ? right : [right];
  const combined = [...left, ...newMessages]; // ← CONCATENA, no reemplaza
  return combined.slice(-20);
}
```

Cuando `enrichmentNode` devuelve `messages: state.messages` (vía spread), el reducer ejecuta:
```
combined = [...state.messages, ...state.messages]  // ← El historial se DUPLICA
```

Con 6 mensajes existentes `[H1, AI1(tc), TM1, AI2, H2, AI3]`, el resultado es:
```
[H1, AI1(tc), TM1, AI2, H2, AI3, H1, AI1(tc), TM1, AI2, H2, AI3]  → slice(-20) → los 12
```

En el turno siguiente, cuando se añade `H3`, el reducer crea 13 mensajes. Al llegar a 21 mensajes y ejecutar `slice(-20)`:
```
❌ El primer mensaje retenido puede ser: AI1(tc) — sin turno humano previo
   → Error: "function call turn comes immediately after a user turn..."
```

O bien:
```
❌ El primer mensaje retenido puede ser: TM1 — sin AIMessage(tc) previo
   → Error: "function response turn comes immediately after a function call turn"
```

**El nodo `enrichment` es llamado en CADA conversación con más de 5 mensajes** (ver `graph.ts` línea 58), lo que convierte este bug en el trigger principal de los crashes en producción.

---

### 🔴 BUG #2 (CRÍTICO): `slice(-20)` en el reducer de `state.ts` parte pares tool-call en la frontera

**Archivo:** `src/state.ts`, líneas 15-20

```typescript
reducer: (left: BaseMessage[], right: BaseMessage | BaseMessage[]) => {
  const newMessages = Array.isArray(right) ? right : [right];
  const combined = [...left, ...newMessages];
  return combined.slice(-20);  // ← Corte ciego, sin verificar parejas de herramientas
},
```

**Escenario de fallo:**

Cuando el historial llega a 21+ mensajes, `slice(-20)` descarta los más antiguos. Si la posición N-21 es un `AIMessage` con `tool_calls` y la posición N-20 es su `ToolMessage` correspondiente:

```
Mensajes[0..20]: [..., AIMessage(tool_calls)]  ← DESCARTADO por slice
Mensajes[1..20]: [ToolMessage, ...]              ← RETENIDO pero HUÉRFANO 💀
```

El `ToolMessage` queda como primer mensaje de la ventana retenida. Cuando se envía a Gemini:
```
[SystemMessage, ToolMessage huérfano, ...]
→ Error: "function response turn comes immediately after a function call turn"
```

Este bug es agravado significativamente por el Bug #1 (duplicación). Con la duplicación activa, el historial puede llegar a 20 mensajes mucho más rápido, y las secuencias dentro de él ya contienen posiciones inválidas donde `AI(tc)` no tiene `ToolMessage` en la posición inmediatamente siguiente (porque hay un duplicado de otro turno intercalado).

---

### 🔴 BUG #3 (CRÍTICO): `sanitizeMessagesForTools` tiene detección de huérfanos unidireccional

**Archivo:** `src/lib/messageUtils.ts`, función `sanitizeMessagesForTools()`

La función existe como línea de defensa final. Sin embargo, solo maneja UN tipo de huérfano:

```typescript
// ✅ SÍ maneja: AIMessage(tc) sin ToolMessage siguiente → lo descarta
if (isAiWithToolCalls) {
  const nextMsg = messages[i + 1];
  if (nextMsg instanceof ToolMessage) {
    safeMessages.push(msg, nextMsg);
    i++;
  } else {
    console.warn("[SanitizeMessages] Eliminando AIMessage huérfano con tool_calls.");
    continue;  // ← Correcto
  }
}

// ❌ NO maneja: ToolMessage sin AIMessage(tc) previo → pasa sin filtrar
else {
  safeMessages.push(msg);  // ← Un ToolMessage huérfano en safeMessages[0] PASA aquí
}
```

**Consecuencia:** Si el Bug #2 dejó un `ToolMessage` en la posición 0 del historial, `sanitizeMessagesForTools` lo pasa a Gemini sin modificación. La última línea de defensa tiene un agujero.

**Caso concreto:** Con `messages = [ToolMessage_huérfano, AIMessage, HumanMessage, ...]`:
- El `for` entra en el `else` branch para el `ToolMessage_huérfano`
- Lo agrega a `safeMessages`
- Resultado: `[SystemMessage, ToolMessage_huérfano, ...]` enviado a Gemini
- Gemini lanza: `"function response turn comes immediately after a function call turn"`

---

### 🟡 BUG #4 (MEDIO): `setup_context` bypass permanente del Gatekeeper después del turno 1

**Archivo:** `src/graph.ts`, líneas 43-52 y `src/index.ts` líneas 85-92

En `index.ts`, el webhook invoca el grafo sin resetear `currentRoute`:
```typescript
const result = await workflowApp.invoke(
  {
    messages: [new HumanMessage(text)],  // ← currentRoute NO se incluye
    genericMessage: genericMsg,
    tenant_id: ...,
  },
  threadConfig  // ← Checkpointer restaura currentRoute = "sdr" del turno anterior
);
```

El reducer de `currentRoute` es `(left, right) => right !== undefined ? right : left`. Como no se envía `currentRoute` en el payload de invocación, el valor checkpointeado del turno anterior (`"sdr"` o `"rag"`) persiste.

En `graph.ts`, la condición de `setup_context`:
```typescript
.addConditionalEdges("setup_context", (state) => {
  if (state.currentRoute === "sdr" || state.currentRoute === "rag") {
    return state.currentRoute;  // ← Bypass del Gatekeeper SIEMPRE a partir del turno 2
  }
  return "gatekeeper";
}, ...)
```

**Consecuencia para el bug de herramientas:** El `gatekeeperNode` usa `sanitizeMessagesForGatekeeper` que extrae solo el último `HumanMessage` y es completamente seguro. Al saltarse el Gatekeeper, el flujo va directamente a `sdrNode` con el historial completo sin sanitización previa del routing node.

---

### 🟡 BUG #5 (MEDIO): Herramienta `escalate_to_human` duplicada en `allTools`

**Archivo:** `src/graph.ts`, línea 7 + `src/nodes/sdr.ts` + `src/nodes/rag.ts`

```typescript
const allTools = [...sdrTools, ...ragTools];
// sdrTools incluye: escalateToHumanTool (de tools/sdr.ts, name: "escalate_to_human")
// ragTools incluye: escalateToHumanTool (de tools/rag.ts, name: "escalate_to_human")
// → allTools tiene "escalate_to_human" DOS veces
```

El `ToolNode` registra herramientas por nombre. Con una herramienta duplicada, la primera definición ("escalate_to_human" del SDR) siempre gana. Cuando el nodo RAG llama a `escalate_to_human`, el `ToolNode` ejecuta la versión SDR. Esto puede producir un `ToolMessage` con formato/contenido incorrecto para el contexto RAG, que el LLM luego intenta procesar con confusión.

---

### 🟢 BUG #6 (BAJO): Sin límite explícito de recursión en el loop `tools` → `sdr/rag`

**Archivo:** `src/graph.ts`, línea 89

```typescript
export const app = workflow.compile({ checkpointer });
// ← Sin recursionLimit explícito
```

LangGraph usa un default de 25 iteraciones. Un LLM que entre en un loop de tool-calling (e.g., buscando en Knowledge Base repetidamente) puede generar 25+ mensajes de `AI(tc) + TM` antes del stop, acelerando el disparo del Bug #2.

---

## 3. Diagrama de Flujo del Fallo (Escenario Principal)

```
Turno 1:  webhook → [H1]
          → setup_context → gatekeeper (currentRoute="sdr") → sdr → AI1(tc) → tools → TM1 → sdr → AI2 → END
          Estado: [H1, AI1(tc), TM1, AI2]

Turno 2:  webhook → [H1, AI1(tc), TM1, AI2, H2]
          → setup_context → BYPASS GATEKEEPER (currentRoute="sdr") → sdr → AI3 → END
          Estado: [H1, AI1(tc), TM1, AI2, H2, AI3]

Turno 3:  webhook → [H1, AI1(tc), TM1, AI2, H2, AI3, H3]  ← 7 mensajes
          → setup_context → BYPASS → gatekeeper (messages.length > 5) → enrichmentNode ← 🔴 BUG #1
          
          enrichmentNode retorna { ...state, extracted_entities: {...} }
          messages reducer: combined = [H1,AI1(tc),TM1,AI2,H2,AI3,H3, H1,AI1(tc),TM1,AI2,H2,AI3,H3]
          slice(-20) → [H1,AI1(tc),TM1,AI2,H2,AI3,H3,H1,AI1(tc),TM1,AI2,H2,AI3,H3]  ← 14 mensajes DUPLICADOS

Turno 4:  webhook → +H4 → 15 mensajes
          → sdr invoca sanitizeMessagesForTools([H1,AI1(tc),TM1,...,H4])
          Gemini recibe secuencia válida por ahora (15 < 20)

Turno 5:  webhook → +H5 → ... → 20 mensajes (cada turno agrega duplicados vía enrichment)

Turno 6:  webhook → +H6 → 21 mensajes → slice(-20) → 20 mensajes
          
          ⚠️ Si posición 0 del slice es un AI1(tc):
          → sanitizeMessagesForTools NO lo filtra si TM1 está en posición 1
          → Gemini recibe [SystemMsg, AI1(tc), TM1, ...]
          → 🔴 "function call turn comes immediately after a user turn..."
          
          ⚠️ O si posición 0 es TM1 (AI1(tc) fue cortado):
          → sanitizeMessagesForTools NO filtra ToolMessages huérfanos (Bug #3)
          → Gemini recibe [SystemMsg, TM1_huérfano, ...]
          → 🔴 "function response turn comes immediately after a function call turn"
```

---

## 4. Plan de Corrección para el Ejecutor

### Fix #1 — `enrichmentNode` (URGENTE, impacto máximo)
**Archivo:** `src/nodes/enrichment.ts`

```typescript
// ✅ CORRECCIÓN: Solo retornar los campos que cambian. NUNCA usar ...state.
return {
  // NO incluir ...state
  extracted_entities: {
    ...state.extracted_entities,
    bant: bantResult
  }
  // El currentRoute ya está en el estado; enrichment no lo cambia.
  // Si se necesita redirigir, solo retornar currentRoute explícitamente.
};
```

**Regla de oro en LangGraph:** Los nodos solo deben retornar los campos del estado que modifican. Retornar `...state` SIEMPRE causa efectos secundarios en reducers aditivos como el de `messages`.

---

### Fix #2 — Reducer de `messages` en `state.ts` (URGENTE)
**Archivo:** `src/state.ts`

```typescript
messages: Annotation<BaseMessage[]>({
  reducer: (left: BaseMessage[], right: BaseMessage | BaseMessage[]) => {
    const newMessages = Array.isArray(right) ? right : [right];
    const combined = [...left, ...newMessages];
    
    if (combined.length <= 20) return combined;
    
    // Ventana deslizante con preservación de pares tool-call
    let sliced = combined.slice(-20);
    
    // Eliminar ToolMessages huérfanos al inicio
    while (
      sliced.length > 0 &&
      (sliced[0]._getType?.() === "tool" || sliced[0].constructor?.name === "ToolMessage")
    ) {
      sliced = sliced.slice(1);
    }
    
    // Eliminar AIMessage(tc) huérfano al inicio (sin HumanMessage o ToolMessage previo)
    while (
      sliced.length > 0 &&
      (sliced[0]._getType?.() === "ai" || sliced[0].constructor?.name === "AIMessage") &&
      (sliced[0] as any).tool_calls?.length > 0
    ) {
      sliced = sliced.slice(1);
    }
    
    return sliced;
  },
  default: () => [],
}),
```

---

### Fix #3 — `sanitizeMessagesForTools` en `messageUtils.ts` (URGENTE)
**Archivo:** `src/lib/messageUtils.ts`

Agregar filtrado bidireccional antes del loop principal:

```typescript
export function sanitizeMessagesForTools(systemPrompt: SystemMessage, messages: BaseMessage[]): BaseMessage[] {
  // PRE-FILTRO: eliminar ToolMessages huérfanos al inicio del historial
  let workingMessages = [...messages];
  
  while (
    workingMessages.length > 0 &&
    (workingMessages[0] instanceof ToolMessage || workingMessages[0]._getType() === "tool")
  ) {
    console.warn("[SanitizeMessages] Eliminando ToolMessage huérfano al inicio del historial.");
    workingMessages = workingMessages.slice(1);
  }
  
  // PRE-FILTRO: eliminar AIMessage(tc) huérfano al inicio (sin Human/Tool previo)
  while (
    workingMessages.length > 0 &&
    (workingMessages[0] instanceof AIMessage || workingMessages[0]._getType() === "ai") &&
    (workingMessages[0] as AIMessage).tool_calls?.length > 0
  ) {
    console.warn("[SanitizeMessages] Eliminando AIMessage(tc) huérfano al inicio del historial.");
    workingMessages = workingMessages.slice(1);
  }

  // Loop existente (ya maneja AIMessage(tc) sin siguiente ToolMessage)
  const safeMessages: BaseMessage[] = [];
  for (let i = 0; i < workingMessages.length; i++) {
    const msg = workingMessages[i];
    if (!msg) continue;

    const isAiWithToolCalls =
      (msg instanceof AIMessage || msg._getType() === "ai") &&
      (msg as AIMessage).tool_calls?.length > 0;

    if (isAiWithToolCalls) {
      const nextMsg = i + 1 < workingMessages.length ? workingMessages[i + 1] : null;
      if (nextMsg && (nextMsg instanceof ToolMessage || nextMsg._getType() === "tool")) {
        safeMessages.push(msg, nextMsg);
        i++;
      } else {
        console.warn("[SanitizeMessages] Eliminando AIMessage(tc) huérfano sin ToolMessage siguiente.");
      }
    } else if (msg instanceof ToolMessage || msg._getType() === "tool") {
      // Segunda línea de defensa: cualquier ToolMessage que llegue aquí sin pareja previa
      // (no debería pasar después del pre-filtro, pero por seguridad):
      const prevSafe = safeMessages[safeMessages.length - 1];
      const prevIsAiWithTc =
        prevSafe &&
        (prevSafe instanceof AIMessage || prevSafe._getType() === "ai") &&
        (prevSafe as AIMessage).tool_calls?.length > 0;
      if (prevIsAiWithTc) {
        safeMessages.push(msg);
      } else {
        console.warn("[SanitizeMessages] Eliminando ToolMessage huérfano en posición intermedia.");
      }
    } else {
      safeMessages.push(msg);
    }
  }

  return [systemPrompt, ...safeMessages];
}
```

---

### Fix #4 — Reset de `currentRoute` en el webhook (RECOMENDADO)
**Archivo:** `src/index.ts`, ambos handlers de webhook (WhatsApp y Telegram)

```typescript
const result = await workflowApp.invoke(
  {
    messages: [new HumanMessage(text)],
    genericMessage: genericMsg,
    tenant_id: ...,
    campaignId: ...,
    currentRoute: null,  // ← Forzar re-evaluación del Gatekeeper en cada nuevo mensaje
  },
  threadConfig
);
```

**Alternativa (en `setupContextNode`):**
```typescript
return { 
  prompts: prompts || {}, 
  llmConfig: llmConfig || {},
  currentRoute: null  // ← Resetear para forzar routing fresco
};
```

---

### Fix #5 — Eliminar herramienta duplicada `escalate_to_human`
**Archivos:** `src/tools/sdr.ts`, `src/tools/rag.ts`, `src/nodes/rag.ts`

Mover la definición de `escalateToHumanTool` a `src/tools/shared.ts` y hacer `import` desde ambos nodos. Eliminar la definición duplicada en `tools/rag.ts`.

---

### Fix #6 — Añadir límite de recursión explícito
**Archivo:** `src/graph.ts`

```typescript
export const app = workflow.compile({ 
  checkpointer,
  // Limitar ciclos sdr→tools→sdr para evitar explosión del historial
  // y contener costos en loops de herramientas
});
// Nota: passar recursionLimit al invoke, no al compile en LangGraph v0.2+
// En invoke: { configurable: { thread_id }, recursionLimit: 10 }
```

En `index.ts`, actualizar la invocación:
```typescript
const result = await workflowApp.invoke(
  { messages: [...], ... },
  { ...threadConfig, recursionLimit: 10 }
);
```

---

## 5. Priorización de Fixes para el Ejecutor

| # | Fix | Archivo | Impacto | Urgencia |
|---|-----|---------|---------|----------|
| 1 | Eliminar `...state` en `enrichmentNode` | `nodes/enrichment.ts` | 🔴 MÁXIMO | INMEDIATO |
| 2 | Reducer `messages` pair-aware en `state.ts` | `state.ts` | 🔴 ALTO | INMEDIATO |
| 3 | `sanitizeMessagesForTools` bidireccional | `lib/messageUtils.ts` | 🔴 ALTO | INMEDIATO |
| 4 | Reset `currentRoute: null` en webhook | `index.ts` | 🟡 MEDIO | Sprint actual |
| 5 | Eliminar `escalate_to_human` duplicado | `tools/rag.ts` | 🟡 MEDIO | Sprint actual |
| 6 | Añadir `recursionLimit` en invoke | `index.ts` | 🟢 BAJO | Próximo sprint |

---

## 6. Prueba de Regresión Recomendada (Para el Tester)

Después de aplicar los fixes, ejecutar la suite con los siguientes escenarios:

1. **Escenario de duplicación**: Simular un hilo con 6+ mensajes y verificar que `enrichmentNode` no duplica mensajes en el estado.
2. **Escenario de boundary-slice**: Simular una conversación de 22+ mensajes donde los últimos dos son `AI(tc)` y `TM`. Verificar que `slice(-20)` no deja `TM` como primer mensaje.
3. **Escenario de ToolMessage huérfano**: Inyectar artificialmente un `ToolMessage` como primer mensaje del historial y verificar que `sanitizeMessagesForTools` lo elimina antes de llamar a Gemini.
4. **Escenario de loop de herramientas**: Simular un LLM que llama 5 herramientas en secuencia y verificar que el historial no excede 20 mensajes en estado corrupto.
5. **Smoke test de `escalate_to_human`**: Disparar una escalación desde RAG y verificar que el `ToolMessage` de respuesta contiene el formato correcto.
