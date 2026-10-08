-- migrations-gcp/019 · ADR-224 D-224.7 y D-224.8: el contrato de referidos y el registro del
-- lead referido. Fuente: Documents/adr/adr-224-casos-de-exito-y-match-con-aliados.md.
--
-- QUÉ ES. Tras cada evento MagIA, el entrevistador de tenant2 le muestra al lead un caso de éxito
-- escrito por un aliado proveedor. Si el lead pide conocer al proveedor y da su consentimiento,
-- se le presenta; si ese negocio cierra, el aliado le paga a micontexto un fee. Esta migración
-- crea el contrato que fija ese fee y el registro que lo hace auditable.
--
-- ⛔ POR QUÉ NO SE REUTILIZA `partner_contracts` (007), que era lo obvio. Ese contrato LICENCIA UN
-- PAQUETE de conocimiento: `package_id` es NOT NULL, y su firma y sus transiciones
-- (aliados-portal `contracts/[id]/sign`, panel `admin/partners/contracts/[id]/sign|transition`)
-- sincronizan una licencia al Cold-Tier y corren el gate de eval del paquete en la primera
-- activación. Un contrato de referidos no tiene paquete. Volver nullable `package_id` obligaría a
-- tocar esas tres rutas para que no sincronicen una licencia vacía. Por eso, tablas hermanas con
-- el MISMO ciclo de vida (`status`) y la MISMA firma por OTP: la lógica pura de
-- `lib/partners/contract-otp.ts` (hash, expiración, bloqueo) se reutiliza; sólo cambia la tabla
-- donde persiste.
--
-- ⛔ NOMBRE. Ya existe `partner_referrals` (007, D-P5) y significa lo CONTRARIO: el aliado que trae
-- un tenant a la plataforma y queda protegido en el catálogo. Lo de aquí es un LEAD que la
-- plataforma le lleva al aliado. De ahí `partner_lead_referrals`, y no `referidos` como dice el
-- borrador del ADR.
--
-- SIN DATOS PERSONALES (D-224.8, invariante del ADR). El lead vive en el hot-tier de su tenant;
-- aquí sólo hay una referencia opaca (`lead_ref`). Nombre y teléfono le llegan al aliado por el
-- traspaso que autoriza el consentimiento, nunca por esta base.
--
-- `partners.vertical` admite `tecnologia`: los proveedores de implementación que escriben casos.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS, y el CHECK de `vertical` se reemplaza buscándolo por
-- su definición (no por su nombre, que Postgres pone solo). Probada dos veces seguidas contra
-- Postgres 16 local el 2026-10-08, con 001–018 aplicadas antes. SIN APLICAR en producción.

BEGIN;

-- ── partners.vertical += 'tecnologia' ────────────────────────────────────────────────────────
DO $$
DECLARE
    c RECORD;
BEGIN
    FOR c IN
        SELECT conname FROM pg_constraint
        WHERE conrelid = 'public.partners'::regclass
          AND contype = 'c'
          AND pg_get_constraintdef(oid) LIKE '%vertical%'
    LOOP
        EXECUTE format('ALTER TABLE public.partners DROP CONSTRAINT %I', c.conname);
    END LOOP;
    ALTER TABLE public.partners ADD CONSTRAINT partners_vertical_check
        CHECK (vertical IN ('legal', 'marketing', 'consultoria', 'reclutamiento', 'tecnologia', 'otro'));
END $$;

-- ── El contrato de referidos ─────────────────────────────────────────────────────────────────
-- Uno por (aliado, tenant): el tenant es el canal del que salen los leads (tenant2 = eventos
-- MagIA). Así cada canal puede tener su propio fee.
CREATE TABLE IF NOT EXISTS partner_referral_agreements (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    partner_id        UUID NOT NULL REFERENCES partners(id),
    tenant_id         TEXT NOT NULL,                 -- mismo tipo que partner_contracts.tenant_id
    fee_model         JSONB NOT NULL,                -- ReferralFeeModelSchema (contracts/src/casos.ts)
    attribution_days  INT NOT NULL DEFAULT 180 CHECK (attribution_days BETWEEN 1 AND 730),
    valid_from        TIMESTAMPTZ NOT NULL,
    valid_until       TIMESTAMPTZ NOT NULL,
    status            TEXT NOT NULL DEFAULT 'draft'
                      CHECK (status IN ('draft', 'pending_signature', 'active', 'suspended', 'terminated', 'expired')),
    terms_version     TEXT NOT NULL,                 -- versión del texto del contrato que se firma
    terms_sha256      TEXT CHECK (terms_sha256 ~ '^[a-f0-9]{64}$'),
    signed_by_partner JSONB,                         -- {user_id, at}, igual que partner_contracts
    signed_by_teseo   JSONB,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    CHECK (valid_until > valid_from),
    CONSTRAINT partner_referral_agreements_fee_kind CHECK (
        jsonb_typeof(fee_model) = 'object' AND fee_model ->> 'kind' IN ('porcentaje', 'fijo')
    ),
    -- Un contrato activo lleva las dos firmas y el hash del texto firmado.
    CONSTRAINT partner_referral_agreements_activo_firmado CHECK (
        status <> 'active'
        OR (signed_by_partner IS NOT NULL AND signed_by_teseo IS NOT NULL AND terms_sha256 IS NOT NULL)
    )
);

COMMENT ON TABLE partner_referral_agreements IS
    'ADR-224 D-224.8: contrato de referidos aliado ↔ tenant de origen de los leads. Fija el fee por cierre. Hermano de partner_contracts (que licencia paquetes), con su mismo ciclo de vida.';

-- Un solo contrato vivo por (aliado, tenant): dos vigentes harían ambiguo qué fee aplica.
CREATE UNIQUE INDEX IF NOT EXISTS partner_referral_agreements_uno_vivo
    ON partner_referral_agreements (partner_id, tenant_id)
    WHERE status IN ('pending_signature', 'active', 'suspended');
CREATE INDEX IF NOT EXISTS partner_referral_agreements_tenant_idx
    ON partner_referral_agreements (tenant_id, status);

CREATE TABLE IF NOT EXISTS partner_referral_agreement_events (
    id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id  UUID NOT NULL REFERENCES partner_referral_agreements(id) ON DELETE CASCADE,
    event         TEXT NOT NULL,
    actor         TEXT NOT NULL,                     -- user_id | 'system'
    detail        JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_referral_agreement_events_idx
    ON partner_referral_agreement_events (agreement_id, created_at);

-- Firma simple por OTP: mismo estado que partner_contract_otp (010). El código nunca se guarda
-- en claro, sólo su hash.
CREATE TABLE IF NOT EXISTS partner_referral_agreement_otp (
    agreement_id  UUID NOT NULL REFERENCES partner_referral_agreements(id) ON DELETE CASCADE,
    signer_role   TEXT NOT NULL CHECK (signer_role IN ('partner', 'teseo')),
    code_hash     TEXT NOT NULL,
    expires_at    TIMESTAMPTZ NOT NULL,
    attempts      INT NOT NULL DEFAULT 0,
    locked_until  TIMESTAMPTZ,
    created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (agreement_id, signer_role)
);

-- ── El registro del lead referido ────────────────────────────────────────────────────────────
-- Etapas (ADR): expuesto → interesado → consentido → presentado → cerrado. Aquí:
-- exposed → interested → consented → introduced → won, más `lost`. `exposed → consented` es
-- válido: el botón «Quiero conocer al proveedor» no exige pasar por «Quiero saber más».
CREATE TABLE IF NOT EXISTS partner_lead_referrals (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    agreement_id    UUID NOT NULL REFERENCES partner_referral_agreements(id),
    lead_ref        TEXT NOT NULL,                   -- id opaco del lead en el hot-tier del tenant
    project_slug    TEXT,                            -- el evento (ADR-220); NULL = base del tenant
    case_id         UUID NOT NULL,                   -- casos_exito.id (Cold-Tier, otra base: sin FK)
    case_version    INT NOT NULL CHECK (case_version >= 1),   -- casos_exito_versiones.version mostrada
    decision_ref    TEXT,                            -- registro de la decisión de JEV que eligió el caso
    stage           TEXT NOT NULL DEFAULT 'exposed'
                    CHECK (stage IN ('exposed', 'interested', 'consented', 'introduced', 'won', 'lost')),
    exposed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    interested_at   TIMESTAMPTZ,
    consented_at    TIMESTAMPTZ,
    consent         JSONB,                           -- LeadReferralConsentSchema: hash del texto, versión del aviso, canal
    introduced_at   TIMESTAMPTZ,
    closed_at       TIMESTAMPTZ,
    deal_amount     NUMERIC(14, 2) CHECK (deal_amount >= 0),
    fee_amount      NUMERIC(14, 2) CHECK (fee_amount >= 0),
    currency        TEXT NOT NULL DEFAULT 'MXN' CHECK (currency ~ '^[A-Z]{3}$'),
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    -- Un caso se le muestra una sola vez a cada lead.
    UNIQUE (agreement_id, lead_ref, case_id),
    -- D-224.7: nada pasa de `exposed`/`interested` hacia el aliado sin consentimiento registrado.
    CONSTRAINT partner_lead_referrals_consentimiento CHECK (
        stage NOT IN ('consented', 'introduced', 'won')
        OR (consented_at IS NOT NULL AND consent IS NOT NULL
            AND consent ? 'text_sha256' AND consent ? 'privacy_notice_version')
    ),
    CONSTRAINT partner_lead_referrals_presentado CHECK (
        stage NOT IN ('introduced', 'won') OR introduced_at IS NOT NULL
    ),
    -- Un cierre ganado lleva monto, fee y fecha: es lo que se factura.
    CONSTRAINT partner_lead_referrals_cierre CHECK (
        stage <> 'won' OR (deal_amount IS NOT NULL AND fee_amount IS NOT NULL AND closed_at IS NOT NULL)
    )
);

COMMENT ON TABLE partner_lead_referrals IS
    'ADR-224 D-224.8: un lead de un tenant referido a un aliado por un caso de éxito. SIN datos personales: lead_ref es opaco. Distinto de partner_referrals (007, D-P5), que protege al aliado que trae un tenant.';

CREATE INDEX IF NOT EXISTS partner_lead_referrals_agreement_idx
    ON partner_lead_referrals (agreement_id, stage);
CREATE INDEX IF NOT EXISTS partner_lead_referrals_lead_idx
    ON partner_lead_referrals (lead_ref);

-- Bitácora inmutable de cambios de etapa: la evidencia de cada fee.
CREATE TABLE IF NOT EXISTS partner_lead_referral_events (
    id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    referral_id  UUID NOT NULL REFERENCES partner_lead_referrals(id) ON DELETE CASCADE,
    from_stage   TEXT,
    to_stage     TEXT NOT NULL,
    actor        TEXT NOT NULL,                      -- user_id | 'system' | 'lead'
    detail       JSONB NOT NULL DEFAULT '{}'::jsonb,
    created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS partner_lead_referral_events_idx
    ON partner_lead_referral_events (referral_id, created_at);

-- Sin RLS: plano de control, aislamiento por requirePartnerMember / requirePlatformAdmin en la
-- capa API (mismo patrón que 006–011).

COMMIT;
