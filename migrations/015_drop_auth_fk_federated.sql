-- 015_drop_auth_fk_federated.sql
-- WU-11/WU-10 (E4) FIX prod: en la topología FEDERADA (auth en Supabase,
-- datos en Cloud SQL) el admin de plataforma vive en el `auth.users` de
-- Supabase, NO en el `auth.users` de la DB de aplicación. Los FK duros
-- introducidos en 012 (audit.actor_id, tenant_invitations.invited_by ->
-- auth.users) hacen fallar TODA mutación auditada y TODA invitación cuando
-- el actor es un admin que no existe en el auth.users co-localizado.
--
-- DECISIÓN: convertir esas referencias en "soft references" (uuid sin FK).
-- La auditoría jamás debe bloquear una acción legítima por integridad
-- referencial contra una tabla que puede no estar co-localizada.
--
-- NO afecta tenant_users.user_id -> auth.users (los miembros de tenant SÍ
-- existen en el auth.users de Cloud SQL; ese FK se conserva).
--
-- Idempotente: DROP CONSTRAINT IF EXISTS. Aditivo/no destructivo (no borra datos).

BEGIN;

ALTER TABLE "public"."user_management_audit"
    DROP CONSTRAINT IF EXISTS "user_management_audit_actor_id_fkey";

ALTER TABLE "public"."tenant_invitations"
    DROP CONSTRAINT IF EXISTS "tenant_invitations_invited_by_fkey";

COMMIT;

-- =============================================================================
-- ROLLBACK (sólo si se re-co-localiza el auth en la misma DB y se garantiza
-- que todo actor existe en auth.users):
--   ALTER TABLE public.user_management_audit
--     ADD CONSTRAINT user_management_audit_actor_id_fkey
--     FOREIGN KEY (actor_id) REFERENCES auth.users(id);
--   ALTER TABLE public.tenant_invitations
--     ADD CONSTRAINT tenant_invitations_invited_by_fkey
--     FOREIGN KEY (invited_by) REFERENCES auth.users(id);
-- =============================================================================
