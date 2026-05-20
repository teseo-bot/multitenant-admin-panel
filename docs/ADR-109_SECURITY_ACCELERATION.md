# ADR-109: Plan de Intervención y Aceleración de Seguridad (Security Acceleration)

**Fecha:** 1 de mayo de 2026
**Estado:** Aprobado
**Autor:** Teseo (Gerente AIDevops) / Jorge García (CEO)

## 1. Contexto y Problema
La auditoría arquitectónica del 1 de mayo de 2026 (`PLAN_OPTIMIZACION_2026-05.md`) detectó vulnerabilidades críticas (P0 y P1), incluyendo la filtración de secretos en el historial de Git, el uso indebido de `service_role` en Supabase (rompiendo el modelo de RLS), y un *fallback* hardcodeado que mezcla datos de clientes no identificados en la base de datos de Comerseg.

El plan original proponía una remediación extendida a 6 sprints (12 semanas). Esta ventana de tiempo de exposición es inaceptable para vulnerabilidades que comprometen el aislamiento de datos multi-tenant y la integridad del sistema (riesgo regulatorio y pérdida de SOC2).

## 2. Decisión
Se rechaza la calendarización del auditor y se aprueba un **Plan de Intervención Acelerada de 3 Sprints**, declarando una "Ley Marcial de Builds" (congelación total de *features* nuevos) hasta remediar la deuda técnica y de seguridad crítica.

## 3. Plan de Acción (3 Sprints)

### Sprint 1: Vector Crítico (Seguridad y Aislamiento Multi-Tenant) - **P0**
- Ejecutar `git filter-repo` para purgar secretos vivos del historial de Git.
- Rotación masiva de credenciales (Supabase, Telegram, GCP, Odoo).
- Eliminación estricta del *fallback* de Comerseg (`index.ts:104`); rechazar con HTTP 400 cualquier webhook sin `tenant_id` válido o JWT.
- Revocar el uso de `service_role` en la capa de ingesta; transición obligatoria a cliente autenticado con `search_path` por tenant.

### Sprint 2: Vector Arquitectónico (SSOT y Modelos) - **P1**
- Inyección centralizada de modelos LLM en `services/llm.ts` vía variables de entorno.
- Eliminación de referencias hardcodeadas a `gemini-2.5-*`.
- Erradicación del estado fantasma `'paused'` en el grafo, mapeándolo a `'human_takeover'`.
- Certificación de tests E2E contra `gemini-3.1-pro-preview`.

### Sprint 3: Vector de Resiliencia (Observabilidad y QA) - **P2**
- Implementación de `failed_events` para el manejo de Dead Letter Queue (DLQ).
- Limpieza del pipeline de CI/CD: configuración de `vitest`, bloqueo de la rama `main` y adición de `gitleaks`.
- Transición a logs estructurados y eliminación de `console.log/error`.

## 4. Consecuencias
- Cero desarrollo de nuevas funcionalidades comerciales durante las próximas 6 semanas.
- Garantía contractual de aislamiento de datos (Data Isolation) entre tenants para prospectos Enterprise.
- Cierre definitivo de la amnesia de estado y el drift de modelos reportado en el ADR-107.