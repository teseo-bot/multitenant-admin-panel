-- 1A: Desnormalización de tenant_id en inbox_messages

-- 1A.1: Añadir columna como nullable inicialmente
ALTER TABLE public.inbox_messages ADD COLUMN IF NOT EXISTS tenant_id UUID;

-- 1A.2: Backfill basado en el lead_id
UPDATE public.inbox_messages 
SET tenant_id = (
  SELECT tenant_id 
  FROM public.leads 
  WHERE leads.id = inbox_messages.lead_id
)
WHERE tenant_id IS NULL;

-- 1A.3: Forzar NOT NULL
ALTER TABLE public.inbox_messages ALTER COLUMN tenant_id SET NOT NULL;

-- 1A.4: Crear índice para queries por tenant
CREATE INDEX IF NOT EXISTS idx_inbox_messages_tenant ON public.inbox_messages(tenant_id);

-- 1A.5: Añadir FK Constraint
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 
        FROM information_schema.table_constraints 
        WHERE constraint_name = 'fk_inbox_messages_tenant'
    ) THEN
        ALTER TABLE public.inbox_messages 
        ADD CONSTRAINT fk_inbox_messages_tenant 
        FOREIGN KEY (tenant_id) 
        REFERENCES public.tenants(id) 
        ON DELETE CASCADE;
    END IF;
END $$;
