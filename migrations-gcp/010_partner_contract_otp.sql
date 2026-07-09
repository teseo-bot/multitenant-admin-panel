-- migrations-gcp/010 · PA4-W2 · origen: WU PA4-W2 (firma simple por OTP de contrato de aliado)
-- Persiste el challenge OTP por (contract_id, signer_role). El código NUNCA se guarda en
-- claro — solo code_hash (sha256, ver lib/partners/contract-otp.ts::hashOtp). Toda la
-- lógica de expiración/lockout es pura (lib/partners/contract-otp.ts::verifyOtp); esta
-- tabla solo persiste el estado que esa función lee/escribe.

CREATE TABLE IF NOT EXISTS partner_contract_otp (
    contract_id UUID NOT NULL REFERENCES partner_contracts(id) ON DELETE CASCADE,
    signer_role TEXT NOT NULL CHECK (signer_role IN ('partner','teseo')),
    code_hash TEXT NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    attempts INT NOT NULL DEFAULT 0,
    locked_until TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contract_id, signer_role)
);

-- Sin RLS: plano de control, aislamiento por requirePartnerMember/requirePlatformAdmin
-- en la capa API (mismo patrón que 006-009 de aliados).
