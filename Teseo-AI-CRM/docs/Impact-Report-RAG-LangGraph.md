# Reporte de Impacto: Integración de RAG y RetrievalNode (RFC-049) en LangGraph

## 1. Análisis de Contexto
Tras analizar el orquestador (`/Users/teseohome/projects/Teseo-AI-CRM/src/orchestrator`), se determina que actualmente el RAG se maneja a través de *Tool Calling* explícito por el LLM (`searchKnowledgeBaseTool` en `src/tools/rag.ts`), quien a su vez invoca la función `searchChunks` en `src/services/db.ts` utilizando una conexión en crudo de PostgreSQL (`pg` Pool) con embeddings simulados (`generateMockEmbedding`). 

El RFC-049 dictamina una migración hacia una topología nativa de recuperación de LangGraph: implementar un `RetrievalNode` independiente que ejecute búsqueda semántica vía RPC en Supabase, desacoplando el RAG de la toma de decisiones del Agente e inyectando el contexto previo a la generación.

## 2. Interacciones y Archivos a Modificar

### A. Dependencias (`package.json`)
- **Impacto:** `@supabase/supabase-js` **no está instalado** en `crm-agentico-orchestrator`.
- **Acción:** Instalar la librería para satisfacer la directiva 3.1 del RFC-049.

### B. Contrato de Estado (`src/state.ts`)
- **Impacto:** El estado global (`GraphState`) carece de las propiedades necesarias para el pipeline RAG explícito.
- **Acciones:** Añadir `tenant_id` (string/UUID obligatorio), `query_embedding` (number[]), `k_limit` (number), `similarity_threshold` (number) y `retrieved_context` (Array) como Annotations del State.

### C. Cliente Supabase (`src/services/supabase.ts` - Nuevo)
- **Impacto:** No existe un cliente HTTP de Supabase (JS) en el backend. `src/services/db.ts` usa una librería `pg` tradicional.
- **Acciones:** Crear una instancia de Supabase Client inyectando las llaves del entorno para habilitar las llamadas `.rpc()`.

### D. El Nodo Recuperador (`src/nodes/retrieval_node.ts` - Nuevo)
- **Impacto:** Es la pieza central del RFC-049.
- **Acciones:** 
  1. Validar la existencia absoluta de `tenant_id` (Application-Level Security) antes de operar.
  2. Consumir `query_embedding` desde el estado de LangGraph.
  3. Ejecutar `supabase.rpc('match_tenant_memories', { query_embedding, match_threshold, match_count, p_tenant_id })`.
  4. Mapear resultados y mutar el `GraphState` populando `retrieved_context`.

### E. Refactorización del Grafo y Nodos de Orquestación (`src/graph.ts` y `src/nodes/rag.ts`)
- **Impacto (`src/graph.ts`):** Ajustar las conexiones (Edges) del grafo. Se debe construir una ruta secuencial: Generación de Embeddings -> `RetrievalNode` -> `RagNode` (Generación de respuesta).
- **Impacto (`src/nodes/rag.ts`):** El nodo de generación abandonará el *Tool Calling* asíncrono para la búsqueda de información. Su *System Prompt* deberá actualizarse para recibir e inyectar de manera declarativa el string del `retrieved_context` provisto por el paso anterior.
- **Impacto Secundario (`src/tools/rag.ts` y `src/services/db.ts`):** Depreciar y eliminar la herramienta `searchKnowledgeBaseTool` y el código mockeado `searchChunks`.

## 3. Efectos Secundarios y Riesgos
1. **Seguridad (Aislamiento de Tenants):** El uso de Service Role Keys con Supabase bypassa las reglas RLS. Es estrictamente necesario que la función RPC `match_tenant_memories` filtre a nivel base de datos (`WHERE tenant_id = p_tenant_id`) en SQL, tal como lo indica el punto 4.3 del RFC-049.
2. **Latencia del Pipeline (CPU Throttling):** Al fragmentar un único Tool Call en múltiples nodos secuenciales (Node Embedding $\rightarrow$ Node DB RPC $\rightarrow$ Node LLM Generación), aumenta el tiempo acumulado de procesamiento en Cloud Run, debiendo monitorizar el tiempo de respuesta total para prevenir los errores documentados en el `ADR-101`.