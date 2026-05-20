# WBS: Arquitectura del Gatekeeper Node (LangGraph)

## 1. Visión General
El `Gatekeeper Node` es el nodo de entrada principal (front-door) del flujo de LangGraph para el AI CRM. Su responsabilidad exclusiva es clasificar la intención inicial del usuario y derivar la conversación al nodo especialista adecuado.

## 2. Estrategia de Clasificación de Intenciones
Se utilizará **Structured Outputs** (implementado vía `.with_structured_output()` en LangChain) apalancado en las capacidades nativas de *Tool Calling* del modelo LLM.
- **Razón:** La heurística simple es frágil ante el lenguaje natural no estructurado. Tool Calling manual es más propenso a errores de formato. Structured Outputs garantiza, mediante validación (ej. Pydantic), la devolución determinista de un JSON con campos estrictos como `next_node` y `confidence_score`.
- **Requisito de Modelo:** Se recomienda usar un modelo "flash" (rápido y económico, ej. Gemini 1.5 Flash o equivalente) dado que la tarea es pura clasificación semántica.

## 3. Estructura Técnica y Firmas Teóricas

### 3.1. `gatekeeperNode(state: GraphStateType) -> Dict[str, Any]`
Este es el nodo ejecutable dentro del grafo de LangGraph. Su función es evaluar el estado actual y decidir el siguiente paso.

**Lógica interna:**
1. Extraer el último mensaje (o los últimos `N` mensajes) del `state`.
2. Invocar al modelo configurado con `Structured Outputs` pasándole las directivas del Gatekeeper (Ej. "Eres un enrutador de tráfico. Si el usuario pregunta por un producto, ve a RAG. Si pide cita, ve a SDR").
3. Recibir el output tipado (`GatekeeperDecision`).
4. Retornar una actualización de estado, inyectando la variable de enrutamiento (por ejemplo, `current_route: decision.next_node`).

### 3.2. `routeFromGatekeeper(state: GraphStateType) -> Literal["rag", "sdr", "__end__"]`
Esta es la función condicional (Conditional Edge) que se evalúa inmediatamente después del `gatekeeperNode`. No interactúa con el LLM, solo lee el estado.

**Lógica interna:**
1. Leer `state["current_route"]`.
2. Retornar directamente la cadena correspondiente al nodo destino en el grafo:
   - `"rag"`: Para recuperación de conocimiento, preguntas frecuentes, descripciones de servicios.
   - `"sdr"`: Para calificación de leads, agendamiento, captura de datos.
   - `"__end__"`: Para finalización de la charla o interacciones sin valor comercial.

## 4. Trade-offs Evaluados (Latencia del LLM vs Precisión en la Derivación)

| Factor | Impacto | Justificación / Mitigación |
| :--- | :--- | :--- |
| **Latencia** | **Negativa** | Añadir un `Gatekeeper` implica una llamada LLM síncrona obligatoria al inicio de la conversación (Time-to-First-Token incrementa ~0.5s - 1.2s). Se mitiga usando modelos *Flash*/*Haiku* con tokens de salida forzados a un esquema mínimo (<20 tokens de respuesta). |
| **Precisión** | **Positiva** | Evita que nodos pesados intenten resolver intenciones fuera de su dominio (ej. el SDR inventando datos porque no tiene acceso a la base de conocimiento). El *routing* determinista mejora drásticamente la calidad final de la respuesta. |
| **Costos** | **Neutro/Positivo**| Gastar un centavo extra en el modelo pequeño del enrutador evita que un modelo grande y costoso consuma tokens analizando mensajes de saludo o spam que deberían ir a `__end__`. |

**Conclusión Arquitectónica:** El sacrificio marginal en latencia inicial es un *trade-off* aceptable y necesario a cambio de la estabilidad estructural, precisión de roles y ahorro de contexto en la arquitectura multi-agente.