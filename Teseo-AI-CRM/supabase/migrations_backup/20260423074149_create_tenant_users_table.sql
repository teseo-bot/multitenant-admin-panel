-- Migration to create the tenant_users junction table
CREATE TABLE IF NOT EXISTS public.tenant_users (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'user',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE(tenant_id, user_id)
);

-- Enable RLS
ALTER TABLE public.tenant_users ENABLE ROW LEVEL SECURITY;

-- Policy to allow admins or service role to manage tenant_users.
-- Since this is Mission Control and we use Service Role to provision initially,
-- we'll just add basic view policies.
CREATE POLICY "Users can view their own tenant_users relation"
    ON public.tenant_users
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service Role has full access to tenant_users"
    ON public.tenant_users
    FOR ALL
    USING (true)
    WITH CHECK (true);
