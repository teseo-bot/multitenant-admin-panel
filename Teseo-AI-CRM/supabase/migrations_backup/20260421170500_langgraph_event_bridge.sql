-- Migration: 20260421170500_langgraph_event_bridge.sql
-- Fase 1: Infraestructura de Base de Datos para el Motor Agéntico (RFC-033)

-- 1. Habilitar extensiones necesarias
CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;
CREATE EXTENSION IF NOT EXISTS pg_cron;

-- 2. Creación de la tabla lead_assignment_outbox (Dead-Letter Queue / Outbox Pattern)
CREATE TABLE IF NOT EXISTS public.lead_assignment_outbox (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    lead_id UUID NOT NULL,
    tenant_id UUID NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'dead')),
    attempts INT NOT NULL DEFAULT 0,
    last_error TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    next_retry_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Index para búsqueda rápida de tareas pendientes
CREATE INDEX IF NOT EXISTS idx_lead_assignment_outbox_pending ON public.lead_assignment_outbox(status, next_retry_at) WHERE status IN ('pending', 'failed');

-- 3. Configuración en Supabase Vault para el Webhook Secret
DO $$ 
DECLARE
  v_secret_id UUID;
BEGIN
  -- Verificar si el secreto ya existe
  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = 'LANGGRAPH_INTERNAL_API_KEY';
  
  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      'changeme_in_dashboard_or_env',
      'LANGGRAPH_INTERNAL_API_KEY',
      'API key for LangGraph Event Bridge'
    );
  END IF;
END $$;

-- 4. Creación de la función trigger (notify_langgraph_new_lead)
CREATE OR REPLACE FUNCTION public.notify_langgraph_new_lead()
RETURNS TRIGGER AS $$
DECLARE
    v_api_key TEXT;
    v_url TEXT;
    v_payload JSONB;
    v_request_id BIGINT;
BEGIN
    -- Intentar obtener la API KEY desde vault
    SELECT secret INTO v_api_key FROM vault.decrypted_secrets WHERE name = 'LANGGRAPH_INTERNAL_API_KEY' LIMIT 1;
    
    IF v_api_key IS NULL OR v_api_key = 'changeme_in_dashboard_or_env' THEN
        -- Insertamos en outbox si no hay API key real
        INSERT INTO public.lead_assignment_outbox (lead_id, tenant_id, status, last_error)
        VALUES (NEW.id, NEW.tenant_id, 'failed', 'Missing or default API key in vault');
        RETURN NEW;
    END IF;

    -- URL del orquestador Hono/Cloud Run
    v_url := current_setting('app.settings.langgraph_webhook_url', true);
    IF v_url IS NULL OR v_url = '' THEN
        v_url := 'https://langgraph-orchestrator.internal/api/internal/leads/assign';
    END IF;

    -- Construir payload dinámico (se extraen campos de NEW de forma segura)
    v_payload := jsonb_build_object(
        'event_type', 'lead.created',
        'lead_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'assigned_node', 'unassigned',
        'source_channel', to_jsonb(NEW)->>'source_channel',
        'created_at', NEW.created_at,
        'trigger_ts', extract(epoch from now())::int
    );
    -- Limpiar nulos (por ej. si source_channel no venía)
    v_payload := jsonb_strip_nulls(v_payload);

    -- Disparar webhook
    BEGIN
        SELECT net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_api_key,
                'X-Idempotency-Key', NEW.id::text
            ),
            body := v_payload,
            timeout_milliseconds := 30000
        ) INTO v_request_id;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.lead_assignment_outbox (lead_id, tenant_id, status, last_error)
        VALUES (NEW.id, NEW.tenant_id, 'pending', SQLERRM);
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Creación del Trigger en la tabla leads
DROP TRIGGER IF EXISTS trg_leads_notify_langgraph ON public.leads;
CREATE TRIGGER trg_leads_notify_langgraph
AFTER INSERT ON public.leads
FOR EACH ROW
WHEN (NEW.assigned_node = 'unassigned')
EXECUTE FUNCTION public.notify_langgraph_new_lead();

-- 6. Función y pg_cron para procesar el outbox
CREATE OR REPLACE FUNCTION public.retry_pending_outbox()
RETURNS VOID AS $$
DECLARE
    v_row RECORD;
    v_api_key TEXT;
    v_url TEXT;
    v_payload JSONB;
BEGIN
    SELECT secret INTO v_api_key FROM vault.decrypted_secrets WHERE name = 'LANGGRAPH_INTERNAL_API_KEY' LIMIT 1;
    IF v_api_key IS NULL OR v_api_key = 'changeme_in_dashboard_or_env' THEN
        RETURN;
    END IF;

    v_url := current_setting('app.settings.langgraph_webhook_url', true);
    IF v_url IS NULL OR v_url = '' THEN
        v_url := 'https://langgraph-orchestrator.internal/api/internal/leads/assign';
    END IF;

    FOR v_row IN 
        SELECT id, lead_id, tenant_id, attempts 
        FROM public.lead_assignment_outbox 
        WHERE status IN ('pending', 'failed') 
          AND next_retry_at <= NOW()
        LIMIT 50
    LOOP
        v_payload := jsonb_build_object(
            'event_type', 'lead.created',
            'lead_id', v_row.lead_id,
            'tenant_id', v_row.tenant_id,
            'assigned_node', 'unassigned',
            'trigger_ts', extract(epoch from now())::int
        );
        
        BEGIN
            PERFORM net.http_post(
                url := v_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || v_api_key,
                    'X-Idempotency-Key', v_row.lead_id::text
                ),
                body := v_payload,
                timeout_milliseconds := 30000
            );

            UPDATE public.lead_assignment_outbox 
            SET status = 'sent', attempts = attempts + 1 
            WHERE id = v_row.id;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.lead_assignment_outbox 
            SET 
                attempts = attempts + 1,
                last_error = SQLERRM,
                status = CASE WHEN attempts + 1 >= 5 THEN 'dead' ELSE 'failed' END,
                next_retry_at = NOW() + (POWER(2, attempts) * interval '1 minute')
            WHERE id = v_row.id;
        END;
    END LOOP;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Configurar pg_cron
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
        BEGIN
            PERFORM cron.unschedule('retry_lead_outbox');
        EXCEPTION WHEN OTHERS THEN
            -- Ignorar si el job no existe
        END;
        
        PERFORM cron.schedule('retry_lead_outbox', '* * * * *', 'SELECT public.retry_pending_outbox()');
    END IF;
END $$;
