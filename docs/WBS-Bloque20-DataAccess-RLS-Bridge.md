# WBS — Bloque 20: Data Access & RLS Bridge

| Campo       | Valor                                    |
| ----------- | ---------------------------------------- |
| **RFC**     | RFC-055                                  |
| **Fecha**   | 2026-04-23                               |
| **Autor**   | Builder (Arquitecto Staff)               |
| **Estimado**| 12–16 horas de implementación neta       |

---

## Dependencias entre Fases

```
Fase 0 (Auditoría & Schema Prep)
    │
    ├──→ Fase 1 (Migraciones SQL: RLS + Rol + Desnormalización)
    │         │
    │         ├──→ Fase 2 (TenantScopedClient + Repositorios)   ← depende de Fase 1
    │         │         │
    │         │         ├──→ Fase 3 (Refactorización de Nodos)   ← depende de Fase 2
    │         │         │
    │         │         └──→ Fase 4 (Data Bleed Test Suite)      ← depende de Fase 2
    │         │
    │         └──→ Fase 4 (Tests SQL puros)                      ← depende de Fase 1
    │
    └──→ Fase 5 (Auditoría grep + Documentación)                 ← después de Fases 3 y 4
```

---

## Fase 0: Auditoría Pre-Migración (Prerequisito)

| # | Tarea | Archivo(s) | Criterio de Aceptación |
|---|-------|-----------|------------------------|
| 0.1 | Ejecutar `grep -rn "pool.connect()" src/orchestrator/src` y documentar cada punto de acceso directo al pool | Global | Lista exhaustiva de archivos que usan `pool.connect()` sin contexto de tenant |
| 0.2 | Ejecutar `grep -rn "supabaseClient" src/orchestrator/src` y clasificar cada uso como "legítimo (admin)" o "debe migrar a DAL" | Global | Tabla de clasificación por archivo |
| 0.3 | Verificar que `inbox_messages` no tiene `tenant_id` directo (confirmar la necesidad de desnormalización) | `supabase/migrations/*` | Confirmación documentada |
| 0.4 | Verificar estado actual de `finops_token_ledger` — ¿tiene `tenant_id` NOT NULL? ¿Tiene índice? | `supabase/migrations/20260422150000_finops_ledger.sql` | Confirmación documentada |

**Estimación:** ~1 hora

---

## Fase 1: Migraciones SQL

### 1A: Desnormalización de `tenant_id` en `inbox_messages`

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 1A.1 | Crear migración que añada `tenant_id UUID` a `inbox_messages` | `supabase/migrations/20260424000000_inbox_messages_tenant_id.sql` | Columna creada como NULLABLE inicialmente |
| 1A.2 | Backfill: `UPDATE inbox_messages SET tenant_id = (SELECT tenant_id FROM leads WHERE leads.id = inbox_messages.lead_id)` | Misma migración | Todos los registros existentes tienen `tenant_id` poblado |
| 1A.3 | `ALTER COLUMN tenant_id SET NOT NULL` | Misma migración | Columna es NOT NULL |
| 1A.4 | Crear índice `idx_inbox_messages_tenant ON inbox_messages(tenant_id)` | Misma migración | Índice creado |
| 1A.5 | Añadir FK: `REFERENCES tenants(id) ON DELETE CASCADE` | Misma migración | Integridad referencial activa |

### 1B: Rol `app_tenant` en PostgreSQL

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 1B.1 | Crear migración que cree el rol `app_tenant` con LOGIN y PASSWORD configurable | `supabase/migrations/20260424000001_app_tenant_role.sql` | Rol existe en el catálogo `pg_roles` |
| 1B.2 | `GRANT USAGE ON SCHEMA public TO app_tenant` | Misma migración | Acceso al schema concedido |
| 1B.3 | `GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant` | Misma migración | Permisos de DML otorgados |
| 1B.4 | `GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant` | Misma migración | Secuencias accesibles (para `gen_random_uuid()`) |
| 1B.5 | `ALTER DEFAULT PRIVILEGES` para tablas futuras | Misma migración | Permisos automáticos en tablas nuevas |

### 1C: Políticas RLS para Tablas Transaccionales

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 1C.1 | `ALTER TABLE leads ENABLE ROW LEVEL SECURITY` | `supabase/migrations/20260424000002_rls_transactional.sql` | RLS habilitado |
| 1C.2 | Crear política dual (orquestador + Mission Control) para `leads` | Misma migración | Política con `current_setting('app.current_tenant', true)::uuid OR tenant_id IN (SELECT ... FROM tenant_users WHERE user_id = auth.uid())` |
| 1C.3 | `ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY` + política dual | Misma migración | RLS habilitado + política creada |
| 1C.4 | `ALTER TABLE finops_token_ledger ENABLE ROW LEVEL SECURITY` + política | Misma migración | RLS habilitado + política creada |
| 1C.5 | Añadir política para `authenticated` en `tenant_memories` (complementar la existente de `service_role`) | Misma migración | Política para `app_tenant` y `authenticated` roles |
| 1C.6 | Reforzar políticas de `tenants` y `tenant_configs` — reemplazar `USING (true)` por filtro real | Misma migración | Políticas actualizadas para usar `auth.uid()` lookup o `app.current_tenant` |

### 1D: Verificación Post-Migración

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 1D.1 | Script de verificación: conectar como `app_tenant`, ejecutar `SELECT * FROM leads` SIN set → debe retornar 0 filas | Script temporal o test SQL | 0 filas retornadas |
| 1D.2 | Script de verificación: conectar como `app_tenant`, `SET app.current_tenant = '<tenant_a>'`, ejecutar `SELECT * FROM leads` → solo filas de tenant_a | Script temporal o test SQL | Solo filas del tenant correcto |
| 1D.3 | `EXPLAIN ANALYZE` de query con RLS activado para medir overhead | Documentar resultado | Overhead < 5ms para tablas con < 100K filas |

**Estimación Fase 1:** ~3 horas

---

## Fase 2: TenantScopedClient y Repositorios

### 2A: `TenantScopedClient`

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 2A.1 | Crear archivo `src/orchestrator/src/services/tenant-scoped-client.ts` | Nuevo | Archivo existe con estructura de clase |
| 2A.2 | Implementar factory estático `create(tenantId: string): Promise<TenantScopedClient>` | Mismo archivo | Valida UUID, conecta al pool, ejecuta `SET app.current_tenant` |
| 2A.3 | Implementar validación de UUID v4 en el constructor (regex: `/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i`) | Mismo archivo | UUID inválido lanza `Error("Invalid tenant_id format")` |
| 2A.4 | Implementar `release()` que ejecuta `RESET app.current_tenant` y devuelve la conexión al pool | Mismo archivo | Conexión limpia devuelta al pool |
| 2A.5 | Implementar hook de seguridad en el pool: `pool.on('release', client => client.query('RESET ALL'))` como red de seguridad | `services/db.ts` (modificar) | Hook registrado |
| 2A.6 | Exponer getters para repositorios: `.leads`, `.messages`, `.memories`, `.finops` | `tenant-scoped-client.ts` | Getters tipados retornan instancias de repositorio |

### 2B: `LeadRepository`

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 2B.1 | Crear `src/orchestrator/src/repositories/lead.repository.ts` | Nuevo | Archivo existe |
| 2B.2 | Implementar `findByStatus(status)` — query sin `WHERE tenant_id` (RLS lo añade) | Mismo archivo | Query correcta, tipado de retorno `Lead[]` |
| 2B.3 | Implementar `findById(id)` | Mismo archivo | Retorna `Lead \| null` |
| 2B.4 | Implementar `create(data: CreateLeadDTO)` — incluye `tenant_id` en el INSERT (para WITH CHECK) | Mismo archivo | Insert incluye `tenant_id` del contexto. RLS WITH CHECK valida consistencia. |
| 2B.5 | Implementar `updateStatus(id, status)` y `updateAssignment(id, node, threadId)` | Mismo archivo | Updates ejecutados correctamente |
| 2B.6 | Definir interfaces `Lead`, `CreateLeadDTO`, `SearchLeadQuery` | Mismo archivo o `types.ts` | Interfaces exportadas |

### 2C: `MessageRepository`

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 2C.1 | Crear `src/orchestrator/src/repositories/message.repository.ts` | Nuevo | Archivo existe |
| 2C.2 | Implementar `findByLeadId(leadId, limit?)` | Mismo archivo | Query con ORDER BY `created_at DESC` |
| 2C.3 | Implementar `create(data)` — incluye `tenant_id` | Mismo archivo | Insert con tenant_id para WITH CHECK |
| 2C.4 | Implementar `findByExternalId(externalId)` | Mismo archivo | Para deduplicación de mensajes entrantes |

### 2D: `MemoryRepository`

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 2D.1 | Crear `src/orchestrator/src/repositories/memory.repository.ts` | Nuevo | Archivo existe |
| 2D.2 | Implementar `search(embedding, threshold, limit)` — delega a `supabaseClient.rpc('match_tenant_memories', { p_tenant_id: this.tenantId, ... })` | Mismo archivo | Wrapper tipado sobre la RPC existente |
| 2D.3 | Implementar `create(content, embedding, metadata)` — usa Service Role para inserts (SECURITY DEFINER) | Mismo archivo | Insert vía supabaseAdmin |

### 2E: `FinOpsRepository`

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 2E.1 | Crear `src/orchestrator/src/repositories/finops.repository.ts` | Nuevo | Archivo existe |
| 2E.2 | Implementar `logUsage(data)` — insert en `finops_token_ledger` | Mismo archivo | Insert con tenant_id |
| 2E.3 | Implementar `getSummary(dateRange)` — query agregada | Mismo archivo | SUM de tokens y costos filtrado por RLS |

### 2F: Restricción de `supabase.ts`

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 2F.1 | Renombrar `services/supabase.ts` → `services/supabase-admin.ts` | Renombrar archivo | Import paths actualizados en consumidores legítimos |
| 2F.2 | Añadir JSDoc de advertencia: `@restricted Solo para operaciones administrativas (onboarding, RPCs SECURITY DEFINER, Storage uploads)` | `supabase-admin.ts` | JSDoc presente |
| 2F.3 | Añadir lint rule (o comentario) que marque imports de `supabase-admin` en nodos del grafo como warning | `.eslintrc` o comentarios | Documentado |

**Estimación Fase 2:** ~4 horas

---

## Fase 3: Refactorización de Nodos del Grafo

| # | Tarea | Archivo | Cambio | Criterio de Aceptación |
|---|-------|---------|--------|------------------------|
| 3.1 | Refactorizar `ingestNode` (SDR Triage) | `sdr-triage/nodes/ingest.ts` | Reemplazar `pool.connect()` + queries manuales por `TenantScopedClient` + `dal.leads.findById()` + `dal.messages.findByLeadId()` | Funcionalidad idéntica, cero referencias a `pool` |
| 3.2 | Refactorizar `hydrateContextNode` | `nodes/hydrate_context.ts` | Reemplazar `pool.connect()` por `TenantScopedClient`. La query de `tenant_configs` se puede hacer vía el DAL o mantener como está (es una query admin). | El nodo sigue retornando `tenantConfig` correctamente |
| 3.3 | Refactorizar `leadsAssignRouter` | `routes/internal/leads-assign.ts` | Reemplazar `pool.connect()` (del pool de checkpointer!) por `TenantScopedClient` para la query de leads. Mantener el pool de checkpointer solo para LangGraph. | Separación de concerns entre pool de checkpointer y pool de DAL |
| 3.4 | Auditar `retrievalNode` | `nodes/retrieval_node.ts` | **Sin cambio funcional** — ya usa `supabaseClient.rpc()` con filtrado interno. Opcionalmente, migrar a `dal.memories.search()` para consistencia de interfaz. | Confirmar que sigue funcionando |
| 3.5 | Auditar `FinOpsCallbackHandler` | `callbacks/finops-callback.ts` | Determinar si usa `supabaseClient` para inserts y migrar a `TenantScopedClient.finops.logUsage()` | Inserts de tokens usan el DAL |
| 3.6 | Auditar `ICPVectorizer` | `services/icp-vectorizer.ts` | Verificar acceso a datos y migrar si accede a tablas con tenant_id | Documentar decisión |
| 3.7 | Verificar `nodes/campaign.ts`, `nodes/sdr.ts`, `nodes/hunter.ts` | Nodos varios | Verificar que no hacen queries directas a tablas transaccionales sin DAL | Confirmación documentada |

**Estimación Fase 3:** ~3 horas

---

## Fase 4: Suite de Tests de Data Bleed

### 4A: Tests SQL (Nivel 1)

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 4A.1 | Crear script SQL de setup: 2 tenants, 3 leads cada uno, mensajes asociados | `tests/data-bleed/setup.sql` | Script idempotente |
| 4A.2 | Test: SELECT leads como `app_tenant` con SET tenant_a → solo filas de A | `tests/data-bleed/test-rls-leads.sql` | Assert: COUNT = 3 |
| 4A.3 | Test: SELECT leads como `app_tenant` SIN SET → 0 filas | Mismo archivo | Assert: COUNT = 0 |
| 4A.4 | Test: INSERT lead con tenant_id de B mientras SET = A → ERROR | Mismo archivo | Assert: violates RLS |
| 4A.5 | Test: SELECT inbox_messages como `app_tenant` con SET tenant_a → solo mensajes de A | `tests/data-bleed/test-rls-messages.sql` | Assert correcto |
| 4A.6 | Test: SELECT finops_token_ledger como `app_tenant` con SET tenant_a → solo registros de A | `tests/data-bleed/test-rls-finops.sql` | Assert correcto |

### 4B: Tests de Integración DAL (Nivel 2 — Vitest)

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 4B.1 | Crear test file `src/orchestrator/src/__tests__/data-bleed.test.ts` | Nuevo | Archivo existe |
| 4B.2 | Test: `TenantScopedClient.create('invalid')` lanza error | Mismo archivo | Test pasa |
| 4B.3 | Test: `dal.leads.findByStatus('New')` solo retorna leads del tenant correcto | Mismo archivo | Test pasa |
| 4B.4 | Test: Conexión liberada no retiene contexto | Mismo archivo | `current_setting('app.current_tenant', true)` retorna NULL post-release |
| 4B.5 | Test: `dal.messages.findByLeadId(lead_of_other_tenant)` retorna array vacío | Mismo archivo | RLS bloquea acceso cruzado |

### 4C: Tests E2E de Scenarios (Nivel 3)

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 4C.1 | Scenario: Cross-tenant lead access via SDR assign → 404 | `src/orchestrator/src/e2e-data-bleed.test.ts` | Test pasa |
| 4C.2 | Scenario: Cross-tenant memory search → NO_RESULTS | Mismo archivo | Memorias de otro tenant invisibles |
| 4C.3 | Scenario: FinOps summary no incluye datos de otro tenant | Mismo archivo | Totales correctos |

**Estimación Fase 4:** ~3 horas

---

## Fase 5: Auditoría Final y Documentación

| # | Tarea | Archivo | Criterio de Aceptación |
|---|-------|---------|------------------------|
| 5.1 | Ejecutar `grep -rn "pool.connect()" src/orchestrator/src` — debe retornar 0 en nodos transaccionales | Global | Cero resultados (excluyendo `checkpointer.ts`, scripts de migración) |
| 5.2 | Ejecutar `grep -rn "from.*supabase" src/orchestrator/src/nodes` — solo debe importar desde `supabase-admin.ts` en casos justificados | Global | Cada import de supabase-admin está justificado |
| 5.3 | Actualizar `ARCHITECTURE_INDEX.md` con RFC-055, ADR-161 (cierre) | `docs/ARCHITECTURE_INDEX.md` | Entradas añadidas |
| 5.4 | Crear ADR-161: Bloque 20 Closure — Data Access & RLS Bridge | `docs/ADR-161-Bloque20-RLS-Bridge-Closure.md` | ADR con evidencia de grep, tests, y benchmarks |
| 5.5 | Verificar que Mission Control sigue funcionando con las nuevas políticas RLS | Manual (o test E2E existente) | Login → Tenants list → Lead detail: todo funciona |

**Estimación Fase 5:** ~1 hora

---

## Resumen de Estimaciones

| Fase | Descripción | Estimación |
|------|-------------|:----------:|
| 0 | Auditoría Pre-Migración | 1h |
| 1 | Migraciones SQL (RLS + Rol + Desnormalización) | 3h |
| 2 | TenantScopedClient + Repositorios | 4h |
| 3 | Refactorización de Nodos del Grafo | 3h |
| 4 | Suite de Tests de Data Bleed | 3h |
| 5 | Auditoría Final + Documentación | 1h |
| **Total** | | **15h** |

---

## Notas para el Ejecutor

1. **Orden estricto:** No comenzar Fase 2 sin que las migraciones de Fase 1 estén aplicadas y verificadas en local.
2. **Supabase Local:** Usar `supabase start` (Docker) para desarrollo. Las migraciones se aplican automáticamente.
3. **Variable de entorno nueva:** `DATABASE_URL_APP_TENANT` — connection string con credenciales del rol `app_tenant`. Añadir a `.env.example`.
4. **No romper el checkpointer:** LangGraph usa su propio pool (`services/checkpointer.ts`) para persistencia de estado. Este pool puede seguir usando el rol `postgres` ya que no almacena datos sensibles de tenant (solo estado del grafo serializado). No refactorizar.
5. **Backward compatibility:** Las migraciones RLS usan `current_setting('app.current_tenant', **true**)` — el `true` hace que retorne NULL si no existe, lo cual resulta en `tenant_id = NULL` → FALSE → 0 filas. Esto es fail-closed, no fail-open.
