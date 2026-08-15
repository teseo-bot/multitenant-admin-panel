-- El AGENTE como dato del plano de control, con el MÓDULO como eje.
--
-- Por qué existe esta migración: la pestaña «Agentes» del panel llevaba meses escribiendo en una
-- tabla `tenant_agents` que NO existe en el plano de control. Vive en el Hot-Tier, herencia de la
-- era Supabase de una sola base, y el panel consulta control ⇒ `42P01` → `catch` → `[]`, que la UI
-- pintaba como «no hay agentes». El aviso «No hay API Keys configuradas» de la pestaña vecina era
-- el mismo fallo. Cinco meses de formulario que no guardaba nada.
--
-- ⚠️ NO confundir con `public.tenant_agents` del Hot-Tier (baseline 000, línea 1170). Son tablas
-- distintas en bases distintas. Ésta es la buena; aquélla es legado que nadie lee. No se migran
-- datos: el Hot-Tier no tiene ninguno que valga (el panel nunca pudo escribir).
--
-- POR QUÉ EL MÓDULO ES EL EJE. Un tenant tendrá agentes de varias funciones —hoy sólo comercial,
-- después compliance, onboarding, analítica—. Si el agente cuelga del módulo, «qué agente atiende
-- esta conversación» se responde por construcción y no hace falta inventar un enrutador entre
-- agentes: el gatekeeper del grafo sigue enrutando DENTRO del agente (comercial / soporte /
-- charla), que es lo que ya hace bien. Los módulos ya están sembrados en 003 y 005 (crm,
-- compliance, analytics, lms/onboarding, asset-studio, finops, finanzas, direccion), así que la
-- taxonomía no se inventa aquí: se reutiliza la que ya gobierna permisos en `tenant_modules`.
--
-- POR QUÉ LA MARCA ES EL SEGUNDO EJE. Un módulo puede necesitar más de una voz cuando el tenant
-- vende bajo varias marcas: tenant1 ya tiene DOS activas —`fleetco` y `cargalo`— y la fuga que
-- hizo contestar a Fleetco un lead de Cargalo demuestra que la voz no puede ser una sola. Se
-- descartaron los otros dos ejes candidatos por medición, no por gusto: el CANAL no vale porque
-- `tenant_channels.brand_id` ya resuelve la marca (poner el canal duplicaría una fila por cada
-- canal de la misma marca), y la CAMPAÑA tampoco porque tiene fallback a un UUID de ceros, así
-- que «sin campaña» acabaría siendo un agente distinto de «campaña X» sin que nadie lo pida.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS + ADD COLUMN IF NOT EXISTS + CREATE INDEX IF NOT EXISTS.
-- Depende de: 001_control_base.sql (tenants), 002_rbac.sql (modules) y 013_tenant_brands.sql
-- (tenant_brands). Aplicar tras 001..014.

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."tenant_agents" (
    "id"            "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id"     "uuid" NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,

    -- FK a `modules`, no texto libre: un módulo mal escrito dejaría al agente inalcanzable y el
    -- síntoma sería «el agente no contesta», tres capas más lejos de la causa. RESTRICT implícito
    -- (el default): retirar un módulo con agentes vivos debe fallar ruidoso.
    "module_id"     "text" NOT NULL REFERENCES "public"."modules"("id"),

    -- NULL ⇒ agente COMPARTIDO del módulo: atiende cualquier marca, y también las conversaciones
    -- que llegan SIN marca. Eso último no es un caso raro: la ruta de correo descarta la marca a
    -- propósito (`inboxWorker.ts`, WU-2.3), porque un buzón no identifica marca y adivinarla sería
    -- servir la equivocada. Misma semántica que `brand_slugs = '{}'` en el corpus, y a propósito.
    --
    -- RESTRICT (el default, como en `module_id` y como en `tenant_channels.brand_id`): retirar una
    -- marca que aún tiene agente vivo debe fallar ruidoso, no llevarse la voz por delante.
    "brand_id"      "uuid" REFERENCES "public"."tenant_brands"("id"),

    "name"          "text" NOT NULL,
    "objective"     "text" NOT NULL DEFAULT '',

    -- NULL ⇒ usa el modelo por defecto del orquestador (MODEL_SDR / MODEL_RAG del entorno).
    -- Nullable a propósito: obliga a que «no elegido» y «elegido vacío» sean estados distintos.
    "model"         "text",

    -- La VOZ del agente. Alimenta los nodos de cara al cliente igual que hoy lo hace
    -- `tenant_configs.semantic_prompts->>'system_prompt'`, que es el único camino vivo.
    -- El `gatekeeper` NO se toca desde aquí: no es una voz, es el enrutador, y sustituirlo por
    -- una personalidad rompe el ruteo entre nodos.
    "system_prompt" "text" NOT NULL DEFAULT '',

    -- Herramientas habilitadas. Vacío ⇒ el nodo usa su juego por defecto. El orquestador las
    -- interpreta como un FILTRO sobre lo que ya sabe bindear, nunca como una fuente: una tool
    -- que no existe en el código no aparece por nombrarla aquí.
    "enabled_tools" "text"[] NOT NULL DEFAULT '{}',

    "is_active"     boolean NOT NULL DEFAULT true,
    "created_at"    timestamp with time zone DEFAULT "timezone"('utc', "now"()) NOT NULL,
    "updated_at"    timestamp with time zone DEFAULT "timezone"('utc', "now"()) NOT NULL,

    CONSTRAINT "tenant_agents_pkey" PRIMARY KEY ("id")
);

-- Para bases que ya recibieron una versión anterior de esta migración (la tabla existía sin marca).
ALTER TABLE "public"."tenant_agents"
    ADD COLUMN IF NOT EXISTS "brand_id" "uuid" REFERENCES "public"."tenant_brands"("id");

CREATE INDEX IF NOT EXISTS "idx_tenant_agents_tenant_id"
    ON "public"."tenant_agents" ("tenant_id");

-- ★ El invariante que hace determinista la resolución: UN SOLO agente activo por
-- (tenant, módulo, marca) — y UNO SOLO compartido por (tenant, módulo).
--
-- Índices únicos PARCIALES, no constraints sobre las columnas: así se pueden conservar varios
-- agentes históricos desactivados para el mismo módulo —útil para volver atrás sin recrear— y aun
-- así «el agente de crm de este tenant para esta marca» es una función total, no un `LIMIT 1` sobre
-- un orden arbitrario. Sin esto, dos filas activas darían un ganador dependiente del plan de
-- ejecución: el peor tipo de fallo, porque es intermitente y no reproduce en local.
--
-- ⚠️ SON DOS ÍNDICES, Y NO ES REDUNDANCIA. En Postgres NULL nunca colisiona con NULL dentro de un
-- índice único, así que un solo índice sobre las tres columnas dejaría entrar N agentes
-- compartidos activos del mismo módulo sin protestar — justo el no-determinismo que el invariante
-- existe para impedir, reintroducido por la puerta de atrás. El segundo índice es el que cubre el
-- hueco que abre la marca opcional.
DROP INDEX IF EXISTS "public"."uq_tenant_agents_activo_por_modulo";

CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_agents_activo_por_marca"
    ON "public"."tenant_agents" ("tenant_id", "module_id", "brand_id")
    WHERE "is_active" AND "brand_id" IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS "uq_tenant_agents_activo_compartido"
    ON "public"."tenant_agents" ("tenant_id", "module_id")
    WHERE "is_active" AND "brand_id" IS NULL;

COMMIT;
