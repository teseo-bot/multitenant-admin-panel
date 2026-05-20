# RFC-003: LangGraph Orchestrator (Orquestador Agéntico)

> **Documento de Arquitectura**
> Proyecto: CRM-Agéntico (fleetco-ai-crm)
> Autor: Builder (Planificador / Arquitecto Staff)
> Estatus: Propuesta
> Fecha: 2026-04-16

---

## 1. Objetivo
Diseñar la arquitectura del Orquestador Agéntico basado en LangGraph para el proyecto CRM-Agéntico. Este componente actuará como el "motor de estado puro" que coordina las interacciones entre los diferentes agentes declarativos, manteniendo el contexto, enrutando mensajes y facilitando el acceso unificado a herramientas externas sin ensuciarse con lógica de negocio.

---

## 2. Estado Compartido (StateGraph)

El estado global (`StateGraph`) es el payload inmutable/mutable que viaja a través del grafo y se actualiza en cada paso. Este estado es la única fuente de la verdad para el contexto del flujo actual.

### Modelo de Estado (`State`)
```typescript
interface GraphState {
  // Historial conversacional estándar de LangChain/LangGraph
  messages: BaseMessage[];
  
  // Resumen persistente para trimming de mensajes (Evita colapso de tokens)
  summary: string;
  
  // Clasificación inicial detectada por el Gatekeeper
  intent: "commercial:cold" | "commercial:warm" | "commercial:hot" | "support:l1" | "spam" | "unknown";
  
  // Identidad del contacto en el CRM
  lead_id?: string | null;
  partner_id?: string | null;
  
  // Contexto del canal de origen
  channel: "telegram" | "whatsapp";
  user_identifier: string; // ID de Telegram o número de WA
  
  // Estado actual del pipeline
  pipeline_status: "new" | "qualified" | "proposition" | "won" | "lost";
  
  // Variables auxiliares para sub-flujos (Payload discriminado)
  enrichment_data?: { 
    source: "hunter" | "sdr" | "investigador"; 
    payload: any 
  };
  
  current_agent: string; // "gatekeeper" | "hunter" | "sdr" | "investigador" | "trafficker" | "content_creator" | "admin"
}
```

### Política de Message Trimming (Ventana Deslizante)
Para prevenir el crecimiento infinito del estado y el eventual colapso de tokens (Window Context Overflow), se implementa una política explícita de *message trimming*:
- Se mantendrán únicamente los **últimos 20 mensajes** en el arreglo `messages`.
- El historial previo será condensado continuamente mediante un LLM y almacenado en la propiedad `summary`.
- El payload se inyectará en cada prompt garantizando un consumo predecible de tokens.

---

## 3. El Router (Gatekeeper Node)

El **Gatekeeper Node** es el punto de entrada al grafo principal. Su única misión es evaluar el último mensaje (o los primeros), extraer la intención del usuario y dirigir el tráfico.

### Mecánica de Enrutamiento
1. **Ejecución del Nodo:** El Gatekeeper analiza el `State.messages[-1]` y llama a un modelo LLM ligero y rápido (con la prompt definida en `.agents/gatekeeper/RULES.md`).
2. **Actualización de Estado:** Escribe el resultado en `State.intent`.
3. **Aristas Condicionales (`addConditionalEdges`):**

```typescript
const routeMessage = (state: GraphState) => {
  if (state.intent === "support:l1") return "reject_node";
  if (state.intent === "spam") return "discard_node";
  if (state.intent === "commercial:cold") return "pipeline_inteligencia"; // -> Investigador / Hunter
  if (state.intent === "commercial:warm" || state.intent === "commercial:hot") return "pipeline_ventas"; // -> SDR
  return "triage_manual"; // Fallback para intervención manual (HITL)
};

workflow.addConditionalEdges("gatekeeper", routeMessage);
```

### Human-in-the-Loop (HITL) y Decisiones Críticas
Cualquier flujo que degenere en `"unknown"` u operaciones de alto impacto de negocio serán enviados al nodo `"triage_manual"`. 
Se utilizará el mecanismo de LangGraph `interrupt_before=["triage_manual", "cotizacion", "marcar_perdido"]` para **pausar la ejecución**. Esto exige la aprobación manual de un operador humano antes de emitir una cotización, marcar un trato como perdido o resolver intenciones desconocidas.

---

## 4. Interacción con Herramientas (ToolNodes)

Para mantener la separación de responsabilidades y evitar Puntos Únicos de Fallo (SPOF), el acceso a herramientas se divide en dos nodos especializados. Ningún agente se conecta directamente a bases de datos.

### Fuentes de Datos y División de Nodos
1. **`tools_rag`:** Lectura desde `pgvector` para extraer reglas del negocio, manuales y datos de la empresa. Nodo rápido, enfocado en bajo tiempo de respuesta.
2. **`tools_transactional`:** Ejecución de operaciones a través de `odoo-mcp` (Model Context Protocol). Al integrar operaciones transaccionales (lectura/escritura en Odoo CE), este nodo incorpora lógicas de *timeout*, *retries* y *circuit breakers*.

### Flujo de Ejecución y Enrutamiento Dinámico
El error arquitectónico común de enrutar estáticamente (`workflow.addEdge("tools", "sdr")`) se corrige evaluando dinámicamente el agente origen.

```typescript
// Transición hacia ToolNode correspondiente
workflow.addConditionalEdges("sdr", toolsCondition, {
  true: "tools_transactional", // o tools_rag según la herramienta invocada
  false: END,
});

// Enrutamiento de retorno dinámico basado en el agente origen
workflow.addConditionalEdges("tools_transactional", (state: GraphState) => state.current_agent);
workflow.addConditionalEdges("tools_rag", (state: GraphState) => state.current_agent);
```

---

## 5. Persistencia y Concurrencia (Checkpointers)

Para mantener la memoria a corto plazo de la conversación, pausar flujos (HITL) y retomar interacciones asíncronas, se empleará **PostgresCheckpointer** (`langgraph-checkpoint-postgres`).

### Estrategia de Persistencia
- **Memoria por Hilo (`thread_id`):** El identificador del canal (`channel` + `user_identifier`) fungirá como el `thread_id` para LangGraph.
- **Base de Datos Dedicada:** Base de datos PostgreSQL independiente del core de Odoo, dedicada a los estados efímeros. Resiliencia ante reinicios del contenedor Docker.

### Candados de Concurrencia (Race Conditions)
En sistemas de mensajería instantánea es común que los usuarios envíen múltiples mensajes consecutivos rápidamente (ej. dos mensajes de WhatsApp en < 1 segundo). Si dos peticiones inician ejecuciones paralelas del grafo bajo el mismo `thread_id`, el Checkpointer causará inconsistencias graves en el estado o fallos de versión.
Para solventar esto, se debe integrar un **candado de concurrencia** en la capa de ingesta de mensajes webhooks:
- Se implementará un **Mutex con Redis** o un **Advisory Lock en Postgres** vinculado al `thread_id`.
- Las peticiones subsecuentes encolarán su procesamiento hasta que el lock previo haya concluido su ejecución de estado.

---

## 6. Patrón "Pipelines como Producto" (Sub-grafos)

El proyecto adoptará una arquitectura de grafos compuestos (Sub-graphs). Esto no solo ordena el código, sino que **permite la venta modular B2B** del software, habilitando u ocultando pipelines según el tier del cliente.

### Topología Modular
- **Grafo Principal (Root):** Gestiona el Gatekeeper y el enrutamiento.
  - **Sub-grafo de Ventas (`pipeline_ventas`):** Contiene el SDR y la lógica de cotización/cierre. (Producto Core).
  - **Sub-grafo de Inteligencia (`pipeline_inteligencia`):** Contiene al Investigador y al Hunter. (Add-on: Outbound Pro).
  - **Sub-grafo de Tráfico (`pipeline_marketing`):** Contiene al Content Creator y al Trafficker. (Add-on: Growth).

### Implementación LangGraph
Los sub-grafos se compilan individualmente y se añaden como nodos opacos dentro del Grafo Principal. El estado puede mapearse o heredarse para aislar contextos.

```typescript
// Sub-grafo de Inteligencia
const intelligenceWorkflow = new StateGraph<IntelligenceState>({...});
const intelligenceNode = intelligenceWorkflow.compile();

// Grafo Principal
const mainWorkflow = new StateGraph<GraphState>({ channels: graphStateChannels })
  .addNode("gatekeeper", gatekeeperNode)
  .addNode("pipeline_inteligencia", intelligenceNode)
  .addNode("pipeline_ventas", salesNode);
```
*Esta separación garantiza que fallos o reinicios en el pipeline de Marketing no afecten a los cierres en vivo del SDR, reforzando la fiabilidad de producción.*