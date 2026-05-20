-- ============================================================
-- RFC-048: RAG Ingestion Webhook (Python Compiler Integration)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS pg_net;
CREATE EXTENSION IF NOT EXISTS supabase_vault CASCADE;

-- 1. Guardar el Webhook Secret en Supabase Vault
DO $$ 
DECLARE
  v_secret_id UUID;
BEGIN
  SELECT id INTO v_secret_id FROM vault.secrets WHERE name = 'PYTHON_COMPILER_WEBHOOK_SECRET';
  
  IF v_secret_id IS NULL THEN
    PERFORM vault.create_secret(
      'teseo-dev-webhook-secret',
      'PYTHON_COMPILER_WEBHOOK_SECRET',
      'API key for Python RAG Compiler webhook validation'
    );
  END IF;
END $$;

-- 2. Función Trigger para notificar al compilador
CREATE OR REPLACE FUNCTION public.notify_python_compiler()
RETURNS TRIGGER AS $$
DECLARE
    v_api_key TEXT;
    v_url TEXT;
    v_payload JSONB;
    v_request_id BIGINT;
BEGIN
    -- Obtener secret desde vault
    SELECT secret INTO v_api_key FROM vault.decrypted_secrets WHERE name = 'PYTHON_COMPILER_WEBHOOK_SECRET' LIMIT 1;

    -- URL de producción del compilador Cloud Run
    v_url := 'https://crm-agentico-compiler-1067632954359.us-central1.run.app/webhook/process-document';

    -- Construir payload (app/models/schemas.py -> WebhookPayload)
    v_payload := jsonb_build_object(
        'document_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'file_path', NEW.file_path,
        'file_type', NEW.file_type
    );

    -- Disparar webhook asíncrono
    BEGIN
        SELECT net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || COALESCE(v_api_key, '')
            ),
            body := v_payload,
            timeout_milliseconds := 15000
        ) INTO v_request_id;
    EXCEPTION WHEN OTHERS THEN
        -- Registrar error pasivo en los logs de PG si la extensión falla localmente
        RAISE WARNING 'pg_net no pudo encolar la solicitud: %', SQLERRM;
    END;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Crear el Trigger en la tabla documents
DROP TRIGGER IF EXISTS trg_documents_notify_compiler ON public.documents;
CREATE TRIGGER trg_documents_notify_compiler
AFTER INSERT ON public.documents
FOR EACH ROW
WHEN (NEW.status = 'processing')
EXECUTE FUNCTION public.notify_python_compiler();
