-- Agrega tenant_id a leads para completar el modelo multi-tenant
ALTER TABLE leads
  ADD COLUMN tenant_id UUID REFERENCES tenants(id) ON DELETE CASCADE;

-- Backfill: asociar leads existentes (del seed) al primer tenant disponible
UPDATE leads SET tenant_id = (SELECT id FROM tenants LIMIT 1) WHERE tenant_id IS NULL;

-- Hacer NOT NULL después del backfill
ALTER TABLE leads ALTER COLUMN tenant_id SET NOT NULL;

-- Índice para filtrado por tenant
CREATE INDEX IF NOT EXISTS idx_leads_tenant ON leads (tenant_id);