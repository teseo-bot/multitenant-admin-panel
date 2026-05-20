# RFC-049: Integración RAG en LangGraph (Bloque 11 - Fase 1)

## 1. Resumen Ejecutivo
Este documento define la arquitectura y el diseño para la integración del patrón RAG (Retrieval-Augmented Generation) dentro del **LangGraph Orchestrator**. Se implementará un nodo de recuperación (`Retrieval Node`) encargado de realizar búsquedas semánticas sobre la tabla `tenant_memories` utilizando `pgvector` en Supabase.

## 2. Principios Arquitectónicos (Cero Código, SOLID, DRY)
- **Single Responsibility Principle (SRP):** El nodo de recuperación tendrá una única responsabilidad: tomar un vector de búsqueda (embedding) y un `tenant_id`, comunicarse con Supabase y retornar el contexto relevante. No formateará prompts ni generará respuestas.
- **Dependency Inversion:** El cliente de Supabase se inyectará en el nodo, permitiendo mocks sencillos para pruebas unitarias.
- **DRY:** La lógica de instanciación del cliente de Supabase y la validación del tenant se reutilizarán desde middlewares/helpers existentes.

## 3. Estructura del Nodo LangGraph (`RetrievalNode`)

### 3.1. Dependencias
- `@supabase/supabase-js`: Cliente REST para la interacción HTTP con Supabase.
- Tipos compartidos del `State` del grafo de LangGraph.

### 3.2. I/O Esperados (Contrato de Estado)
**Input (del `State` del grafo):**
- `tenant_id` (UUID): Identificador estricto del inquilino.
- `query_embedding` (Array<number>): Representación vectorial de la consulta del usuario, generada en un nodo previo.
- `k_limit` (Number, opcional): Límite de resultados a recuperar (por defecto: 5).
- `similarity_threshold` (Number, opcional): Umbral de similitud mínima.

**Output (hacia el `State` del grafo):**
- `retrieved_context` (Array<MemoryObject>): Lista estructurada de memorias recuperadas de la base de datos.
- `rag_status` (String): Estado de la operación (`SUCCESS`, `NO_RESULTS`, `ERROR`).

### 3.3. Interacción con Supabase
La consulta no será un `select()` directo con filtros, sino que se invocará un **Stored Procedure (RPC)** especializado en similitud vectorial mediante el método `.rpc()` de Supabase JS.
- **RPC Propuesto:** `match_tenant_memories`
- **Payload HTTP:** `{ "query_embedding": [...], "match_threshold": 0.75, "match_count": 5, "p_tenant_id": "uuid-del-tenant" }`

## 4. Validaciones de Seguridad (Tenant Isolation)
El aislamiento de inquilinos es el requerimiento de seguridad de nivel 0 (Crítico).
1. **Application-Level:** El `RetrievalNode` debe lanzar una excepción crítica (y abortar el grafo) si el `tenant_id` en el `State` es nulo, indefinido o no es un UUID válido, antes de hacer la petición a la red.
2. **Database-Level (RLS - Row Level Security):** Aunque el cliente JS envíe `p_tenant_id`, la tabla `tenant_memories` debe tener políticas RLS estrictas forzando que el `auth.uid()` (o el rol de servicio con scope restringido) coincida de forma determinista con la columna `tenant_id`.
3. **RPC-Level:** El procedimiento almacenado debe incluir `WHERE tenant_id = p_tenant_id` como filtro hardcoded previo al cálculo de similitud de cosenos (`<=>`), para reducir el área de búsqueda vectorizada solo al subconjunto del inquilino (mejora performance y seguridad).

## 5. Work Breakdown Structure (WBS)

### Épica: Integración RAG en LangGraph (Bloque 11)

- **[Task 1.1] Diseño de Base de Datos y RPC (Pre-requisito)**
  - Definición de la función de base de datos `match_tenant_memories` (SQL).
  - Configuración de índices HNSW o IVFFlat en la columna `embedding` de `tenant_memories`.
  - Revisión y auditoría de políticas RLS para tenant isolation.

- **[Task 1.2] Implementación del Contrato de Estado (State)**
  - Actualizar los tipos e interfaces TS de LangGraph para incluir `query_embedding` y `retrieved_context`.

- **[Task 1.3] Desarrollo del `RetrievalNode`**
  - Implementación del nodo sin estado.
  - Inyección del cliente HTTP Supabase.
  - Bloques de manejo de excepciones y timeouts en llamadas HTTP REST.

- **[Task 1.4] Integración en el Orchestrator Graph**
  - Configuración del enrutamiento (`edges`): Conectar nodo de generación de embeddings -> nodo de recuperación -> nodo de generación (LLM).
  - Manejo de flujos condicionales (ej. saltar el RAG si la intención no requiere contexto).

- **[Task 1.5] Pruebas Unitarias y de Aislamiento (Tester)**
  - Pruebas unitarias de I/O del nodo aislando Supabase (Mocks).
  - Test de integración validando que `tenant A` no pueda extraer vectores de `tenant B`.
