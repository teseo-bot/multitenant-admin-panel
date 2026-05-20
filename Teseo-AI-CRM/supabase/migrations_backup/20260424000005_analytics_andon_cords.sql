-- ============================================================
-- Bloque 22: Analytics & Andon Cords (Telemetría y Alertas)
-- Dependencias: RFC-036, RFC-038
-- ============================================================

-- 1. Indexación Selectiva para Analíticas
CREATE INDEX IF NOT EXISTS idx_leads_analytics_status ON public.leads (status);
CREATE INDEX IF NOT EXISTS idx_leads_analytics_dates ON public.leads (created_at DESC);

-- 2. RPC: Distribución de Leads por Estado (get_leads_by_status)
CREATE OR REPLACE FUNCTION public.rpc_get_leads_by_status()
RETURNS TABLE (
  status lead_status,
  total bigint
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
    SELECT l.status, COUNT(*) as total
    FROM public.leads l
    WHERE l.tenant_id = current_setting('app.current_tenant', true)::uuid 
       OR current_setting('app.current_tenant', true) IS NULL
    GROUP BY l.status;
END;
$$;

-- 3. RPC: Métricas de Conversión y SLAs (get_conversion_metrics)
CREATE OR REPLACE FUNCTION public.rpc_get_conversion_metrics()
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
  v_tenant_id uuid;
BEGIN
  v_tenant_id := current_setting('app.current_tenant', true)::uuid;

  SELECT COUNT(*) INTO v_total FROM public.leads 
  WHERE tenant_id = v_tenant_id OR v_tenant_id IS NULL;
  
  SELECT COUNT(*) INTO v_won FROM public.leads 
  WHERE status = 'Won' AND (tenant_id = v_tenant_id OR v_tenant_id IS NULL);
  
  SELECT COUNT(*) INTO v_lost FROM public.leads 
  WHERE status = 'Lost' AND (tenant_id = v_tenant_id OR v_tenant_id IS NULL);

  RETURN QUERY SELECT 
    v_total,
    v_won,
    v_lost,
    CASE WHEN v_total > 0 THEN ROUND((v_won::numeric / v_total::numeric) * 100, 2) ELSE 0 END;
END;
$$;

-- 4. Extensión para Andon Cord (HITL) en pg_notify
-- Ya existe la tabla inbox_messages, vamos a preparar un trigger que emita refresh=true,
-- pero que respete los chunks asincronos si llegan por otra via.
-- (La lógica de chunk se manejará en el Edge Router, no desde DB triggers por eficiencia)
CREATE OR REPLACE FUNCTION public.notify_inbox_refresh()
RETURNS TRIGGER AS $$
BEGIN
  -- Emite notificación genérica para el lead afectado
  PERFORM pg_notify(
    'inbox_channel', 
    json_build_object(
      'lead_id', NEW.lead_id,
      'refresh', true
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_inbox_messages_notify ON public.inbox_messages;
CREATE TRIGGER trg_inbox_messages_notify
AFTER INSERT ON public.inbox_messages
FOR EACH ROW
EXECUTE FUNCTION public.notify_inbox_refresh();
