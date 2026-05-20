# ADR-105: Configurador Multi-Agente en Mission Control

| Campo | Valor |
|---|---|
| **ID** | ADR-105 |
| **Estado** | Propuesto |
| **Fecha** | 2026-04-19 |
| **Autor** | Teseo AIDevops |
| **Dominio** | Torre de Control B2B (Frontend/UI) |

## 1. Contexto y Problema

Tras la estabilización del pipeline E2E con el **LangGraph Orchestrator** y Supabase (ADR-104), identificamos una limitante funcional severa en la Torre de Control B2B (`Mission Control`): 
La tarjeta `AI Behavior Config` actual (desplegada en `/tenants/[id]`) fue diseñada con el falso supuesto de que el inquilino opera bajo una arquitectura *monolítica* de un solo prompt (SDR). 

Sin embargo, el despliegue real en Cloud Run utiliza una arquitectura Hub & Spoke con múltiples nodos especialistas:
1. **Gatekeeper (Enrutador Semántico)**
2. **SDR (Cualificador Comercial BANT)**
3. **L1 Support (Agente de Servicio al Cliente / RAG)**
4. **Content Creator / FinOps Router (Tareas en Background)**

Actualmente, modificar el comportamiento de estos agentes por separado (ej: hacer que el SDR sea más agresivo, pero que el L1 siga siendo empático) requiere modificar el código fuente de LangGraph o almacenar configuraciones complejas en el campo `features: JSONB` de Supabase sin interfaz gráfica.

## 2. Decisión (Propuesta de Rediseño UI/DB)

### 2.1 Refactorización de la Tabla `tenant_configs`
El esquema maestro de Postgres debe evolucionar de campos estáticos hacia un modelo relacional o un JSON fuertemente tipado:
- En lugar de `system_prompt` (VARCHAR), usar un campo `agent_prompts (JSONB)` que mapee IDs de nodo a sus instrucciones: `{"gatekeeper": "...", "sdr": "...", "l1": "..."}`.
- *Alternativa Relacional:* Crear tabla hija `tenant_agent_configs (id, tenant_id, node_name, prompt, tier)`.

### 2.2 Rediseño de la Vista de Inquilino (`/tenants/[id]`)
Transformar la tarjeta monolítica en un patrón maestro-detalle usando los componentes de **Tabs (Shadcn/ui)**.

**Estructura Propuesta:**
- **Tab: General:** Identity, Orchestrator URL, Secret Vault.
- **Tab: Gatekeeper:** Edición de lógica de enrutamiento y umbral de confianza (Confidence Score).
- **Tab: SDR Agent:** System Prompt Comercial, Modelo Asignado (`ultra` sugerido para BANT) y Webhook de Salesforce/Odoo.
- **Tab: Support L1:** System Prompt de soporte, URL de base de datos vectorial (TeseoKDB) y umbrales de escalación.

### 2.3 Middleware de Hidratación (`hydrate_context.ts`)
El orquestador en GCP deberá leer el objeto `agent_prompts` completo desde el caché y esparcirlo (`spread operator`) en el estado global (`GraphState.tenantConfig`), de modo que cada nodo (`sdrNode`, `ragNode`) extraiga exclusivamente el prompt de su sub-clave correspondiente.

## 3. Consecuencias y Siguientes Pasos
- **Pros:** Desbloquea la granularidad máxima. El CEO o el equipo de Ops podrá tunear sub-agentes en caliente sin tocar LangGraph.
- **Contras:** Incrementa la complejidad de la consulta de inicialización en PostgreSQL y obliga a rediseñar la UI de la tarjeta derecha en Mission Control.
- **Acción Inmediata (Siguiente Sprint):** Diseñar el esquema JSON de la tabla `tenant_configs` y crear la interfaz de Tabs en Next.js.