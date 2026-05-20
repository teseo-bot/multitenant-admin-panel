# ADR-113: Arquitectura y Capa de Datos del Asset Studio

**Fecha:** 2026-04-20
**Estado:** Aprobado e Implementado (Fases 1 y 2)
**Contexto:**
Se requiere un módulo (`Asset Studio`) dentro de `crm-agentico-panel` para gestionar prompts, variables y AB tests (multi-tenant). El Builder generó el RFC-015 para delinear este módulo.

**Decisiones Estructurales:**
1. **Base de Datos (PostgreSQL/Supabase):** 
   - 6 tablas: `prompt_templates`, `prompt_versions`, `ab_experiments`, `ab_variants`, `ab_impressions`, `variable_defs`.
   - **Dependencia Circular:** Resuelta mediante `ALTER TABLE ... DEFERRABLE INITIALLY DEFERRED` para la Foreign Key `winner_variant_id` y `active_version_id`.
   - **Integridad de Tráfico (AB Testing):** Constraint Trigger implementado (`sum(traffic_pct) = 100`) evaluado al final de la transacción (`DEFERRABLE INITIALLY DEFERRED`).
   - **Seguridad (RLS):** Aislamiento forzado en las 6 tablas con `tenant_id = (auth.jwt() ->> 'tenant_id')::uuid`. Fail-closed (si no hay tenant, 0 filas).

2. **Backend For Frontend (BFF):**
   - Implementado usando Next.js App Router API Routes.
   - Todo payload entrante se valida usando esquemas de `Zod`. Cero inyecciones de código tipo `any`.
   - Autenticación manejada mediante `createServerClient` de `@supabase/ssr`.

3. **Arquitectura de Estado (UI vs Server):**
   - **Server State:** Exclusivamente delegado a TanStack Query v5 (queries y mutations). Controla la caché de los assets extraídos del BFF.
   - **UI State:** Exclusivamente delegado a Zustand v5 (Store transitorio). Maneja páneles activos, modales y borradores en memoria. No se mezcla con el data fetching.

**Consecuencias:**
- La arquitectura asegura que los inquilinos no accedan a prompts cruzados y la validación matemática de experimentos A/B recae en la BD y Zod.
- La separación de estado reduce el prop-drilling y previene la saturación de Zustand.
- *Deuda Técnica Asumida (Hardening):* Faltan algunos índices en las FKs para escalamiento futuro y chequeos explícitos de autorización HTTP 401 en endpoints state-machine (aunque el RLS los protege). Se registrarán en el backlog.