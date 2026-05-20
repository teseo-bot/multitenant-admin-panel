# ADR-096: Bypass del Teseo AI Gateway y Adopción Nativa de Google GenAI

| Campo | Valor |
|---|---|
| **ID** | ADR-096 |
| **Estado** | Aprobado |
| **Fecha** | 2026-04-17 |
| **Autor** | Teseo AIDevops |
| **Aprobador** | Jorge García |
| **Dominio** | CRM-Agentico Orchestrator |

## 1. Contexto y Problema

Durante las pruebas E2E del Orquestador Omnicanal (WhatsApp/Telegram) en Google Cloud Run, el sistema enfrentó un bloqueo crítico (HTTP 502 Bad Gateway / 404 / Timeout 403) continuo durante 28 horas.

El análisis de la causa raíz determinó que el problema no radicaba en el grafo de LangGraph, ni en la persistencia de PostgresCheckpointer, ni en el Lock Lógico asíncrono, sino en la capa intermedia: **Teseo AI Gateway**.

Teseo AI Gateway fue diseñado internamente como un reemplazo de LiteLLM (debido a fallos de seguridad de este último) para orquestar FinOps, balancear tokens y unificar llaves. Sin embargo:
1. **Incompatibilidad de Tool Calling (Structured Outputs):** LangChain inyecta esquemas complejos Zod al invocar `.bindTools()`. El Gateway intermedio no fue diseñado para traducir nativamente y sin pérdida de contexto estos esquemas estrictos de OpenAI hacia la API REST de Google Gemini V1 Beta.
2. **Health Probes Estrictos:** El proxy del Gateway realizaba verificaciones a endpoints deprecaos de Google sin autenticación, forzando un falso "failing" y expulsando la petición antes de que llegara a ejecutarse.
3. **Cuello de Botella Asíncrono:** La traducción intermedia crasheaba bajo carga de Tool Calling, generando fallos silenciosos donde Meta reintentaba el envío.

## 2. Decisión

1. **Desacoplar temporalmente al Orquestador del Teseo AI Gateway.**
2. Modificar `src/services/llm.ts` para instanciar el cliente oficial `@langchain/google-genai` usando `gemini-2.5-flash`.
3. Inyectar la API Key de Gemini de manera directa en las variables de entorno de Cloud Run (`GEMINI_DIRECT_KEY`).

## 3. Consecuencias y Siguientes Pasos

**Pros:**
- Las pruebas E2E pasan al 100% de manera instantánea.
- LangGraph asimila las herramientas y los esquemas Zod con total fiabilidad y sin pérdida de contexto.
- Se elimina el intermediario que causaba el cuello de botella.

**Contras / Deuda Técnica Asumida:**
- Se pierde el control FinOps centralizado del Gateway para las peticiones del CRM-Agentico.
- Los modelos quedan hardcodeados en el Orquestador en lugar de ser balanceados dinámicamente (`"auto"`).

**Acción de Investigación Aprobada:**
Debe iniciarse un análisis de ingeniería inversa sobre cómo LiteLLM maneja la serialización de *Tool Calling* de OpenAI a Gemini sin corromper el payload, para eventualmente reescribir esa funcionalidad en nuestro Teseo AI Gateway.

## 4. Alerta de Obsolescencia y Fallbacks (Septiembre 2026)
⚠️ **ALERTA CRÍTICA:** Google deprecia `gemini-2.5` en septiembre de 2026. 
Debido a que hemos hardcodeado `"gemini-2.5-flash"`, el Orquestador fallará catastróficamente si no se implementa una lógica de fallback y balanceo de carga *interna* dentro de `crm-agentico-orchestrator` antes de esa fecha. La re-adopción de un Gateway funcional o un LLM Router interno es mandatoria.
