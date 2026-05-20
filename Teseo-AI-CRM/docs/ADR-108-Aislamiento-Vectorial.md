# ADR-108: Refactor de Aislamiento Vectorial (Bypass de Mission Control)

## 1. Contexto
Durante el despliegue de la capa de Continuous Learning (Minion Worker), se detectó que la tabla vectorial `tenant_memories` y la cola de `pg-boss` fueron acopladas a la base de datos de Mission Control (Supabase).

El CEO observó correctamente que esto viola la directiva fundacional de ADR-097 (Aislamiento Single-Tenant). Mission Control (Supabase) es exclusivamente el plano de control (Facturación, Configuración de LLMs, Catálogo B2B). Los datos conversacionales y la memoria a largo plazo (RAG) de un cliente como Fleetco deben existir estricta y únicamente en su base de datos PostgreSQL dedicada, sin hacer llamadas a Mission Control durante la ejecución del grafo.

## 2. Decisión
Migrar la extensión `pgvector` y la tabla `tenant_memories` hacia la base de datos aislada del cliente (`DATABASE_URL`).
El Minion Worker y el Orquestador cortan toda dependencia de `SUPABASE_URL` y `SUPABASE_SERVICE_ROLE_KEY` para operaciones de inferencia o RAG.

## 3. Estado
Aprobado. Se planifica refactorización en el Track Primario.