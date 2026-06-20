-- Migration: Enable RLS on all public tables missing it
-- Date: 2026-06-20
-- Reason: Supabase Security Linter flagged 11 tables with RLS disabled in public schema
-- Strategy: Enable RLS on all flagged tables. Service role bypasses RLS automatically.
--   No public policies are added because these tables are accessed exclusively
--   via backend (service_role key or direct pg pool connection), never via
--   PostgREST with anon/authenticated keys.
--   If a table needs frontend access in the future, add a specific policy.

-- ============================================================
-- Categoría 1: Tablas internas de LangGraph (accedidas vía pg pool)
-- ============================================================
ALTER TABLE public.checkpoints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_migrations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_blobs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.checkpoint_writes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.thread_locks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threads ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- Categoría 2: Tablas de negocio (accedidas vía service_role desde API routes)
-- ============================================================
ALTER TABLE public.lead_assignment_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.failed_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.finops_model_pricing ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tasks ENABLE ROW LEVEL SECURITY;
