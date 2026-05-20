# RFC-056: Arquitectura del Nodo SDR (BANT) y Orquestación HITL

## 1. Contexto y Objetivo
El Nodo SDR dentro del Orquestador LangGraph tiene el propósito de calificar leads basándose en el framework BANT (Budget, Authority, Need, Timeline) y decidir si debe agendar una reunión, actualizar el CRM o transferir la conversación a un agente humano (Human-In-The-Loop - HITL).

## 2. Decisiones Arquitectónicas (ADRs)

### 2.1 Acceso Directo a PostgreSQL (Service Role Bypass)
El nodo SDR y sus dependencias (herramientas) operarán como servicios Backend privilegiados.
- **Implementación:** Se usará `Supabase Service Role Key` para bypasear Row Level Security (RLS) en la capa de herramientas (e.g., `updateLeadProfileTool`).
- **Justificación:** Operaciones como encolar tickets para revisión humana (HITL a través de `pg-boss`) o consultar métricas globales de disponibilidad cruzan límites de tenant y requieren privilegios de sistema.

### 2.2 Desacoplamiento Cognición vs. Emisión (Humanizer)
Para evitar el "efecto interrogatorio" en la extracción BANT, el flujo se divide en:
1.  **Capa Cognitiva (SDR Node):** Evalúa el estado del Lead. Su prompt (system prompt) es estricto y analítico. Salida interna: "Preguntar sobre Budget".
2.  **Capa de Emisión / Humanizer:** No es un nodo independiente de LangGraph que modifique el flujo, sino un paso de pre-procesamiento / generación de lenguaje dentro de la respuesta del nodo SDR antes de enviar el mensaje, o una directiva en el prompt de respuesta. Para simplificar, inyectaremos instrucciones de "Styling/Persona" en el propio nodo SDR o en el bloque Dispatcher final, garantizando que el mensaje de salida mantenga empatía.

### 2.3 Workflow HITL y Estado (Checkpointer)
- Cuando el SDR invoca `escalateToHumanTool`, el grafo transita al bloque que marca la necesidad de intervención.
- El checkpointer de LangGraph preserva el hilo.
- Un worker asíncrono notificará al vendedor humano (vía Inbox UI o webhook).

## 3. Plan de Implementación (WBS)
1.  **Actualización de `src/nodes/sdr.ts`:**
    - Ajustar el System Prompt para inyectar el marco BANT.
    - Implementar lógica de llamado a herramientas (`updateLeadProfileTool`, `escalateToHumanTool`).
2.  **Implementación de Herramientas de SDR (`src/tools/sdr.ts`):**
    - `updateLeadProfileTool`: Zod schema para BANT. Uso de cliente Supabase con Service Role.
    - `escalateToHumanTool`: Actualiza el estado del thread/lead indicando "requires_human".
3.  **Lógica del Dispatcher / HITL (`src/nodes/dispatcher.ts` o Worker):**
    - Revisar que los mensajes escalados interrumpan el flujo (ya está configurado en `interruptBefore: ["dispatcher"]`).

## 4. Restricciones
- Ningún código del SDR debe acceder a Supabase mediante clientes con tokens anónimos o RLS limitado, debe instanciar el cliente con `SERVICE_ROLE_KEY`.
