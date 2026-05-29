-- Migración FinOps View ADR-138
-- Creado en 2026-04-22

-- Vista analítica de FinOps por Tenant (agrupada por mes y modelo)
CREATE OR REPLACE VIEW public.tenant_financial_summary_view AS
SELECT 
    tenant_id,
    date_trunc('month', created_at) AS billing_month,
    model_name,
    COUNT(id) AS total_requests,
    SUM(input_tokens) AS total_input_tokens,
    SUM(output_tokens) AS total_output_tokens,
    SUM(total_cost) AS total_cost_usd
FROM 
    public.finops_token_ledger
GROUP BY 
    tenant_id, date_trunc('month', created_at), model_name;

-- Para que el RLS aplique correctamente sobre la vista, usamos el patrón "security invoker"
-- (Sin embargo, en Postgres < 15, las vistas asumen RLS de la tabla base si no usan security definer)
ALTER VIEW public.tenant_financial_summary_view SET (security_invoker = true);

-- Políticas RLS estrictas sobre finops_token_ledger
ALTER TABLE public.finops_token_ledger ENABLE ROW LEVEL SECURITY;

-- Política: Los Tenants solo pueden leer (SELECT) sus propios consumos
CREATE POLICY "Tenants can view their own finops ledger"
ON public.finops_token_ledger
FOR SELECT
USING (tenant_id = auth.uid());

-- Política: Inserciones permitidas solo por service_role (Backend LangGraph)
-- (El backend utiliza la Service Key para bypassear RLS al inyectar logs)
