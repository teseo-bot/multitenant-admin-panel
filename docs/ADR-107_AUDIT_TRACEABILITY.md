# ADR-107: Complemento de Trazabilidad y Auditoría Arquitectónica

**Fecha:** 1 de Mayo de 2026
**Target:** `crm-agentico-orchestrator` (Ruta raíz: `/Users/teseohome/Teseo_AI`)
**Contexto:** Diagnóstico forense de fallos y regresiones del último sprint antes del despliegue concurrente. Diseñado como insumo de trazabilidad para revisión por Auditor (Opus 4.7).

## REGISTRO DE FALLOS Y MUTACIONES ESTRUCTURALES

### 1. Amnesia Estructural en Estado de LangGraph
- **Fallo:** Los webhooks subsecuentes llegaban sin *query params*, forzando a `src/index.ts` a enviar explícitamente `{ campaignId: null }`. Los reducers de `src/state.ts` sólo bloqueaban `undefined`, permitiendo que el estado histórico (`tenant_id`, `campaignId`) se sobrescribiera con `null`.
- **Mitigación:** Se blindaron los reducers: `(right !== undefined && right !== null) ? right : left`.
- **Directiva de Auditoría:** Validar que ninguna variable crítica en `src/state.ts` sea susceptible a inyecciones de valores nulos literales en la memoria del PostgreSQL Checkpointer.

### 2. Bloqueo Duro (400 Bad Request) por Tool Calling
- **Fallo:** La API de Gemini detonó un error de orden conversacional (`function call turn comes immediately after a user turn`) al procesar interacciones complejas. El historial del *thread* en PostgreSQL se envenenó irreversiblemente.
- **Mitigación:** Truncado manual del estado en BD (`DELETE FROM public.checkpoints WHERE thread_id = '...'`).
- **Directiva de Auditoría:** Revisar mitigaciones de bucles infinitos y sanitización de mensajes en el historial de LangGraph antes de inyectarlos al LLM.

### 3. Deuda Técnica Severa: Hardcoding de Modelos Obsoletos
- **Fallo:** Múltiples nodos (`src/services/llm.ts`, `gatekeeper.ts`, `sdr.ts`, `rag.ts`) tenían incrustado el uso obligatorio de `gemini-2.5-flash` o `gemini-2.5-pro`.
- **Estado:** Erradicación obligatoria hacia `gemini-3.1-pro-preview` dictaminada en el `MASTER_ARCHITECTURE.md` y `MEMORY.md`.
- **Directiva de Auditoría:** Escanear la base de código completa para garantizar que la instanciación de modelos dependa de variables de entorno o constantes centralizadas y no esté quemada directamente en los nodos.

### 4. Crash Inicial por Inconsistencia de Esquema (BD)
- **Fallo:** Falla en inicialización debido a la inexistencia de la columna `features` en la tabla `tenant_configs`.
- **Mitigación:** Se inyectó la migración `migrations/003_add_features.sql` (`features jsonb DEFAULT '{}'::jsonb`).
- **Directiva de Auditoría:** Analizar la carpeta `migrations/` y el archivo `docker-compose.yml` para garantizar consistencia absoluta entre el código (TypeORM/Drizzle/Prisma) y el DDL de PostgreSQL.

### 5. Fallos de Gateway y Red (Ngrok & Telegram API)
- **Fallo A:** Error 401 Unauthorized de la API de Telegram al conectar webhook por token revocado. (Resuelto actualizando `TELEGRAM_BOT_TOKEN` en `.env`).
- **Fallo B:** Error 400 Bad Request de Telegram `message text is empty` cuando LangGraph retornaba cadenas vacías. (Resuelto inyectando un validador *fallback* en la salida de `index.ts`).
- **Fallo C:** Error 503 Ngrok por mapeo de puerto incorrecto. (Resuelto cambiando `PORT=3000` a `PORT=8080` alineado al mapeo de Docker/Cloud Run).
- **Directiva de Auditoría:** Evaluar robustez del manejador de salida hacia Meta/Telegram, verificando que existan cadenas de error controladas para respuestas vacías o fallidas del LLM.

---
*Este documento queda registrado como estado activo de la arquitectura para validación del equipo de Agentes.*