-- migrations-gcp/005 · origen: migrations/017_kdb_modules_seed.sql · deltas: ninguno

BEGIN;

INSERT INTO "public"."modules" ("id", "name", "description", "sort_order", "is_active")
VALUES
    ('finanzas',  'Finanzas · Conocimiento',              'Presupuestos, tarifas, crédito y reportes financieros.', 70, true),
    ('direccion', 'Dirección · Conocimiento Estratégico',  'Conocimiento estratégico transversal con revisión editorial obligatoria.', 80, true)
ON CONFLICT ("id") DO NOTHING;

UPDATE "public"."modules"
SET "name" = 'Onboarding Academy'
WHERE "id" = 'lms';

COMMIT;
