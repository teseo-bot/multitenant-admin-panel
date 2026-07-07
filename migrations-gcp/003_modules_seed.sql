-- migrations-gcp/003 · origen: migrations/013_seed_modules.sql · deltas: ninguno

BEGIN;

INSERT INTO "public"."modules" ("id", "name", "description", "sort_order", "is_active")
VALUES
    ('crm',          'CRM Agéntico',       'Orquestación conversacional y calificación de leads.', 10, true),
    ('asset-studio', 'Asset Studio',       'Generación y gestión de activos creativos.',           20, true),
    ('analytics',    'Analítica Labs',     'Analítica avanzada y exploración de datos.',           30, true),
    ('compliance',   'Compliance Monitor', 'Monitoreo de cumplimiento y políticas.',               40, true),
    ('lms',          'Agentic LMS',        'Plataforma de aprendizaje agéntico.',                  50, true),
    ('finops',       'FinOps Control',     'Control de costos y consumo de tokens/LLM.',           60, true)
ON CONFLICT ("id") DO NOTHING;

COMMIT;
