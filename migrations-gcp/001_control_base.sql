-- migrations-gcp/001 · origen: schema.sql (extracto tablas base) · deltas: user_id→TEXT, user_role ENUM→TEXT+CHECK, DROP auth.users FK

-- Enums convertidos a TEXT + CHECK
-- tenant_status: 'active' | 'suspended' | 'onboarding'
-- user_role: 'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER'
-- theme_mode: 'LIGHT' | 'DARK' | 'SYSTEM'

CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "status" "text" DEFAULT 'onboarding' NOT NULL
        CHECK ("status" IN ('active', 'suspended', 'onboarding')),
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "orchestrator_url" "text",
    "api_key_vault_id" "text",
    "domain" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "tenants_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenants_domain_key" UNIQUE ("domain"),
    CONSTRAINT "uk_tenant_name" UNIQUE ("name")
);

CREATE TABLE IF NOT EXISTS "public"."tenant_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
    "llm_tier" "text" DEFAULT 'gemini-3.1-pro' NOT NULL,
    "features" "jsonb" DEFAULT '{}' NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "semantic_prompts" "jsonb" DEFAULT '{"sdr": "", "rag_l1": "", "gatekeeper": ""}' NOT NULL,
    "primary_color" "text" DEFAULT '222.2 47.4% 11.2%',
    "accent_color" "text" DEFAULT '210 40% 98%',
    "logo_url" "text",
    "theme_mode" "text" DEFAULT 'SYSTEM'
        CHECK ("theme_mode" IN ('LIGHT', 'DARK', 'SYSTEM')),
    CONSTRAINT "tenant_configs_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "uk_tenant_config" UNIQUE ("tenant_id")
);

CREATE TABLE IF NOT EXISTS "public"."tenant_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
    "user_id" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "text" DEFAULT 'MEMBER' NOT NULL
        CHECK ("role" IN ('OWNER', 'ADMIN', 'MEMBER', 'VIEWER')),
    CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_users_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id")
);

CREATE TABLE IF NOT EXISTS "public"."tenant_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,
    "channel_type" "text" NOT NULL,
    "channel_identifier" "text" NOT NULL,
    "credentials" "jsonb" DEFAULT '{}',
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc', "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc', "now"()) NOT NULL,
    CONSTRAINT "tenant_channels_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "tenant_channels_type_identifier_key" UNIQUE ("channel_type", "channel_identifier")
);

-- Índices de soporte
CREATE INDEX IF NOT EXISTS "idx_tenant_users_tenant_id" ON "public"."tenant_users" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_users_user_id" ON "public"."tenant_users" ("user_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_configs_tenant_id" ON "public"."tenant_configs" ("tenant_id");
CREATE INDEX IF NOT EXISTS "idx_tenant_channels_tenant_id" ON "public"."tenant_channels" ("tenant_id");
