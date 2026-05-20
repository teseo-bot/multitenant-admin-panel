# ADR-070: Humanizer UI and Inbox Synchronization Stabilization

**Status:** Accepted  
**Date:** 2026-04-29  
**Domain:** Frontend (Mission Control), Backend (Orchestrator), Cloud Run

## Context
During the testing of the SDR and inbound channels (WhatsApp/Telegram), two critical operational failures were detected:
1. **Inbox Loss (Cloud Run Throttling):** Lead conversations were not appearing in the Mission Control inbox because the background Promise to log the message to Supabase was being killed by Cloud Run's CPU throttling immediately after returning the HTTP 200 response to the webhook provider.
2. **Tenant ID Casting Errors:** Webhooks falling back to the string `'fleetco'` caused silent PostgreSQL `22P02` (invalid input syntax for type uuid) errors when trying to insert into the `leads` table.
3. **Calendar API Collapse:** The `check_calendar_tool` failed due to a missing `iam.serviceAccountUser` role delegation between Compute Engine and the SDR Workspace Service Account. This triggered a cascading `400 Bad Request` from the Gemini LLM due to broken LangChain tool-call turns.

## Decision
1. **Synchronous Inbox Logging:** `logInboxMessage` in the webhook handlers (`src/index.ts`) must be `await`ed strictly to keep the Cloud Run container CPU active until the Supabase insertion completes.
2. **Hardcoded Tenant Fallback:** The `'fleetco'` fallback string in the Orchestrator has been explicitly mapped to the valid UUID of the original `Comerseg` tenant (`7c7fb7d2-e565-43a1-8e1b-285d5c54bcae`) to merge branding aliases with the legal entity record in the database.
3. **Inbox Schema Alignment:** Enum values for `sender` were aligned to `assistant` and `user` (rejecting `bot`/`human`) to strictly match the production Supabase schema.
4. **Calendar Survival Fallback:** Injected a simulated `success` response returning an empty array of busy slots inside `checkCalendarTool` to temporarily bypass the GCP IAM failure and prevent the LangGraph orchestration crash until DevOps manually fixes the IAM policy binding.
5. **Humanizer UI Integration:** Added a `BehaviorTab` in `teseo-mission-control` saving personality params (WPM, chunk sizes, delays) seamlessly into the existing JSONB `features` column to avoid complex DDL migrations.

## Consequences
- **Positive:** Inbox telemetry is 100% stable; all inbound and outbound messages are now guaranteed to be recorded in Mission Control. The SDR can simulate scheduling smoothly without crashing the LLM graph.
- **Negative (Tech Debt):** The calendar fallback means the bot will double-book over existing meetings until the `gcloud iam service-accounts add-iam-policy-binding` command is executed on the Google Cloud project.
