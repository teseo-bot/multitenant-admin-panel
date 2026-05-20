-- Migración FinOps ADR-137
-- Creado en 2026-04-22

CREATE TABLE IF NOT EXISTS public.finops_model_pricing (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    model_name TEXT NOT NULL UNIQUE, -- ej. "google/gemini-3.1-pro-preview"
    input_cost_per_million NUMERIC NOT NULL,
    output_cost_per_million NUMERIC NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.finops_token_ledger (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    thread_id TEXT NOT NULL,
    model_name TEXT NOT NULL,
    input_tokens INTEGER NOT NULL,
    output_tokens INTEGER NOT NULL,
    total_cost NUMERIC NOT NULL DEFAULT 0.0,
    metadata JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para el Dashboard FinOps
CREATE INDEX IF NOT EXISTS idx_finops_ledger_tenant ON public.finops_token_ledger(tenant_id);
CREATE INDEX IF NOT EXISTS idx_finops_ledger_created_at ON public.finops_token_ledger(created_at);

-- Trigger Opcional para calcular costos on-insert (si queremos delegarlo a BD)
CREATE OR REPLACE FUNCTION public.calculate_finops_cost()
RETURNS trigger AS $$
DECLARE
    in_cost NUMERIC;
    out_cost NUMERIC;
BEGIN
    SELECT input_cost_per_million, output_cost_per_million
    INTO in_cost, out_cost
    FROM public.finops_model_pricing
    WHERE model_name = NEW.model_name;

    IF FOUND THEN
        NEW.total_cost := ((NEW.input_tokens / 1000000.0) * in_cost) + ((NEW.output_tokens / 1000000.0) * out_cost);
    ELSE
        -- Default to zero if model is not priced yet
        NEW.total_cost := 0.0;
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER calculate_finops_cost_trigger
BEFORE INSERT ON public.finops_token_ledger
FOR EACH ROW
EXECUTE FUNCTION public.calculate_finops_cost();

-- Insertar precios base de Gemini 3.1 Pro (Ejemplo)
INSERT INTO public.finops_model_pricing (model_name, input_cost_per_million, output_cost_per_million)
VALUES ('google/gemini-3.1-pro-preview', 1.25, 5.00)
ON CONFLICT (model_name) DO NOTHING;
