# MASTER ARCHITECTURE (SSOT)
**Date:** 3 Mayo 2026
**Status:** ACTIVE

## 1. Core Ecosystem (Hub & Spoke)
- **teseo-mission-control (Admin):** Global B2B control panel.
- **Teseo-AI-CRM (Tenant Frontend):** Customer-facing Command Center.
- **crm-agentico-orchestrator:** Node.js/LangGraph service running on Cloud Run Gen2. Evaluates incoming webhooks.
- **Supabase (Data Plane):** Central Postgres DB serving auth, tenant isolation (RLS), config storage (JSONB), and vector embeddings (RAG).

## 2. Architectural Decisions (Sprints April 2026)
- **Deprecations:** Legacy monolith config documents are DEPRECATED. `tenant_configs` JSONB is the unified source of truth for features.
- **Channel Omnichannel:** Moved from hardcoded DB columns to a JSONB array/dict.
- **UI Decoupling:** `TenantThemeStyle` removed from Mission Control.
- **Scorched Earth Backup:** `POST /api/tenant/[id]/backup` acts as the gateway for the Kill Switch.
- **Inverse Render Prop for Navigation:** Adopted strictly to fix hydration crashes with `@base-ui` React components in Shadcn.

## 3. Deployment Constraints
- **Polyrepo:** Strict separation of concerns (one repo per app/service).
- **Cloud Run:** All stateless frontends and orchestrators deploy as containerized services on GCP `us-central1`.

## 4. Architectural Decisions (Sprint 28 April 2026)
- **Webhook Proxy & Sidecar Trirreme:** Implementación estable de la arquitectura Multi-Container en Cloud Run Gen2 para `crm-agentico-orchestrator`. El sidecar Trirreme (Rust headless browser) se ejecuta de forma local en el pod.

## [UPDATE 30 Abril 2026] Clean Room & Multi-Tenant Docker Swarm
- **Topología de Servicios (Maestro):** Un solo `docker-compose.yml` gobierna los recursos inter-agentes locales.

## [UPDATE 3 Mayo 2026] Reglas de Despliegue Zero-Trust (GCP & Secrets)
- **Direct VPC Egress:** Ningún servicio en Cloud Run debe conectarse a bases de datos a través de IPs públicas de Cloud SQL. El secreto `DATABASE_URL` debe mantener invariablemente la IP privada (`172.18.208.3`). Todos los microservicios (`crm-frontend` y `crm-agentico-orchestrator`) tienen habilitado `vpc-egress private-ranges-only` hacia la subred `default`.
- **Enrutamiento M2M (Tenant OS):** El Orquestador (`crm-agentico-orchestrator`) apunta exclusivamente a `https://crm-frontend-1067632954359.us-central1.run.app` mediante la variable `TENANT_OS_URL` e inyecta la cabecera `Authorization: Bearer M2M_API_KEY`.
- **Inbound Webhooks (WhatsApp):** El mapeo `WhatsApp -> Tenant` se realiza dinámicamente mediante `resolveTenantIdByWhatsAppPhone`, normalizando el prefijo `521` heredado de la API de Meta a `52`.
- **Aislamiento del SDR:** El agente cualificador SDR tiene estrictamente **PROHIBIDO** hacer peticiones HTTP (JSON-RPC) para crear leads en Odoo. El tool `update_lead_profile` es puramente una herramienta de actualización de memoria local (`GraphState`). Solo el humano puede pasar leads al ERP.
- **Telemetría Watchdog:** Todos los fallos de `LangGraph` y colas de letras muertas (DLQ) detonan alertas directamente al endpoint remoto de Watchdog.
