-- Migration: Setup Master DB (Tenants & Configs)
-- RFC-011: Supabase Master DB and Mission Control B2B

-- 1. Create Enums
CREATE TYPE tenant_status AS ENUM ('active', 'suspended', 'onboarding');

-- 2. Create `tenants` table
CREATE TABLE IF NOT EXISTS public.tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    status tenant_status NOT NULL DEFAULT 'onboarding',
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. Create `tenant_configs` table
CREATE TABLE IF NOT EXISTS public.tenant_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    system_prompt TEXT,
    llm_tier TEXT NOT NULL DEFAULT 'gemini-3.1-pro',
    features JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT uk_tenant_config UNIQUE (tenant_id)
);

-- 4. Enable Row Level Security (RLS)
ALTER TABLE public.tenants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant_configs ENABLE ROW LEVEL SECURITY;

-- 5. Create RLS Policies
-- Nota: Service Role de LangGraph ignora RLS automáticamente.
-- Estas políticas aseguran que solo usuarios autenticados (Admin en Mission Control)
-- puedan leer o escribir configuraciones. Se sugiere integrar validación vía auth.jwt() en producción.
CREATE POLICY "Admins full access on tenants"
ON public.tenants
FOR ALL 
TO authenticated
USING (true)
WITH CHECK (true);

CREATE POLICY "Admins full access on tenant_configs"
ON public.tenant_configs
FOR ALL
TO authenticated
USING (true)
WITH CHECK (true);

-- 6. Trigger: Auto-actualización de updated_at para configs
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER set_tenant_configs_updated_at
BEFORE UPDATE ON public.tenant_configs
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

-- 7. Documentación en esquema (PostgREST)
COMMENT ON TABLE public.tenants IS 'Almacena la identidad y estado de suscripción de clientes B2B.';
COMMENT ON TABLE public.tenant_configs IS 'Parámetros operacionales que dictan el comportamiento de la IA para cada tenant.';
