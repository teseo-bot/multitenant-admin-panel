# ADR-120: Outbound Tracking Injection — Schema & Architecture

**Status:** Proposed  
**Date:** 2026-05-04  
**Author:** Builder (sprint subagent)  
**Supersedes:** N/A  
**Related:** ADR-112/113 (Hybrid Federated DB / SSE), campaigns schema, SDR-outbound agent

---

## Context

The Teseo-AI-CRM platform tracks **inbound** leads from web, telegram, and whatsapp channels via `inbox_messages`, the campaign resolver, and the existing SSE push architecture. However, **outbound** prospecting — the SDR agent sending emails, LinkedIn messages, or cold calls — has **zero first-class tracking** in the database.

### Current Gaps

1. **No sequence model:** The SDR-outbound agent (`fleetco-claw/src/agents/sdr-outbound`) creates leads in the CRM via `create_lead_in_crm` but doesn't record *which* outbound sequence enrolled them or what steps were executed.
2. **No touchpoint audit trail:** When the agent sends an email or LinkedIn connection request, there's no record of delivery status, timestamps, or external message IDs.
3. **No engagement tracking:** Opens, clicks, replies, and bounces from email/LinkedIn are not captured — the CRM is blind to outbound engagement.
4. **No cadence enforcement:** Without enrollment state, the agent can't know "this lead already received step 3 of sequence X" and may duplicate outreach.
5. **No SSE integration for outbound:** The existing `pg_notify` pattern (`inbox_updates` channel) doesn't extend to outbound events, so the Lead Detail UI can't react in real-time to outbound activity.

### Business Impact

- **Sales Ops** can't measure outbound effectiveness (open rates, reply rates, bounce rates).
- **FinOps** can't attribute LLM/API costs to specific outbound sequences.
- **Multi-tenant isolation** is untested for outbound data — a Zero-Trust gap.

---

## Decision

Add five new tables to the `public` schema under Supabase, enforcing Zero-Trust multi-tenant isolation from day one:

| Table | Purpose |
|---|---|
| `outbound_sequences` | Cadence definitions (name, channel, active status) |
| `outbound_sequence_steps` | Ordered steps within a sequence (type, delay, template) |
| `outbound_enrollments` | Lead ↔ Sequence binding (current step, status) |
| `outbound_touchpoints` | Every executed outbound action (sent, delivered, failed) |
| `outbound_tracking_events` | Engagement events (open, click, reply, bounce) |

### Key Design Choices

1. **Tenant-scoped everything:** All five tables have `tenant_id UUID NOT NULL` with FK + RLS policies using the existing `tenant_users` join pattern.
2. **Enum types over free text:** `outbound_channel`, `outbound_step_type`, `outbound_enrollment_status`, `outbound_touchpoint_status`, `outbound_event_type` — enforced at DB level.
3. **SSE-ready via pg_notify:** Triggers on `outbound_touchpoints` and `outbound_tracking_events` fire to a new `outbound_updates` channel so the Panel can subscribe per-lead.
4. **Idempotent enrollment:** `UNIQUE(lead_id, sequence_id)` prevents double-enrollment.
5. **Soft exit states:** `outbound_enrollment_status` includes `paused`, `bounced`, `replied`, `unsubscribed`, `manual_exit` — no hard deletes.

### ER Diagram (Logical)

```
tenants
  ├── outbound_sequences
  │     └── outbound_sequence_steps
  ├── outbound_enrollments ──→ leads
  │     └── outbound_touchpoints ──→ outbound_sequence_steps
  │           └── outbound_tracking_events
  └── leads
```

---

## Consequences

### Positive

- The SDR-outbound agent can record every touchpoint atomically and check enrollment status before executing the next step.
- The Panel's Lead Detail view can show a chronological "Expediente" of outbound activity alongside inbound messages.
- SSE pushes outbound events to the UI without polling.
- FinOps can join `outbound_touchpoints` with LLM cost logs for per-sequence ROI.

### Negative / Risks

- **Migration complexity:** Five new tables + enums + triggers must be tested against existing schema. The Executor should run `supabase db diff` before applying.
- **RLS performance:** The `tenant_users` subquery in RLS policies adds a join per query. If perf degrades, consider a `security_definer` function or materialized tenant context.
- **Enum rigidity:** Adding new channels (e.g., `twitter_dm`) requires a migration. Acceptable trade-off for type safety.
- **No backfill:** Existing outbound actions (if any) won't appear in the new tables. This is forward-only.

### Open Questions for the Executor

1. Does `get_my_tenant_id()` already exist? If not, create it or use the inline subquery pattern.
2. Should `outbound_touchpoints.external_id` be indexed for webhook dedup?
3. Decide on TTL for `outbound_tracking_events` (could grow fast with email opens).

---

## Migration Reference

- **File:** `supabase/migrations/20260504000000_add_outbound_tracking.sql`
- **Naming alias:** `2026-05-04_add_outbound_tracking.sql`
- **Depends on:** `tenants` table, `leads` table, `tenant_users` table

---

## Alternatives Considered

1. **JSONB on leads.metadata:** Store outbound data as nested JSON. Rejected — no referential integrity, no RLS, poor query performance.
2. **Separate microservice DB:** Run outbound tracking in its own Postgres. Rejected — adds operational complexity, breaks the monolithic-Supabase simplicity.
3. **Event sourcing in Redis:** Fast but ephemeral. Rejected — needs durable audit trail for compliance.
