-- Migration: Migración Backend Branding y Usuarios (Paso 3 RFC)
-- Agrega columnas de UI Branding a tenant_configs y ajusta tenant_users.

-- 1. Enum ThemeMode
DO $$ BEGIN
    CREATE TYPE theme_mode AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 2. Enum UserRole
DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

-- 3. Modify tenants (Organizaciones)
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS domain TEXT UNIQUE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- 4. Modify tenant_configs
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT '222.2 47.4% 11.2%';
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT '210 40% 98%';
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS theme_mode theme_mode DEFAULT 'SYSTEM';

-- 5. Actualizar tenant_users
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS role_enum user_role DEFAULT 'MEMBER';
UPDATE public.tenant_users SET role_enum = 'MEMBER' WHERE role = 'user';
UPDATE public.tenant_users SET role_enum = 'ADMIN' WHERE role = 'admin';
ALTER TABLE public.tenant_users DROP COLUMN IF EXISTS role;
ALTER TABLE public.tenant_users RENAME COLUMN role_enum TO role;

-- 6. Trigger for updated_at on tenants
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_tenants_updated_at ON public.tenants;
CREATE TRIGGER set_tenants_updated_at
BEFORE UPDATE ON public.tenants
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();
