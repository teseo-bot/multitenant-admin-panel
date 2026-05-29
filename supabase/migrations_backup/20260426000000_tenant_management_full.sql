-- ============================================================
-- Migration: ADR-200 Tenant Management Full Functionality
-- Date: 2026-04-26
-- Description: Consolidates branding columns, storage bucket,
--              user role enum, and tenant domain support.
-- Idempotent: YES (all operations use IF NOT EXISTS / ON CONFLICT)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Custom Types (idempotent)
-- ────────────────────────────────────────────────────────────

DO $$ BEGIN
    CREATE TYPE theme_mode AS ENUM ('LIGHT', 'DARK', 'SYSTEM');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE user_role AS ENUM ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ────────────────────────────────────────────────────────────
-- 2. Tenants table extensions
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS domain TEXT UNIQUE;
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

-- Updated_at trigger for tenants
DROP TRIGGER IF EXISTS set_tenants_updated_at ON public.tenants;
CREATE TRIGGER set_tenants_updated_at
  BEFORE UPDATE ON public.tenants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ────────────────────────────────────────────────────────────
-- 3. Tenant Configs — Branding columns
-- ────────────────────────────────────────────────────────────

ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS primary_color TEXT DEFAULT 'oklch(0.205 0 0)';
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS accent_color TEXT DEFAULT 'oklch(0.97 0.01 106.42)';
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.tenant_configs ADD COLUMN IF NOT EXISTS theme_mode TEXT DEFAULT 'SYSTEM';

-- ────────────────────────────────────────────────────────────
-- 4. Storage Bucket: tenant-assets
-- ────────────────────────────────────────────────────────────

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'tenant-assets',
  'tenant-assets',
  true,
  2097152,  -- 2MB
  ARRAY['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp']
) ON CONFLICT (id) DO NOTHING;

-- Storage RLS: public read
DO $$ BEGIN
  CREATE POLICY "public_read_tenant_assets" ON storage.objects
    FOR SELECT USING (bucket_id = 'tenant-assets');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Storage RLS: authenticated users can upload
DO $$ BEGIN
  CREATE POLICY "authenticated_upload_tenant_assets" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'tenant-assets');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Storage RLS: authenticated users can update their uploads
DO $$ BEGIN
  CREATE POLICY "authenticated_update_tenant_assets" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'tenant-assets');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- Storage RLS: authenticated users can delete
DO $$ BEGIN
  CREATE POLICY "authenticated_delete_tenant_assets" ON storage.objects
    FOR DELETE TO authenticated
    USING (bucket_id = 'tenant-assets');
EXCEPTION WHEN duplicate_object THEN null;
END $$;

-- ────────────────────────────────────────────────────────────
-- 5. Verification
-- ────────────────────────────────────────────────────────────

-- Verify columns exist (will fail loudly if something went wrong)
DO $$
BEGIN
  PERFORM column_name FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'tenant_configs' AND column_name = 'primary_color';
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Migration verification failed: primary_color column not found in tenant_configs';
  END IF;
END $$;
