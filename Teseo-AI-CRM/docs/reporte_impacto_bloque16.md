# Reporte de Impacto - Bloque 16: Nodo Investigador e Inteligencia Competitiva RAG

## 1. Restricciones Inquebrantables (TeseoKDB)
Tras inspeccionar la base de conocimiento empírica (`TeseoKDB`), se han identificado las siguientes directivas arquitectónicas que deben cumplirse sin excepción para el despliegue del nuevo nodo:
- **Middleware de Compactación de Contexto Gradual:** Para evitar saturar la ventana de contexto del LLM (como ocurre actualmente cuando se vuelcan bloques masivos), el producto del web scraping estructurado debe pasar por un proceso de compactación/destilación antes de integrarse al prompt del agente.
- **Aislamiento de Checkpoints (State Isolation):** Los agentes (SDR, Hunter, Evaluador) no deben compartir el "Checkpoint" de LangGraph completo. El Investigador debe inyectar únicamente el resumen destilado en el estado (`leadProfile` o un nuevo campo), desechando el HTML/JSON crudo recuperado.
- **Preferencia por Arnés Determinista:** Se debe reducir el andamiaje explícito de lógica IA e incrementar compuertas de seguridad deterministas (ej. control estricto de recuperación y errores en las llamadas a APIs externas como Hunter.io).

## 2. Archivos Exactos que Deben Modificarse
Para integrar el nodo sin romper la orquestación actual:
1. `src/orchestrator/src/graph.ts`: Registrar el nodo `investigador`, crear la función de ruteo/derivación hacia SDR/Hunter, y actualizar los `conditionalEdges`.
2. `src/orchestrator/src/state.ts`: 
   - Ampliar la interfaz `sourceNode` para incluir `"hunter"` e `"investigador"`.
   - Agregar campos para almacenar la inteligencia recolectada (ej. `investigator_data` o extender `leadProfile`).
3. `src/orchestrator/src/nodes/evaluator.ts`: Actualizar la función `routeAfterEvaluator` para que soporte ruteo inverso de `FAIL` hacia el nodo `"hunter"`.
4. `src/orchestrator/src/nodes/gatekeeper.ts` (Opcional): Si se abstrae la ruta "SDR" a un genérico "SALES/INBOUND".
5. **Nuevos Archivos:**
   - `src/orchestrator/src/nodes/investigador.ts` (Lógica de scraping y compactación).
   - `src/orchestrator/src/nodes/hunter.ts` (Nodo comercial agresivo/outbound, destino de la derivación).

## 3. Punto de Anclaje Propuesto para el Nodo Investigador
De acuerdo a la arquitectura actual, el punto de anclaje óptimo es **después de la clasificación inicial y antes de la lógica de ventas**:
- **Paso 1:** `gatekeeperNode` detecta una intención comercial o un lead entrante.
- **Paso 2 (Anclaje):** En lugar de enrutar directo a `sdrNode`, el grafo enrutará a `investigadorNode`.
- **Paso 3:** `investigadorNode` ejecuta el scraping, enriquece el perfil del lead y aplica la compactación gradual.
- **Paso 4 (Derivación):** Inmediatamente después del Investigador, se inserta una función de ruteo (`conditionalEdge`) que evalúa los datos enriquecidos y deriva la ejecución hacia `sdrNode` (nurturing) o `hunterNode` (cierre outbound/agresivo).
- **Paso 5 (Respeto al Bloque 15):** Tanto `sdrNode` como `hunterNode` tendrán sus ejes de salida (`__end__`) apuntando al `evaluatorNode`. Esto asegura que el filtro de calidad LLM-as-a-Judge siga operando para todas las respuestas generadas sin ser alterado.

## 4. Efectos Secundarios y Riesgos Identificados
- **Riesgo de Latencia I/O:** Las peticiones de scraping estructurado y llamadas a APIs (como `Hunter.io` para correos) introducen tiempos de espera asíncronos. Si el scraping tarda más de lo previsto, el pipeline podría provocar timeouts en canales síncronos (WhatsApp/Telegram). Se deben imponer timeouts estrictos en el código del Investigador.
- **Saturación del Payload:** Omitir la regla de "Compactación de Contexto" resultaría en la ruptura del límite de tokens del LLM de destino o en el fallo de la política de ventana deslizante en el `reducer` de LangGraph (`state.ts`).
- **Conflictos en el Evaluador (Hoyo Negro de Estado):** Si no se actualiza correctamente la propiedad `sourceNode` en `state.ts` y en `evaluator.ts`, una respuesta de baja calidad proveniente del nuevo nodo `hunter` que resulte en un `FAIL` causaría un fallback directo al `dispatcher`, enviando un mensaje defectuoso al cliente al no saber cómo reintentarlo.