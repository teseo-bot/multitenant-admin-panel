-- 014_orphan_membership_fix.sql
-- WU-04 (E1): Resolver membresías huérfanas (tenant_users.user_id IS NULL) y
-- restaurar la regla "toda membresía DEBE tener identidad" (user_id NOT NULL).
--
-- POLÍTICA DE NEGOCIO: INVITAR (no purgar). Un huérfano se convierte en una
-- invitación pendiente; su dato NO se pierde. Confirmado: 0 huérfanos actuales.
--
-- Depende de: 012 (crea tenant_invitations). Aplicar DESPUÉS de 012/013.
-- Gate: revisión Opus + backup verificado antes de aplicar (skill accidental-data-loss-prevention).
-- ROLLBACK documentado al final.

BEGIN;

-- (1) Reporte informativo (no falla; sólo deja traza en el log del runner).
DO $$
DECLARE
  n_orphans int;
BEGIN
  SELECT count(*) INTO n_orphans FROM public.tenant_users WHERE user_id IS NULL;
  RAISE NOTICE 'tenant_users huérfanos detectados: %', n_orphans;
END $$;

-- (2) Convertir cada huérfano CON email en una invitación pendiente (idempotente).
--     Sólo si tiene email; sin email no es invitable y se trata en (3).
INSERT INTO public.tenant_invitations (tenant_id, email, role, token, status)
SELECT
  tu.tenant_id,
  tu.email,
  COALESCE(tu.role::text, 'MEMBER'),
  replace(gen_random_uuid()::text, '-', ''),
  'pending'
FROM public.tenant_users tu
WHERE tu.user_id IS NULL
  AND tu.email IS NOT NULL
ON CONFLICT (tenant_id, email) DO NOTHING;

-- (3) Auditar y eliminar las filas huérfanas (ya preservadas como invitación,
--     o sin email => no representables como membresía válida).
INSERT INTO public.user_management_audit (tenant_id, target_user, action, detail)
SELECT
  tu.tenant_id,
  NULL,
  'orphan_migrated_to_invite',
  jsonb_build_object('email', tu.email, 'role', tu.role, 'orphan_id', tu.id)
FROM public.tenant_users tu
WHERE tu.user_id IS NULL;

DELETE FROM public.tenant_users WHERE user_id IS NULL;

-- (4) Guarda de seguridad: abortar si por cualquier razón quedan huérfanos.
DO $$
DECLARE
  n_orphans int;
BEGIN
  SELECT count(*) INTO n_orphans FROM public.tenant_users WHERE user_id IS NULL;
  IF n_orphans > 0 THEN
    RAISE EXCEPTION 'Abortado: quedan % huérfanos; no se aplica SET NOT NULL.', n_orphans;
  END IF;
END $$;

-- (5) Restaurar la regla. Sólo se llega aquí con 0 huérfanos.
ALTER TABLE public.tenant_users ALTER COLUMN user_id SET NOT NULL;

COMMIT;

-- =============================================================================
-- ROLLBACK (ejecutar manualmente si se necesita revertir el endurecimiento):
--   ALTER TABLE public.tenant_users ALTER COLUMN user_id DROP NOT NULL;
-- (Las invitaciones creadas en (2) y los registros de auditoría en (3) se
--  conservan deliberadamente; revertir esos datos no es parte del rollback.)
-- =============================================================================
