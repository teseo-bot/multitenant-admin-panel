# Reporte de Impacto Técnico - Learner (Bloque 31 Fase 2)
**Fecha:** Abril 2026
**Agente:** Learner (Investigador de Contexto)
**Repositorio:** `/Users/teseohome/projects/crm-agentico-orchestrator`

## 1. Topología LangGraph Actual
Tras el análisis directo del código fuente (cumpliendo con la Ley Marcial Documental), la topología se orquesta en `src/graph.ts`. 
- **Entrada (`START`):** `gatekeeper` (evaluador de intención).
- **Rutas Principales:** `gatekeeper` -> `sdr` (ventas) o `retrieval`/`rag` (soporte técnico/info) o `__end__`.
- **Nodos de Herramientas:** Centralizado. Las herramientas se combinan (`allTools = [...sdrTools, ...ragTools]`) y se cargan en un único `ToolNode` (línea 15 en `src/graph.ts`). Desde `toolsNode`, un edge condicional devuelve el flujo a `sdr` o `rag`.

## 2. Inyección de System Prompts
Los prompts actuales están codificados de forma dura (hardcoded) en cada nodo. Para inyectar los prompts provenientes de la Fase 1 (`prompts.ts`), se deben modificar los siguientes archivos:

*   **Gatekeeper:** `src/nodes/gatekeeper.ts`
    *   *Líneas:* 14-19
    *   *Acción:* Importar el prompt desde `prompts.ts` e inyectarlo en `const systemPrompt = new SystemMessage(...)`.
*   **SDR:** `src/nodes/sdr.ts`
    *   *Líneas:* 22-31
    *   *Acción:* Reemplazar la definición de `const systemPrompt` por el exportado desde la Fase 1, inyectando dinámicamente el `state.leadProfile`.
*   **RAG:** `src/nodes/rag.ts`
    *   *Líneas:* 14-21
    *   *Acción:* Reemplazar `const systemPrompt` por la constante equivalente.

## 3. Instanciación del `ToolNode` y Vinculación de Herramientas
*   **Instanciación del ToolNode:**
    *   *Archivo:* `src/graph.ts`
    *   *Línea:* 15 (`const toolsNode = new ToolNode<GraphStateType>(allTools);`)
    *   *Acción:* El nodo central ya está correctamente instanciado y conectado. Sin embargo, hereda las herramientas combinadas de RAG y SDR (línea 12).
*   **Vinculación de Web Scraping y CRM (SDR/Gatekeeper):**
    *   *Archivo:* `src/nodes/sdr.ts`
    *   *Líneas:* 8-15 (`export const sdrTools = [...]`)
    *   *Acción:* Aquí es donde se deben añadir las nuevas herramientas de web scraping y las de CRM. Actualmente contiene herramientas del workspace (calendario, inbox, drive). Al añadirlas aquí, se auto-propagarán al `ToolNode` en `graph.ts` y al binding del modelo en la línea 19 (`.bindTools(sdrTools)`).

## Conclusión
La arquitectura del StateGraph actual soporta bien la adición de nuevas tools a través de los arreglos estáticos de cada nodo (`sdrTools`, `ragTools`). La inyección de los System Prompts requiere limpiar los textos estáticos en los nodos (`gatekeeper.ts`, `sdr.ts`, `rag.ts`) y reemplazarlos por dependencias de la biblioteca de prompts maestra de la Fase 1. Se verificó en disco el estado completo.