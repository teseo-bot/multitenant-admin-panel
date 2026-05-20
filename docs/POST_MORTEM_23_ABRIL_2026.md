# POST_MORTEM_23_ABRIL_2026.md

## 1. Resumen Ejecutivo
Sprint dedicado a la resolución del Bloque 20: Bottom-Up Architecture (Data Access & RLS Bridge) en Teseo-AI-CRM. El objetivo principal fue inyectar el contexto de `tenantId` en la capa transaccional de Base de Datos para asegurar aislamiento criptográfico de datos (Zero-Trust/RLS).

## 2. Hitos Alcanzados (Bloque 20)
1. **Diseño (Builder):** Creación del `RFC-055-Bloque20-DataAccess-RLS-Bridge.md` documentando el patrón `TenantScopedClient` y las políticas RLS.
2. **Infraestructura RLS (Ejecutor):**
   - Desnormalización del `tenant_id` en `inbox_messages`.
   - Creación del rol PostgreSQL `app_tenant`.
   - Implementación de políticas RLS `CHECK` y `USING` atadas a `app.current_tenant` y `auth.uid()`.
   - Desarrollo e inyección en los 4 repositorios principales: `lead`, `message`, `memory`, y `finops`.
3. **Migración de Nodos LangGraph:** Refactor de `ingest.ts`, `hydrate_context.ts`, y `leads-assign.ts` para usar el cliente acotado por tenant y no el pool global.
4. **Validación E2E (Tester):** Implementación de la suite `data-bleed.test.ts`. Certificación de aislamiento: se bloquean lecturas/escrituras cruzadas.
5. **Correcciones de Seguridad (Reviewer):** Se interceptó y depuró la fuga del JWT `Service Role Key` expuesto inadvertidamente al frontend en ` mission-control/.env.local`.

## 3. Incidentes (Fricciones Operativas)
- **Fallo de Sintaxis PostgreSQL:** `SET app.current_tenant = $1` fue rechazado por la librería `pg` al intentar parametrizar un `SET`. **Resolución:** Refactorización inmediata hacia la función `SELECT set_config('app.current_tenant', $1, false)`.
- **Falla en Auditoría Final Inicial:** El primer dictamen del Reviewer fue FAIL CRÍTICO debido al "Service Role Key Disguise". Se resolvió reemplazando la llave comprometida por un placeholder estricto que exige un verdadero JWT de rol `anon`.

## 4. Estado Final
El Bloque 20 ha sido cerrado. El sistema opera ahora bajo un aislamiento estructural rígido a nivel PostgreSQL/RLS, erradicando el riesgo de "Data Bleeding" entre cuentas corporativas concurrentes en la misma base de datos lógica.

## 5. Próximo Sprint (Bloque 16)
Puntero activo delegado al: **Nodo Investigador (Inteligencia Competitiva RAG)**.