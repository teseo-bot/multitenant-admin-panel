-- Add unique constraint for idempotent ingestions
ALTER TABLE public.documents 
ADD CONSTRAINT documents_tenant_id_external_id_key 
UNIQUE (tenant_id, external_id);
