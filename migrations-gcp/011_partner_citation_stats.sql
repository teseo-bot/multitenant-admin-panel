-- PA7-W3 (TRD §9): metering de citas de conocimiento certificado. Solo conteos [INV-5.4].
-- Base de métricas del portal del aliado y de regalías marketplace (PA8, D-P1).

CREATE TABLE IF NOT EXISTS partner_citation_stats (
    contract_id UUID NOT NULL REFERENCES partner_contracts(id) ON DELETE CASCADE,
    day DATE NOT NULL,
    citations INT NOT NULL CHECK (citations >= 0),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (contract_id, day)
);
CREATE INDEX IF NOT EXISTS idx_pcs_day ON partner_citation_stats(day);
