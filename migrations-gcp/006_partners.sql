-- migrations-gcp/006 · origen: TRD-Aliados-Conocimiento-Certificado.md §4 bloque 006_partners.sql · deltas: partner_members.user_id → TEXT, partner_package_versions.published_by → TEXT

CREATE TABLE IF NOT EXISTS partners (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug TEXT NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
    legal_name TEXT NOT NULL,
    vertical TEXT NOT NULL CHECK (vertical IN ('legal','marketing','consultoria','reclutamiento','otro')),
    contact_email TEXT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending_verification'
        CHECK (status IN ('pending_verification','verified','suspended','offboarded')),
    kms_key_id TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Miembros: user de auth ↔ aliado. 'curator' puede publicar/firmar; 'member' solo edita.
-- user_id es TEXT (uid de Identity Platform, ADR-206 D-206.3) — no UUID, sin FK a auth local.
CREATE TABLE IF NOT EXISTS partner_members (
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    user_id TEXT NOT NULL,
    member_role TEXT NOT NULL DEFAULT 'member' CHECK (member_role IN ('member','curator')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (partner_id, user_id)
);

CREATE TABLE IF NOT EXISTS partner_packages (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id UUID NOT NULL REFERENCES partners(id) ON DELETE CASCADE,
    slug TEXT NOT NULL CHECK (slug ~ '^[a-z0-9][a-z0-9-]{2,59}$'),
    title TEXT NOT NULL,
    description TEXT NOT NULL DEFAULT '',
    systems TEXT[] NOT NULL,
    altitude_max INT NOT NULL DEFAULT 3 CHECK (altitude_max BETWEEN 1 AND 5),
    status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','retired')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (partner_id, slug)
);

-- Versión publicada = snapshot inmutable + firma. Una fila por publish.
CREATE TABLE IF NOT EXISTS partner_package_versions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    package_id UUID NOT NULL REFERENCES partner_packages(id) ON DELETE CASCADE,
    version INT NOT NULL,
    manifest JSONB NOT NULL,               -- PackageManifestSchema completo
    manifest_sha256 TEXT NOT NULL,
    signature_b64 TEXT NOT NULL,
    kms_key_version TEXT NOT NULL,
    published_by TEXT NOT NULL,            -- uid Identity Platform del curator (ADR-206)
    published_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE (package_id, version)
);
