-- 017_kdb_modules_seed.sql
-- K11-W1 (Cerebro Virtual OKF): amplía el catálogo de módulos con las dos bocas
-- de ingesta HOCFLIT que aún no tenían módulo RBAC propio (finanzas, dirección),
-- y corrige el nombre visible de 'lms' para alinearlo con la UI (menu-items.ts
-- ya la llama "Onboarding Academy"; ver tenant-admin-panel/components/layout/menu-items.ts).
-- Idempotente: ON CONFLICT DO NOTHING para los INSERT; el UPDATE de 'lms' es
-- idempotente por naturaleza (mismo valor si se re-aplica).
-- Depende de: 013 (crea el catálogo inicial). Aplicar DESPUÉS de 012..016.

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
