# ADR-098: Balanceador de LLM Interno (LLM Router) y Política FinOps

| Campo | Valor |
|---|---|
| **ID** | ADR-098 |
| **Estado** | Aprobado |
| **Fecha** | 2026-04-18 |
| **Autor** | Builder (Planificador/Arquitecto Staff) |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | Teseo-AI-CRM / Orquestador |

## 1. Contexto y Problema
En el ADR-096 y ADR-097 se determinó que cada cliente (Tenant) tendrá infraestructura dedicada (Cloud Run, VectorDB) y que el Orquestador consumirá el LLM directamente sin pasar por un AI Gateway externo, ya que esto rompía el flujo de **Tool Calling** (schemas Zod).

Al hacer bypass del Gateway, perdimos dos capacidades críticas que el SaaS necesita para ser rentable y resistente:
1. **Fallback (Resiliencia):** Si la API de Google (Gemini) se cae o el cliente agota sus tokens (HTTP 429), LangGraph falla y el SDR no responde.
2. **Balanceo por Tier (FinOps):** No todas las preguntas necesitan el poder (y el costo) de un modelo Premium (Tier 1). Tareas simples como enrutar una intención (Gatekeeper) deberían usar un modelo más rápido y barato (Tier 2 o Tier 3) para ahorrarle dinero al cliente.

## 2. Decisión
Implementar un **LLM Router Interno** dentro de `src/orchestrator/services/llm-router.ts`.

Este módulo encapsulará la lógica de instanciación del cliente de LangChain (`@langchain/google-genai` o `@langchain/anthropic`) usando un sistema de Tiers y un array de llaves inyectadas vía variables de entorno.

### 2.1 Política de Tiers
El sistema admitirá 3 Tiers lógicos. El CEO o el panel de Teseo podrán configurar qué modelos exactos se asignan a cada Tier para cada Tenant (inyectando variables de entorno en GCP):

- **TIER_1 (Premium/Reasoning):** Tareas críticas, síntesis profundas o decisiones complejas. 
  - *Fallback predeterminado:* `gemini-3.1-pro-preview` o `claude-3-opus-20240229`.
- **TIER_2 (Fast/Tool-Calling):** Tareas transaccionales, SDR, uso intensivo de herramientas.
  - *Fallback predeterminado:* `gemini-2.5-flash` o `claude-3-haiku-20240307`.
- **TIER_3 (Open/Ultra-Fast):** Enrutamiento básico (Gatekeeper), clasificación de sentimiento o fallback de emergencia.
  - *Fallback predeterminado:* `llama-3.1-8b-instruct` o `gemini-1.5-flash`.

### 2.2 Inyección de Llaves y Fallback Asíncrono
- El Router leerá llaves separadas por comas desde `.env` o Cloud Run (ej: `LLM_API_KEYS="AIzaSy... , sk-ant-..."`).
- En caso de que un nodo de LangGraph reciba un error HTTP 429 (Quota Exceeded) o 5xx del proveedor, el `llm-router.ts` capturará la excepción, rotará automáticamente la API Key o degradará al siguiente Tier disponible, y reintentará la petición sin que LangGraph aborte la ejecución principal.

## 3. Consecuencias y Siguientes Pasos
- **Pros:** Resiliencia total ante caídas de proveedores de IA. Optimización de costos FinOps por Tenant. Mantenemos el "Tool Calling" nativo sin traducciones defectuosas de proxy.
- **Contras:** El código del orquestador incrementa su complejidad al tener que manejar reintentos y rotación de llaves que antes delegaba al Gateway.
- **Acción:** Desarrollar `llm-router.ts` y refactorizar los nodos (`rag.ts`, `gatekeeper.ts`, `sdr.ts`) para que soliciten al router un Tier específico en lugar de un modelo hardcodeado (ej. `getLLM({ tier: 2 })`).
