-- 1B: Rol app_tenant en PostgreSQL

-- 1B.1: Crear rol si no existe
DO $$
BEGIN
  IF NOT EXISTS (SELECT FROM pg_catalog.pg_roles WHERE rolname = 'app_tenant') THEN
    CREATE ROLE app_tenant LOGIN PASSWORD 'app_tenant_password' NOINHERIT;
  END IF;
END $$;

-- 1B.2: Conceder uso del schema
GRANT USAGE ON SCHEMA public TO app_tenant;

-- 1B.3 y 1B.4: Conceder permisos sobre tablas y secuencias existentes
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant;

-- 1B.5: Permisos por defecto para tablas futuras
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT USAGE, SELECT ON SEQUENCES TO app_tenant;
