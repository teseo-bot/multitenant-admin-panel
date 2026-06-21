-- 012_user_management_rbac.sql
-- WU-01 (E1): Modelo canónico de RBAC modular por tenant.
-- ADITIVO Y NO DESTRUCTIVO: sólo CREATE ... IF NOT EXISTS y ADD COLUMN IF NOT EXISTS.
-- Prohibido en esta migración: DROP / TRUNCATE / DELETE / SET NOT NULL (eso es 014_orphan_membership_fix.sql).
-- Idempotente: aplicar 2x no falla.

BEGIN;

-- ---------------------------------------------------------------------------
-- Catálogo global de módulos del SaaS.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."modules" (
    "id"          text PRIMARY KEY,            -- slug estable: 'crm', 'asset-studio', ...
    "name"        text NOT NULL,
    "description" text,
    "sort_order"  integer NOT NULL DEFAULT 0,
    "is_active"   boolean NOT NULL DEFAULT true,
    "created_at"  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Entitlement: qué módulos tiene contratados/activos un tenant.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."tenant_modules" (
    "tenant_id"  uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
    "module_id"  text NOT NULL REFERENCES "public"."modules"("id"),
    "is_active"  boolean NOT NULL DEFAULT true,
    "created_at" timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("tenant_id", "module_id")
);

-- ---------------------------------------------------------------------------
-- Permiso granular por miembro y módulo (sólo aplica a MEMBER / VIEWER).
-- OWNER / ADMIN tienen acceso implícito a todos los módulos activos del tenant.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."tenant_user_modules" (
    "tenant_user_id" uuid NOT NULL REFERENCES "public"."tenant_users"("id") ON DELETE CASCADE,
    "module_id"      text NOT NULL REFERENCES "public"."modules"("id"),
    "access_level"   text NOT NULL DEFAULT 'NONE',   -- NONE | READ | WRITE
    "created_at"     timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY ("tenant_user_id", "module_id"),
    CONSTRAINT "tenant_user_modules_access_level_chk"
        CHECK ("access_level" IN ('NONE', 'READ', 'WRITE'))
);

-- ---------------------------------------------------------------------------
-- Invitaciones: reemplaza el hack de user_id nullable. Un admin "registra" a
-- alguien que aún no tiene cuenta -> fila aquí, NO en tenant_users.
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."tenant_invitations" (
    "id"         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    "tenant_id"  uuid NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
    "email"      text NOT NULL,
    -- Rol como text + CHECK (no acoplado al ENUM public.user_role, que puede no
    -- existir en entornos mínimos). Valores alineados con el ENUM de prod.
    "role"       text NOT NULL DEFAULT 'MEMBER',
    "invited_by" uuid REFERENCES "auth"."users"("id"),
    "token"      text NOT NULL UNIQUE,
    "status"     text NOT NULL DEFAULT 'pending',    -- pending | accepted | revoked | expired
    "expires_at" timestamptz NOT NULL DEFAULT (now() + interval '7 days'),
    "created_at" timestamptz NOT NULL DEFAULT now(),
    CONSTRAINT "tenant_invitations_status_chk"
        CHECK ("status" IN ('pending', 'accepted', 'revoked', 'expired')),
    CONSTRAINT "tenant_invitations_role_chk"
        CHECK ("role" IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
    CONSTRAINT "tenant_invitations_tenant_email_key" UNIQUE ("tenant_id", "email")
);

-- ---------------------------------------------------------------------------
-- Auditoría de gestión de usuarios (quién hizo qué).
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS "public"."user_management_audit" (
    "id"          bigserial PRIMARY KEY,
    "actor_id"    uuid REFERENCES "auth"."users"("id"),
    "tenant_id"   uuid,
    "target_user" uuid,
    "action"      text NOT NULL,   -- invite | role_change | module_grant | suspend | delete | ...
    "detail"      jsonb,
    "created_at"  timestamptz NOT NULL DEFAULT now()
);

-- ---------------------------------------------------------------------------
-- Estado explícito de membresía.
-- ---------------------------------------------------------------------------
ALTER TABLE "public"."tenant_users"
    ADD COLUMN IF NOT EXISTS "status" text NOT NULL DEFAULT 'active';

-- ---------------------------------------------------------------------------
-- Índices de apoyo para el directorio global y la resolución de acceso.
-- ---------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS "idx_tenant_users_tenant_id" ON "public"."tenant_users" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_users_user_id"   ON "public"."tenant_users" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_users_status"    ON "public"."tenant_users" ("status");
CREATE INDEX IF NOT EXISTS "idx_tenant_modules_tenant"  ON "public"."tenant_modules" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_invitations_status" ON "public"."tenant_invitations" ("status");
CREATE INDEX IF NOT EXISTS "idx_uma_tenant"             ON "public"."user_management_audit" ("tenant_id");

COMMIT;
