# WBS-StateGraph: Topología del Grafo Maestro para CRM-Agentico

## 1. Topología del Grafo
El Grafo Maestro centraliza la lógica conversacional y operativa del CRM-Agentico. Se instanciará utilizando la clase `StateGraph` proporcionada por LangGraph, tipada fuertemente con nuestra interfaz central `GraphState`.

```typescript
import { StateGraph } from "@langchain/langgraph";
import { GraphState } from "./types/GraphState";

// Instanciación del StateGraph Maestro
const workflow = new StateGraph<GraphState>({
  channels: graphStateChannels // objeto predefinido con los reducers (ej. append messages)
});
```

## 2. Nodos y Ejes (Nodes & Edges)
El flujo principal está dictado por un enrutamiento condicional estricto. La puerta de entrada es siempre el `gatekeeperNode`, quien clasifica y protege el acceso a los nodos especializados.

**Nodos:**
- `gatekeeperNode`: Nodo inicial, clasifica intenciones, maneja el contexto inmediato, small talk y fallback.
- `sdrNode`: Nodo Placeholder (Sales Development Representative) encargado del flujo de ventas, prospección y calificación.
- `ragNode`: Nodo Placeholder para la generación aumentada por recuperación (preguntas frecuentes, soporte, documentación interna).

**Ejes (Flujo Principal):**
```typescript
import { START, END } from "@langchain/langgraph";

// 1. Agregar Nodos al flujo
workflow.addNode("gatekeeper", gatekeeperNode);
workflow.addNode("sdr", sdrNode); // Placeholder SDR
workflow.addNode("rag", ragNode); // Placeholder RAG

// 2. Definir Punto de Entrada
workflow.addEdge(START, "gatekeeper");

// 3. Ejes Condicionales desde el Gatekeeper
workflow.addConditionalEdges("gatekeeper", routeFromGatekeeper, {
  "sdr": "sdr",
  "rag": "rag",
  "end": END
});

// 4. Ejes de salida (Retorno o fin de ejecución)
workflow.addEdge("sdr", END);
workflow.addEdge("rag", END);
```

## 3. Checkpointer (Memoria a Largo Plazo)
Para que el CRM recuerde el contexto de los usuarios a través de múltiples mensajes de WhatsApp en días o semanas, el Grafo necesita memoria persistente (e.g., PostgresSaver, MongoSaver o MemorySaver para desarrollo). El `checkpointer` se instancia a nivel de servicio y se inyecta durante la etapa `.compile()` del Grafo.

```typescript
// Dentro del GraphService, inyección del checkpointer persistente
const checkpointer = await getCheckpointer(); // Retorna la instancia de BaseCheckpointSaver

// Compilación inyectando la persistencia
const app = workflow.compile({ checkpointer });
```
El `thread_id` (que mapeará 1:1 al número de teléfono del usuario final en WhatsApp) será inyectado dinámicamente en el objeto `config` al momento de invocar el grafo para cargar su memoria conversacional correspondiente.

## 4. Consumo (API / Hono) - Seudocódigo Arquitectónico
El webhook de WhatsApp montado en Hono actuará como el orquestador de borde. Para evitar condiciones de carrera (ej. un usuario mandando múltiples mensajes rápidamente que corrompan el state), se implementa un mecanismo de exclusión mutua mediante colas o candados redis/memory (`acquireLock` / `releaseLock`).

```typescript
// Handler del Webhook de WhatsApp en Hono
app.post('/webhook/whatsapp', async (c) => {
  const payload = await c.req.json();
  const userPhone = extractPhone(payload);
  const userMessage = extractMessage(payload);

  // 1. Lock distribuido/local para proteger el state del thread
  const lock = await acquireLock(`lock_wa_${userPhone}`);
  if (!lock) {
     // Política estricta: encolar tarea en background (BullMQ) o descartar 429.
     return c.text('Too Many Requests', 429);
  }

  try {
    // 2. Traer el grafo compilado y el checkpointer listos
    const graphApp = await getCompiledGraph();

    // 3. Configuración con el identificador único del hilo (Memoria)
    const config = { configurable: { thread_id: userPhone } };

    const inputState = {
      messages: [{ role: "user", content: userMessage }],
    };

    // 4. Invocación del grafo de LangGraph
    const result = await graphApp.invoke(inputState, config);

    // 5. Extraer y enviar la respuesta IA generada a la API oficial de WhatsApp
    const aiResponse = result.messages[result.messages.length - 1].content;
    await sendWhatsAppMessage(userPhone, aiResponse);

    return c.text('OK', 200);

  } catch (error) {
    console.error("Error en Grafo / AI:", error);
    return c.text('Internal Server Error', 500);
  } finally {
    // 6. Liberación garantizada del candado concurrente
    await releaseLock(`lock_wa_${userPhone}`);
  }
});
```