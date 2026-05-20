# ADR-149: Cierre de Sprint (Bloques 13 y 14) - HITL Realtime, Analytics & FinOps

**Fecha:** 23 de Abril de 2026
**Estado:** Aprobado
**Contexto:**
Durante la ejecución de los Bloques 13 y 14, enfrentamos desafíos arquitectónicos derivados de las restricciones impuestas previamente en el entorno serverless (Cloud Run) detalladas en el ADR-136, específicamente la incapacidad de mantener conexiones TCP crudas para usar `pg_notify` en el Frontend.
Adicionalmente, los Dashboards de Analítica y FinOps contenían datos "mockeados" en el cliente que no reflejaban el estado de la BD.

**Decisión Técnica (Bloque 13 - HITL):**
1. **Realtime Websockets:** Se adoptó la solución nativa de Supabase Realtime (WSS) a través de `@supabase/supabase-js`. El hook `use-threads.ts` fue modificado para suscribirse directamente a eventos `INSERT` en la tabla `inbox_messages`, invalidando la caché de React Query en tiempo real (0ms de latencia) y respetando el pool de conexiones HTTP.
2. **Intercepción en LangGraph:** Se inyectó la variable `is_human_handled` en el `GraphState` (manejado por el Checkpointer de Postgres). 
3. **Señalización Webhook:** El panel Next.js ahora dispara un POST a `/api/internal/graph/interrupt` en el Python Compiler cuando ocurre un evento de "Takeover" o cuando el humano envía un mensaje directamente (Takeover implícito). El `gatekeeperNode` lee esta variable y, de ser verdadera, aborta la ejecución enrutando a `__end__`.

**Decisión Técnica (Bloque 14 - Dashboard & FinOps):**
1. **RPC Analítico:** Se implementó `rpc_get_leads_timeseries` (generando ventanas de 3 meses usando `generate_series`) para reemplazar los mocks en Recharts.
2. **FinOps Breakdown:** Se construyó una gráfica agregada en React Recharts para visualizar los consumos por modelo, facilitando la auditoría de costos (Gemini Flash vs Claude Sonnet).
3. **Caché Defensiva (React Query):** Todas las vistas de Command Center configuran un `staleTime` agresivo (5 mins) para evitar que F5 repetitivos agoten el Connection Pool.

**Consecuencias:**
- La arquitectura ahora es asíncrona pero altamente responsiva en el cliente (Optimistic UI + WS).
- Se habilitó la "Auditoría Financiera Real", fundamental para la siguiente fase.
- El sistema está listo para avanzar a la fase de campañas masivas (Bloque 15) donde el gasto de tokens se disparará y el Auditor entrará en juego.
