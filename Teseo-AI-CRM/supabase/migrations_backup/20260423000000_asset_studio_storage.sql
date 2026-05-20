-- 1. Create the Bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('asset_snapshots_bucket', 'asset_snapshots_bucket', false)
ON CONFLICT (id) DO NOTHING;

-- 2. Create the `documents` Table
CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL,
    name TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_type TEXT,
    size_bytes BIGINT,
    status TEXT DEFAULT 'pending',
    created_by UUID REFERENCES auth.users(id),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Apply RLS Policies for the `documents` Table
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can access their tenant documents"
ON public.documents FOR ALL
USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid)
WITH CHECK (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Polítcias para Storage (`asset_snapshots_bucket`):
-- Select Policy
CREATE POLICY "Users can access their tenant documents storage select"
ON storage.objects FOR SELECT
USING (bucket_id = 'asset_snapshots_bucket' AND (storage.foldername(name))[1] = auth.jwt()->>'tenant_id');

-- Insert Policy
CREATE POLICY "Users can access their tenant documents storage insert"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'asset_snapshots_bucket' AND (storage.foldername(name))[1] = auth.jwt()->>'tenant_id');

-- 4. Trigger Webhook (`net.http_post`)
-- Habilitar extensión pg_net si no existe
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE OR REPLACE FUNCTION public.notify_crm_compiler()
RETURNS TRIGGER AS $$
BEGIN
    -- Realizar POST asíncrono
    PERFORM net.http_post(
        url := 'https://api.teseo.lat/webhook/process-document',
        headers := '{"Content-Type": "application/json"}'::jsonb,
        body := json_build_object(
            'document_id', NEW.id,
            'tenant_id', NEW.tenant_id,
            'file_path', NEW.file_path,
            'status', NEW.status
        )::jsonb
    );
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_compiler
AFTER INSERT OR UPDATE OF status ON public.documents
FOR EACH ROW
WHEN (NEW.status = 'processing' OR (TG_OP = 'INSERT'))
EXECUTE FUNCTION public.notify_crm_compiler();
