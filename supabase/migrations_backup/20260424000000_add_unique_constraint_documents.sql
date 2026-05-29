-- Add unique constraint on documents (tenant_id, external_id) to support ON CONFLICT
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 
    FROM pg_constraint 
    WHERE conname = 'documents_tenant_id_external_id_key'
  ) THEN
    ALTER TABLE documents ADD CONSTRAINT documents_tenant_id_external_id_key UNIQUE (tenant_id, external_id);
  END IF;
END $$;
