-- 1C: Políticas RLS para Tablas Transaccionales

-- ============================================================
-- 1C.1 & 1C.2: LEADS
-- ============================================================
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_leads" ON public.leads;
CREATE POLICY "tenant_isolation_leads" ON public.leads
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- ============================================================
-- 1C.3: INBOX_MESSAGES
-- ============================================================
ALTER TABLE public.inbox_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_inbox_messages" ON public.inbox_messages;
CREATE POLICY "tenant_isolation_inbox_messages" ON public.inbox_messages
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- ============================================================
-- 1C.4: FINOPS_TOKEN_LEDGER
-- ============================================================
ALTER TABLE public.finops_token_ledger ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tenant_isolation_finops_ledger" ON public.finops_token_ledger;
CREATE POLICY "tenant_isolation_finops_ledger" ON public.finops_token_ledger
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- ============================================================
-- 1C.5: TENANT_MEMORIES
-- ============================================================
-- Ya tiene RLS habilitado (20260419110000_tenant_memories.sql)
-- Añadimos política para app_tenant y authenticated
DROP POLICY IF EXISTS "tenant_isolation_memories" ON public.tenant_memories;
CREATE POLICY "tenant_isolation_memories" ON public.tenant_memories
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- ============================================================
-- 1C.6: REFORZAR TENANTS Y TENANT_CONFIGS
-- ============================================================
DROP POLICY IF EXISTS "Admins full access on tenants" ON public.tenants;
DROP POLICY IF EXISTS "tenant_isolation_tenants" ON public.tenants;
CREATE POLICY "tenant_isolation_tenants" ON public.tenants
  FOR ALL
  USING (
    id = current_setting('app.current_tenant', true)::uuid
    OR
    id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    id = current_setting('app.current_tenant', true)::uuid
    OR
    id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Admins full access on tenant_configs" ON public.tenant_configs;
DROP POLICY IF EXISTS "tenant_isolation_tenant_configs" ON public.tenant_configs;

-- Read policy: Any user in the tenant can read configs
CREATE POLICY "tenant_configs_select" ON public.tenant_configs
  FOR SELECT
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    tenant_id IN (
      SELECT tu.tenant_id FROM public.tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );

-- Modify policy: Only ADMIN or OWNER can mutate configs
CREATE POLICY "tenant_configs_modify" ON public.tenant_configs
  FOR ALL
  USING (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_configs.tenant_id
      AND tu.user_id = auth.uid()
      AND UPPER(tu.role::text) IN ('ADMIN', 'OWNER')
    )
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    EXISTS (
      SELECT 1 FROM public.tenant_users tu
      WHERE tu.tenant_id = tenant_configs.tenant_id
      AND tu.user_id = auth.uid()
      AND UPPER(tu.role::text) IN ('ADMIN', 'OWNER')
    )
  );
