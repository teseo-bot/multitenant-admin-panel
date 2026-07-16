-- migrations-gcp/009 · origen: docs/aliados/knowledge-lab/DISEÑO-Knowledge-Lab.md §3.2 · deltas: renumerada 008→009 (008 tomada por tenant_users_expansion)

CREATE TABLE IF NOT EXISTS partner_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('doc','url')),
    title TEXT NOT NULL,
    source_ref TEXT NOT NULL,          -- 'doc:sha256:…' | 'url:https://…' (SourceRefSchema de @teseo/contracts)
    gcs_object TEXT,                   -- solo kind='doc': objeto en _fuentes/ del bundle del aliado
    ingest_status TEXT NOT NULL DEFAULT 'registered'
        CHECK (ingest_status IN ('registered','distilling','distilled','failed')),
    created_by TEXT NOT NULL,          -- uid Identity Platform
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (partner_id, source_ref)
);
CREATE INDEX IF NOT EXISTS partner_sources_partner_idx ON partner_sources(partner_id, ingest_status);

-- KL1-W2: marca de onboarding completado del miembro del aliado
ALTER TABLE partner_members ADD COLUMN IF NOT EXISTS onboarded_at TIMESTAMPTZ;

-- Sin RLS: plano de control, aislamiento por requirePartnerMember en la capa API
-- (mismo patrón que 006/007 de aliados).
