# ADR-121 — Integración CRM-API (Kanban Live Data)

**Fecha:** 21 Abril 2026
**Autor:** Teseo (Gerente AIDevops)
**Contexto:** Sprint 1.7 - Integración a Base de Datos
**Estado:** Aplicado y Verificado

## Problema
El tablero Kanban (`KanbanBoard`) operaba con datos falsos (MOCK_LEADS) y la API de Leads (Rutas POST y PATCH) padecía un bug tipográfico en su esquema Zod (`compunknown`), lo cual provocaba la pérdida de la información del campo "company". Adicionalmente, el esquema necesitaba blindaje ante el agotamiento del espacio flotante lexicográfico en reordenamientos extremos.

## Decisión Técnica
1. **DRY & Zod Fix:** Se centralizaron los esquemas de validación en `lib/validations/lead.ts`. Se corrigió el error tipográfico (`compunknown` -> `company`), permitiendo persistir el nombre de la empresa durante las mutaciones.
2. **Eliminación de Mocks:** Se extirpó por completo `MOCK_LEADS` y el condicional `NEXT_PUBLIC_MOCK_MODE` en `use-leads.ts`. El front-end ahora consume exclusivamente TanStack Query apuntando a los Route Handlers que a su vez se conectan a Postgres vía `@supabase/ssr`.
3. **Resiliencia (D&D):** Se implementó una migración semilla (`20260421100000_seed_leads_dev.sql`) y se construyó el RPC `rebalance_column` (`20260421100001_rebalance_column_rpc.sql`) para rebalancear matemáticamente el índice `sort_order` si este sufre pérdida de precisión por múltiples movimientos de arrastrar y soltar en los extremos.

## Consecuencias y Verificación
- **Tester (Zero-Trust):** PASS. Al levantar la base de datos local y realizar login de prueba, el Kanban renderiza los leads provenientes de la BD sin fallos. El POST con la empresa 'Teseo Corp' retorna HTTP 200 y se guarda sin pérdidas en la base de datos.
- El ciclo de Kanban Data Fetching está certificado y listo para integraciones posteriores.