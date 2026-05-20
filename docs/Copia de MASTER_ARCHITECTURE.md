# MASTER ARCHITECTURE (SSOT) - Teseo AI CRM

> **WARNING:** This file is the Single Source of Truth (SSOT). Any ADR or RFC conflicting with the policies described here must be considered DEPRECATED.

## 1. Top Funnel vs Bottom Funnel
- **Top Funnel (Mission Control & Supabase):** ALL inbound traffic from WhatsApp, Telegram, or Web Chat must be captured, logged, and profiled exclusively within Supabase (`leads` and `inbox_messages` tables). The SDR agent operates on this layer.
- **Bottom Funnel (Odoo ERP):** Leads are ONLY synchronized to the Odoo ERP when a formal quote is requested or the lead is considered completely closed/won. Direct inserts to Odoo on first contact are DEPRECATED.

## 2. Omnichannel & Cloud Run Resilience
- **Synchronous Telemetry:** Any webhook hitting Cloud Run Gen 2 MUST `await` database operations (like Inbox logging) before returning the HTTP 200 response to prevent the container's CPU throttling from killing the network request.
- **Tenant Resolution:** Webhook routing relies on UUIDs. Legacy string-based aliases (e.g., `'fleetco'`) must be mapped at the edge to their canonical Supabase UUIDs.

## 3. Humanizer & AI Configuration
- **Zero-DDL Extensibility:** New configuration modules for AI behavior (e.g., Humanizer WPM, Delays, Chunking) must be serialized into the `features` JSONB column in the `tenant_configs` table. Do not create new scalar columns for every toggle.

## 4. Agent Tooling
- **Calendar & Workspace:** Calendar availability relies on Google Workspace Domain-Wide Delegation or OAuth2. If the API fails due to IAM/Auth errors, tools MUST return a graceful simulated fallback to prevent LangGraph state corruption and LLM 400 Bad Request cascades.

## 5. Inbox & Flujo Transaccional Asimétrico
- **Tipado Estricto de Supabase:** La tabla `inbox_messages` restringe el campo `sender` mediante un Enum de base de datos (`message_sender`).
- **Valores Autorizados:** Todo evento de mensajería debe usar exclusivamente `ai_agent` (para automatizaciones/bots), `human_admin` (para el usuario SDR/Gerente tomando control manual desde el CRM) o `customer` (para el lead entrante).
- **Prevención de Regresiones:** El uso de valores legacy como `bot`, `assistant`, `human` o `user` generará rechazos a nivel de base de datos (`22P02 Invalid text representation`) y está estrictamente prohibido tanto en el frontend (`OmnichannelComposer`) como en el backend (`crm-agentico-orchestrator`).

## 6. Arquitectura Híbrida / Federación de Bases de Datos (ADR-113)
- **Supabase (Multi-Tenant Operativo):** Responsable de la autenticación, configuración de Tenants (Prompts B2B), facturación y Control Plane.
- **Neon Tech / Postgres Serverless (Data Lake Interactivo):** Almacén central de la data conversacional masiva y "3ra velocidad de ingesta". Almacena vectores (RAG), estados de LangGraph (Checkpointer), y registros crudos de `inbox_messages` y `leads` divididos en esquemas de base de datos rígidos (`SET search_path`).
- El CRM Frontend no debe consultar el Inbox a través de Supabase web, sino mediante un API Bridge en el servidor (Next.js) que se conecte directamente a Neon Tech para bucear en los esquemas privados.

## 7. Protocolos de Cierre y Mantenimiento de Estado (Hibernación)
- El estado de la aplicación y la deuda técnica pendiente deben registrarse siempre en `MEMORY.md` antes de reiniciar o purgar la sesión de los agentes, bajo la sección de **[▶️ PRÓXIMA SESIÓN]**.
- Cualquier cambio infraestructural no documentado en la carpeta `/docs` carece de validez operativa.

## 8. Orquestación y Nodos de Inteligencia (LangGraph)
- **Nodo Hunter (OSINT):** El orquestador inyecta dinámicamente un nodo `hunter.ts` dentro de la máquina de estados principal. Su función es extraer y procesar inteligencia de fuentes abiertas (OSINT), depositándola en la columna `osint_data` del prospecto en Neon Tech.
- **Zero-Trust Loop:** Para prevenir contaminación de contexto en la memoria conversacional, los estados de LangGraph (`checkpoints`) deben depurarse rigurosamente tras validaciones.

## 9. Lógica de Venta CRM (Pipeline y UI Reactiva)
- **Calificación Estricta:** Un prospecto transiciona del Inbox a la primera etapa del Pipeline (Kanban) **SÓLO** si el backend valida la presencia de: `nombre`, `teléfono`, `correo` y `necesidad`. La tabla `leads` en Neon Tech controla la columna `pipeline_stage`.
- **UI Asimétrica y Event-Driven:** El layout operativo del Lead asigna el 70% del viewport al chat con herramientas fijas (`absolute bottom-0`). El espacio restante hospeda los paneles "Expediente Hunter" y "Resumen Semántico", los cuales invalidan su caché y se re-renderizan **exclusivamente** vía Server-Sent Events (SSE) al escuchar triggers `LISTEN/NOTIFY` desde Neon Tech.
