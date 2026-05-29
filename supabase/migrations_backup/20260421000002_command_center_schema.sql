-- ============================================================
-- RFC-021: Command Center — DDL Completo
-- Target: Cloud SQL del Tenant (crm-agentico-orchestrator)
-- ============================================================

-- 1. Tipos Enumerados (idempotentes)
DO $$ BEGIN CREATE TYPE lead_status     AS ENUM ('New','Contacted','Qualified','Lost','Won'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE lead_source     AS ENUM ('inbound_web','inbound_telegram','inbound_whatsapp','outbound_hunter','manual','referral'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE assigned_node   AS ENUM ('gatekeeper','sdr','hunter','admin','unassigned'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_sender  AS ENUM ('customer','ai_agent','human_admin'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN CREATE TYPE message_channel AS ENUM ('telegram','whatsapp','web','email'); EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- 2. Tabla leads
CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          VARCHAR(255) NOT NULL,
  company       VARCHAR(255),
  email         VARCHAR(320),
  phone         VARCHAR(20),
  status        lead_status   NOT NULL DEFAULT 'New',
  source        lead_source   NOT NULL DEFAULT 'inbound_web',
  icp_score     NUMERIC(5,2)  CHECK (icp_score >= 0 AND icp_score <= 100),
  assigned_node assigned_node NOT NULL DEFAULT 'unassigned',
  sort_order    DOUBLE PRECISION NOT NULL DEFAULT 0,
  thread_id     TEXT UNIQUE,
  metadata      JSONB NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Tabla inbox_messages
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

-- 4. Índices
CREATE INDEX IF NOT EXISTS idx_leads_kanban       ON leads (status, sort_order);
CREATE INDEX IF NOT EXISTS idx_leads_assigned      ON leads (assigned_node) WHERE assigned_node != 'unassigned';
CREATE INDEX IF NOT EXISTS idx_leads_icp           ON leads (icp_score DESC NULLS LAST);
CREATE INDEX IF NOT EXISTS idx_messages_timeline   ON inbox_messages (lead_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_external   ON inbox_messages (external_id) WHERE external_id IS NOT NULL;

-- 5. Trigger updated_at
CREATE OR REPLACE FUNCTION trg_fn_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_leads_updated_at ON leads;
CREATE TRIGGER trg_leads_updated_at
  BEFORE UPDATE ON leads
  FOR EACH ROW
  EXECUTE FUNCTION trg_fn_set_updated_at();
