# Reporte de Impacto y Enrutamiento (ADR-109 FinOps)

## 1. Análisis de Ubicación y Arquitectura
**Aviso Importante:** El directorio `/Users/teseohome/projects/fleetco` referenciado originalmente no existe bajo ese nombre exacto. Tras consultar el entorno de trabajo, se determinó que la orquestación basada en **LangGraph** (StateGraph y ejecución de LLMs) reside en el microservicio:
👉 `/Users/teseohome/projects/fleetco-claw/`

La base de conocimientos de TeseoKDB indica que la aplicación utiliza LangGraph de forma explícita para control de estado y flujos.

## 2. Puntos de Inyección e Intercepción

### A. Instanciación del Service Role de Supabase
- **Ruta recomendada:** `/Users/teseohome/projects/fleetco-claw/src/finops/FinOpsLogger.ts` (NUEVO)
- **Implementación:** Se debe exportar una clase `FinOpsLogger` que internamente instancie `@supabase/supabase-js` utilizando `process.env.SUPABASE_URL` y `process.env.SUPABASE_SERVICE_ROLE_KEY`. Esto permitirá eludir las restricciones de RLS y escribir de manera asíncrona la telemetría, tal como se especifica en el ADR-109.

### B. Intercepción del `StateGraph` / LLM para el `token_usage`
La orquestación principal y los agentes derivan de instancias de `ChatOpenAI`. No se debe bloquear el flujo del StateGraph directamente. La mejor técnica es utilizar el sistema de **Callbacks de LangChain**:
1. **Crear el Callback Handler:** 
   - **Ruta:** `/Users/teseohome/projects/fleetco-claw/src/finops/FinOpsCallbackHandler.ts` (NUEVO)
   - Extender de `BaseCallbackHandler` y sobrescribir el método `handleLLMEnd(output)`.
   - Extraer `output.generations[0][0].message.response_metadata.token_usage`.
   - Llamar a `FinOpsLogger.logUsageAsync()` sin `await`.

2. **Inyección en los LLMs existentes:**
   Se deben modificar los archivos donde se instancian los modelos para inyectar `callbacks: [new FinOpsCallbackHandler(...)]`:
   - `/Users/teseohome/projects/fleetco-claw/src/orchestrator/gatekeeper.ts` (en `triageLlm`).
   - `/Users/teseohome/projects/fleetco-claw/src/agents/support-l1/agent.ts` (en `const llm = new ChatOpenAI(...)`).
   - `/Users/teseohome/projects/fleetco-claw/src/agents/chitchat/agent.ts` (y los demás agentes en la carpeta `agents/*` que utilicen `ChatOpenAI`).

## 3. Advertencias y Restricciones (TeseoKDB & Contexto)
1. **Restricción de Latencia (Asincronía Obligatoria):** Las llamadas a Supabase **no deben bloquear** el hilo principal de los Nodos del grafo. El callback `handleLLMEnd` debe ejecutar "fire-and-forget" capturando promesas fallidas (`.catch(console.error)`).
2. **Contexto de Seguridad B2B (Tenant ID):** En los nodos de los agentes (ej. `supportL1Node`), el `tenantId` ya está siendo extraído del estado (`state.tenantId`). El callback handler deberá recibir este `tenantId` al instanciarse para poder asociar correctamente los tokens en Supabase.
3. **Persistencia Actual en Prisma:** Actualmente, `fleetco-claw` utiliza Prisma y una BD propia (`schema.prisma` con pgvector y el modelo `AgentInteraction`). El `tenant_token_usage` en Supabase será un registro paralelo enfocado estrictamente a **FinOps** independiente del KDB local, de acuerdo con el patrón dictado en el ADR-109. No se debe modificar `schema.prisma` de fleetco-claw para esto; se asume la ejecución de raw SQL (o migraciones directas de Supabase) para la tabla `tenant_token_usage`.

## 4. Archivos a Modificar (Rutas Absolutas)
- **Nuevos:**
  - `/Users/teseohome/projects/fleetco-claw/src/finops/FinOpsLogger.ts`
  - `/Users/teseohome/projects/fleetco-claw/src/finops/FinOpsCallbackHandler.ts`
- **A Modificar (Inyección del Callback):**
  - `/Users/teseohome/projects/fleetco-claw/src/orchestrator/gatekeeper.ts`
  - `/Users/teseohome/projects/fleetco-claw/src/agents/support-l1/agent.ts`
  - `/Users/teseohome/projects/fleetco-claw/src/agents/sdr-outbound/agent.ts`
  - `/Users/teseohome/projects/fleetco-claw/src/agents/staff-it/agent.ts`
  - `/Users/teseohome/projects/fleetco-claw/src/agents/staff-dm/agent.ts`
  - `/Users/teseohome/projects/fleetco-claw/src/agents/staff-general/agent.ts`
  - `/Users/teseohome/projects/fleetco-claw/src/agents/chitchat/agent.ts`
  - `/Users/teseohome/projects/fleetco-claw/src/agents/content-creator/agent.ts`
- **Módulos Requeridos:**
  Asegurarse de que `fleetco-claw` tenga instalado `@supabase/supabase-js`. Actualmente `package.json` no lo lista.

---
**Firma:** Learner (Investigador) - Contexto Asimilado. Cero código generado. Listo para Ejecutor.