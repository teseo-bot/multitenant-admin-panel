-- RFC-BLOQUE-15: Campañas y Evaluador (LLM-as-a-Judge)
-- Update campaigns schema to include new evaluative and content fields

-- Add missing columns to campaigns table (if it exists)
ALTER TABLE public.campaigns 
ADD COLUMN IF NOT EXISTS lead_id UUID REFERENCES public.leads(id) ON DELETE CASCADE,
ADD COLUMN IF NOT EXISTS type TEXT CHECK (type IN ('email_sequence', 'ad_copy', 'blast')),
ADD COLUMN IF NOT EXISTS content JSONB NOT NULL DEFAULT '{}',
ADD COLUMN IF NOT EXISTS evaluator_score INTEGER,
ADD COLUMN IF NOT EXISTS evaluator_feedback TEXT;

-- We need to safely update the status constraint. 
-- Since a constraint could have a different name depending on when it was added,
-- we'll try to drop the known one or use a more robust DO block.
DO $$ 
BEGIN
  -- Intentamos remover la restricción anterior si existe
  BEGIN
    ALTER TABLE public.campaigns DROP CONSTRAINT IF EXISTS campaigns_status_check;
  EXCEPTION
    WHEN undefined_object THEN
      NULL;
  END;
  
  -- Agregamos la nueva restricción que engloba los estados anteriores y los nuevos (Bloque 15)
  ALTER TABLE public.campaigns ADD CONSTRAINT campaigns_status_check 
    CHECK (status IN ('draft', 'pending_review', 'review', 'approved', 'rejected', 'active', 'paused', 'completed', 'sent', 'failed'));
END $$;

-- Verify RLS and tenant_isolation policy exist as required by Bloque 15
-- We'll recreate or ensure the policy exists. The table was already configured with RLS
-- in a prior migration, but we ensure the policy is present.
DO $$ 
BEGIN
  IF NOT EXISTS (
      SELECT 1 FROM pg_policies 
      WHERE tablename = 'campaigns' AND policyname = 'tenant_isolation'
  ) THEN
      CREATE POLICY "tenant_isolation" ON public.campaigns
        USING (tenant_id = current_setting('app.tenant_id', true)::UUID);
  END IF;
END $$;
