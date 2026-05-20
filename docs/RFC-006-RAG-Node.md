# RFC-006: RAG Node Architecture (Knowledge Retrieval)

## 1. Objetivo y Alcance
El nodo RAG (Retrieval-Augmented Generation) es el encargado de responder preguntas de soporte, información de productos, y dudas técnicas de los clientes. Actúa como el centro de conocimiento del `CRM-Agentico`, abstrayendo la recuperación de datos desde Postgres (`pgvector`). 

## 2. Mejores Prácticas de la Industria Aplicadas
- **Vector Search Tooling:** El LLM no debe recibir el contexto inyectado a la fuerza en el prompt si la consulta es vaga. En su lugar, el RAG opera como un agente en sí mismo (Tool-Calling) y decide *cuándo* y *qué* buscar en la base de datos usando una herramienta `search_knowledge_base(query)`.
- **Handoff Asimétrico:** Si el usuario pregunta algo que el Vector DB no contiene, el RAG debe transferir la conversación usando la herramienta `escalate_to_human(reason)`.
- **Inmutable State Expansion:** Se debe extender `GraphState` para soportar `ragStatus` (estado de la búsqueda).

## 3. Extensión Requerida en `GraphState` (en `src/state.ts`)
```typescript
  ragStatus: Annotation<"searching" | "answered" | "handoff">({
    reducer: (left, right) => right || left,
    default: () => "searching",
  }),
```

## 4. Herramientas (Tools) del Nodo
1. `search_knowledge_base(query)`: Realiza una búsqueda semántica (HNSW) en Postgres.
2. `escalate_to_human(reason)`: (Reutilizada de SDR) Cambia el `ragStatus` a "handoff".

## 5. Diseño del Nodo (`ragNode.ts`)
1. **System Prompt:** 
   - Rol: "Eres un asesor de soporte experto de Fleetco..."
   - Tono: Claro, directo y empático.
   - Reglas: Siempre busca en la base de conocimientos antes de responder un dato duro. Si no encuentras la respuesta exacta, NO inventes, escala a un humano.
2. **Modelo de IA:** 
   - `ChatOpenAI` con soporte de Tool Calling, enrutado por `AI Gateway` (`X-Tenant-Id`).

## 6. Dictamen de Aprobación
- [ ] Validado contra principios Zero-Trust.
- [ ] Alineado a la Ley Marcial Documental.
- [ ] Preparado para delegación al Ejecutor.
