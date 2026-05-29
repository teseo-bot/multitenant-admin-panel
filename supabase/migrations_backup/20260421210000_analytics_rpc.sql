-- ============================================================
-- RFC-038: Capa Analítica (Analytics Data Layer)
-- Target: Cloud SQL del Tenant (crm-agentico-orchestrator)
-- ============================================================

-- 1. Indexación Selectiva para Analíticas
-- Optimización de COUNT por estado
CREATE INDEX IF NOT EXISTS idx_leads_analytics_status ON leads (status);

-- Optimización para SLAs (filtros por fecha de creación y asignación)
CREATE INDEX IF NOT EXISTS idx_leads_analytics_dates ON leads (created_at DESC);


-- 2. RPC: Distribución de Leads por Estado
-- Retorna el conteo total de leads agrupados por status.
CREATE OR REPLACE FUNCTION rpc_get_leads_by_status()
RETURNS TABLE (
  status lead_status,
  total bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER -- Se ejecuta con privilegios del creador para bypass RLS interno si es necesario, 
                 -- aunque en este diseño Tenant OS el backend validará auth antes de llamar el RPC.
AS $$
BEGIN
  RETURN QUERY
    SELECT l.status, COUNT(*) as total
    FROM leads l
    GROUP BY l.status;
END;
$$;


-- 3. RPC: Métricas de Conversión y SLAs
-- Retorna contadores agregados para el pipeline
CREATE OR REPLACE FUNCTION rpc_get_conversion_metrics()
RETURNS TABLE (
  total_leads bigint,
  won_leads bigint,
  lost_leads bigint,
  avg_conversion_rate numeric
)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total bigint;
  v_won bigint;
  v_lost bigint;
BEGIN
  SELECT COUNT(*) INTO v_total FROM leads;
  SELECT COUNT(*) INTO v_won FROM leads WHERE status = 'Won';
  SELECT COUNT(*) INTO v_lost FROM leads WHERE status = 'Lost';

  RETURN QUERY SELECT 
    v_total,
    v_won,
    v_lost,
    CASE WHEN v_total > 0 THEN ROUND((v_won::numeric / v_total::numeric) * 100, 2) ELSE 0 END;
END;
$$;
