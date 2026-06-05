ALTER TABLE public.tenant_agents ADD COLUMN IF NOT EXISTS enabled_tools text[] DEFAULT '{}';
