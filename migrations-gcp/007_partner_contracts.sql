-- migrations-gcp/007 · origen: TRD-Aliados-Conocimiento-Certificado.md §4 bloque 007_partner_contracts.sql · deltas: ninguno

CREATE TABLE IF NOT EXISTS partner_contracts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id),
    tenant_id TEXT NOT NULL,
    package_id UUID NOT NULL REFERENCES partner_packages(id),
    kind TEXT NOT NULL DEFAULT 'direct' CHECK (kind IN ('direct','marketplace')),  -- D-P1
    scope JSONB NOT NULL,                  -- ContractScopeSchema
    fee_model JSONB NOT NULL DEFAULT '{"kind":"incluido"}'::jsonb,
    derived_knowledge_clause TEXT NOT NULL DEFAULT 'client_keeps'
        CHECK (derived_knowledge_clause IN ('client_keeps','review_on_exit')),
    valid_from TIMESTAMPTZ NOT NULL,
    valid_until TIMESTAMPTZ NOT NULL,
    status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft','pending_signature','active','suspended','terminated','expired')),
    terms_sha256 TEXT,
    signed_by_partner JSONB,               -- {user_id, at}
    signed_by_teseo JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (valid_until > valid_from)
);
CREATE INDEX IF NOT EXISTS partner_contracts_tenant_idx ON partner_contracts(tenant_id, status);
CREATE INDEX IF NOT EXISTS partner_contracts_partner_idx ON partner_contracts(partner_id, status);

-- Bitácora inmutable de eventos del contrato (creación, firmas, transiciones, sync)
CREATE TABLE IF NOT EXISTS partner_contract_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    contract_id UUID NOT NULL REFERENCES partner_contracts(id) ON DELETE CASCADE,
    event TEXT NOT NULL,
    actor TEXT NOT NULL,                   -- user_id | 'system'
    detail JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- D-P5: protección de referidos — el catálogo/marketplace no promociona otros aliados
-- de la misma vertical a un tenant referido. Restringe promoción, no compra.
CREATE TABLE IF NOT EXISTS partner_referrals (
    tenant_id TEXT NOT NULL,
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    referred_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    active BOOLEAN NOT NULL DEFAULT TRUE,
    PRIMARY KEY (tenant_id, partner_id)
);
