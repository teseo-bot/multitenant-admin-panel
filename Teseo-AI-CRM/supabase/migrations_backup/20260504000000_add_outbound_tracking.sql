-- =============================================================================
-- Migration: 20260504000000_add_outbound_tracking.sql
-- Purpose:   Outbound Injection — tracking tables for SDR outbound campaigns
-- ADR Ref:   docs/adr/ADR-120_outbound_tracking.md
-- Author:    Builder (subagent)
-- Date:      2026-05-04
-- =============================================================================
-- 
-- Context:
-- The CRM currently tracks inbound leads (inbound_web, inbound_telegram,
-- inbound_whatsapp) but has NO first-class tracking for outbound sequences.
-- The SDR-Outbound agent (fleetco-claw/src/agents/sdr-outbound) creates leads
-- but does not record outbound touchpoints, cadence steps, or delivery status.
--
-- This migration adds:
--   1. outbound_sequences      — campaign cadence definitions
--   2. outbound_sequence_steps — individual steps (email, linkedin, call, etc.)
--   3. outbound_enrollments    — lead <-> sequence relationship
--   4. outbound_touchpoints    — every actual touchpoint execution + delivery status
--   5. outbound_tracking_events — open/click/reply/bounce webhook events
--
-- Zero-Trust principle:
--   All tables enforce tenant_id NOT NULL with FK to tenants(id).
--   RLS policies restrict access to authenticated users within their tenant.
-- =============================================================================

-- ─── 1. ENUM TYPES ──────────────────────────────────────────────────────────

DO $$ BEGIN
  CREATE TYPE public.outbound_channel AS ENUM (
    'email', 'linkedin', 'whatsapp', 'telegram', 'phone', 'sms'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.outbound_step_type AS ENUM (
    'auto_email', 'manual_email', 'linkedin_connect', 'linkedin_message',
    'phone_call', 'sms', 'whatsapp', 'telegram', 'custom_task'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.outbound_enrollment_status AS ENUM (
    'active', 'paused', 'completed', 'bounced', 'replied', 'unsubscribed', 'manual_exit'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.outbound_touchpoint_status AS ENUM (
    'scheduled', 'sent', 'delivered', 'failed', 'skipped', 'cancelled'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  CREATE TYPE public.outbound_event_type AS ENUM (
    'open', 'click', 'reply', 'bounce', 'unsubscribe', 'spam_report',
    'linkedin_accepted', 'linkedin_replied', 'call_connected', 'call_no_answer'
  );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;


-- ─── 2. OUTBOUND SEQUENCES ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outbound_sequences (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id   UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name        TEXT NOT NULL,
  description TEXT,
  channel     public.outbound_channel NOT NULL DEFAULT 'email',
  is_active   BOOLEAN NOT NULL DEFAULT true,
  metadata    JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_sequences_tenant
  ON public.outbound_sequences(tenant_id);


-- ─── 3. OUTBOUND SEQUENCE STEPS ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outbound_sequence_steps (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sequence_id  UUID NOT NULL REFERENCES public.outbound_sequences(id) ON DELETE CASCADE,
  tenant_id    UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  step_order   INT NOT NULL DEFAULT 1,
  step_type    public.outbound_step_type NOT NULL DEFAULT 'auto_email',
  delay_hours  INT NOT NULL DEFAULT 24,
  subject      TEXT,           -- email subject or task title
  body         TEXT,           -- template body (supports {{variables}})
  metadata     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_sequence_step_order UNIQUE (sequence_id, step_order)
);

CREATE INDEX IF NOT EXISTS idx_outbound_steps_sequence
  ON public.outbound_sequence_steps(sequence_id);


-- ─── 4. OUTBOUND ENROLLMENTS ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outbound_enrollments (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  sequence_id     UUID NOT NULL REFERENCES public.outbound_sequences(id) ON DELETE CASCADE,
  current_step    INT NOT NULL DEFAULT 0,
  status          public.outbound_enrollment_status NOT NULL DEFAULT 'active',
  enrolled_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at    TIMESTAMPTZ,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,

  CONSTRAINT uq_lead_sequence UNIQUE (lead_id, sequence_id)
);

CREATE INDEX IF NOT EXISTS idx_outbound_enrollments_lead
  ON public.outbound_enrollments(lead_id);
CREATE INDEX IF NOT EXISTS idx_outbound_enrollments_tenant_status
  ON public.outbound_enrollments(tenant_id, status);


-- ─── 5. OUTBOUND TOUCHPOINTS ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outbound_touchpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  enrollment_id   UUID NOT NULL REFERENCES public.outbound_enrollments(id) ON DELETE CASCADE,
  step_id         UUID REFERENCES public.outbound_sequence_steps(id) ON DELETE SET NULL,
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  channel         public.outbound_channel NOT NULL,
  status          public.outbound_touchpoint_status NOT NULL DEFAULT 'scheduled',
  scheduled_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  executed_at     TIMESTAMPTZ,
  external_id     TEXT,          -- message-id, linkedin request id, etc.
  error_message   TEXT,
  metadata        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_touchpoints_enrollment
  ON public.outbound_touchpoints(enrollment_id);
CREATE INDEX IF NOT EXISTS idx_outbound_touchpoints_lead
  ON public.outbound_touchpoints(lead_id);
CREATE INDEX IF NOT EXISTS idx_outbound_touchpoints_scheduled
  ON public.outbound_touchpoints(tenant_id, status, scheduled_at)
  WHERE status = 'scheduled';


-- ─── 6. OUTBOUND TRACKING EVENTS ───────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.outbound_tracking_events (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id       UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  touchpoint_id   UUID NOT NULL REFERENCES public.outbound_touchpoints(id) ON DELETE CASCADE,
  lead_id         UUID NOT NULL REFERENCES public.leads(id) ON DELETE CASCADE,
  event_type      public.outbound_event_type NOT NULL,
  event_data      JSONB NOT NULL DEFAULT '{}'::jsonb,  -- user-agent, ip, link clicked, etc.
  occurred_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_outbound_events_touchpoint
  ON public.outbound_tracking_events(touchpoint_id);
CREATE INDEX IF NOT EXISTS idx_outbound_events_lead
  ON public.outbound_tracking_events(lead_id);
CREATE INDEX IF NOT EXISTS idx_outbound_events_tenant_type
  ON public.outbound_tracking_events(tenant_id, event_type);


-- ─── 7. RLS POLICIES (Zero-Trust Multi-Tenant) ─────────────────────────────

ALTER TABLE public.outbound_sequences ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_sequence_steps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_enrollments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_touchpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.outbound_tracking_events ENABLE ROW LEVEL SECURITY;

-- Helper: tenant_id resolution via auth.uid() → tenant_users mapping
-- Assumes the function get_my_tenant_id() exists from prior migrations.
-- If not, the Executor must create it. Fallback: direct join.

CREATE POLICY "outbound_sequences_tenant_isolation" ON public.outbound_sequences
  FOR ALL USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "outbound_steps_tenant_isolation" ON public.outbound_sequence_steps
  FOR ALL USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "outbound_enrollments_tenant_isolation" ON public.outbound_enrollments
  FOR ALL USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "outbound_touchpoints_tenant_isolation" ON public.outbound_touchpoints
  FOR ALL USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );

CREATE POLICY "outbound_events_tenant_isolation" ON public.outbound_tracking_events
  FOR ALL USING (
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu WHERE tu.user_id = auth.uid()
    )
  );


-- ─── 8. NOTIFY TRIGGER (SSE Integration) ───────────────────────────────────
-- Fires on new touchpoints/events so the Panel can update via SSE.

CREATE OR REPLACE FUNCTION public.notify_outbound_event()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM pg_notify(
    'outbound_updates',
    json_build_object(
      'table', TG_TABLE_NAME,
      'action', TG_OP,
      'tenant_id', NEW.tenant_id,
      'lead_id', NEW.lead_id,
      'id', NEW.id
    )::text
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outbound_touchpoint_notify
  AFTER INSERT OR UPDATE ON public.outbound_touchpoints
  FOR EACH ROW EXECUTE FUNCTION public.notify_outbound_event();

CREATE TRIGGER trg_outbound_event_notify
  AFTER INSERT ON public.outbound_tracking_events
  FOR EACH ROW EXECUTE FUNCTION public.notify_outbound_event();


-- ─── 9. UPDATED_AT TRIGGER ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trg_outbound_sequences_updated
  BEFORE UPDATE ON public.outbound_sequences
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
