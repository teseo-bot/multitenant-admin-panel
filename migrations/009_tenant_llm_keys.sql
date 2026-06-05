CREATE TABLE IF NOT EXISTS public.tenant_llm_keys (
    id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
    tenant_id uuid REFERENCES public.tenants(id) ON DELETE CASCADE,
    provider text NOT NULL,
    api_key text NOT NULL,
    created_at timestamp with time zone DEFAULT NOW(),
    UNIQUE(tenant_id, provider)
);
