


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA "pg_catalog";






COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_net" WITH SCHEMA "public";






CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";






CREATE TYPE "public"."ab_experiment_status" AS ENUM (
    'draft',
    'running',
    'paused',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."ab_experiment_status" OWNER TO "postgres";


CREATE TYPE "public"."ab_outcome" AS ENUM (
    'no_response',
    'response',
    'positive_response',
    'meeting_booked',
    'deal_advanced',
    'objection',
    'unsubscribe'
);


ALTER TYPE "public"."ab_outcome" OWNER TO "postgres";


CREATE TYPE "public"."assigned_node" AS ENUM (
    'gatekeeper',
    'sdr',
    'hunter',
    'admin',
    'unassigned'
);


ALTER TYPE "public"."assigned_node" OWNER TO "postgres";


CREATE TYPE "public"."document_status" AS ENUM (
    'processing',
    'ready',
    'error'
);


ALTER TYPE "public"."document_status" OWNER TO "postgres";


CREATE TYPE "public"."lead_source" AS ENUM (
    'inbound_web',
    'inbound_telegram',
    'inbound_whatsapp',
    'outbound_hunter',
    'manual',
    'referral'
);


ALTER TYPE "public"."lead_source" OWNER TO "postgres";


CREATE TYPE "public"."lead_status" AS ENUM (
    'New',
    'Contacted',
    'Qualified',
    'Lost',
    'Won'
);


ALTER TYPE "public"."lead_status" OWNER TO "postgres";


CREATE TYPE "public"."message_channel" AS ENUM (
    'telegram',
    'whatsapp',
    'web',
    'email'
);


ALTER TYPE "public"."message_channel" OWNER TO "postgres";


CREATE TYPE "public"."message_sender" AS ENUM (
    'customer',
    'ai_agent',
    'human_admin'
);


ALTER TYPE "public"."message_sender" OWNER TO "postgres";


CREATE TYPE "public"."prompt_version_status" AS ENUM (
    'draft',
    'active',
    'testing',
    'archived'
);


ALTER TYPE "public"."prompt_version_status" OWNER TO "postgres";


CREATE TYPE "public"."tenant_status" AS ENUM (
    'active',
    'suspended',
    'onboarding'
);


ALTER TYPE "public"."tenant_status" OWNER TO "postgres";


CREATE TYPE "public"."theme_mode" AS ENUM (
    'LIGHT',
    'DARK',
    'SYSTEM'
);


ALTER TYPE "public"."theme_mode" OWNER TO "postgres";


CREATE TYPE "public"."user_role" AS ENUM (
    'OWNER',
    'ADMIN',
    'MEMBER',
    'VIEWER'
);


ALTER TYPE "public"."user_role" OWNER TO "postgres";


CREATE TYPE "public"."variable_type" AS ENUM (
    'text',
    'url',
    'number',
    'enum',
    'json'
);


ALTER TYPE "public"."variable_type" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."calculate_finops_cost"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    in_cost NUMERIC;
    out_cost NUMERIC;
BEGIN
    SELECT input_cost_per_million, output_cost_per_million
    INTO in_cost, out_cost
    FROM public.finops_model_pricing
    WHERE model_name = NEW.model_name;

    IF FOUND THEN
        NEW.total_cost := ((NEW.input_tokens / 1000000.0) * in_cost) + ((NEW.output_tokens / 1000000.0) * out_cost);
    ELSE
        -- Default to zero if model is not priced yet
        NEW.total_cost := 0.0;
    END IF;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."calculate_finops_cost"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."check_experiment_traffic_pct"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  total_pct INT;
  exp_id UUID;
BEGIN
  exp_id := COALESCE(NEW.experiment_id, OLD.experiment_id);
  
  SELECT SUM(traffic_pct) INTO total_pct
  FROM ab_variants
  WHERE experiment_id = exp_id;

  IF total_pct IS NOT NULL AND total_pct != 100 THEN
    RAISE EXCEPTION 'La suma de traffic_pct para el experimento % debe ser exactamente 100', exp_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;


ALTER FUNCTION "public"."check_experiment_traffic_pct"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_experiment_stats"("p_experiment_id" "uuid") RETURNS TABLE("variantId" "uuid", "label" "text", "impressions" bigint, "responseRate" numeric, "positiveRate" numeric, "meetingsBooked" bigint, "avgSentiment" numeric, "avgResponseTimeMs" numeric, "conversionRate" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH variant_data AS (
    SELECT 
      v.id as variant_id,
      v.label as variant_label,
      COUNT(i.id) as impressions,
      COUNT(i.id) FILTER (WHERE i.outcome != 'no_response') as responses,
      COUNT(i.id) FILTER (WHERE i.outcome = 'positive_response' OR i.outcome = 'meeting_booked' OR i.outcome = 'deal_advanced') as positive_responses,
      COUNT(i.id) FILTER (WHERE i.outcome = 'meeting_booked') as meetings,
      COUNT(i.id) FILTER (WHERE i.outcome IN ('meeting_booked', 'deal_advanced')) as conversions,
      AVG(i.sentiment_score) as avg_sentiment,
      AVG(i.response_time_ms) as avg_response_time
    FROM ab_variants v
    LEFT JOIN ab_impressions i ON v.id = i.variant_id
    WHERE v.experiment_id = p_experiment_id
    GROUP BY v.id, v.label
  )
  SELECT 
    variant_id,
    variant_label,
    impressions,
    CASE WHEN impressions > 0 THEN ROUND((responses::numeric / impressions::numeric) * 100, 2) ELSE 0 END,
    CASE WHEN impressions > 0 THEN ROUND((positive_responses::numeric / impressions::numeric) * 100, 2) ELSE 0 END,
    meetings,
    COALESCE(ROUND(avg_sentiment::numeric, 2), 0),
    COALESCE(ROUND(avg_response_time::numeric, 2), 0),
    CASE WHEN impressions > 0 THEN ROUND((conversions::numeric / impressions::numeric) * 100, 2) ELSE 0 END
  FROM variant_data;
END;
$$;


ALTER FUNCTION "public"."get_experiment_stats"("p_experiment_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_experiment_timeseries"("p_experiment_id" "uuid", "p_bucket" "text" DEFAULT 'day'::"text") RETURNS TABLE("timeBucket" timestamp with time zone, "variantId" "uuid", "label" "text", "conversionRate" numeric)
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  RETURN QUERY
  WITH time_buckets AS (
    SELECT 
      date_trunc(p_bucket, i.created_at) as time_bucket,
      v.id as variant_id,
      v.label as variant_label,
      COUNT(i.id) as total_impressions,
      COUNT(i.id) FILTER (WHERE i.outcome IN ('meeting_booked', 'deal_advanced')) as total_conversions
    FROM ab_variants v
    JOIN ab_impressions i ON v.id = i.variant_id
    WHERE v.experiment_id = p_experiment_id
    GROUP BY 1, 2, 3
  )
  SELECT 
    time_bucket,
    variant_id,
    variant_label,
    CASE WHEN total_impressions > 0 THEN ROUND((total_conversions::numeric / total_impressions::numeric) * 100, 2) ELSE 0 END as conversion_rate
  FROM time_buckets
  ORDER BY time_bucket ASC;
END;
$$;


ALTER FUNCTION "public"."get_experiment_timeseries"("p_experiment_id" "uuid", "p_bucket" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."handle_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."handle_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."notify_langgraph_new_lead"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_api_key TEXT;
    v_url TEXT;
    v_payload JSONB;
    v_request_id BIGINT;
BEGIN
    -- Intentar obtener la API KEY desde vault
    SELECT secret INTO v_api_key FROM vault.decrypted_secrets WHERE name = 'LANGGRAPH_INTERNAL_API_KEY' LIMIT 1;
    
    IF v_api_key IS NULL OR v_api_key = 'changeme_in_dashboard_or_env' THEN
        -- Insertamos en outbox si no hay API key real
        INSERT INTO public.lead_assignment_outbox (lead_id, tenant_id, status, last_error)
        VALUES (NEW.id, NEW.tenant_id, 'failed', 'Missing or default API key in vault');
        RETURN NEW;
    END IF;

    -- URL del orquestador Hono/Cloud Run
    v_url := current_setting('app.settings.langgraph_webhook_url', true);
    IF v_url IS NULL OR v_url = '' THEN
        v_url := 'https://langgraph-orchestrator.internal/api/internal/leads/assign';
    END IF;

    -- Construir payload dinámico (se extraen campos de NEW de forma segura)
    v_payload := jsonb_build_object(
        'event_type', 'lead.created',
        'lead_id', NEW.id,
        'tenant_id', NEW.tenant_id,
        'assigned_node', 'unassigned',
        'source_channel', to_jsonb(NEW)->>'source_channel',
        'created_at', NEW.created_at,
        'trigger_ts', extract(epoch from now())::int
    );
    -- Limpiar nulos (por ej. si source_channel no venía)
    v_payload := jsonb_strip_nulls(v_payload);

    -- Disparar webhook
    BEGIN
        SELECT net.http_post(
            url := v_url,
            headers := jsonb_build_object(
                'Content-Type', 'application/json',
                'Authorization', 'Bearer ' || v_api_key,
                'X-Idempotency-Key', NEW.id::text
            ),
            body := v_payload,
            timeout_milliseconds := 30000
        ) INTO v_request_id;
    EXCEPTION WHEN OTHERS THEN
        INSERT INTO public.lead_assignment_outbox (lead_id, tenant_id, status, last_error)
        VALUES (NEW.id, NEW.tenant_id, 'pending', SQLERRM);
    END;

    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."notify_langgraph_new_lead"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rebalance_column"() RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
    lead_record RECORD;
    new_order FLOAT := 1000;
BEGIN
    FOR lead_record IN 
        SELECT id FROM leads ORDER BY sort_order ASC
    LOOP
        UPDATE leads SET sort_order = new_order WHERE id = lead_record.id;
        new_order := new_order + 1000;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."rebalance_column"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."resolve_tenant_by_channel"("p_channel_type" "text", "p_channel_identifier" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_tenant_id uuid;
BEGIN
    SELECT tenant_id INTO v_tenant_id
    FROM public.tenant_channels
    WHERE channel_type = p_channel_type 
      AND channel_identifier = p_channel_identifier
      AND is_active = true
    LIMIT 1;
    
    RETURN v_tenant_id;
END;
$$;


ALTER FUNCTION "public"."resolve_tenant_by_channel"("p_channel_type" "text", "p_channel_identifier" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."retry_pending_outbox"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    v_row RECORD;
    v_api_key TEXT;
    v_url TEXT;
    v_payload JSONB;
BEGIN
    SELECT secret INTO v_api_key FROM vault.decrypted_secrets WHERE name = 'LANGGRAPH_INTERNAL_API_KEY' LIMIT 1;
    IF v_api_key IS NULL OR v_api_key = 'changeme_in_dashboard_or_env' THEN
        RETURN;
    END IF;

    v_url := current_setting('app.settings.langgraph_webhook_url', true);
    IF v_url IS NULL OR v_url = '' THEN
        v_url := 'https://langgraph-orchestrator.internal/api/internal/leads/assign';
    END IF;

    FOR v_row IN 
        SELECT id, lead_id, tenant_id, attempts 
        FROM public.lead_assignment_outbox 
        WHERE status IN ('pending', 'failed') 
          AND next_retry_at <= NOW()
        LIMIT 50
    LOOP
        v_payload := jsonb_build_object(
            'event_type', 'lead.created',
            'lead_id', v_row.lead_id,
            'tenant_id', v_row.tenant_id,
            'assigned_node', 'unassigned',
            'trigger_ts', extract(epoch from now())::int
        );
        
        BEGIN
            PERFORM net.http_post(
                url := v_url,
                headers := jsonb_build_object(
                    'Content-Type', 'application/json',
                    'Authorization', 'Bearer ' || v_api_key,
                    'X-Idempotency-Key', v_row.lead_id::text
                ),
                body := v_payload,
                timeout_milliseconds := 30000
            );

            UPDATE public.lead_assignment_outbox 
            SET status = 'sent', attempts = attempts + 1 
            WHERE id = v_row.id;

        EXCEPTION WHEN OTHERS THEN
            UPDATE public.lead_assignment_outbox 
            SET 
                attempts = attempts + 1,
                last_error = SQLERRM,
                status = CASE WHEN attempts + 1 >= 5 THEN 'dead' ELSE 'failed' END,
                next_retry_at = NOW() + (POWER(2, attempts) * interval '1 minute')
            WHERE id = v_row.id;
        END;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."retry_pending_outbox"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_conversion_metrics"() RETURNS TABLE("total_leads" bigint, "won_leads" bigint, "lost_leads" bigint, "avg_conversion_rate" numeric)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
  v_total bigint;
  v_won bigint;
  v_lost bigint;
BEGIN
  SELECT COUNT(*) INTO v_total FROM leads;
  SELECT COUNT(*) INTO v_won FROM leads WHERE status = 'Won';
  SELECT COUNT(*) INTO v_lost FROM leads WHERE status = 'Lost';

  RETURN QUERY SELECT 
    v_total,
    v_won,
    v_lost,
    CASE WHEN v_total > 0 THEN ROUND((v_won::numeric / v_total::numeric) * 100, 2) ELSE 0 END;
END;
$$;


ALTER FUNCTION "public"."rpc_get_conversion_metrics"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."rpc_get_leads_by_status"() RETURNS TABLE("status" "public"."lead_status", "total" bigint)
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
  RETURN QUERY
    SELECT l.status, COUNT(*) as total
    FROM leads l
    GROUP BY l.status;
END;
$$;


ALTER FUNCTION "public"."rpc_get_leads_by_status"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_next_version_number"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  IF NEW.version_number IS NULL THEN
    SELECT COALESCE(MAX(version_number), 0) + 1
    INTO NEW.version_number
    FROM prompt_versions
    WHERE template_id = NEW.template_id;
  END IF;
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_next_version_number"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_fn_set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."trg_fn_set_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_campaigns_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_campaigns_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_updated_at_column"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_updated_at_column"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."ab_experiments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "template_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "status" "public"."ab_experiment_status" DEFAULT 'draft'::"public"."ab_experiment_status" NOT NULL,
    "min_impressions" integer DEFAULT 100 NOT NULL,
    "confidence_level" numeric(3,2) DEFAULT 0.95 NOT NULL,
    "started_at" timestamp with time zone,
    "ended_at" timestamp with time zone,
    "winner_variant_id" "uuid",
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."ab_experiments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ab_impressions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "variant_id" "uuid" NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "outcome" "public"."ab_outcome",
    "sentiment_score" numeric(4,3),
    "response_time_ms" integer,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "ab_impressions_sentiment_score_check" CHECK ((("sentiment_score" >= '-1.000'::numeric) AND ("sentiment_score" <= 1.000)))
);


ALTER TABLE "public"."ab_impressions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."ab_variants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "experiment_id" "uuid" NOT NULL,
    "version_id" "uuid" NOT NULL,
    "traffic_pct" integer NOT NULL,
    "label" character(1) NOT NULL,
    CONSTRAINT "ab_variants_traffic_pct_check" CHECK ((("traffic_pct" >= 0) AND ("traffic_pct" <= 100)))
);


ALTER TABLE "public"."ab_variants" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_approvals" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "reviewer_id" "uuid" NOT NULL,
    "decision" "text" NOT NULL,
    "reason" "text",
    "decided_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaign_approvals_decision_check" CHECK (("decision" = ANY (ARRAY['approved'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."campaign_approvals" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaign_events" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "campaign_id" "uuid" NOT NULL,
    "event_type" "text" NOT NULL,
    "agent_role" "text",
    "thread_id" "uuid",
    "lead_id" "uuid",
    "payload" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "idempotency_key" character varying(255),
    CONSTRAINT "campaign_events_event_type_check" CHECK (("event_type" = ANY (ARRAY['message_sent'::"text", 'message_received'::"text", 'tool_call'::"text", 'handoff_request'::"text", 'handoff_completed'::"text", 'lead_qualified'::"text", 'lead_lost'::"text", 'state_change'::"text", 'error'::"text", 'manual_override'::"text"])))
);


ALTER TABLE "public"."campaign_events" OWNER TO "postgres";


CREATE MATERIALIZED VIEW "public"."campaign_metrics" AS
 SELECT "campaign_id",
    "count"(*) FILTER (WHERE ("event_type" = 'message_sent'::"text")) AS "messages_sent",
    "count"(*) FILTER (WHERE ("event_type" = 'message_received'::"text")) AS "messages_received",
    "count"(*) FILTER (WHERE ("event_type" = 'lead_qualified'::"text")) AS "leads_qualified",
    "count"(*) FILTER (WHERE ("event_type" = 'lead_lost'::"text")) AS "leads_lost",
    "count"(*) FILTER (WHERE ("event_type" = 'handoff_request'::"text")) AS "handoffs_requested",
    "count"(*) FILTER (WHERE ("event_type" = 'handoff_completed'::"text")) AS "handoffs_completed",
    "count"(*) FILTER (WHERE ("event_type" = 'error'::"text")) AS "errors",
    "count"(DISTINCT "thread_id") AS "unique_threads",
    "count"(DISTINCT "lead_id") AS "unique_leads",
    "min"("occurred_at") AS "first_event_at",
    "max"("occurred_at") AS "last_event_at"
   FROM "public"."campaign_events" "ce"
  GROUP BY "campaign_id"
  WITH NO DATA;


ALTER MATERIALIZED VIEW "public"."campaign_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."campaigns" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "agent_roles" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "channel" "text" NOT NULL,
    "status" "text" DEFAULT 'draft'::"text" NOT NULL,
    "target_audience" "jsonb" DEFAULT '{}'::"jsonb",
    "scheduled_start" timestamp with time zone,
    "scheduled_end" timestamp with time zone,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "campaigns_channel_check" CHECK (("channel" = ANY (ARRAY['whatsapp'::"text", 'email'::"text", 'linkedin'::"text", 'webchat'::"text"]))),
    CONSTRAINT "campaigns_status_check" CHECK (("status" = ANY (ARRAY['draft'::"text", 'pending_review'::"text", 'approved'::"text", 'rejected'::"text", 'active'::"text", 'paused'::"text", 'completed'::"text"])))
);


ALTER TABLE "public"."campaigns" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "file_path" "text",
    "file_type" "text" NOT NULL,
    "size_bytes" bigint,
    "status" "public"."document_status" DEFAULT 'processing'::"public"."document_status" NOT NULL,
    "error_message" "text",
    "created_by" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finops_model_pricing" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "model_name" "text" NOT NULL,
    "input_cost_per_million" numeric NOT NULL,
    "output_cost_per_million" numeric NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."finops_model_pricing" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."finops_token_ledger" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "thread_id" "text" NOT NULL,
    "model_name" "text" NOT NULL,
    "input_tokens" integer NOT NULL,
    "output_tokens" integer NOT NULL,
    "total_cost" numeric DEFAULT 0.0 NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."finops_token_ledger" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."inbox_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "sender" "public"."message_sender" NOT NULL,
    "channel" "public"."message_channel" NOT NULL,
    "content" "text" NOT NULL,
    "external_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "actor_id" "uuid"
);


ALTER TABLE "public"."inbox_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."job" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "priority" integer DEFAULT 0 NOT NULL,
    "data" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "state" "text" DEFAULT 'created'::"text" NOT NULL,
    "retry_limit" integer DEFAULT 0 NOT NULL,
    "retry_count" integer DEFAULT 0 NOT NULL,
    "retry_delay" integer DEFAULT 0 NOT NULL,
    "retry_backoff" boolean DEFAULT false NOT NULL,
    "start_after" timestamp with time zone DEFAULT "now"() NOT NULL,
    "started_on" timestamp with time zone,
    "singleton_key" "text",
    "singleton_on" timestamp without time zone,
    "expire_in" interval DEFAULT '00:15:00'::interval NOT NULL,
    "created_on" timestamp with time zone DEFAULT "now"() NOT NULL,
    "completed_on" timestamp with time zone,
    "keep_until" timestamp with time zone DEFAULT ("now"() + '14 days'::interval) NOT NULL
);


ALTER TABLE "public"."job" OWNER TO "postgres";


COMMENT ON TABLE "public"."job" IS 'Cola de trabajos duraderos para los Minion Workers (ADR-106).';



CREATE TABLE IF NOT EXISTS "public"."lead_assignment_outbox" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "lead_id" "uuid" NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "attempts" integer DEFAULT 0 NOT NULL,
    "last_error" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "next_retry_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "lead_assignment_outbox_status_check" CHECK (("status" = ANY (ARRAY['pending'::"text", 'sent'::"text", 'failed'::"text", 'dead'::"text"])))
);


ALTER TABLE "public"."lead_assignment_outbox" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."leads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" character varying(255) NOT NULL,
    "company" character varying(255),
    "email" character varying(320),
    "phone" character varying(20),
    "status" "public"."lead_status" DEFAULT 'New'::"public"."lead_status" NOT NULL,
    "source" "public"."lead_source" DEFAULT 'inbound_web'::"public"."lead_source" NOT NULL,
    "icp_score" numeric(5,2),
    "assigned_node" "public"."assigned_node" DEFAULT 'unassigned'::"public"."assigned_node" NOT NULL,
    "sort_order" double precision DEFAULT 0 NOT NULL,
    "thread_id" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    CONSTRAINT "leads_icp_score_check" CHECK ((("icp_score" >= (0)::numeric) AND ("icp_score" <= (100)::numeric)))
);


ALTER TABLE "public"."leads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_templates" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text",
    "active_version_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone,
    CONSTRAINT "prompt_templates_role_check" CHECK (("role" = ANY (ARRAY['sdr'::"text", 'gatekeeper'::"text", 'hunter'::"text", 'l1_support'::"text"])))
);


ALTER TABLE "public"."prompt_templates" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."prompt_versions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "template_id" "uuid" NOT NULL,
    "version_number" integer NOT NULL,
    "content" "text" NOT NULL,
    "variables" "jsonb" DEFAULT '[]'::"jsonb" NOT NULL,
    "changelog" "text",
    "status" "public"."prompt_version_status" DEFAULT 'draft'::"public"."prompt_version_status" NOT NULL,
    "created_by" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."prompt_versions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_channels" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "channel_type" "text" NOT NULL,
    "channel_identifier" "text" NOT NULL,
    "credentials" "jsonb" DEFAULT '{}'::"jsonb",
    "is_active" boolean DEFAULT true,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."tenant_channels" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_configs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "llm_tier" "text" DEFAULT 'gemini-3.1-pro'::"text" NOT NULL,
    "features" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "semantic_prompts" "jsonb" DEFAULT '{"sdr": "", "rag_l1": "", "gatekeeper": ""}'::"jsonb" NOT NULL,
    "primary_color" "text" DEFAULT '222.2 47.4% 11.2%'::"text",
    "accent_color" "text" DEFAULT '210 40% 98%'::"text",
    "logo_url" "text",
    "theme_mode" "public"."theme_mode" DEFAULT 'SYSTEM'::"public"."theme_mode"
);


ALTER TABLE "public"."tenant_configs" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_configs" IS 'Parámetros operacionales que dictan el comportamiento de la IA para cada tenant.';



CREATE OR REPLACE VIEW "public"."tenant_financial_summary_view" WITH ("security_invoker"='true') AS
 SELECT "tenant_id",
    "date_trunc"('month'::"text", "created_at") AS "billing_month",
    "model_name",
    "count"("id") AS "total_requests",
    "sum"("input_tokens") AS "total_input_tokens",
    "sum"("output_tokens") AS "total_output_tokens",
    "sum"("total_cost") AS "total_cost_usd"
   FROM "public"."finops_token_ledger"
  GROUP BY "tenant_id", ("date_trunc"('month'::"text", "created_at")), "model_name";


ALTER VIEW "public"."tenant_financial_summary_view" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenant_memories" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "embedding" "public"."vector"(768) NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "document_id" "uuid"
);


ALTER TABLE "public"."tenant_memories" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenant_memories" IS 'Memoria a largo plazo de cada inquilino (RAG).';



CREATE TABLE IF NOT EXISTS "public"."tenant_users" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "role" "public"."user_role" DEFAULT 'MEMBER'::"public"."user_role"
);


ALTER TABLE "public"."tenant_users" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tenants" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "status" "public"."tenant_status" DEFAULT 'onboarding'::"public"."tenant_status" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "orchestrator_url" "text",
    "api_key_vault_id" "text",
    "domain" "text",
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."tenants" OWNER TO "postgres";


COMMENT ON TABLE "public"."tenants" IS 'Almacena la identidad y estado de suscripción de clientes B2B.';



CREATE TABLE IF NOT EXISTS "public"."variable_defs" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "tenant_id" "uuid" NOT NULL,
    "key" "text" NOT NULL,
    "label" "text" NOT NULL,
    "type" "public"."variable_type" DEFAULT 'text'::"public"."variable_type" NOT NULL,
    "default_value" "text",
    "enum_options" "jsonb",
    "required" boolean DEFAULT false NOT NULL,
    "description" "text",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."variable_defs" OWNER TO "postgres";


ALTER TABLE ONLY "public"."ab_experiments"
    ADD CONSTRAINT "ab_experiments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ab_impressions"
    ADD CONSTRAINT "ab_impressions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."ab_variants"
    ADD CONSTRAINT "ab_variants_experiment_id_label_key" UNIQUE ("experiment_id", "label");



ALTER TABLE ONLY "public"."ab_variants"
    ADD CONSTRAINT "ab_variants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_approvals"
    ADD CONSTRAINT "campaign_approvals_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaign_events"
    ADD CONSTRAINT "campaign_events_campaign_id_idempotency_key_key" UNIQUE ("campaign_id", "idempotency_key");



ALTER TABLE ONLY "public"."campaign_events"
    ADD CONSTRAINT "campaign_events_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finops_model_pricing"
    ADD CONSTRAINT "finops_model_pricing_model_name_key" UNIQUE ("model_name");



ALTER TABLE ONLY "public"."finops_model_pricing"
    ADD CONSTRAINT "finops_model_pricing_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."finops_token_ledger"
    ADD CONSTRAINT "finops_token_ledger_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."inbox_messages"
    ADD CONSTRAINT "inbox_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."job"
    ADD CONSTRAINT "job_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."lead_assignment_outbox"
    ADD CONSTRAINT "lead_assignment_outbox_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_thread_id_key" UNIQUE ("thread_id");



ALTER TABLE ONLY "public"."prompt_templates"
    ADD CONSTRAINT "prompt_templates_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_templates"
    ADD CONSTRAINT "prompt_templates_tenant_id_role_name_key" UNIQUE ("tenant_id", "role", "name");



ALTER TABLE ONLY "public"."prompt_versions"
    ADD CONSTRAINT "prompt_versions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."prompt_versions"
    ADD CONSTRAINT "prompt_versions_template_id_version_number_key" UNIQUE ("template_id", "version_number");



ALTER TABLE ONLY "public"."tenant_channels"
    ADD CONSTRAINT "tenant_channels_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_channels"
    ADD CONSTRAINT "tenant_channels_type_identifier_key" UNIQUE ("channel_type", "channel_identifier");



ALTER TABLE ONLY "public"."tenant_configs"
    ADD CONSTRAINT "tenant_configs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_memories"
    ADD CONSTRAINT "tenant_memories_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_tenant_id_user_id_key" UNIQUE ("tenant_id", "user_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_domain_key" UNIQUE ("domain");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "tenants_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."tenant_configs"
    ADD CONSTRAINT "uk_tenant_config" UNIQUE ("tenant_id");



ALTER TABLE ONLY "public"."tenants"
    ADD CONSTRAINT "uk_tenant_name" UNIQUE ("name");



ALTER TABLE ONLY "public"."variable_defs"
    ADD CONSTRAINT "variable_defs_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."variable_defs"
    ADD CONSTRAINT "variable_defs_tenant_id_key_key" UNIQUE ("tenant_id", "key");



CREATE INDEX "idx_campaign_approvals_campaign" ON "public"."campaign_approvals" USING "btree" ("campaign_id", "decided_at" DESC);



CREATE INDEX "idx_campaign_events_campaign" ON "public"."campaign_events" USING "btree" ("campaign_id", "occurred_at" DESC);



CREATE INDEX "idx_campaign_events_type" ON "public"."campaign_events" USING "btree" ("campaign_id", "event_type");



CREATE UNIQUE INDEX "idx_campaign_metrics_pk" ON "public"."campaign_metrics" USING "btree" ("campaign_id");



CREATE INDEX "idx_campaigns_created_at" ON "public"."campaigns" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_campaigns_tenant_status" ON "public"."campaigns" USING "btree" ("tenant_id", "status");



CREATE INDEX "idx_finops_ledger_created_at" ON "public"."finops_token_ledger" USING "btree" ("created_at");



CREATE INDEX "idx_finops_ledger_tenant" ON "public"."finops_token_ledger" USING "btree" ("tenant_id");



CREATE INDEX "idx_impressions_created" ON "public"."ab_impressions" USING "btree" ("created_at");



CREATE INDEX "idx_impressions_variant" ON "public"."ab_impressions" USING "btree" ("variant_id");



CREATE INDEX "idx_lead_assignment_outbox_pending" ON "public"."lead_assignment_outbox" USING "btree" ("status", "next_retry_at") WHERE ("status" = ANY (ARRAY['pending'::"text", 'failed'::"text"]));



CREATE INDEX "idx_leads_analytics_dates" ON "public"."leads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_leads_analytics_status" ON "public"."leads" USING "btree" ("status");



CREATE INDEX "idx_leads_assigned" ON "public"."leads" USING "btree" ("assigned_node") WHERE ("assigned_node" <> 'unassigned'::"public"."assigned_node");



CREATE INDEX "idx_leads_icp" ON "public"."leads" USING "btree" ("icp_score" DESC NULLS LAST);



CREATE INDEX "idx_leads_kanban" ON "public"."leads" USING "btree" ("status", "sort_order");



CREATE INDEX "idx_leads_tenant" ON "public"."leads" USING "btree" ("tenant_id");



CREATE INDEX "idx_messages_external" ON "public"."inbox_messages" USING "btree" ("external_id") WHERE ("external_id" IS NOT NULL);



CREATE INDEX "idx_messages_external_id" ON "public"."inbox_messages" USING "btree" ("external_id") WHERE ("external_id" IS NOT NULL);



CREATE INDEX "idx_messages_timeline" ON "public"."inbox_messages" USING "btree" ("lead_id", "created_at" DESC);



CREATE INDEX "job_name_idx" ON "public"."job" USING "btree" ("name");



CREATE INDEX "job_start_after_idx" ON "public"."job" USING "btree" ("start_after");



CREATE INDEX "job_state_idx" ON "public"."job" USING "btree" ("state");



CREATE INDEX "tenant_memories_embedding_idx" ON "public"."tenant_memories" USING "hnsw" ("embedding" "public"."vector_cosine_ops");



CREATE INDEX "tenant_memories_tenant_id_idx" ON "public"."tenant_memories" USING "btree" ("tenant_id");



CREATE OR REPLACE TRIGGER "calculate_finops_cost_trigger" BEFORE INSERT ON "public"."finops_token_ledger" FOR EACH ROW EXECUTE FUNCTION "public"."calculate_finops_cost"();



CREATE OR REPLACE TRIGGER "set_tenant_configs_updated_at" BEFORE UPDATE ON "public"."tenant_configs" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "set_tenants_updated_at" BEFORE UPDATE ON "public"."tenants" FOR EACH ROW EXECUTE FUNCTION "public"."handle_updated_at"();



CREATE OR REPLACE TRIGGER "tr_set_next_version_number" BEFORE INSERT ON "public"."prompt_versions" FOR EACH ROW EXECUTE FUNCTION "public"."set_next_version_number"();



CREATE OR REPLACE TRIGGER "trg_campaigns_updated_at" BEFORE UPDATE ON "public"."campaigns" FOR EACH ROW EXECUTE FUNCTION "public"."update_campaigns_updated_at"();



CREATE CONSTRAINT TRIGGER "trg_check_traffic_pct" AFTER INSERT OR DELETE OR UPDATE ON "public"."ab_variants" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."check_experiment_traffic_pct"();



CREATE OR REPLACE TRIGGER "trg_leads_notify_langgraph" AFTER INSERT ON "public"."leads" FOR EACH ROW WHEN (("new"."assigned_node" = 'unassigned'::"public"."assigned_node")) EXECUTE FUNCTION "public"."notify_langgraph_new_lead"();



CREATE OR REPLACE TRIGGER "trg_leads_updated_at" BEFORE UPDATE ON "public"."leads" FOR EACH ROW EXECUTE FUNCTION "public"."trg_fn_set_updated_at"();



CREATE OR REPLACE TRIGGER "trg_prompt_templates_updated_at" BEFORE UPDATE ON "public"."prompt_templates" FOR EACH ROW EXECUTE FUNCTION "public"."update_updated_at_column"();



ALTER TABLE ONLY "public"."ab_experiments"
    ADD CONSTRAINT "ab_experiments_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prompt_templates"("id");



ALTER TABLE ONLY "public"."ab_experiments"
    ADD CONSTRAINT "ab_experiments_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."ab_impressions"
    ADD CONSTRAINT "ab_impressions_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "public"."ab_variants"("id");



ALTER TABLE ONLY "public"."ab_variants"
    ADD CONSTRAINT "ab_variants_experiment_id_fkey" FOREIGN KEY ("experiment_id") REFERENCES "public"."ab_experiments"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."ab_variants"
    ADD CONSTRAINT "ab_variants_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "public"."prompt_versions"("id");



ALTER TABLE ONLY "public"."campaign_approvals"
    ADD CONSTRAINT "campaign_approvals_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaign_events"
    ADD CONSTRAINT "campaign_events_campaign_id_fkey" FOREIGN KEY ("campaign_id") REFERENCES "public"."campaigns"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."campaigns"
    ADD CONSTRAINT "campaigns_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_templates"
    ADD CONSTRAINT "fk_active_version" FOREIGN KEY ("active_version_id") REFERENCES "public"."prompt_versions"("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."inbox_messages"
    ADD CONSTRAINT "fk_inbox_messages_actor" FOREIGN KEY ("actor_id") REFERENCES "auth"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."ab_experiments"
    ADD CONSTRAINT "fk_winner_variant" FOREIGN KEY ("winner_variant_id") REFERENCES "public"."ab_variants"("id") ON DELETE SET NULL DEFERRABLE INITIALLY DEFERRED;



ALTER TABLE ONLY "public"."inbox_messages"
    ADD CONSTRAINT "inbox_messages_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "public"."leads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."leads"
    ADD CONSTRAINT "leads_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."prompt_templates"
    ADD CONSTRAINT "prompt_templates_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



ALTER TABLE ONLY "public"."prompt_versions"
    ADD CONSTRAINT "prompt_versions_template_id_fkey" FOREIGN KEY ("template_id") REFERENCES "public"."prompt_templates"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_channels"
    ADD CONSTRAINT "tenant_channels_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_configs"
    ADD CONSTRAINT "tenant_configs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_memories"
    ADD CONSTRAINT "tenant_memories_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_memories"
    ADD CONSTRAINT "tenant_memories_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tenant_users"
    ADD CONSTRAINT "tenant_users_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."variable_defs"
    ADD CONSTRAINT "variable_defs_tenant_id_fkey" FOREIGN KEY ("tenant_id") REFERENCES "public"."tenants"("id");



CREATE POLICY "Admins full access on tenant_configs" ON "public"."tenant_configs" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Admins full access on tenants" ON "public"."tenants" TO "authenticated" USING (true) WITH CHECK (true);



CREATE POLICY "Authenticated users can read" ON "public"."tenant_channels" FOR SELECT TO "authenticated" USING (true);



CREATE POLICY "Service Role Full Access to Jobs" ON "public"."job" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service Role Full Access to Memories" ON "public"."tenant_memories" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service Role has full access to tenant_channels" ON "public"."tenant_channels" TO "service_role" USING (true) WITH CHECK (true);



CREATE POLICY "Service Role has full access to tenant_users" ON "public"."tenant_users" USING (true) WITH CHECK (true);



CREATE POLICY "Tenants can view their own finops ledger" ON "public"."finops_token_ledger" FOR SELECT USING (("tenant_id" = "auth"."uid"()));



CREATE POLICY "Users can view their own tenant_users relation" ON "public"."tenant_users" FOR SELECT USING (("auth"."uid"() = "user_id"));



ALTER TABLE "public"."ab_experiments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ab_impressions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."ab_variants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_approvals" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaign_events" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."campaigns" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."finops_token_ledger" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."job" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompt_templates" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."prompt_versions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_channels" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_configs" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "tenant_isolation_campaign_approvals" ON "public"."campaign_approvals" USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns" "c"
  WHERE (("c"."id" = "campaign_approvals"."campaign_id") AND ("c"."tenant_id" = ("current_setting"('app.tenant_id'::"text", true))::"uuid")))));



CREATE POLICY "tenant_isolation_campaign_events" ON "public"."campaign_events" USING ((EXISTS ( SELECT 1
   FROM "public"."campaigns" "c"
  WHERE (("c"."id" = "campaign_events"."campaign_id") AND ("c"."tenant_id" = ("current_setting"('app.tenant_id'::"text", true))::"uuid")))));



CREATE POLICY "tenant_isolation_campaigns" ON "public"."campaigns" USING (("tenant_id" = ("current_setting"('app.tenant_id'::"text", true))::"uuid"));



CREATE POLICY "tenant_isolation_documents" ON "public"."documents" USING (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_isolation_experiments" ON "public"."ab_experiments" USING (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_isolation_impressions" ON "public"."ab_impressions" USING (("variant_id" IN ( SELECT "v"."id"
   FROM ("public"."ab_variants" "v"
     JOIN "public"."ab_experiments" "e" ON (("e"."id" = "v"."experiment_id")))
  WHERE ("e"."tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"))));



CREATE POLICY "tenant_isolation_templates" ON "public"."prompt_templates" USING (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_isolation_variables" ON "public"."variable_defs" USING (("tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"));



CREATE POLICY "tenant_isolation_variants" ON "public"."ab_variants" USING (("experiment_id" IN ( SELECT "ab_experiments"."id"
   FROM "public"."ab_experiments"
  WHERE ("ab_experiments"."tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"))));



CREATE POLICY "tenant_isolation_versions" ON "public"."prompt_versions" USING (("template_id" IN ( SELECT "prompt_templates"."id"
   FROM "public"."prompt_templates"
  WHERE ("prompt_templates"."tenant_id" = (("auth"."jwt"() ->> 'tenant_id'::"text"))::"uuid"))));



ALTER TABLE "public"."tenant_memories" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenant_users" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tenants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."variable_defs" ENABLE ROW LEVEL SECURITY;




ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";









GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";






GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_out"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_send"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_out"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_send"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_in"("cstring", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_out"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_recv"("internal", "oid", integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_send"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_typmod_in"("cstring"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(real[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(double precision[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(integer[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_halfvec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_sparsevec"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."array_to_vector"(numeric[], integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_float4"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_sparsevec"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_to_vector"("public"."halfvec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_halfvec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_to_vector"("public"."sparsevec", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_float4"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_halfvec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_to_sparsevec"("public"."vector", integer, boolean) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "anon";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector"("public"."vector", integer, boolean) TO "service_role";














































































































































































GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."binary_quantize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."calculate_finops_cost"() TO "anon";
GRANT ALL ON FUNCTION "public"."calculate_finops_cost"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."calculate_finops_cost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."check_experiment_traffic_pct"() TO "anon";
GRANT ALL ON FUNCTION "public"."check_experiment_traffic_pct"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."check_experiment_traffic_pct"() TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."cosine_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_experiment_stats"("p_experiment_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_experiment_stats"("p_experiment_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_experiment_stats"("p_experiment_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_experiment_timeseries"("p_experiment_id" "uuid", "p_bucket" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."get_experiment_timeseries"("p_experiment_id" "uuid", "p_bucket" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_experiment_timeseries"("p_experiment_id" "uuid", "p_bucket" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_accum"(double precision[], "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_add"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_cmp"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_concat"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_eq"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ge"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_gt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_l2_squared_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_le"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_lt"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_mul"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_ne"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_negative_inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_spherical_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."halfvec_sub"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."hamming_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."handle_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnsw_sparsevec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."hnswhandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_bit_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflat_halfvec_support"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "postgres";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "anon";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "authenticated";
GRANT ALL ON FUNCTION "public"."ivfflathandler"("internal") TO "service_role";



GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "postgres";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "anon";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "authenticated";
GRANT ALL ON FUNCTION "public"."jaccard_distance"(bit, bit) TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l1_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."halfvec", "public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_norm"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."l2_normalize"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."notify_langgraph_new_lead"() TO "anon";
GRANT ALL ON FUNCTION "public"."notify_langgraph_new_lead"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."notify_langgraph_new_lead"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rebalance_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."rebalance_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rebalance_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."resolve_tenant_by_channel"("p_channel_type" "text", "p_channel_identifier" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."resolve_tenant_by_channel"("p_channel_type" "text", "p_channel_identifier" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."resolve_tenant_by_channel"("p_channel_type" "text", "p_channel_identifier" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."retry_pending_outbox"() TO "anon";
GRANT ALL ON FUNCTION "public"."retry_pending_outbox"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."retry_pending_outbox"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_get_conversion_metrics"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_conversion_metrics"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_get_conversion_metrics"() TO "service_role";



GRANT ALL ON FUNCTION "public"."rpc_get_leads_by_status"() TO "anon";
GRANT ALL ON FUNCTION "public"."rpc_get_leads_by_status"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."rpc_get_leads_by_status"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_next_version_number"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_next_version_number"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_next_version_number"() TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_cmp"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_eq"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ge"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_gt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_l2_squared_distance"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_le"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_lt"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_ne"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "anon";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sparsevec_negative_inner_product"("public"."sparsevec", "public"."sparsevec") TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."halfvec", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "postgres";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "anon";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "authenticated";
GRANT ALL ON FUNCTION "public"."subvector"("public"."vector", integer, integer) TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_fn_set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_fn_set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_fn_set_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_campaigns_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_campaigns_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_campaigns_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_updated_at_column"() TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_accum"(double precision[], "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_add"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_avg"(double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_cmp"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "anon";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_combine"(double precision[], double precision[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_concat"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_dims"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_eq"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ge"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_gt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_l2_squared_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_le"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_lt"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_mul"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_ne"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_negative_inner_product"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_norm"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_spherical_distance"("public"."vector", "public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."vector_sub"("public"."vector", "public"."vector") TO "service_role";












GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."avg"("public"."vector") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."halfvec") TO "service_role";



GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "postgres";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "anon";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "authenticated";
GRANT ALL ON FUNCTION "public"."sum"("public"."vector") TO "service_role";















GRANT ALL ON TABLE "public"."ab_experiments" TO "anon";
GRANT ALL ON TABLE "public"."ab_experiments" TO "authenticated";
GRANT ALL ON TABLE "public"."ab_experiments" TO "service_role";



GRANT ALL ON TABLE "public"."ab_impressions" TO "anon";
GRANT ALL ON TABLE "public"."ab_impressions" TO "authenticated";
GRANT ALL ON TABLE "public"."ab_impressions" TO "service_role";



GRANT ALL ON TABLE "public"."ab_variants" TO "anon";
GRANT ALL ON TABLE "public"."ab_variants" TO "authenticated";
GRANT ALL ON TABLE "public"."ab_variants" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_approvals" TO "anon";
GRANT ALL ON TABLE "public"."campaign_approvals" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_approvals" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_events" TO "anon";
GRANT ALL ON TABLE "public"."campaign_events" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_events" TO "service_role";



GRANT ALL ON TABLE "public"."campaign_metrics" TO "anon";
GRANT ALL ON TABLE "public"."campaign_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."campaign_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."campaigns" TO "anon";
GRANT ALL ON TABLE "public"."campaigns" TO "authenticated";
GRANT ALL ON TABLE "public"."campaigns" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."finops_model_pricing" TO "anon";
GRANT ALL ON TABLE "public"."finops_model_pricing" TO "authenticated";
GRANT ALL ON TABLE "public"."finops_model_pricing" TO "service_role";



GRANT ALL ON TABLE "public"."finops_token_ledger" TO "anon";
GRANT ALL ON TABLE "public"."finops_token_ledger" TO "authenticated";
GRANT ALL ON TABLE "public"."finops_token_ledger" TO "service_role";



GRANT ALL ON TABLE "public"."inbox_messages" TO "anon";
GRANT ALL ON TABLE "public"."inbox_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."inbox_messages" TO "service_role";



GRANT ALL ON TABLE "public"."job" TO "anon";
GRANT ALL ON TABLE "public"."job" TO "authenticated";
GRANT ALL ON TABLE "public"."job" TO "service_role";



GRANT ALL ON TABLE "public"."lead_assignment_outbox" TO "anon";
GRANT ALL ON TABLE "public"."lead_assignment_outbox" TO "authenticated";
GRANT ALL ON TABLE "public"."lead_assignment_outbox" TO "service_role";



GRANT ALL ON TABLE "public"."leads" TO "anon";
GRANT ALL ON TABLE "public"."leads" TO "authenticated";
GRANT ALL ON TABLE "public"."leads" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_templates" TO "anon";
GRANT ALL ON TABLE "public"."prompt_templates" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_templates" TO "service_role";



GRANT ALL ON TABLE "public"."prompt_versions" TO "anon";
GRANT ALL ON TABLE "public"."prompt_versions" TO "authenticated";
GRANT ALL ON TABLE "public"."prompt_versions" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_channels" TO "anon";
GRANT ALL ON TABLE "public"."tenant_channels" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_channels" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_configs" TO "anon";
GRANT ALL ON TABLE "public"."tenant_configs" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_configs" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_financial_summary_view" TO "anon";
GRANT ALL ON TABLE "public"."tenant_financial_summary_view" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_financial_summary_view" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_memories" TO "anon";
GRANT ALL ON TABLE "public"."tenant_memories" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_memories" TO "service_role";



GRANT ALL ON TABLE "public"."tenant_users" TO "anon";
GRANT ALL ON TABLE "public"."tenant_users" TO "authenticated";
GRANT ALL ON TABLE "public"."tenant_users" TO "service_role";



GRANT ALL ON TABLE "public"."tenants" TO "anon";
GRANT ALL ON TABLE "public"."tenants" TO "authenticated";
GRANT ALL ON TABLE "public"."tenants" TO "service_role";



GRANT ALL ON TABLE "public"."variable_defs" TO "anon";
GRANT ALL ON TABLE "public"."variable_defs" TO "authenticated";
GRANT ALL ON TABLE "public"."variable_defs" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































