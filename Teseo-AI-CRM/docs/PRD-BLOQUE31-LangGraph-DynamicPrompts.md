# PRD Bloque 31: LangGraph Dynamic Prompts & Herramientas SDR

## 1. Objetivo y Contexto
El objetivo de este bloque es refactorizar `crm-agentico-orchestrator` para eliminar la dependencia de prompts hardcodeados en el código fuente. En su lugar, los *System Messages* para los agentes (SDR, Gatekeeper y RAG) se hidratarán dinámicamente desde la base de datos Supabase de Mission Control. Adicionalmente, se integrarán las herramientas de web scraping y sincronización de leads en el nodo del SDR.

## 2. Diseño Arquitectónico: Hidratación Dinámica de Prompts

### 2.1. Origen de Datos
- **Base de Datos:** Supabase de Mission Control.
- **Tabla:** `tenant_configs`.
- **Columna Objetivo:** `semantic_prompts` (tipo JSON/JSONB).

### 2.2. Flujo de Ejecución (LangGraph)
1. **Inicialización del Grafo:** Al inicio del ciclo de LangGraph o al instanciar el flujo para un tenant específico, se debe realizar una consulta asíncrona a Supabase para obtener el registro correspondiente en `tenant_configs`.
2. **Inyección en el Estado:** El JSON recuperado de `semantic_prompts` debe inyectarse en el `State` del grafo (ej. `state.prompts`) para que esté disponible para todos los nodos.
3. **Consumo por Nodos:**
   - **Nodo Gatekeeper:** Leerá la clave correspondiente (ej. `state.prompts.gatekeeper_system_prompt`).
   - **Nodo RAG:** Leerá la clave correspondiente (ej. `state.prompts.rag_system_prompt`).
   - **Nodo SDR:** Leerá la clave correspondiente (ej. `state.prompts.sdr_system_prompt`).
4. **Fallback/Caché:** Implementar un mecanismo de fallback con prompts por defecto en caso de fallo en la conexión a Supabase, y opcionalmente una caché en memoria para no sobrecargar Supabase en cada turno de conversación si el prompt no cambia.

## 3. Inyección de Herramientas en el Nodo SDR

### 3.1. Herramientas a Integrar
1. `scrapeWebsiteTool`: Permite al SDR investigar el sitio web del prospecto.
2. `syncCrmLeadTool`: Permite al SDR guardar o actualizar la información del lead directamente en el CRM.

### 3.2. Estrategia de Inyección
- Las herramientas se deben vincular (`bind_tools`) al LLM instanciado específicamente dentro del nodo **SDR**.
- El `State` de LangGraph debe soportar un arreglo de mensajes compatible con llamadas a herramientas (`ToolMessage`, `AIMessage` con `tool_calls`).
- El nodo SDR debe tener un `addConditionalEdges` hacia un nodo de tipo `ToolNode` (o equivalente según SDK) que contenga el registro de `scrapeWebsiteTool` y `syncCrmLeadTool`.
- Tras la ejecución de las herramientas, el flujo debe regresar al nodo SDR mediante un `addEdge` directo desde el `ToolNode` al SDR, para que el LLM evalúe el resultado y genere la respuesta final al usuario.

## 4. Work Breakdown Structure (WBS) para el Ejecutor

- [ ] **Fase 1: Preparación del Estado y Conexión a BD**
  - [ ] **Tarea 1.1:** Actualizar la definición del `State` de LangGraph para incluir la propiedad `prompts` (diccionario/objeto).
  - [ ] **Tarea 1.2:** Implementar el cliente/servicio `fetchTenantPrompts(tenantId)` que consulte Supabase (`tenant_configs` -> `semantic_prompts`).
  - [ ] **Tarea 1.3:** Crear un nodo inicial (ej. `setup_context_node`) o middleware en el grafo que ejecute la consulta a Supabase e hidrate `state.prompts`.

- [ ] **Fase 2: Refactorización de Nodos Secundarios (Gatekeeper y RAG)**
  - [ ] **Tarea 2.1:** Modificar el nodo **Gatekeeper** para instanciar su prompt leyendo desde `state.prompts`.
  - [ ] **Tarea 2.2:** Modificar el nodo **RAG** para instanciar su prompt leyendo desde `state.prompts`.
  - [ ] **Tarea 2.3:** Limpiar los archivos de configuración y eliminar las constantes de prompts estáticos obsoletos.

- [ ] **Fase 3: Refactorización del Nodo SDR e Inyección de Tools**
  - [ ] **Tarea 3.1:** Modificar el nodo **SDR** para leer su *System Message* desde `state.prompts`.
  - [ ] **Tarea 3.2:** Importar e instanciar `scrapeWebsiteTool` y `syncCrmLeadTool` en el entorno del SDR.
  - [ ] **Tarea 3.3:** Modificar la inicialización del LLM en el SDR para usar la función de binding (ej. `.bind_tools([scrapeWebsiteTool, syncCrmLeadTool])`).
  - [ ] **Tarea 3.4:** Configurar el `ToolNode` en el grafo principal y asegurar que las conexiones condicionales desde el SDR enruten a `tools` cuando sea necesario, regresando al SDR post-ejecución.

- [ ] **Fase 4: Resiliencia y Logging**
  - [ ] **Tarea 4.1:** Implementar mecanismo de *fallback* para asegurar que los agentes tengan prompts base en caso de que Supabase devuelva null o falle por timeout.
  - [ ] **Tarea 4.2:** Incorporar logs estructurados para trazar cuándo el SDR decide invocar una herramienta.
