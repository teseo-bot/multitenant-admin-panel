-- Migration: Add unique constraint to tenant name to prevent duplicates
ALTER TABLE public.tenants ADD CONSTRAINT uk_tenant_name UNIQUE (name);
