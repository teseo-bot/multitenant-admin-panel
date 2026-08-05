-- ADR-215 WU-1.1 — La MARCA como dato en el plano de control.
--
-- Fleetco y Cargalo son dos marcas DENTRO de tenant1, no dos tenants (ADR-215 §2): el tenant
-- es un límite de soberanía de datos, y el retargeting de los leads que Fleetco no cierre
-- exige que ambas marcas vean el mismo lead. Con Cargalo como tenant aparte, eso sería una
-- exportación cross-tenant.
--
-- Esta migración sólo crea el REGISTRO. La siembra de las dos marcas y sus 6 canales es
-- WU-1.3, y va aparte a propósito: los identificadores de canal de Fleetco deben COPIARSE de
-- `tenant_configs.features->'channels'`, no teclearse — un dígito distinto en
-- `wa_phone_number_id` hace que el resolver no encuentre el canal y el mensaje se descarte en
-- silencio.
--
-- `tenant_configs` NO se toca: se conserva como el default del tenant. Cuando un canal no
-- resuelve marca, la voz y el branding caen ahí (cascada de WU-3.1). Es lo que permite
-- desplegar el código nuevo sin ventana: añadir el dato activa el camino nuevo, quitarlo
-- revierte.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS.
-- Depende de: 001_control_base.sql (tenants, tenant_channels). Aplicar DESPUÉS de 001..012.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."tenant_brands" (
    "id"               "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id"        "uuid" NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
    "slug"             "text" NOT NULL,
    "display_name"     "text" NOT NULL,
    -- Voz por marca. Vacío ⇒ cae al `semantic_prompts` de `tenant_configs` (WU-3.1).
    "semantic_prompts" "jsonb" NOT NULL DEFAULT '{}',
    -- Branding por marca (WU-6.1). Vacío ⇒ cae a las columnas de `tenant_configs`.
    "branding"         "jsonb" NOT NULL DEFAULT '{}',
    "is_active"        boolean NOT NULL DEFAULT true,
    "created_at"       timestamp with time zone DEFAULT "timezone"('utc', "now"()) NOT NULL,
    "updated_at"       timestamp with time zone DEFAULT "timezone"('utc', "now"()) NOT NULL,
    CONSTRAINT "tenant_brands_pkey" PRIMARY KEY ("id"),
    -- Dos tenants PUEDEN tener marcas homónimas; un tenant no puede tener la misma dos veces.
    CONSTRAINT "tenant_brands_tenant_slug_key" UNIQUE ("tenant_id", "slug")
);

CREATE INDEX IF NOT EXISTS "idx_tenant_brands_tenant_id" ON "public"."tenant_brands" ("tenant_id");

-- El canal apunta a la marca. `tenant_channels` ya trae UNIQUE (channel_type,
-- channel_identifier) desde 001, así que esta columna convierte «canal → marca» en una FUNCIÓN
-- TOTAL por construcción, no en una heurística ([INV-215.1]). De ahí se deduce que la marca NO
-- necesita entrar en el `thread_id`: cada marca tiene sus propios identificadores.
--
-- NULLABLE a propósito: permite aplicar esta migración ANTES de sembrar, sin romper las filas
-- existentes ni exigir ventana. La obligatoriedad la impone el código ([INV-215.3]: un canal
-- sin marca resoluble FALLA, no cae a un default), no la columna.
--
-- ON DELETE RESTRICT, no CASCADE: borrar una marca que todavía tiene canales vivos debe fallar
-- ruidoso. Un CASCADE aquí apagaría canales en silencio.
ALTER TABLE "public"."tenant_channels"
    ADD COLUMN IF NOT EXISTS "brand_id" "uuid"
    REFERENCES "public"."tenant_brands"("id") ON DELETE RESTRICT;

CREATE INDEX IF NOT EXISTS "idx_tenant_channels_brand_id" ON "public"."tenant_channels" ("brand_id");

COMMIT;
