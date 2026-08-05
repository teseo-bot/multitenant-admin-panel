-- ADR-212 D1 (F1) — mapa tenant → Identity Platform.
--
-- Sin esto, el alta desde control crea la identidad en el IdP de `micontexto-control` y el
-- usuario NO puede entrar al panel de su tenant: los tokens de Firebase son por proyecto.
-- Medido el 2026-08-05 con la primera alta real: monica.galan@fleetco.mx quedó en control
-- (sin contraseña, sin claims) y no existía en micontexto-tenant1.
--
-- `idp_tenant_id` queda para tenants que usen multi-tenancy de GCIP (como el portal de
-- aliados, que sí usa `authForTenant`). Comerseg usa el IdP a nivel proyecto ⇒ va NULL.
-- Existe la columna desde ahora para no migrar otra vez cuando aparezca el primer tenant que
-- la necesite.
--
-- Ambas NULLABLE a propósito: un tenant sin mapa mantiene el comportamiento anterior (IdP de
-- control). Es lo que permite desplegar el código sin romper tenants no migrados — el
-- fallback que exige ADR-212 D1.
--
-- Idempotente. Depende de: 001_control_base.sql (tabla tenants).

BEGIN;

ALTER TABLE "public"."tenants" ADD COLUMN IF NOT EXISTS "idp_project_id" text;
ALTER TABLE "public"."tenants" ADD COLUMN IF NOT EXISTS "idp_tenant_id"  text;

COMMENT ON COLUMN "public"."tenants"."idp_project_id" IS
  'Proyecto GCP cuyo Identity Platform autentica a los usuarios de este tenant. NULL = usa el IdP de control (tenant no migrado, ADR-212 D1).';
COMMENT ON COLUMN "public"."tenants"."idp_tenant_id" IS
  'Tenant de GCIP dentro de ese proyecto, para multi-tenancy. NULL = IdP a nivel proyecto.';

-- Comerseg: su panel (comerseg.fleetco.mx) ya autentica contra micontexto-tenant1, así que el
-- mapa sólo documenta lo que el frontend ya hace. Verificado: NEXT_PUBLIC_FIREBASE_PROJECT_ID
-- del tenant-admin-panel es micontexto-tenant1.
UPDATE "public"."tenants"
   SET "idp_project_id" = 'micontexto-tenant1'
 WHERE "id" = '00000000-0000-0000-0000-000000000001'
   AND "idp_project_id" IS DISTINCT FROM 'micontexto-tenant1';

COMMIT;
