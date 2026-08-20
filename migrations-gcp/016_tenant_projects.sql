-- ADR-220 D-220.4 — el PROYECTO como dato en el plano de control.
--
-- El tenant del entrevistador atiende a varios clientes a la vez. El proyecto es el eje que
-- acota qué conocimiento alcanza cada agente entrevistador, y aquí vive su catálogo.
--
-- ⛔ POR QUÉ TABLA PROPIA Y NO `campaigns` — D-220.4, medido. `campaigns` existe en el Hot-Tier
-- del tenant y parece el sitio natural, pero `context-kdb-orchestrator/src/services/campaign_resolver.ts`
-- la AUTO-CREA cuando no encuentra una campaña activa para un canal, con el nombre
-- «Inbound Orgánico - whatsapp». Un catálogo que el runtime puede inventar no es un catálogo:
-- el selector de carga enseñaría campañas fantasma que no creó nadie. Y su `channel` tiene un
-- CHECK cerrado a cuatro valores que nada tiene que ver con un proyecto de análisis.
--
-- La relación campaña → proyecto puede existir después. Nunca al revés.
--
-- Hermana de `tenant_brands` (013) a propósito, y con la misma forma: es el MISMO tipo de
-- objeto —un eje de alcance del tenant— y el resolver de canal las lee juntas en una consulta.
--
-- ⚠️ EL DEFAULT DEL EJE NO VIVE AQUÍ. Que el vacío sea «base del tenant» y que NO sea el valor
-- inicial del selector (D-220.2) lo decide el endpoint que sirve el eje, no esta tabla. Aquí
-- sólo está el catálogo.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
-- Depende de: 001_control_base.sql (tenants, tenant_channels). Aplicar tras 001..015.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."tenant_projects" (
    "id"           "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id"    "uuid" NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
    -- El slug es lo que viaja al corpus y lo que filtran las seis lecturas del orquestador.
    -- No se deriva del nombre: si se normalizara aquí y no allá, el selector ofrecería un valor
    -- que la ingesta rechaza.
    "slug"         "text" NOT NULL,
    "display_name" "text" NOT NULL,
    "is_active"    boolean NOT NULL DEFAULT true,
    "created_at"   timestamp with time zone DEFAULT "timezone"('utc', "now"()) NOT NULL,
    "updated_at"   timestamp with time zone DEFAULT "timezone"('utc', "now"()) NOT NULL,
    CONSTRAINT "tenant_projects_pkey" PRIMARY KEY ("id"),
    -- Dos tenants PUEDEN tener proyectos homónimos; un tenant no puede tener el mismo dos veces.
    CONSTRAINT "tenant_projects_tenant_slug_key" UNIQUE ("tenant_id", "slug")
);

CREATE INDEX IF NOT EXISTS "idx_tenant_projects_tenant_id"
    ON "public"."tenant_projects" ("tenant_id");

COMMENT ON TABLE "public"."tenant_projects" IS
    'ADR-220 D-220.4 — catálogo de proyectos por tenant. Eje de alcance del conocimiento, hermano de tenant_brands. NO usar campaigns para esto: el orquestador la auto-crea.';

-- ─── El canal apunta al proyecto ───────────────────────────────────────────────────────────
--
-- ADR-220 D-220.3: el proyecto entra por la IDENTIDAD DE LA CONVERSACIÓN y nunca por el schema
-- de una tool. Si el LLM pudiera nombrarlo, una instrucción colada en un mensaje o en un
-- documento haría que el agente leyera el corpus de otro cliente. Esta columna es la costura
-- que lo hace imposible: el canal por el que entra el mensaje decide el proyecto.
--
-- Encaja con lo ya decidido para campañas —un bot por campaña, sin conmutador—: la fila del
-- canal lleva el proyecto igual que ya lleva la marca.
--
-- NULLABLE a propósito, igual que `brand_id` en la 013: permite aplicar esta migración ANTES
-- de dar de alta nada, sin romper las filas existentes ni exigir ventana. Un canal sin
-- proyecto EN UN TENANT QUE ACOTA se atiende sólo con la base del tenant y el orquestador lo
-- grita en el log — degradación segura, pero ruidosa.
--
-- ON DELETE RESTRICT, no CASCADE: borrar un proyecto con canales vivos debe fallar ruidoso.
-- Un CASCADE aquí apagaría canales en silencio.
ALTER TABLE "public"."tenant_channels"
    ADD COLUMN IF NOT EXISTS "project_id" "uuid"
    REFERENCES "public"."tenant_projects"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "idx_tenant_channels_project_id"
    ON "public"."tenant_channels" ("project_id");

COMMIT;
