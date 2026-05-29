-- 1D: Verificación Post-Migración (SQL scripts para Data Bleed Testing)
-- tests/data-bleed/test-rls.sql
-- Setup y validación de data bleed

-- Crear tenants de prueba
INSERT INTO public.tenants (id, name, status) VALUES 
('00000000-0000-4000-a000-000000000001', 'Tenant A', 'active'),
('00000000-0000-4000-a000-000000000002', 'Tenant B', 'active')
ON CONFLICT DO NOTHING;

-- Crear leads de prueba
INSERT INTO public.leads (id, tenant_id, name) VALUES 
('10000000-0000-4000-a000-000000000001', '00000000-0000-4000-a000-000000000001', 'Lead A1'),
('10000000-0000-4000-a000-000000000002', '00000000-0000-4000-a000-000000000002', 'Lead B1')
ON CONFLICT DO NOTHING;

-- Verificar como app_tenant
SET ROLE app_tenant;

-- Sin setear tenant, debe fallar / retornar 0
SELECT count(*) FROM public.leads; -- Expected 0

-- Seteando Tenant A
SET LOCAL app.current_tenant = '00000000-0000-4000-a000-000000000001';
SELECT count(*) FROM public.leads; -- Expected 1

-- Seteando Tenant B
SET LOCAL app.current_tenant = '00000000-0000-4000-a000-000000000002';
SELECT count(*) FROM public.leads; -- Expected 1

RESET ROLE;
