-- ADR-106: Continuous Learning & Durable Jobs
-- Setup pgvector and tenant memories table

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE IF NOT EXISTS public.tenant_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
    content TEXT NOT NULL,
    metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
    embedding vector(768) NOT NULL, -- Assuming Gemini text-embedding-004 (768 dims)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices HNSW para búsqueda por similitud vectorial
CREATE INDEX IF NOT EXISTS tenant_memories_embedding_idx ON public.tenant_memories USING hnsw (embedding vector_cosine_ops);

-- Index para filtrado rápido por tenant
CREATE INDEX IF NOT EXISTS tenant_memories_tenant_id_idx ON public.tenant_memories(tenant_id);

ALTER TABLE public.tenant_memories ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service Role Full Access to Memories" 
ON public.tenant_memories 
FOR ALL 
TO service_role 
USING (true) 
WITH CHECK (true);

COMMENT ON TABLE public.tenant_memories IS 'Memoria a largo plazo de cada inquilino (RAG).';
