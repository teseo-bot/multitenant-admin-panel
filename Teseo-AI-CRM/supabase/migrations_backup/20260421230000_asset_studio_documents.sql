-- ============================================================
-- RFC-047: Gestor Documental (RAG Ingestion)
-- ============================================================

CREATE TYPE document_status AS ENUM ('processing', 'ready', 'error');

CREATE TABLE IF NOT EXISTS public.documents (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    file_path TEXT,
    file_type TEXT NOT NULL,
    size_bytes BIGINT,
    status document_status NOT NULL DEFAULT 'processing',
    error_message TEXT,
    created_by UUID,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Vincular los chunks con el documento padre
ALTER TABLE public.tenant_memories ADD COLUMN IF NOT EXISTS document_id UUID REFERENCES public.documents(id) ON DELETE CASCADE;

-- RLS
ALTER TABLE public.documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_documents" ON public.documents
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

-- Crear bucket de storage para los documentos (si no existe)
INSERT INTO storage.buckets (id, name, public) 
VALUES ('tenant_documents', 'tenant_documents', false)
ON CONFLICT (id) DO NOTHING;

-- RLS para Storage (Políticas básicas asumiendo tenant_id inyectado en el path, ej. tenant_id/filename)
-- En este MVP Single-Tenant, dejaremos que el Server Role los maneje o crearemos una política abierta para autenticados
CREATE POLICY "Auth Users can upload documents" 
ON storage.objects FOR INSERT 
TO authenticated 
WITH CHECK (bucket_id = 'tenant_documents');

CREATE POLICY "Auth Users can view documents" 
ON storage.objects FOR SELECT 
TO authenticated 
USING (bucket_id = 'tenant_documents');
