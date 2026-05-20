# Reporte de Contexto RAG: Fase 1 Asset Studio (Base de Datos y TypeScript)

Este reporte destila las convenciones, restricciones topológicas y hallazgos provenientes de **TeseoKDB** y el análisis del **RFC-015 Asset Studio**, preparando el camino libre de alucinaciones para el Ejecutor.

## 1. Rutas exactas de los archivos a modificar o crear

De acuerdo al árbol de directorios del proyecto, la estructura es un monorepo donde el dashboard reside en `crm-agentico-panel` y las migraciones en la raíz del backend (Supabase).

**SQL Migrations:**
*   `[NUEVO]` `/Users/teseohome/projects/Teseo-AI-CRM/supabase/migrations/<TIMESTAMP>_asset_studio_schema.sql` (Contendrá las 6 tablas principales: `prompt_templates`, `prompt_versions`, `ab_experiments`, `ab_variants`, `ab_impressions`, `variable_defs`, así como Enums y Políticas RLS).

**Contratos TypeScript (Domain Types):**
*   `[NUEVO]` `/Users/teseohome/projects/Teseo-AI-CRM/crm-agentico-panel/types/prompt.ts`
*   `[NUEVO]` `/Users/teseohome/projects/Teseo-AI-CRM/crm-agentico-panel/types/variable.ts`
*   `[NUEVO]` `/Users/teseohome/projects/Teseo-AI-CRM/crm-agentico-panel/types/experiment.ts`

## 2. Restricciones y Convenciones Extraídas (TeseoKDB + Proyecto Actual)

### A. Capa de Base de Datos (Supabase / PostgreSQL)
*   **Aislamiento Tenancy (RLS como Fuente de Verdad):** Toda tabla creada debe llevar estricto `ENABLE ROW LEVEL SECURITY`. Las políticas se basan siempre en la extracción segura del JWT: `(auth.jwt() ->> 'tenant_id')::uuid`. TeseoKDB prohíbe el bypass de esto por aplicación (Thin-layer BFF).
*   **Idempotencia DDL y Tipos ENUM:** Las migraciones SQL deben ser declarativas. Para crear tipos ENUMs (`prompt_version_status`, `variable_type`, etc.) es recomendable usar validaciones o el enfoque tradicional seguro dentro de las transacciones de Supabase migrations.
*   **Constraints Diferidos (Circular References):** La relación entre `prompt_templates.active_version_id` y `prompt_versions.id` es bidireccional. Para insertar de forma fluida (crear template -> crear versión -> actualizar template) es mandatorio el uso de `DEFERRABLE INITIALLY DEFERRED` en la clave foránea del template.
*   **Metadatos Cronológicos:** Columnas de control como `created_at` o `updated_at` deben usar `TIMESTAMPTZ NOT NULL DEFAULT now()`.
*   **Identificadores:** Utilizar `gen_random_uuid()` predeterminado del motor PostgreSQL (>13) / Supabase. 

### B. Capa de TypeScript
*   **Strict Mode (TeseoKDB TypeScript Standard):** Cero `any` explícitos (`@typescript-eslint/no-explicit-any`). Obligación de crear Single Responsibility Contracts segregados por dominio del negocio.
*   **Thin-BFF con Validación en el Edge:** Los route handlers de Next.js actúan como un proxy sin estado y sin lógicas de base de datos directas o mutaciones pesadas sin validar. Todo el input (`body`) debe parsearse y limpiarse obligatoriamente usando `Zod` antes de llegar a la capa persistente.
*   **Tipos Exportados Separados:** La definición de UI States viaja de forma independiente a la definición de dominio. No mezclar types del ORM/DB con el State de zustand (`AssetStudioState`).

## 3. Posibles Side-effects de esta Implementación

1.  **Deadlock de Inserción (Circular):** Si el ejecutor omite o implementa incorrectamente el `DEFERRABLE INITIALLY DEFERRED` de `active_version_id`, la aplicación arrojará error 500 al intentar crear el primer borrador (draft version) de un template, truncando el ciclo vital fundamental del RFC.
2.  **Fugas de Datos Multitenant (RLS Leakage):** Al habilitar las tablas secundarias (`prompt_versions`, `ab_variants`, `ab_impressions`), se corre el riesgo de no definirles RLS explícito o no enlazar la política correctamente haciendo un JOIN implícito (e.g. verificar que la versión corresponde a un template cuyo tenant coincide con el actual). Si un programador asume que hereda por tabla padre sin la policy, generará fugas laterales.
3.  **Race Condition de Version Numbering:** El esquema propuesto recupera secuencialmente el número de versión (obteniendo el último más uno). Bajo altas concurrencias por usuarios en un mismo tenant, puede detonar una violación de constraint Unique: `UNIQUE (template_id, version_number)`. Es necesario contemplar que en la inserción (Route Handler POST) se manejen fallas `409 Conflict` (o un retry lógico), o preverlo en la abstracción TypeScript futura.
4.  **Desincronización de Contratos:** Como los tipos TS de `/types` son declarados a mano en este esquema del RFC y no autogenerados vía introspection de Supabase CLI (por la velocidad del RFC), si la BD cambia una columna (`active_version_id` vs `activeVersionId`), el tipado requerirá mapping seguro o serialización con `camelcase-keys` y `snakecase-keys` para evitar crashes en tiempo de ejecución al hidratar TanStack Query.
