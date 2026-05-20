-- disable_ddl_transaction!
-- ============================================================
-- RFC-055: Arquitectura del Motor de Ingesta Multimodal RAG
-- Task 1: Actualización del Esquema Relacional (documents)
-- ============================================================

-- Agregar nuevos estados al ENUM existente 'document_status'
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'pending';
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'processing';
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'ready';
ALTER TYPE document_status ADD VALUE IF NOT EXISTS 'failed';

-- Agregar nuevas columnas requeridas para ingesta
ALTER TABLE public.documents 
    ADD COLUMN IF NOT EXISTS source TEXT,
    ADD COLUMN IF NOT EXISTS external_id TEXT,
    ADD COLUMN IF NOT EXISTS raw_file_url TEXT;

-- Indexar external_id para búsqueda rápida y control de idempotencia (creación concurrente)
CREATE INDEX CONCURRENTLY IF NOT EXISTS documents_external_id_idx ON public.documents(external_id);

-- Opcionalmente asegurar un unique constraint si la idempotencia requiere que external_id y tenant_id sean únicos
-- (Omitido explícitamente a menos que se solicite, pero el índice es clave)