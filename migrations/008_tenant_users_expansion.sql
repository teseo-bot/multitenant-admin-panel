ALTER TABLE public.tenant_users ALTER COLUMN user_id DROP NOT NULL;
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS email text;
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS full_name text;
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS job_title text;
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS reports_to text;
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS security_notes text;
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS token_usage integer DEFAULT 0;
ALTER TABLE public.tenant_users ADD COLUMN IF NOT EXISTS last_active timestamp with time zone;
