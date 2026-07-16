-- 008_tenant_users_expansion.sql
-- Restaura en el plano de control GCP las columnas de expansión de tenant_users
-- que el esquema legacy de Supabase tenía en migrations/008 y que la app del panel
-- (lib/services/membership.ts) y el seed (scripts/seed-ui-demo.ts) requieren:
--   email, full_name, job_title, reports_to, phone, security_notes,
--   token_usage, last_active.
--
-- NO se replica el `ALTER COLUMN user_id DROP NOT NULL` de la migración legacy:
-- en el modelo GCP-Native (ADR-206) las membresías sin cuenta viven en
-- public.tenant_invitations, por lo que tenant_users.user_id permanece NOT NULL.
--
-- Idempotente: ADD COLUMN IF NOT EXISTS. Re-ejecutable sin efectos.

BEGIN;

ALTER TABLE "public"."tenant_users" ADD COLUMN IF NOT EXISTS "email"          text;
ALTER TABLE "public"."tenant_users" ADD COLUMN IF NOT EXISTS "full_name"      text;
ALTER TABLE "public"."tenant_users" ADD COLUMN IF NOT EXISTS "job_title"      text;
ALTER TABLE "public"."tenant_users" ADD COLUMN IF NOT EXISTS "reports_to"     text;
ALTER TABLE "public"."tenant_users" ADD COLUMN IF NOT EXISTS "phone"          text;
ALTER TABLE "public"."tenant_users" ADD COLUMN IF NOT EXISTS "security_notes" text;
ALTER TABLE "public"."tenant_users" ADD COLUMN IF NOT EXISTS "token_usage"    integer DEFAULT 0;
ALTER TABLE "public"."tenant_users" ADD COLUMN IF NOT EXISTS "last_active"    timestamp with time zone;

-- Índice de apoyo para el directorio global (búsqueda por email), consistente
-- con los índices creados en 002_rbac.sql.
CREATE INDEX IF NOT EXISTS "idx_tenant_users_email" ON "public"."tenant_users" ("email");

COMMIT;
