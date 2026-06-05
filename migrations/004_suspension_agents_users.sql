-- Add suspension_message to tenants
ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS suspension_message text;

-- Create tenant_agents table for Prompts & IA
CREATE TABLE IF NOT EXISTS public.tenant_agents (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    name text NOT NULL,
    model text DEFAULT 'gpt-4o',
    system_prompt text,
    module_assigned text,
    created_at timestamp with time zone DEFAULT NOW(),
    updated_at timestamp with time zone DEFAULT NOW()
);

-- Create tenant_users table for Access & Roles (Admin / Telemetry)
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    email text NOT NULL,
    role text DEFAULT 'viewer',
    token_usage integer DEFAULT 0,
    last_active timestamp with time zone,
    created_at timestamp with time zone DEFAULT NOW(),
    UNIQUE(tenant_id, email)
);
