-- K6-W1: ACL de agentes para consumo del Cerebro Virtual OKF (TRD §10)
CREATE TABLE IF NOT EXISTS kdb_agent_acls (
    role TEXT PRIMARY KEY,
    allowed_systems TEXT[] NOT NULL,
    max_altitude INT NOT NULL CHECK (max_altitude BETWEEN 1 AND 5)
);
INSERT INTO kdb_agent_acls (role, allowed_systems, max_altitude) VALUES
    ('sdr', '{c-comercial,o-operaciones}', 3),
    ('compliance', '{l-legal,f-finanzas,h-talento-humano,o-operaciones,c-comercial,i-innovacion,t-tecnologia}', 5),
    ('eval', '{h-talento-humano,o-operaciones,c-comercial,f-finanzas,l-legal,i-innovacion,t-tecnologia}', 5)
ON CONFLICT (role) DO NOTHING;
