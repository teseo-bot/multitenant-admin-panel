-- Add missing operation and client columns to tenants
ALTER TABLE public.tenants 
ADD COLUMN IF NOT EXISTS telegram_bot_token text,
ADD COLUMN IF NOT EXISTS telegram_whitelisted_group_ids jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS company_name text,
ADD COLUMN IF NOT EXISTS contact_name text,
ADD COLUMN IF NOT EXISTS email text,
ADD COLUMN IF NOT EXISTS phone text,
ADD COLUMN IF NOT EXISTS finops_token_ledger integer DEFAULT 0;

-- Add missing branding columns to tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS primary_color text DEFAULT '#007bff',
ADD COLUMN IF NOT EXISTS accent_color text DEFAULT '#6c757d',
ADD COLUMN IF NOT EXISTS logo_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS theme_mode text DEFAULT 'system';

-- Create tenant_behavior_settings table
CREATE TABLE IF NOT EXISTS public.tenant_behavior_settings (
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    reading_speed_wpm integer DEFAULT 250,
    streaming_chunk_size integer DEFAULT 64,
    artificial_delay_ms integer DEFAULT 100,
    PRIMARY KEY (tenant_id)
);
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS fleetco_plus_enabled boolean DEFAULT false;
CREATE TABLE IF NOT EXISTS public.tenant_configs (
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    primary_color text,
    accent_color text,
    logo_url text,
    theme_mode text,
    PRIMARY KEY (tenant_id)
);
