> **[COMPLETED/DEPRECATED]** Este plan fue ejecutado exitosamente durante el Security Sprint (1 y 2 de Mayo de 2026). Todos los hallazgos P0, P1 y P2 han sido mitigados. Se mantiene solo como registro histórico. 

# PLAN DE OPTIMIZACIÓN — `crm-agentico-orchestrator`

**Fecha de emisión:** 1 de mayo 2026
**Origen:** Auditoría arquitectónica (Opus 4.7) + ADR‑107
**Audiencia primaria:** Project Manager
**Audiencia secundaria:** Tech Lead, equipo de desarrollo, stakeholders de negocio
**Versión:** 1.0 — Propuesta para refinement
**Vigencia:** 6 sprints (12 semanas) — revisión a sprint 3

---

## 1. Resumen ejecutivo

La auditoría detectó **4 hallazgos P0 (bloqueantes de seguridad)**, **6 P1 (drift arquitectónico mayor)** y **6 P2 (calidad/funcionalidad)**. El sistema funciona en producción, pero opera con **superficie de ataque crítica** (service_role de Supabase y tokens vivos en historial de git) y con **deuda técnica que contradice el SSOT vigente** (modelo Gemini deprecado en 100% de los nodos, fallback que mezcla data entre tenants).

**Recomendación ejecutiva:** congelar features nuevos durante un *Security Sprint* (S1) y ejecutar 4 sprints adicionales de hardening + alineación SSOT antes de habilitar nuevos tenants. El costo de no remediar P0 supera por 2‑3 órdenes de magnitud el costo del plan completo.

| Métrica | Estado actual | Estado objetivo (sprint 6) |
|---|---|---|
| Hallazgos P0 abiertos | 4 | 0 |
| Cobertura de tests pasando | 110/112 (98 %) | 100 % en `src/`, suite saneada |
| Drift modelo LLM (SSOT §4) | 7 archivos | 0 |
| Secretos en código/git | ≥ 7 | 0 (rotados + history scrubbed) |
| Aislamiento multi‑tenant verificado | parcial | E2E + RLS forzado |
| Dependencias con CVEs | 8 moderate | 0 known‑moderate o superior |

---

## 2. Contexto de negocio

`crm-agentico-orchestrator` es el **núcleo conversacional B2B** del producto Teseo: ingiere mensajes de WhatsApp/Telegram, califica leads (BANT) y los sincroniza a CRMs (Supabase, Odoo). Cada tenant es un cliente paying de la plataforma SaaS.

**Riesgos de negocio derivados de la auditoría:**

1. **Riesgo regulatorio (LFPDPPP / GDPR / SOC2):** la posibilidad de leer mensajes y leads cross‑tenant via `service_role` hardcodeado constituye violación de aislamiento de datos. Una sola denuncia abre auditoría regulatoria + multas.
2. **Riesgo reputacional:** si un competidor o investigador clona el repo (o lo encuentra en archivo público), publica los tokens vivos y esto es atribuido al equipo, el daño a la marca es inmediato.
3. **Riesgo operativo:** el fallback hardcoded a UUID de Comerseg (`src/index.ts:104`) está mezclando mensajes de tenants no identificados en la base de un cliente real → contaminación de datos comerciales y métricas falsas.
4. **Riesgo de sprawl:** la deuda en política de modelos crece con cada feature; tocar nodos sin centralizar el LLM duplica el trabajo en cada release.
5. **Costo de oportunidad:** sin tests E2E saneados ni JWT obligatorio, no se puede onboardear el siguiente tenant sin riesgo. Cada semana de retraso = ingreso recurrente diferido.

**Tesis del plan:** las correcciones P0 son **defensa**, las P1 son **inversión en velocidad** (cada deuda saneada acelera futuros sprints), las P2 son **resiliencia** (reducen incidentes en guardia).

---

## 3. Mapa de riesgos (matriz de impacto × probabilidad)

| # | Hallazgo | Impacto | Prob. | Score | Workstream |
|---|---|---|---|---|---|
| 1 | Secretos vivos en `.env` + service_role Supabase | Catastrófico | Alta | 25 | WS‑1 Security |
| 2 | `'dev_fallback_key'` permite auth con string literal | Alto | Media | 16 | WS‑1 Security |
| 3 | JWT sin verificar firma en SSE | Alto | Media | 16 | WS‑1 Security |
| 4 | Fallback Comerseg mezcla data cross‑tenant | Alto | Alta | 20 | WS‑3 Multi‑tenant |
| 5 | Política Gemini 3.1 Pro no aplicada (7 archivos) | Medio | Alta | 15 | WS‑2 SSOT |
| 6 | `pipeline_status` admite estado fantasma `'paused'` | Medio | Media | 12 | WS‑2 SSOT |
| 7 | `setupContextNode` continúa sin tenant_id | Medio | Media | 12 | WS‑3 Multi‑tenant |
| 8 | 8 CVEs moderate por cadena `uuid<14` | Medio | Media | 12 | WS‑1 Security |
| 9 | Sin DLQ para webhooks Tenant OS | Medio | Media | 9 | WS‑4 Reliability |
| 10 | Tests duplicados en `dist/`, 1 test rojo | Bajo | Alta | 8 | WS‑5 Quality Gate |
| 11 | TTL de lock fijo 60 s | Bajo | Baja | 4 | WS‑4 Reliability |
| 12 | OAuth Workspace sin healthcheck/refresh persistente | Bajo | Baja | 4 | WS‑4 Reliability |

> Score = impacto (1‑5) × probabilidad (1‑5).

---

## 4. Workstreams

Cinco workstreams independientes pero secuenciables. WS‑1 es bloqueante de todo lo demás.

### WS‑1 · Security & Compliance Hardening **[P0 + CVEs]**

**Objetivo de negocio:** eliminar la exposición que invalida cualquier auditoría SOC2/GDPR y proteger la propiedad intelectual.

**Alcance técnico:**
- Rotación obligatoria de **todas** las credenciales presentes en historial git (Telegram bot ×3, Google API Key, Gemini Direct Key, Odoo password, M2M_API_KEY, AI_GATEWAY_TOKEN, Supabase service_role, Service Account `fleetco-sdr-workspace`).
- Limpieza del historial git con `git filter-repo` + force push coordinado.
- Eliminación de fallbacks hardcoded en `src/services/inbox.ts:13`, `src/services/odoo.ts:9-12`, `src/index.ts:351`.
- JWT obligatorio en `src/routes/events.ts`: rechazar si falta `JWT_SECRET` o si el token no tiene claim `tenant_id`.
- Endurecer `/api/internal/config`: 503 si las env vars internas no están configuradas.
- `npm overrides` para `uuid@^14` y `npm audit` limpio.
- Secret scanning en CI (gitleaks o trufflehog) que bloquee merge si detecta patrón.

**Definition of Done:**
- `git log -p --all -- .env` no devuelve secretos.
- `npm audit --omit=dev` reporta 0 moderate/high/critical.
- `gitleaks detect` corre en CI con exit 0.
- Pruebas manuales de los 3 endpoints internos confirman 401 sin Bearer válido.
- Documento `INCIDENT_RESPONSE_2026-05.md` con timeline de rotación firmado por Tech Lead.

**Riesgo si no se ejecuta:** brecha de datos cross‑tenant, multa LFPDPPP (hasta 320 000 UMAs), pérdida de SOC2 prospectivo.

---

### WS‑2 · SSOT Alignment & Model Migration **[P1]**

**Objetivo de negocio:** restaurar la "Ley Marcial de Builds" (SSOT §5) y eliminar deuda que está costando latencia y dinero por uso de modelos deprecados.

**Alcance técnico:**
- Centralizar nombres de modelo en `src/services/llm.ts` con constantes `MODEL_GATEKEEPER`, `MODEL_SDR`, `MODEL_RAG`, `MODEL_ENRICHMENT`, `MODEL_INVESTIGATOR`, leídas de env con default `gemini-3.1-pro-preview`.
- Eliminar literales `gemini-2.5-*` de `nodes/*.ts`, `services/llm.ts`, `services/enrichment/bantScorer.ts`.
- Migración SQL `004_update_llm_config_defaults.sql` que actualice docstring de `tenant_configs.llm_config`.
- Corregir `pipeline_status`: ampliar tipo a `"active" | "human_takeover" | "paused"` o redirigir `pause` → `human_takeover` y eliminar el campo fantasma `current_agent` de `graph-interrupt.ts:32`.
- Tests de regresión: invocación E2E de cada nodo con el modelo nuevo, verificación de tool‑calling sin error 400.

**Definition of Done:**
- `grep -rn "gemini-2.5" src/ migrations/` devuelve cero resultados.
- E2E (`scripts/e2e_simulate_lead.ts`) pasa contra Gemini 3.1 Pro.
- Operador humano puede pausar un thread y `getState` refleja el estado correcto.
- ADR‑108 firmado documentando el cierre de ADR‑106 §4.

**Riesgo si no se ejecuta:** continuar pagando costo de tool‑calling fallido (error 400 ya documentado en ADR‑107 §2), bloqueo de roadmap multi‑modelo.

---

### WS‑3 · Multi‑Tenant Isolation Fortification **[P1]**

**Objetivo de negocio:** garantizar la promesa contractual de aislamiento de datos por cliente — pre‑requisito para vender el siguiente tenant y para SOC2.

**Alcance técnico:**
- Eliminar fallback hardcoded a UUID Comerseg en `src/index.ts:104` y `:236`. Si falta `tenant_id`, responder 400 al webhook (Meta/Telegram aceptan; mejor que contaminar BD).
- `setupContextNode`: si `!tenant_id`, retornar `currentRoute="__end__"` con mensaje de fallback explícito ("origen no autorizado").
- Validar `tenant_id` con regex UUID antes de cualquier `SET search_path`.
- Test E2E que envía un mensaje sin `tenant_id` y verifica que NO se inserta lead.
- Reemplazar uso de `service_role` en `inbox.ts` por cliente `pg` autenticado con search_path por tenant (mismo patrón que `db.ts:withTenantContext`).
- Auditar todas las llamadas Supabase: ninguna debe usar service_role salvo migraciones administrativas.

**Definition of Done:**
- Test E2E "tenant injection" pasa: 0 inserts cross‑tenant.
- Búsqueda `grep -rn "service_role\|SERVICE_ROLE_KEY" src/` solo devuelve usos en scripts de admin documentados.
- Postman collection con 5 escenarios de tenant boundary firmada por QA.

**Riesgo si no se ejecuta:** un tenant ve datos de otro → ruptura contractual, churn, juicio.

---

### WS‑4 · Reliability & Observability **[P2]**

**Objetivo de negocio:** reducir tiempo medio de detección y recuperación (MTTD/MTTR), habilitar SLO formal hacia clientes.

**Alcance técnico:**
- Persistir DLQ para `dispatchEventsFromResult` (tabla `failed_events` con retry exponencial + alerta a Watchdog tras 3 fallos).
- TTL de lock distribuido configurable por env `THREAD_LOCK_TTL_MS` (default 60 s, máx 5 min).
- Healthcheck del cliente Workspace OAuth: endpoint `/health/workspace` que valida que el refresh token aún funciona, expuesto en startup y cron 6 h.
- Logs estructurados consistentes: ya existe `lib/logger.ts`, falta migrar `console.error/log` restantes (tools, services/odoo, services/telegram, services/whatsapp).
- Dashboard mínimo: latencia P50/P95/P99 por nodo, tasa de error 400 Gemini, eventos despachados/perdidos a Tenant OS.

**Definition of Done:**
- DLQ con tabla SQL + worker que reprocesa.
- 0 ocurrencias de `console.log/error` en `src/services/` y `src/tools/`.
- Dashboard Grafana/Cloud Logging con 5 paneles operacionales.
- Runbook `RUNBOOK_INCIDENT_RESPONSE.md` con 3 escenarios.

**Riesgo si no se ejecuta:** incidentes en producción detectados por el cliente antes que por el equipo.

---

### WS‑5 · Quality Gate & Developer Experience **[P2]**

**Objetivo de negocio:** acelerar velocidad sostenible del equipo y prevenir regresiones.

**Alcance técnico:**
- `vitest.config.ts` con `exclude: ['dist/**', '.legacy_tests/**']`.
- Limpieza de `dist/` del repo local + agregar a `.gitignore` si no está.
- Reparar test rojo `searchKnowledgeBaseTool` con seed de chunks o mock determinístico.
- CI pipeline en `.github/workflows/ci.yml` (existe directorio `.github/`): `npm ci` + `tsc --noEmit` + `npm test` + `gitleaks` + `npm audit --audit-level=high`.
- Política de branch: protección de `main`, PR review obligatorio, status checks bloqueantes.
- Plantilla de ADR en `docs/ADR_TEMPLATE.md` para futuras decisiones (formato actual ya consistente, falta plantilla).

**Definition of Done:**
- CI verde en `main` durante 7 días corridos.
- 100 % tests verdes (`npm test` exit 0 sin tests duplicados desde `dist/`).
- Branch protection activo (verificable en GitHub settings).

**Riesgo si no se ejecuta:** acumulación de regresiones invisibles, retrabajo en cada release.

---

## 5. Roadmap por sprints (asunciones: equipo de 2 devs + 0.5 QA, sprints de 2 semanas)

```
S1 (sem 1-2)   ████████ WS-1 SECURITY SPRINT — congelación de features
                         Rotación, scrub history, fallbacks, JWT, gitleaks CI
S2 (sem 3-4)   ██████   WS-2 SSOT (modelo + pipeline_status)
               ██       WS-5 inicio (CI básico + dist cleanup)
S3 (sem 5-6)   ██████   WS-3 multi-tenant fortification
               ██       WS-5 cierre (branch protection + ADR template)
S4 (sem 7-8)   ████████ WS-4 reliability (DLQ + healthchecks + logs)
S5 (sem 9-10)  ████     WS-4 cierre (dashboards) + buffer
               ████     hardening cruzado / pen test
S6 (sem 11-12) ████████ Estabilización + carga + sign-off SOC2 prep
```

> S1 es **bloqueante**. WS‑2/3/5 pueden paralelizarse parcialmente si hay capacidad. WS‑4 requiere WS‑1/2 cerrados.

---

## 6. Estimaciones (story points en Fibonacci)

| Workstream | SP | Equivalencia días‑persona | Sprints |
|---|---|---|---|
| WS‑1 Security | 21 | ~10 | 1 |
| WS‑2 SSOT + Modelo | 13 | ~6 | 1 |
| WS‑3 Multi‑tenant | 13 | ~6 | 1 |
| WS‑4 Reliability | 21 | ~10 | 1.5 |
| WS‑5 Quality Gate | 8 | ~4 | 0.5 (split) |
| Buffer (riesgos + retrabajo) | 13 | ~6 | 1 |
| **TOTAL** | **89 SP** | **~42 días‑persona** | **6 sprints** |

> Velocidad asumida: 15‑18 SP/sprint con 2 devs. Si el equipo crece a 3, comprime a 4 sprints.

---

## 7. Dependencias y ruta crítica

```
WS-1 (Security) ──┬──> WS-2 (SSOT)        ──┐
                  ├──> WS-3 (Multi-tenant) ──┼──> WS-4 (Reliability) ──> Sign-off
                  └──> WS-5 (Quality Gate) ──┘
```

**Dependencias externas críticas:**
- Acceso de admin a Supabase (rotación service_role).
- Acceso de owner a Google Cloud Console (rotación SA `fleetco-sdr-workspace`).
- Coordinación con Meta Business y BotFather (rotación Telegram).
- Ventana de mantenimiento de ~30 min para force‑push tras `git filter-repo` (afecta a todos los devs con clones locales).

**Ruta crítica:** rotación de credenciales → scrub history → cambios de código que dependen de envs nuevas. Si rotación se atrasa, todo S1 se atrasa.

---

## 8. Métricas de éxito (KPIs)

| KPI | Baseline | Meta S3 | Meta S6 |
|---|---|---|---|
| Hallazgos P0 abiertos | 4 | 0 | 0 |
| `npm audit` moderate+ | 8 | 0 | 0 |
| Cobertura de tests | ~? | 70 % | 80 % |
| Tests pasando en CI | n/a | 100 % | 100 % |
| Drift modelo LLM (archivos) | 7 | 0 | 0 |
| Eventos perdidos hacia Tenant OS / día | desconocido | < 5 | < 1 |
| MTTR incidente prod | desconocido | < 30 min | < 15 min |
| Latencia P95 webhook → respuesta | desconocida | medida | < 8 s |
| Tasa error 400 Gemini | observada | < 1 % | < 0.1 % |

**Indicadores de negocio asociados:**
- Tiempo para onboardear nuevo tenant: actual N/A → meta 1 día con runbook.
- Capacidad para responder due‑diligence de seguridad de prospects enterprise: actual "no" → meta "sí" con evidencia auditable.

---

## 9. Roles y RACI (light)

| Actividad | Tech Lead | Backend Dev | QA | DevOps/SRE | PM | Negocio |
|---|---|---|---|---|---|---|
| Rotación de credenciales | A | R | C | R | I | I |
| `git filter-repo` + force push | A | R | I | C | I | — |
| Refactor modelo LLM | A | R | C | I | I | — |
| Eliminación fallback Comerseg | A | R | R (E2E) | I | I | C |
| DLQ + dashboards | C | R | I | A | I | — |
| CI + branch protection | C | C | I | A,R | I | — |
| Sign‑off de cierre por sprint | A | I | R | I | R | C |

> R = Responsible · A = Accountable · C = Consulted · I = Informed.

---

## 10. Gobernanza y ceremonias

- **Daily stand‑up (15 min):** estado de WS activo, blockers, riesgos emergentes.
- **Refinement semanal (1 h):** PM + TL revisan backlog y ajustan SP.
- **Sprint review (1 h):** demo de cierre por workstream + sign‑off de DoD.
- **Retrospectiva (45 min):** lecciones aprendidas, especialmente tras S1 (Security Sprint atípico).
- **Reporte ejecutivo quincenal (1 página):** progreso vs. KPIs, riesgos top‑3, decisiones que requieren escalamiento.

**Decisiones que requieren ADR formal:**
- Cualquier cambio al SSOT (`MASTER_ARCHITECTURE.md`).
- Cambio de proveedor LLM o tier de modelo.
- Adición/eliminación de tenant productivo.
- Cambio en política de aislamiento (search_path vs RLS nativo Supabase).

---

## 11. Riesgos de ejecución y mitigaciones

| Riesgo | Impacto | Mitigación |
|---|---|---|
| Rotación de credenciales rompe integraciones live (Meta/Telegram webhooks) | Alta interrupción | Ventana de mantenimiento anunciada, rollback plan, rotación por canal serializada |
| `git filter-repo` invalida clones locales | Confusión equipo | Comunicación previa + script `re-clone.sh` + ventana coordinada |
| Migración Gemini 3.1 Pro introduce regresiones | Calidad de respuesta | Canary con 1 tenant interno (Comerseg) por 48 h antes de roll‑out |
| Eliminación fallback Comerseg revela que tráfico productivo viene sin tenant_id | Pérdida de mensajes | Logging primero por 1 sprint para medir volumen, luego enforcement |
| Falta de capacidad QA | Tests E2E rezagados | Externalizar smoke‑tests a Postman + Newman en CI |
| Resistencia a congelar features | Presión comercial | Carta del Tech Lead a stakeholders con cuantificación del riesgo P0 |
| Equipo descubre nuevos hallazgos durante remediación | Scope creep | Buffer de 13 SP reservado, escalamiento a PM si se excede |

---

## 12. Anexo A — Backlog detallado (importable a Linear/Jira)

### WS‑1 Security (21 SP)
- [SEC‑01] Rotar TELEGRAM_BOT_TOKEN y registrar en Secret Manager — 2 SP
- [SEC‑02] Rotar GEMINI_DIRECT_KEY / GOOGLE_API_KEY — 2 SP
- [SEC‑03] Rotar ODOO_PASS — 1 SP
- [SEC‑04] Rotar M2M_API_KEY y AI_GATEWAY_TOKEN (coordinar con Mission Control) — 3 SP
- [SEC‑05] Rotar Supabase service_role + revocar JWT viejo — 3 SP
- [SEC‑06] Rotar Service Account `fleetco-sdr-workspace` y redeploy — 2 SP
- [SEC‑07] `git filter-repo` para purgar `.env` y `*.key.json` del historial — 3 SP
- [SEC‑08] Eliminar fallback service_role hardcoded en `inbox.ts:13` — 1 SP
- [SEC‑09] Eliminar `'dev_fallback_key'` y fallbacks de `odoo.ts` — 1 SP
- [SEC‑10] JWT obligatorio + claim `tenant_id` en `events.ts` — 2 SP
- [SEC‑11] `package.json` overrides `uuid@^14` + `npm audit` limpio — 1 SP
- [SEC‑12] Integrar `gitleaks` en CI bloqueante — 0 SP (parte de WS‑5)

### WS‑2 SSOT (13 SP)
- [SSOT‑01] Centralizar constantes de modelo en `services/llm.ts` — 2 SP
- [SSOT‑02] Refactor `nodes/gatekeeper.ts`, `sdr.ts`, `rag.ts`, `investigator.ts`, `triage-evaluator.ts` — 3 SP
- [SSOT‑03] Refactor `services/enrichment/bantScorer.ts` — 1 SP
- [SSOT‑04] Migración 004 documentando defaults Gemini 3.1 Pro — 1 SP
- [SSOT‑05] Tipo `pipeline_status` corregido + alineación `graph-interrupt.ts` — 2 SP
- [SSOT‑06] Eliminar campo fantasma `current_agent` — 1 SP
- [SSOT‑07] E2E con Gemini 3.1 Pro (`scripts/e2e_simulate_lead.ts`) — 2 SP
- [SSOT‑08] ADR‑108 cerrando ADR‑106 §4 — 1 SP

### WS‑3 Multi‑tenant (13 SP)
- [MT‑01] Eliminar fallback Comerseg en `index.ts` (con logging previo 1 sprint) — 3 SP
- [MT‑02] Validación regex UUID de `tenant_id` en `db.ts` — 2 SP
- [MT‑03] `setupContextNode` corta a `__end__` sin tenant — 2 SP
- [MT‑04] Migrar `inbox.ts` a `withTenantContext` — 3 SP
- [MT‑05] Suite E2E "tenant boundary" (5 escenarios) — 3 SP

### WS‑4 Reliability (21 SP)
- [REL‑01] Tabla `failed_events` + worker DLQ — 5 SP
- [REL‑02] TTL lock configurable por env — 1 SP
- [REL‑03] `/health/workspace` endpoint + cron 6 h — 3 SP
- [REL‑04] Migrar console.* a `logger` estructurado en `services/` y `tools/` — 3 SP
- [REL‑05] Dashboard de 5 paneles (latencia/errores/eventos) — 5 SP
- [REL‑06] `RUNBOOK_INCIDENT_RESPONSE.md` con 3 escenarios — 2 SP
- [REL‑07] Pruebas de carga ligeras (k6 contra `/api/webhook`) — 2 SP

### WS‑5 Quality Gate (8 SP)
- [QG‑01] `vitest.config.ts` con exclude — 1 SP
- [QG‑02] Limpieza de `dist/` y refuerzo `.gitignore` — 1 SP
- [QG‑03] Reparar test `searchKnowledgeBaseTool` — 2 SP
- [QG‑04] CI completo (`tsc --noEmit` + `npm test` + `gitleaks` + `npm audit`) — 2 SP
- [QG‑05] Branch protection + PR template — 1 SP
- [QG‑06] `docs/ADR_TEMPLATE.md` — 1 SP

---

## 13. Anexo B — Decisiones que requieren input ejecutivo

1. **Ventana de mantenimiento para `git filter-repo`** (1‑2 h): ¿qué horario y comunicación a stakeholders?
2. **Política de feature freeze durante S1**: ¿se acepta congelar 2 semanas o se busca compromiso?
3. **Modelo Gemini 3.1 Pro: ¿canary con tenant interno o roll‑out directo?** Tradeoff: velocidad vs. riesgo.
4. **Eliminación de fallback Comerseg:** ¿quién comunica a sales que mensajes no atribuidos serán rechazados?
5. **Presupuesto para herramientas:** Gitleaks (open source ✓), Grafana Cloud (~), k6 OSS (✓), Snyk/Dependabot (consideración).
6. **¿Auditoría externa** (pentest profesional) **al cierre del plan?** Recomendado pre‑SOC2.

---

## 14. Anexo C — Aciertos verificados (mantener y documentar)

Para evitar regresiones durante el plan:

- HMAC validation en webhook Meta (`index.ts:62`) — *no tocar*.
- Secret token validation en webhook Telegram (`index.ts:197`) — *no tocar*.
- SSRF guard en `obscura/url-validator.ts` — *cubierto por tests*.
- Reducers no‑null para `tenant_id` y `campaignId` (ADR‑106) — *cubrir con tests de reducer*.
- Dockerfile multi‑stage con usuario no‑root — *no relajar*.
- Cloudbuild con pinning por `COMMIT_SHA` — *política de inmutabilidad debe permanecer*.
- `tsc strict + noUncheckedIndexedAccess + exactOptionalPropertyTypes` — *no degradar*.
- Sanitización de tool‑calls huérfanos en `messageUtils.ts` — *cubrir con tests unitarios*.

---

**Aprobación requerida (PM + Tech Lead + sponsor de negocio) antes de iniciar S1.**

*Documento generado a partir de la auditoría arquitectónica del 1 de mayo 2026 (Opus 4.7). Vinculado a `MASTER_ARCHITECTURE.md` y `ADR-107_AUDIT_TRACEABILITY.md`.*
