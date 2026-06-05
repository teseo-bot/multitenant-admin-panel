ALTER TABLE public.tenant_behavior_settings
ADD COLUMN IF NOT EXISTS allowed_expressions jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS forbidden_expressions jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS intermittent_typing boolean DEFAULT false;
