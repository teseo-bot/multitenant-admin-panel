-- Expand branding configurations
ALTER TABLE public.tenant_configs 
ADD COLUMN IF NOT EXISTS secondary_color text DEFAULT '#6c757d',
ADD COLUMN IF NOT EXISTS background_color text DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS card_background_color text DEFAULT '#ffffff',
ADD COLUMN IF NOT EXISTS logo_light_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS logo_dark_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS favicon_url text DEFAULT '',
ADD COLUMN IF NOT EXISTS app_icon_url text DEFAULT '';

-- Add suspension columns to tenants
ALTER TABLE public.tenants
ADD COLUMN IF NOT EXISTS suspension_status text DEFAULT 'active',
ADD COLUMN IF NOT EXISTS suspension_reason text;

-- Add humanizer parameters to behavior
ALTER TABLE public.tenant_behavior_settings
ADD COLUMN IF NOT EXISTS humanizer_enabled boolean DEFAULT true,
ADD COLUMN IF NOT EXISTS typo_rate real DEFAULT 0.0,
ADD COLUMN IF NOT EXISTS pause_before_reply_ms integer DEFAULT 1000,
ADD COLUMN IF NOT EXISTS typing_speed_variance real DEFAULT 0.2;
