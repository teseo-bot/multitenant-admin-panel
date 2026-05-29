-- Fase 3: Infraestructura DLQ
CREATE TABLE IF NOT EXISTS lead_assignment_outbox (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID REFERENCES leads(id) ON DELETE CASCADE,
  tenant_id UUID NOT NULL,
  payload JSONB NOT NULL,
  status VARCHAR(20) DEFAULT 'pending', -- 'pending', 'sent', 'failed', 'dead'
  attempts INT DEFAULT 0,
  last_error TEXT,
  next_retry_at TIMESTAMPTZ DEFAULT NOW(),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for cron polling
CREATE INDEX IF NOT EXISTS idx_outbox_status_retry ON lead_assignment_outbox (status, next_retry_at) WHERE status IN ('pending', 'failed');

-- Setup pg_cron to poll and retry (requires pg_cron extension)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'pg_cron'
  ) THEN
    -- Scheduled every 5 minutes
    PERFORM cron.schedule(
      'dlq_retry_cron',
      '*/5 * * * *',
      $$
      UPDATE lead_assignment_outbox 
      SET status = 'pending', attempts = attempts + 1 
      WHERE status = 'failed' AND attempts < 5 AND next_retry_at <= NOW();
      
      UPDATE lead_assignment_outbox 
      SET status = 'dead' 
      WHERE status = 'failed' AND attempts >= 5;
      $$
    );
  END IF;
END $$;
