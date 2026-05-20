# ADR-128: Post-Mortem y Cierre del Sprint 4 (HITL & DLQ)

| Campo | Valor |
|---|---|
| **ID** | ADR-128 |
| **Estado** | Aprobado |
| **Fecha** | 2026-04-21 |
| **Autor** | Teseo AIDevops |
| **Aprobador** | Jorge García (CEO) |
| **Dominio** | Resiliencia, Event-Driven Architecture, HITL |

## 1. Contexto de Ejecución
Este sprint abordó la necesidad crítica de Human-in-the-Loop (HITL) para que el SDR Autónomo pueda operar con supervisión humana en el *Command Center*, así como la creación de la infraestructura de resiliencia (DLQ) para mitigar fallos en las invocaciones asíncronas entre la base de datos (PostgreSQL) y el Orquestador (LangGraph).

## 2. Decisiones Implementadas
- **Renderizado Proactivo SSE (RFC-036):** Se implementó un *Zustand Ephemeral Store* para pintar chunks de texto en la vista del hilo, usando una estrategia de "Pruning Hook" para limpiar burbujas optimistas al recibir el *refresh* de la base de datos, mitigando Race Conditions.
- **Protocolo de Handoff (RFC-037):** El endpoint de handoff muta localmente y emite una señal `POST /api/internal/graph/interrupt` a LangGraph. Se usa el método `updateState` de LangGraph para inyectar `pipeline_status: paused` en el checkpointer, forzando un *Breakpoint* que enmudece al agente.
- **Dead-Letter Queue (DLQ):** Se estructuró la tabla `lead_assignment_outbox` en Supabase. Se acopló el reintento autónomo usando `pg_cron` (cada 5 minutos, hasta 5 intentos antes de pasar a estado `dead`). Se implementó un panel visual de administración en Next.js para inspeccionar fallos y forzar reintentos.

## 3. Consecuencias
- La estabilidad de las integraciones S2S se robustece; las llamadas asíncronas ya no son cajas negras de fallo silencioso.
- La experiencia del operador se humaniza al ver la inferencia del modelo en tiempo real.
- La arquitectura multimodular exige que el ambiente de producción (`DATABASE_URL`, `HONO_ORCHESTRATOR_URL`) esté alineado, de lo contrario la DLQ comenzará a llenarse.
