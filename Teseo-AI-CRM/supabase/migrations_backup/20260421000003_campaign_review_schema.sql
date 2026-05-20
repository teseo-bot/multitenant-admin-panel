-- ============================================================
-- Tabla: campaigns
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaigns (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id     UUID NOT NULL REFERENCES public.tenants(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  description   TEXT,
  agent_roles   TEXT[] NOT NULL DEFAULT '{}',        -- ['sdr', 'hunter']
  channel       TEXT NOT NULL CHECK (channel IN ('whatsapp','email','linkedin','webchat')),
  status        TEXT NOT NULL DEFAULT 'draft'
                CHECK (status IN ('draft','pending_review','approved','rejected','active','paused','completed')),
  target_audience JSONB DEFAULT '{}',                -- filtros de leads
  scheduled_start TIMESTAMPTZ,
  scheduled_end   TIMESTAMPTZ,
  created_by    UUID NOT NULL,                       -- auth.uid() del operador
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices
CREATE INDEX idx_campaigns_tenant_status ON public.campaigns(tenant_id, status);
CREATE INDEX idx_campaigns_created_at ON public.campaigns(created_at DESC);

-- RLS
ALTER TABLE public.campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_campaigns" ON public.campaigns
  FOR ALL USING (tenant_id = (current_setting('app.tenant_id', true))::uuid);

-- ============================================================
-- Tabla: campaign_events (audit log de acciones del agente)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_events (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  event_type    TEXT NOT NULL CHECK (event_type IN (
    'message_sent','message_received','tool_call','handoff_request',
    'handoff_completed','lead_qualified','lead_lost','state_change',
    'error','manual_override'
  )),
  agent_role    TEXT,                                 -- 'sdr', 'hunter', etc.
  thread_id     UUID,                                 -- FK lógico a threads
  lead_id       UUID,                                 -- FK lógico a leads
  payload       JSONB NOT NULL DEFAULT '{}',          -- datos del evento
  occurred_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Índices para timeline queries
CREATE INDEX idx_campaign_events_campaign ON public.campaign_events(campaign_id, occurred_at DESC);
CREATE INDEX idx_campaign_events_type ON public.campaign_events(campaign_id, event_type);

-- RLS (vía join a campaigns)
ALTER TABLE public.campaign_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_campaign_events" ON public.campaign_events
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_events.campaign_id
      AND c.tenant_id = (current_setting('app.tenant_id', true))::uuid
    )
  );

-- ============================================================
-- Tabla: campaign_approvals (registro de decisiones)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.campaign_approvals (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id   UUID NOT NULL REFERENCES public.campaigns(id) ON DELETE CASCADE,
  reviewer_id   UUID NOT NULL,                       -- auth.uid() del aprobador
  decision      TEXT NOT NULL CHECK (decision IN ('approved','rejected')),
  reason        TEXT,
  decided_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_campaign_approvals_campaign ON public.campaign_approvals(campaign_id, decided_at DESC);

ALTER TABLE public.campaign_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "tenant_isolation_campaign_approvals" ON public.campaign_approvals
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.campaigns c
      WHERE c.id = campaign_approvals.campaign_id
      AND c.tenant_id = (current_setting('app.tenant_id', true))::uuid
    )
  );

-- ============================================================
-- Vista materializada: campaign_metrics (agregaciones pre-calculadas)
-- ============================================================
CREATE MATERIALIZED VIEW IF NOT EXISTS public.campaign_metrics AS
SELECT
  ce.campaign_id,
  COUNT(*) FILTER (WHERE ce.event_type = 'message_sent')      AS messages_sent,
  COUNT(*) FILTER (WHERE ce.event_type = 'message_received')   AS messages_received,
  COUNT(*) FILTER (WHERE ce.event_type = 'lead_qualified')     AS leads_qualified,
  COUNT(*) FILTER (WHERE ce.event_type = 'lead_lost')          AS leads_lost,
  COUNT(*) FILTER (WHERE ce.event_type = 'handoff_request')    AS handoffs_requested,
  COUNT(*) FILTER (WHERE ce.event_type = 'handoff_completed')  AS handoffs_completed,
  COUNT(*) FILTER (WHERE ce.event_type = 'error')              AS errors,
  COUNT(DISTINCT ce.thread_id)                                  AS unique_threads,
  COUNT(DISTINCT ce.lead_id)                                    AS unique_leads,
  MIN(ce.occurred_at)                                           AS first_event_at,
  MAX(ce.occurred_at)                                           AS last_event_at
FROM public.campaign_events ce
GROUP BY ce.campaign_id;

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_metrics_pk ON public.campaign_metrics(campaign_id);

-- Trigger para updated_at en campaigns
CREATE OR REPLACE FUNCTION update_campaigns_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_campaigns_updated_at ON public.campaigns;
CREATE TRIGGER trg_campaigns_updated_at
  BEFORE UPDATE ON public.campaigns
  FOR EACH ROW
  EXECUTE FUNCTION update_campaigns_updated_at();
