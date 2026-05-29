-- ═══════════════════════════════════════════════════════
-- ENUMS
-- ═══════════════════════════════════════════════════════
CREATE TYPE prompt_version_status AS ENUM ('draft','active','testing','archived');
CREATE TYPE ab_experiment_status AS ENUM ('draft','running','paused','completed','cancelled');
CREATE TYPE ab_outcome AS ENUM (
  'no_response','response','positive_response',
  'meeting_booked','deal_advanced','objection','unsubscribe'
);
CREATE TYPE variable_type AS ENUM ('text','url','number','enum','json');

-- ═══════════════════════════════════════════════════════
-- Tabla: prompt_templates (cabecera inmutable de template)
-- ═══════════════════════════════════════════════════════
CREATE TABLE prompt_templates (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  role             TEXT NOT NULL CHECK (role IN ('sdr','gatekeeper','hunter','l1_support')),
  name             TEXT NOT NULL,
  description      TEXT,
  active_version_id UUID,                          -- FK diferida (circular)
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  archived_at      TIMESTAMPTZ,
  UNIQUE (tenant_id, role, name)
);

-- ═══════════════════════════════════════════════════════
-- Tabla: prompt_versions (cada save = versión inmutable)
-- ═══════════════════════════════════════════════════════
CREATE TABLE prompt_versions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id      UUID NOT NULL REFERENCES prompt_templates(id) ON DELETE CASCADE,
  version_number   INT  NOT NULL,
  content          TEXT NOT NULL,
  variables        JSONB NOT NULL DEFAULT '[]',     -- [{key, label, type, required, default}]
  changelog        TEXT,
  status           prompt_version_status NOT NULL DEFAULT 'draft',
  created_by       UUID NOT NULL,                   -- user_id del operador
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_id, version_number)
);

-- FK diferida para active_version_id
ALTER TABLE prompt_templates
  ADD CONSTRAINT fk_active_version
  FOREIGN KEY (active_version_id) REFERENCES prompt_versions(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- Trigger para updated_at en prompt_templates
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER trg_prompt_templates_updated_at
  BEFORE UPDATE ON prompt_templates
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ═══════════════════════════════════════════════════════
-- Tabla: ab_experiments
-- ═══════════════════════════════════════════════════════
CREATE TABLE ab_experiments (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  template_id      UUID NOT NULL REFERENCES prompt_templates(id),
  name             TEXT NOT NULL,
  status           ab_experiment_status NOT NULL DEFAULT 'draft',
  min_impressions  INT NOT NULL DEFAULT 100,        -- mínimo para significancia
  confidence_level NUMERIC(3,2) NOT NULL DEFAULT 0.95,
  started_at       TIMESTAMPTZ,
  ended_at         TIMESTAMPTZ,
  winner_variant_id UUID,
  created_by       UUID NOT NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ═══════════════════════════════════════════════════════
-- Tabla: ab_variants (brazos del experimento)
-- ═══════════════════════════════════════════════════════
CREATE TABLE ab_variants (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  experiment_id    UUID NOT NULL REFERENCES ab_experiments(id) ON DELETE CASCADE,
  version_id       UUID NOT NULL REFERENCES prompt_versions(id),
  traffic_pct      INT NOT NULL CHECK (traffic_pct BETWEEN 0 AND 100),
  label            CHAR(1) NOT NULL,                -- 'A', 'B', 'C'
  UNIQUE (experiment_id, label)
);

-- Constraint: sum(traffic_pct) por experiment = 100
CREATE OR REPLACE FUNCTION check_experiment_traffic_pct()
RETURNS TRIGGER AS $$
DECLARE
  total_pct INT;
  exp_id UUID;
BEGIN
  exp_id := COALESCE(NEW.experiment_id, OLD.experiment_id);
  
  SELECT SUM(traffic_pct) INTO total_pct
  FROM ab_variants
  WHERE experiment_id = exp_id;

  IF total_pct IS NOT NULL AND total_pct != 100 THEN
    RAISE EXCEPTION 'La suma de traffic_pct para el experimento % debe ser exactamente 100', exp_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE CONSTRAINT TRIGGER trg_check_traffic_pct
  AFTER INSERT OR UPDATE OR DELETE ON ab_variants
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW
  EXECUTE FUNCTION check_experiment_traffic_pct();

-- FK diferida para winner_variant_id
ALTER TABLE ab_experiments
  ADD CONSTRAINT fk_winner_variant
  FOREIGN KEY (winner_variant_id) REFERENCES ab_variants(id)
  ON DELETE SET NULL
  DEFERRABLE INITIALLY DEFERRED;

-- ═══════════════════════════════════════════════════════
-- Tabla: ab_impressions (registro por interacción)
-- ═══════════════════════════════════════════════════════
CREATE TABLE ab_impressions (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  variant_id       UUID NOT NULL REFERENCES ab_variants(id),
  thread_id        UUID NOT NULL,
  lead_id          UUID NOT NULL,
  outcome          ab_outcome,
  sentiment_score  NUMERIC(4,3) CHECK (sentiment_score >= -1.000 AND sentiment_score <= 1.000),
  response_time_ms INT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_impressions_variant ON ab_impressions(variant_id);
CREATE INDEX idx_impressions_created ON ab_impressions(created_at);

-- ═══════════════════════════════════════════════════════
-- Tabla: variable_defs (catálogo de variables por tenant)
-- ═══════════════════════════════════════════════════════
CREATE TABLE variable_defs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id        UUID NOT NULL REFERENCES tenants(id),
  key              TEXT NOT NULL,
  label            TEXT NOT NULL,
  type             variable_type NOT NULL DEFAULT 'text',
  default_value    TEXT,
  enum_options     JSONB,                            -- ["option_a","option_b"]
  required         BOOLEAN NOT NULL DEFAULT false,
  description      TEXT,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, key)
);

-- ═══════════════════════════════════════════════════════
-- RLS — Todo filtrado por tenant_id via JWT
-- ═══════════════════════════════════════════════════════
ALTER TABLE prompt_templates   ENABLE ROW LEVEL SECURITY;
ALTER TABLE prompt_versions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_experiments     ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_variants        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ab_impressions     ENABLE ROW LEVEL SECURITY;
ALTER TABLE variable_defs      ENABLE ROW LEVEL SECURITY;

-- Políticas RLS seguras sin fugas
CREATE POLICY "tenant_isolation_templates" ON prompt_templates
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_versions" ON prompt_versions
  FOR ALL USING (
    template_id IN (
      SELECT id FROM prompt_templates
      WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY "tenant_isolation_experiments" ON ab_experiments
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);

CREATE POLICY "tenant_isolation_variants" ON ab_variants
  FOR ALL USING (
    experiment_id IN (
      SELECT id FROM ab_experiments
      WHERE tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY "tenant_isolation_impressions" ON ab_impressions
  FOR ALL USING (
    variant_id IN (
      SELECT v.id FROM ab_variants v
      JOIN ab_experiments e ON e.id = v.experiment_id
      WHERE e.tenant_id = (auth.jwt() ->> 'tenant_id')::uuid
    )
  );

CREATE POLICY "tenant_isolation_variables" ON variable_defs
  FOR ALL USING (tenant_id = (auth.jwt() ->> 'tenant_id')::uuid);
