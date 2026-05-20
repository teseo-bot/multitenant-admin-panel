# ADR-110: Implementación del Worker Dead Letter Queue (DLQ)

**Fecha:** 1 Mayo 2026  
**Estado:** Aceptado  
**Autor:** Builder (coordinado por Teseo)  

## 1. Contexto y Problema
En episodios de alta concurrencia o intermitencias con las APIs de canales (Telegram, Meta) y proveedores de LLM (Gemini 3.1 Pro), el orquestador (`crm-agentico-orchestrator`) experimenta fallos de envío y ejecución de nodos en LangGraph. Actualmente, el mecanismo de supervivencia deposita los eventos críticos en la tabla `failed_events`, mitigando la pérdida inmediata de datos. Sin embargo, no existe un mecanismo activo que recicle y despache estos eventos; permanecen estancados pasivamente.

## 2. Decisión Arquitectónica
Se implementará un **Worker Cron/Background (DLQ Worker)** dentro de `crm-agentico-orchestrator`. 
La solución adoptará las siguientes directrices técnicas:

1. **Aislamiento de Ejecución:** El worker operará como un proceso en *background* dentro del mismo contenedor del orquestador o como un *entrypoint* separado (ej. `src/workers/dlq.ts`), garantizando acceso directo a la base de datos sin sobrecargar las rutas HTTP de webhooks.
2. **Estrategia de Reintentos (Exponential Backoff):** Los eventos se reintentarán escalonadamente (ej. 1m, 5m, 15m, 1h, max 24h). 
3. **Límite de Reintentos:** Se establece un máximo de 5 intentos por evento. Superado el límite, el registro pasará a un estado de fallo permanente (o se moverá a una tabla `dead_events` para análisis manual) para evitar ciclos infinitos.
4. **Control de Concurrencia Seguro:** La consulta a la tabla `failed_events` utilizará obligatoriamente `SELECT ... FOR UPDATE SKIP LOCKED` en PostgreSQL. Esto prevé y bloquea condiciones de carrera si el Enjambre (Swarm) escala a múltiples réplicas del contenedor.

## 3. Consecuencias
* **Positivas:** Resiliencia transaccional (Zero Data Loss) frente a caídas temporales de APIs de terceros. Aumento del SLA del sistema frente a los Tenants.
* **Negativas / Riesgos:** Aumento en el consumo de conexiones a Postgres. Requiere optimización en el *connection pool* (pg) y supervisión del uso de RAM para que grandes picos de fallos no causen un Out Of Memory (OOM) en el contenedor.