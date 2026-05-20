-- Ya incluido en 20260421000002_command_center_schema.sql, pero reiteramos de forma idempotente para cumplir con RFC-027

CREATE TABLE IF NOT EXISTS inbox_messages (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id       UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,
  sender        message_sender  NOT NULL,
  channel       message_channel NOT NULL,
  content       TEXT NOT NULL,
  external_id   TEXT,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_messages_timeline   ON inbox_messages (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_external   ON inbox_messages (external_id) WHERE external_id IS NOT NULL;
