# ADR-122 — Inbox Dual (Live Data & Messaging)

**Fecha:** 21 Abril 2026
**Autor:** Teseo (Gerente AIDevops)
**Contexto:** Sprint 1.8 - Inbox Dual y Mutación Optimista
**Estado:** Aplicado y Verificado

## Problema
El componente `InboxPanel` y el Historial de Mensajes operaban sobre arreglos falsos (`MOCK_MESSAGES`). Además, la API de mensajes devolvía el historial en orden descendente (DESC), rompiendo la experiencia conversacional cronológica de la UI (tipo WhatsApp), y carecía de validadores Zod centralizados.

## Decisión Técnica
1. **Persistencia Inquebrantable:** Se creó la migración idempotente `20260421200000_inbox_messages_schema.sql` y se pobló el historial inicial mediante `20260421200001_seed_inbox_messages_dev.sql`, anclando dinámicamente los mensajes a los UUIDs reales de los leads existentes.
2. **Corrección de Flujo SSR:** El Endpoint `GET /api/leads/[id]/messages` fue parcheado para devolver datos en `ORDER BY created_at ASC`, asegurando coherencia visual. Se extrajo la validación a `lib/validations/message.ts`.
3. **Erradicación de Mocks:** El estado global ahora confía 100% en TanStack Query consultando el cliente SSR de Supabase, activado reactivamente por el `selectedLeadId` de Zustand.

## Consecuencias y Verificación
- **Tester (Zero-Trust):** PASS (vía Playwright). Al seleccionar un Lead, la UI dispara el fetch, carga el historial sin Mocks y presenta los mensajes en el orden correcto. El Composer efectúa la mutación optimista local y el POST retorna HTTP 200 hacia Supabase. El UI Shell del Inbox es oficialmente responsivo y real.