-- ADR-221 D-221.1 — el proyecto se vincula al REMITENTE, no al canal.
--
-- La 016 ató el proyecto al canal (`tenant_channels.project_id`), y para tenant1 está bien:
-- una marca vive en un canal para siempre. Para tenant2 no sirve, y la razón no es técnica:
--
--   1. Meta exige una línea telefónica real y verificada para WhatsApp Business, y hay
--      presupuesto para UNA. Los proyectos son efímeros; una línea por conferencia no existe.
--   2. Un bot por proyecto diluye la marca. `analiticaMCBot` es el activo que se promueve
--      desde el escenario, y multiplicarlo lo destruye.
--
-- ⇒ Un solo número, un solo bot, N proyectos que van y vienen. El vínculo proyecto ↔ persona
-- necesita su propia fila, con su propia vida, distinta de la del canal y de la del lead. Es
-- la primera vez en el programa que el eje de alcance no cuelga de la configuración sino de
-- la conversación.
--
-- ⛔ EN TENANT2, `tenant_channels.project_id` SE QUEDA `NULL` PARA SIEMPRE (D-221.1). Esta
-- tabla no la sustituye: conviven. La 016 sigue sirviendo a tenant1.
--
-- Idempotente: CREATE TABLE IF NOT EXISTS.
-- Depende de: 001_control_base.sql (tenants) y 016_tenant_projects.sql (tenant_projects).

BEGIN;

CREATE TABLE IF NOT EXISTS "public"."tenant_project_bindings" (
    "id"          "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id"   "uuid" NOT NULL REFERENCES "public"."tenants"("id") ON DELETE CASCADE,

    -- El canal por el que entró, con los mismos literales en minúscula que usa el resolver
    -- (`whatsapp`, `telegram`, `email`, `web`). Sin CHECK a propósito: el canon vive en
    -- `contracts` y un CHECK aquí sería una segunda fuente de verdad que caduca aparte.
    "channel_type" "text" NOT NULL,

    -- ⚠️ QUÉ ES «EL REMITENTE», Y POR QUÉ ES EL MISMO IDENTIFICADOR QUE LLAVEA EL HILO.
    -- En WhatsApp es el teléfono; en Telegram, el `chatId`. Se eligió deliberadamente el
    -- mismo valor con el que `buildThreadId` arma la llave de la conversación, y no el id de
    -- la persona: en un grupo de Telegram el grano correcto para una conferencia es el GRUPO,
    -- y además mantiene alineados el vínculo y el hilo, que es lo que D-221.7 necesitará
    -- cuando el hilo gane el segmento de proyecto.
    "sender_identifier" "text" NOT NULL,

    -- CASCADE, y no el RESTRICT que la 016 puso sobre `tenant_channels.project_id`. No es una
    -- incoherencia: son objetos distintos. El canal es CONFIGURACIÓN —borrar un proyecto con
    -- canales vivos debe fallar ruidoso—; el vínculo es un HECHO DERIVADO de una conversación,
    -- y sin su proyecto no significa nada. Además habría uno por asistente: un RESTRICT aquí
    -- haría indeleble cualquier proyecto que llegara a usarse.
    "project_id"  "uuid" NOT NULL REFERENCES "public"."tenant_projects"("id") ON DELETE CASCADE,

    "bound_at"    timestamp with time zone DEFAULT "timezone"('utc', "now"()) NOT NULL,

    CONSTRAINT "tenant_project_bindings_pkey" PRIMARY KEY ("id"),

    -- D-221.7, «último gana»: quien asiste a una segunda conferencia se REVINCULA, y el
    -- vínculo nuevo sustituye al anterior. Esta restricción es lo que hace que el upsert del
    -- emparejador sea la implementación literal de esa decisión, y no una convención que
    -- alguien pueda saltarse desde otro sitio.
    CONSTRAINT "tenant_project_bindings_remitente_key"
        UNIQUE ("tenant_id", "channel_type", "sender_identifier")
);

-- La lectura caliente es «¿este remitente ya está vinculado?», en cada mensaje entrante. La
-- sirve el índice único de arriba. Éste es para el camino frío: listar quién se vinculó a una
-- conferencia, que es de lo que sale el entregable.
CREATE INDEX IF NOT EXISTS "idx_tenant_project_bindings_project"
    ON "public"."tenant_project_bindings" ("project_id");

COMMENT ON TABLE "public"."tenant_project_bindings" IS
    'ADR-221 D-221.1 — vínculo remitente ↔ proyecto, con su propia vida. Un número, un bot, N proyectos. Último gana (UNIQUE por remitente). En tenant2, tenant_channels.project_id se queda NULL para siempre.';

COMMIT;
