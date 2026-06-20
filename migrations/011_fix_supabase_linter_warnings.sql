-- Migration: Fix Supabase Security Linter warnings (50+ alerts)
-- Date: 2026-06-20
-- Categories addressed:
--   1. function_search_path_mutable (23 functions)
--   2. anon_security_definer_function_executable (9 functions)
--   3. authenticated_security_definer_function_executable (9 functions, same as above)
--   4. materialized_view_in_api (1 view)
--   5. rls_policy_always_true (1 policy)
--   6. public_bucket_allows_listing (2 buckets)
-- Nota: extension_in_public (vector, pg_net) y auth_leaked_password_protection
--   requieren acciones manuales en el Dashboard (ver notas al final).
-- Nota: notify_inbox_updates fue listada por el linter pero no existe en la BD.

-- ============================================================
-- 1. Fix search_path en todas las funciones (23 alertas)
-- ============================================================
ALTER FUNCTION public.update_updated_at_column() SET search_path = public;
ALTER FUNCTION public.check_experiment_traffic_pct() SET search_path = public;
ALTER FUNCTION public.notify_inbox_refresh() SET search_path = public;
ALTER FUNCTION public.resolve_tenant_by_channel(p_channel_type text, p_channel_identifier text) SET search_path = public;
ALTER FUNCTION public.inject_tenant_id() SET search_path = public;
ALTER FUNCTION public.notify_outbound_event() SET search_path = public;
ALTER FUNCTION public.set_updated_at() SET search_path = public;
ALTER FUNCTION public.get_experiment_timeseries(p_experiment_id uuid, p_bucket text) SET search_path = public;
ALTER FUNCTION public.set_next_version_number() SET search_path = public;
ALTER FUNCTION public.handle_updated_at() SET search_path = public;
ALTER FUNCTION public.get_experiment_stats(p_experiment_id uuid) SET search_path = public;
ALTER FUNCTION public.trg_fn_set_updated_at() SET search_path = public;
ALTER FUNCTION public.update_campaigns_updated_at() SET search_path = public;
ALTER FUNCTION public.rebalance_column() SET search_path = public;
ALTER FUNCTION public.notify_langgraph_new_lead() SET search_path = public;
ALTER FUNCTION public.retry_pending_outbox() SET search_path = public;
ALTER FUNCTION public.calculate_finops_cost() SET search_path = public;
ALTER FUNCTION public.notify_crm_compiler() SET search_path = public;
ALTER FUNCTION public.rpc_get_leads_timeseries() SET search_path = public;
ALTER FUNCTION public.notify_python_compiler() SET search_path = public;
ALTER FUNCTION public.match_tenant_memories(query_embedding vector, match_threshold double precision, match_count integer, p_tenant_id uuid) SET search_path = public;
ALTER FUNCTION public.rpc_get_leads_by_status() SET search_path = public;
ALTER FUNCTION public.rpc_get_conversion_metrics() SET search_path = public;

-- ============================================================
-- 2. Revocar EXECUTE de anon y authenticated en SECURITY DEFINER
--    functions que solo deben ser llamadas por service_role/backend
--    (18 alertas: 9 anon + 9 authenticated)
-- ============================================================
REVOKE EXECUTE ON FUNCTION public.inject_tenant_id() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.match_tenant_memories(query_embedding vector, match_threshold double precision, match_count integer, p_tenant_id uuid) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_crm_compiler() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_langgraph_new_lead() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.notify_python_compiler() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.resolve_tenant_by_channel(p_channel_type text, p_channel_identifier text) FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.retry_pending_outbox() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_get_conversion_metrics() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_get_leads_by_status() FROM anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.rpc_get_leads_timeseries() FROM anon, authenticated;

-- ============================================================
-- 3. Revocar acceso a materialized view desde API (1 alerta)
--    campaign_metrics solo debe ser accesible por service_role
-- ============================================================
REVOKE SELECT ON public.campaign_metrics FROM anon, authenticated;

-- ============================================================
-- 4. Eliminar política RLS siempre-true en tenant_users (1 alerta)
--    El service_role bypassa RLS, por lo que esta política es
--    redundante y peligrosa.
-- ============================================================
DROP POLICY IF EXISTS "Service Role has full access to tenant_users" ON public.tenant_users;

-- ============================================================
-- 5. Eliminar políticas de listing público en storage buckets (2 alertas)
-- ============================================================
DROP POLICY IF EXISTS "Public Access for Snapshots" ON storage.objects;
DROP POLICY IF EXISTS "public_read_tenant_assets" ON storage.objects;

-- ============================================================
-- NOTAS MANUALES (requieren Dashboard de Supabase):
--
-- 6. extension_in_public (2 alertas):
--    - Mover extensión `vector` al schema `extensions`
--    - Mover extensión `pg_net` al schema `extensions`
--
-- 7. auth_leaked_password_protection (1 alerta):
--    - Authentication > Settings > Habilitar "Leaked password protection"
-- ============================================================
