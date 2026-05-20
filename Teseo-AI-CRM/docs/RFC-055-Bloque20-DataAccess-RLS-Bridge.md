# RFC-055: Bloque 20 — Bottom-Up Architecture: Data Access & RLS Bridge

| Campo          | Valor                                              |
| -------------- | -------------------------------------------------- |
| **ID**         | RFC-055                                            |
| **Estado**     | Borrador                                           |
| **Fecha**      | 2026-04-23                                         |
| **Autor**      | Builder (Arquitecto Staff)                         |
| **Dominio**    | Data Access Layer · Row-Level Security · PostgreSQL |
| **Bloques**    | Bloque 20                                          |
| **Precedentes**| ADR-097 (Single-Tenant SaaS), ADR-139 (Multi-Tenant Onboarding), ADR-140 (Bloque 18 Closure), ADR-148 (ServiceRole Bypass RLS), RFC-051 (Multi-Tenant Completo) |

---

## 1. Contexto y Problema

### 1.1 Evolución del Aislamiento de Datos

El Bloque 18 (RFC-051 / ADR-140) eliminó los fallbacks de `process.env.TENANT_ID` en la capa de aplicación, asegurando que el `tenantId` se propague rigurosamente desde el header HTTP → Gateway → GraphState. Sin embargo, **el aislamiento de datos sigue siendo una responsabilidad de la capa de aplicación** (filtros `WHERE tenant_id = $1` manuales en cada query).

Esto presenta tres vulnerabilidades estructurales:

| # | Vulnerabilidad | Ejemplo | Severidad |
|---|----------------|---------|-----------|
| V1 | **Query sin filtro de tenant** | Un desarrollador escribe `SELECT * FROM leads WHERE status = 'New'` sin `AND tenant_id = ?` | **CRÍTICA** — Data bleed total entre inquilinos |
| V2 | **Singleton de Supabase con Service Role** | `services/supabase.ts` exporta un cliente global con `SUPABASE_SERVICE_ROLE_KEY` que bypasea toda política RLS | **ALTA** — Cualquier nodo que lo importe tiene acceso irrestricto a todos los tenants |
| V3 | **Acceso directo a `pg.Pool` sin contexto** | `services/db.ts` exporta un pool global sin `SET` de parámetros de sesión, ignorando cualquier política RLS a nivel de PostgreSQL | **ALTA** — RLS no aplica porque no hay claim de sesión |

### 1.2 Estado Actual del RLS en Supabase

Auditoría del esquema actual de migraciones:

| Tabla | `ENABLE ROW LEVEL SECURITY` | Política con filtro `tenant_id` | Estado |
|-------|:---------------------------:|:-------------------------------:|--------|
| `tenants` | ✅ | ❌ (permite `FOR ALL TO authenticated`) | ⚠️ Sobre-permisivo |
| `tenant_configs` | ✅ | ❌ (permite `FOR ALL TO authenticated`) | ⚠️ Sobre-permisivo |
| `tenant_users` | ✅ | ⚠️ Parcial (`auth.uid() = user_id` para SELECT) | Incompleto |
| `tenant_memories` | ✅ | ❌ (solo `service_role` FOR ALL) | ⚠️ Sin política para `authenticated` |
| `leads` | ❌ | ❌ | ❌ **CRÍTICO** |
| `inbox_messages` | ❌ | ❌ | ❌ **CRÍTICO** |
| `finops_token_ledger` | ❌ | ❌ | ❌ **CRÍTICO** |
| `finops_model_pricing` | ❌ | ❌ | ⚠️ Tabla compartida (sin tenant, aceptable) |
| `asset_studio_*` | Varía | ❌ | ⚠️ Pendiente de auditoría |

**Hallazgo clave:** Las tablas transaccionales más críticas (`leads`, `inbox_messages`, `finops_token_ledger`) **no tienen RLS habilitado en absoluto**. Cualquier query sin filtro explícito de tenant expone datos cruzados.

### 1.3 El Problema del "Service Role Singleton"

El archivo `src/orchestrator/src/services/supabase.ts` exporta:

```typescript
export const supabaseClient = createClient(supabaseUrl, supabaseKey);
// donde supabaseKey = SUPABASE_SERVICE_ROLE_KEY
```

Este cliente **bypasea todo RLS por diseño de Supabase**. Esto fue una decisión correcta para el momento (ADR-148 — permitir ingesta RAG sin JWT de usuario), pero se convierte en un riesgo sistémico cuando múltiples nodos del grafo lo importan para operaciones que DEBERÍAN ser aisladas por tenant.

### 1.4 El Problema del "Pool Desnudo"

`services/db.ts` exporta un `pg.Pool` sin ningún mecanismo de inyección de contexto de sesión. Los nodos como `ingest.ts` (SDR Triage) hacen queries directas con `WHERE tenant_id = $2` manual, pero PostgreSQL RLS no se activa porque:

1. La conexión no establece `SET app.current_tenant = '<uuid>'`
2. No hay políticas que referencien `current_setting('app.current_tenant')`
3. El pool opera como superusuario (o con el rol `postgres`)

---

## 2. Arquitectura Propuesta

### 2.1 Principios Rectores

| # | Principio | Descripción |
|---|-----------|-------------|
| P1 | **Defense in Depth** | El aislamiento de tenant se aplica en TRES capas: PostgreSQL RLS, DAL con contexto inyectado, y validación de aplicación |
| P2 | **Fail-Closed** | Si no se puede resolver el `tenant_id` en cualquier capa, la operación DEBE fallar. Nunca degradar a acceso global. |
| P3 | **Zero Naked Queries** | Ningún módulo de aplicación puede ejecutar queries crudas contra el pool sin pasar por el DAL con contexto de tenant. |
| P4 | **Service Role = Operaciones de Sistema** | El cliente con Service Role Key solo se usa para operaciones administrativas (onboarding, migraciones, RPCs de sistema). Todo acceso transaccional por tenant pasa por el DAL contextualizado. |

### 2.2 Diagrama de Arquitectura por Capas

```
┌─────────────────────────────────────────────────────────────────┐
│                    CAPA 1: APPLICATION LAYER                     │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────────────┐  │
│  │ Gatekeeper   │  │ Retrieval    │  │ SDR Triage (ingest)   │  │
│  │  Node        │  │  Node        │  │                       │  │
│  └──────┬───────┘  └──────┬───────┘  └───────────┬───────────┘  │
│         │                 │                       │              │
│         └─────────────────┼───────────────────────┘              │
│                           │                                      │
│                    state.tenant_id                                │
│                           │                                      │
├───────────────────────────┼──────────────────────────────────────┤
│                    CAPA 2: DATA ACCESS LAYER (DAL)               │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────────────┐ │
│  │              TenantScopedClient                             │ │
│  │                                                             │ │
│  │  constructor(tenantId: string)                              │ │
│  │  ├── Valida UUID format                                    │ │
│  │  ├── Ejecuta SET app.current_tenant = tenantId             │ │
│  │  └── Expone repositorios:                                  │ │
│  │      ├── .leads      → LeadRepository                      │ │
│  │      ├── .messages   → MessageRepository                   │ │
│  │      ├── .memories   → MemoryRepository (via Supabase RPC) │ │
│  │      ├── .finops     → FinOpsRepository                    │ │
│  │      └── .campaigns  → CampaignRepository                  │ │
│  └─────────────────────────────────────────────────────────────┘ │
│                           │                                      │
├───────────────────────────┼──────────────────────────────────────┤
│                    CAPA 3: POSTGRESQL RLS                         │
│                           │                                      │
│  ┌────────────────────────┴────────────────────────────────────┐ │
│  │  Policies on leads, inbox_messages, finops_token_ledger:    │ │
│  │                                                             │ │
│  │  USING (tenant_id = current_setting('app.current_tenant')   │ │
│  │         ::uuid)                                             │ │
│  │  WITH CHECK (tenant_id = current_setting(                   │ │
│  │         'app.current_tenant')::uuid)                        │ │
│  │                                                             │ │
│  │  ┌───────────────────────────┐                              │ │
│  │  │ SECURITY DEFINER RPCs    │ ← match_tenant_memories()    │ │
│  │  │ (filtra manualmente)     │   ya implementa esto         │ │
│  │  └───────────────────────────┘                              │ │
│  └─────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### 2.3 Componente: `TenantScopedClient`

Es el corazón de este RFC. Actúa como un **puente** entre el `tenant_id` que vive en el `GraphState` (o en el contexto de Hono) y la conexión PostgreSQL con RLS activado.

#### Contrato (Pseudocódigo / Interfaz)

```
INTERFACE TenantScopedClient:
  CONSTRUCTOR(tenantId: string)
    PRECONDICIÓN: tenantId debe ser un UUID v4 válido (regex)
    POSTCONDICIÓN: La conexión pg tiene SET app.current_tenant = tenantId
    INVARIANTE: Toda query emitida por los repositorios hijos está filtrada
  
  PROPERTY leads: LeadRepository
  PROPERTY messages: MessageRepository
  PROPERTY memories: MemoryRepository
  PROPERTY finops: FinOpsRepository
  
  METHOD release(): void
    POSTCONDICIÓN: La conexión se devuelve al pool con RESET app.current_tenant
```

#### Flujo de Vida

```
1. Nodo del grafo recibe state.tenant_id
2. Nodo solicita: const dal = await TenantScopedClient.create(state.tenant_id)
3. TenantScopedClient:
   a. Valida UUID format (regex match)
   b. Adquiere conexión del pool: pool.connect()
   c. Ejecuta: SET LOCAL app.current_tenant = '<tenantId>'
      (SET LOCAL asegura que expire al final de la transacción)
   d. Retorna instancia con repositorios inyectados
4. Nodo opera: const leads = await dal.leads.findByStatus('New')
   → Query ejecutada: SELECT * FROM leads WHERE status = 'New'
   → PostgreSQL RLS añade automáticamente: AND tenant_id = current_setting('app.current_tenant')::uuid
5. Nodo finaliza: dal.release()
   → Conexión ejecuta: RESET app.current_tenant
   → Conexión retorna al pool limpia
```

#### Decisión Clave: `SET LOCAL` vs `SET`

| Opción | Alcance | Pros | Contras |
|--------|---------|------|---------|
| `SET app.current_tenant` | Sesión completa | Persiste mientras la conexión esté activa | Si no se limpia (RESET), contamina la siguiente query del pool |
| `SET LOCAL app.current_tenant` | Transacción actual | Auto-limpieza al COMMIT/ROLLBACK | Requiere BEGIN/COMMIT explícito |

**Decisión:** Usar `SET` con limpieza explícita en `release()` (`RESET app.current_tenant`). Esto permite queries fuera de transacción explícita (la mayoría de los nodos no usan transacciones) y mantiene el contexto durante toda la vida del `TenantScopedClient`.

Como red de seguridad adicional, el pool configurará un `afterRelease` hook que ejecute `RESET ALL` si detecta que `app.current_tenant` sigue seteado.

### 2.4 Repositorios Base (DAL)

Cada repositorio encapsula las queries de una tabla y recibe la conexión ya contextualizada. El RLS de PostgreSQL es la red de seguridad; los repositorios añaden la capa de tipado y validación de dominio.

#### `LeadRepository`

```
INTERFACE LeadRepository:
  findByStatus(status: LeadStatus): Promise<Lead[]>
  findById(id: UUID): Promise<Lead | null>
  create(data: CreateLeadDTO): Promise<Lead>
  updateStatus(id: UUID, status: LeadStatus): Promise<void>
  updateAssignment(id: UUID, node: AssignedNode, threadId: string): Promise<void>
  search(query: SearchLeadQuery): Promise<Lead[]>
  
  INVARIANTE: Todas las queries se ejecutan sobre la conexión del TenantScopedClient.
              PostgreSQL RLS filtra por tenant_id automáticamente.
              El repositorio NO añade WHERE tenant_id = ? manualmente
              (el RLS es la fuente de verdad).
```

#### `MessageRepository`

```
INTERFACE MessageRepository:
  findByLeadId(leadId: UUID, limit?: number): Promise<InboxMessage[]>
  create(data: CreateMessageDTO): Promise<InboxMessage>
  findByExternalId(externalId: string): Promise<InboxMessage | null>
  
  INVARIANTE: Los joins con `leads` están protegidos transitivamente
              (inbox_messages.lead_id → leads.id, y leads tiene RLS por tenant).
              Adicionalmente, inbox_messages tendrá su propio tenant_id y RLS.
```

#### `MemoryRepository`

```
INTERFACE MemoryRepository:
  search(embedding: number[], threshold: float, limit: int): Promise<Memory[]>
  create(content: string, embedding: number[], metadata: JSONB): Promise<Memory>
  
  NOTA: Este repositorio usa supabaseClient (Service Role) para ejecutar
        match_tenant_memories() que ya implementa filtrado Zero-Trust interno.
        La función RPC es SECURITY DEFINER y filtra por p_tenant_id manualmente.
        El TenantScopedClient inyecta el tenant_id como parámetro.
```

#### `FinOpsRepository`

```
INTERFACE FinOpsRepository:
  logUsage(data: FinOpsEntry): Promise<void>
  getSummary(dateRange: DateRange): Promise<FinOpsSummary>
  
  INVARIANTE: finops_token_ledger tiene RLS habilitado.
```

### 2.5 Migración SQL: Políticas RLS para Tablas Transaccionales

#### 2.5.1 Pre-requisito: Columna `tenant_id` en `inbox_messages`

La tabla `inbox_messages` actualmente **NO tiene columna `tenant_id`** directa. La relación con el tenant es transitiva: `inbox_messages.lead_id → leads.tenant_id`. Para que RLS funcione eficientemente sin subqueries en cada policy, necesitamos desnormalizar:

```
ALTER TABLE inbox_messages ADD COLUMN tenant_id UUID REFERENCES tenants(id);
UPDATE inbox_messages SET tenant_id = (SELECT tenant_id FROM leads WHERE leads.id = inbox_messages.lead_id);
ALTER TABLE inbox_messages ALTER COLUMN tenant_id SET NOT NULL;
CREATE INDEX idx_inbox_messages_tenant ON inbox_messages(tenant_id);
```

**Justificación:** Las políticas RLS que dependen de subqueries (`USING (lead_id IN (SELECT id FROM leads WHERE tenant_id = ...))`) son un anti-patrón conocido de rendimiento en PostgreSQL. La desnormalización de `tenant_id` directamente en `inbox_messages` permite:
1. Políticas RLS simples y rápidas (comparación directa)
2. Índice dedicado para filtrado
3. Consistencia con el patrón de `leads`

#### 2.5.2 Políticas RLS

```sql
-- ============================================================
-- Bloque 20: RLS Bridge para tablas transaccionales
-- ============================================================

-- 1. LEADS
ALTER TABLE leads ENABLE ROW LEVEL SECURITY;

-- Política para conexiones de aplicación (vía pool con SET app.current_tenant)
CREATE POLICY "tenant_isolation_leads" ON leads
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- Service Role bypasea automáticamente (inherente a Supabase)

-- 2. INBOX_MESSAGES
ALTER TABLE inbox_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_inbox_messages" ON inbox_messages
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 3. FINOPS_TOKEN_LEDGER
ALTER TABLE finops_token_ledger ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tenant_isolation_finops_ledger" ON finops_token_ledger
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);

-- 4. TENANT_MEMORIES (refuerzo — ya tiene RLS, falta política para rol de app)
CREATE POLICY "tenant_isolation_memories" ON tenant_memories
  FOR ALL
  USING (tenant_id = current_setting('app.current_tenant', true)::uuid)
  WITH CHECK (tenant_id = current_setting('app.current_tenant', true)::uuid);
```

**Nota sobre `current_setting('app.current_tenant', true)`:** El segundo parámetro `true` indica "retornar NULL si no existe el setting" en lugar de lanzar un error. Esto es crucial: si `app.current_tenant` no fue seteado, la comparación `tenant_id = NULL` siempre retorna FALSE, bloqueando todo acceso. **Fail-closed by design.**

### 2.6 Rol de PostgreSQL Dedicado: `app_tenant`

Para que las políticas RLS apliquen, la conexión del pool NO debe usar el rol `postgres` (superusuario) ni el `service_role` de Supabase, ya que ambos bypasean RLS.

**Estrategia:**

1. Crear un rol `app_tenant` con permisos limitados:
   ```sql
   CREATE ROLE app_tenant LOGIN PASSWORD '...' NOINHERIT;
   GRANT USAGE ON SCHEMA public TO app_tenant;
   GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO app_tenant;
   GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO app_tenant;
   ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO app_tenant;
   ```

2. Configurar `services/db.ts` para usar este rol en el `DATABASE_URL` del pool.

3. El `TenantScopedClient` adquiere conexiones de este pool (sujetas a RLS) y setea `app.current_tenant`.

4. El `supabaseClient` con Service Role Key se reserva EXCLUSIVAMENTE para:
   - `match_tenant_memories()` (RPC con filtrado interno)
   - Operaciones de onboarding (ADR-139)
   - Upload de documentos a Storage (ADR-148)
   - Migraciones y scripts administrativos

### 2.7 Refactorización de Nodos del Grafo

#### Antes (Patrón Actual — `ingest.ts` como ejemplo):

```
// ❌ Patrón inseguro: pool desnudo + filtro manual
const client = await pool.connect();
const leadRes = await client.query(
  'SELECT ... FROM leads WHERE id = $1 AND tenant_id = $2',
  [lead_id, tenant_id]
);
```

#### Después (Patrón Propuesto):

```
// ✅ Patrón seguro: DAL con contexto + RLS de PostgreSQL
const dal = await TenantScopedClient.create(state.tenant_id);
try {
  const lead = await dal.leads.findById(state.lead_id);
  // PostgreSQL RLS garantiza que lead pertenece al tenant correcto
  // Incluso si el código olvida validar, RLS bloquea
} finally {
  dal.release();
}
```

#### Inventario de Nodos a Refactorizar:

| Nodo/Servicio | Archivo | Acceso Actual | Cambio Requerido |
|---------------|---------|---------------|------------------|
| `ingestNode` (SDR Triage) | `sdr-triage/nodes/ingest.ts` | `pool.connect()` + WHERE manual | → `TenantScopedClient` |
| `retrievalNode` | `nodes/retrieval_node.ts` | `supabaseClient.rpc()` | Sin cambio (RPC ya es Zero-Trust) |
| `hydrateContextNode` | `nodes/hydrate_context.ts` | `pool.connect()` + query manual | → `TenantScopedClient` |
| `leadsAssignRouter` | `routes/internal/leads-assign.ts` | `pool.connect()` (checkpointer pool!) | → `TenantScopedClient` |
| `FinOpsCallbackHandler` | `callbacks/finops-callback.ts` | Probablemente `supabaseClient` | → `TenantScopedClient.finops` |
| `dispatchMemoryJob` | `services/minion-producer.ts` | Probablemente `supabaseClient` | Sin cambio (Service Role legítimo) |
| `ICPVectorizer` | `services/icp-vectorizer.ts` | Indeterminate | → Auditar y migrar |

### 2.8 Interacción con Mission Control (Next.js)

Mission Control (`src/mission-control`) usa `@supabase/ssr` con la `ANON_KEY` y cookies de sesión. El RLS de Supabase para las tablas del Tenant OS ya funciona parcialmente vía `auth.uid()`.

**Cambio necesario:** Las políticas RLS de `leads`, `inbox_messages`, etc. deben soportar DOS modos de acceso:

1. **Desde el Orquestador:** `current_setting('app.current_tenant')` (pool con `app_tenant` role)
2. **Desde Mission Control:** `auth.uid()` → lookup en `tenant_users` → `tenant_id`

La política debe ser una disyunción:

```sql
CREATE POLICY "tenant_isolation_leads" ON leads
  FOR ALL
  USING (
    -- Modo 1: Orquestador (pool pg con SET app.current_tenant)
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    -- Modo 2: Mission Control (Supabase Auth + tenant_users junction)
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  )
  WITH CHECK (
    tenant_id = current_setting('app.current_tenant', true)::uuid
    OR
    tenant_id IN (
      SELECT tu.tenant_id FROM tenant_users tu
      WHERE tu.user_id = auth.uid()
    )
  );
```

**Optimización:** La subquery `tenant_users` se ejecuta solo si `current_setting` retorna NULL (cortocircuito de PostgreSQL con OR). En el Orquestador, `app.current_tenant` siempre estará seteado, así que la subquery nunca se ejecuta.

---

## 3. Estrategia de Test de Penetración de Datos (Data Bleed)

### 3.1 Filosofía

> **No basta con probar que el sistema funciona. Hay que probar que el sistema FALLA correctamente cuando un atacante intenta cruzar fronteras de tenant.**

### 3.2 Framework de Testing: Tres Niveles

#### Nivel 1: Unit Tests de Políticas RLS (SQL puro)

Ejecutados directamente contra PostgreSQL usando `pgTAP` o scripts SQL en la CI pipeline.

```
TEST: "Lead de Tenant A es invisible para Tenant B"
  SETUP:
    INSERT tenant_a (id: 'aaa...')
    INSERT tenant_b (id: 'bbb...')
    INSERT lead (tenant_id: 'aaa...', name: 'Alice')
  
  ACT (como app_tenant, SET app.current_tenant = 'bbb...'):
    SELECT * FROM leads WHERE name = 'Alice'
  
  ASSERT:
    rows_returned = 0  ← RLS bloqueó el acceso

TEST: "INSERT con tenant_id ajeno es rechazado por RLS"
  SETUP:
    SET app.current_tenant = 'aaa...'
  
  ACT:
    INSERT INTO leads (name, tenant_id) VALUES ('Malicious', 'bbb...')
  
  ASSERT:
    ERROR (violates row-level security policy)
```

#### Nivel 2: Integration Tests del DAL (TypeScript/Vitest)

Ejecutados contra una instancia de Supabase local (Docker) con migraciones aplicadas.

```
TEST: "TenantScopedClient solo retorna leads del tenant correcto"
  SETUP:
    Crear 2 tenants (A, B) via Service Role
    Crear 3 leads en Tenant A, 2 en Tenant B
  
  ACT:
    const dalA = await TenantScopedClient.create(tenantA.id)
    const leadsA = await dalA.leads.findByStatus('New')
    dalA.release()
  
  ASSERT:
    leadsA.length === 3
    leadsA.every(l => l.tenant_id === tenantA.id) === true

TEST: "TenantScopedClient rechaza tenant_id inválido"
  ACT:
    await TenantScopedClient.create('not-a-uuid')
  
  ASSERT:
    throws Error("Invalid tenant_id format")

TEST: "Conexión liberada NO retiene contexto de tenant"
  SETUP:
    const dal = await TenantScopedClient.create(tenantA.id)
    dal.release()
  
  ACT:
    // Re-adquirir conexión del pool (puede ser la misma)
    const rawClient = await pool.connect()
    const res = await rawClient.query("SELECT current_setting('app.current_tenant', true)")
    rawClient.release()
  
  ASSERT:
    res.rows[0].current_setting === null  ← RESET fue exitoso
```

#### Nivel 3: E2E Data Bleed Tests (Scenario-Based)

Simulan un flujo completo de request → grafo → query → respuesta, verificando que no hay contaminación cruzada.

```
SCENARIO: "Cross-Tenant Memory Injection via [LEARN]"
  SETUP:
    Tenant A con memoria: "El precio del producto es $100"
    Tenant B sin memorias
  
  ACT:
    Enviar request con x-tenant-id: tenant_b
    Mensaje: "¿Cuál es el precio del producto?"
  
  ASSERT:
    Respuesta NO contiene "$100"
    RAG retorna NO_RESULTS para Tenant B
    (La memoria de Tenant A es invisible)

SCENARIO: "Lead Cross-Tenant Access via SDR Triage"
  SETUP:
    Lead "Alice" en Tenant A (id: lead_a)
    Lead "Bob" en Tenant B (id: lead_b)
  
  ACT:
    POST /internal/leads/assign con x-tenant-id: tenant_a, lead_id: lead_b
  
  ASSERT:
    HTTP 404 (Lead not found)
    ← RLS impidió que Tenant A viera el lead de Tenant B

SCENARIO: "FinOps Data Bleed"
  SETUP:
    5 registros de finops_token_ledger para Tenant A
    3 registros para Tenant B
  
  ACT:
    const dal = await TenantScopedClient.create(tenantA.id)
    const summary = await dal.finops.getSummary({...})
  
  ASSERT:
    summary.totalRecords === 5 (no 8)
    summary solo contiene datos de Tenant A
```

### 3.3 Matriz de Cobertura de Data Bleed

| Tabla | SELECT cruzado | INSERT cruzado | UPDATE cruzado | DELETE cruzado | Via RPC |
|-------|:-:|:-:|:-:|:-:|:-:|
| `leads` | ✅ | ✅ | ✅ | ✅ | N/A |
| `inbox_messages` | ✅ | ✅ | ✅ | ✅ | N/A |
| `tenant_memories` | ✅ | ✅ | N/A | N/A | ✅ (`match_tenant_memories`) |
| `finops_token_ledger` | ✅ | ✅ | N/A | N/A | N/A |
| `tenant_configs` | ✅ | N/A | ✅ | N/A | N/A |

### 3.4 CI/CD Integration

```
Pipeline Step: "data-bleed-tests"
  Image: supabase/postgres (Docker)
  Steps:
    1. Aplicar todas las migraciones SQL
    2. Crear rol app_tenant
    3. Ejecutar tests Nivel 1 (SQL assertions)
    4. Levantar Supabase local (Docker Compose)
    5. Ejecutar tests Nivel 2 (Vitest + DAL)
    6. Ejecutar tests Nivel 3 (E2E scenarios)
  
  Gate: Si CUALQUIER test de data bleed falla → BLOQUEAR el merge.
```

---

## 4. Inventario de Cambios por Archivo

| # | Archivo | Tipo | Cambio |
|---|---------|------|--------|
| 1 | `services/db.ts` | Modificar | Cambiar `DATABASE_URL` para usar rol `app_tenant`. Exportar factory `createTenantPool` |
| 2 | `services/supabase.ts` | Restringir | Renombrar a `services/supabase-admin.ts`. Añadir JSDoc: "Solo para operaciones de sistema" |
| 3 | **NUEVO** `services/tenant-scoped-client.ts` | Crear | Clase `TenantScopedClient` con factory, repositorios, y `release()` |
| 4 | **NUEVO** `repositories/lead.repository.ts` | Crear | Queries tipadas para `leads` |
| 5 | **NUEVO** `repositories/message.repository.ts` | Crear | Queries tipadas para `inbox_messages` |
| 6 | **NUEVO** `repositories/memory.repository.ts` | Crear | Wrapper sobre `match_tenant_memories` RPC |
| 7 | **NUEVO** `repositories/finops.repository.ts` | Crear | Queries tipadas para `finops_token_ledger` |
| 8 | `sdr-triage/nodes/ingest.ts` | Refactorizar | Reemplazar `pool.connect()` por `TenantScopedClient` |
| 9 | `nodes/hydrate_context.ts` | Refactorizar | Reemplazar `pool.connect()` por `TenantScopedClient` |
| 10 | `routes/internal/leads-assign.ts` | Refactorizar | Reemplazar pool directo por `TenantScopedClient` |
| 11 | **NUEVA MIGRACIÓN** `2026XXXX_rls_transactional_tables.sql` | Crear | RLS + políticas para `leads`, `inbox_messages`, `finops_token_ledger` |
| 12 | **NUEVA MIGRACIÓN** `2026XXXX_app_tenant_role.sql` | Crear | Rol `app_tenant` y grants |
| 13 | **NUEVA MIGRACIÓN** `2026XXXX_inbox_messages_tenant_id.sql` | Crear | Desnormalización de `tenant_id` en `inbox_messages` |
| 14 | **NUEVO** `__tests__/data-bleed.test.ts` | Crear | Suite E2E de penetración de datos |

---

## 5. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|:----------:|:-------:|------------|
| El rol `app_tenant` no tiene acceso a todas las tablas necesarias | Media | Alto | Migración incluye `GRANT` sobre todas las tablas. Test de humo post-migración. |
| `SET app.current_tenant` se "fuga" al pool si `release()` no se llama | Media | Crítico | Hook `afterRelease` en el pool que ejecuta `RESET ALL`. Tests Nivel 2 verifican limpieza. |
| Las políticas RLS con OR (orquestador + Mission Control) degradan performance | Baja | Medio | Benchmark con `EXPLAIN ANALYZE`. PostgreSQL cortocircuita en la primera condición TRUE del OR. |
| `inbox_messages` sin `tenant_id` directo bloquea la migración RLS | Confirmada | Alto | Migración de desnormalización en Fase 1 (pre-requisito). Backfill desde `leads.tenant_id`. |
| Supabase Realtime y Replication se ven afectados por RLS | Baja | Medio | Supabase Realtime respeta RLS para `anon`/`authenticated`. Verificar que SSE de Command Center sigue funcionando. |
| Incompatibilidad con `@supabase/ssr` en Mission Control si las políticas cambian | Baja | Medio | Las políticas usan OR con `auth.uid()` → compatible con el cliente anon de Mission Control. |

---

## 6. Criterios de Aceptación Globales

- [ ] `EXPLAIN ANALYZE` de `SELECT * FROM leads` con rol `app_tenant` y `app.current_tenant` seteado muestra "Filter: (tenant_id = ...)" en el plan.
- [ ] Query `SELECT * FROM leads` SIN `SET app.current_tenant` retorna 0 filas (fail-closed).
- [ ] `TenantScopedClient` valida formato UUID y rechaza strings arbitrarios.
- [ ] `TenantScopedClient.release()` limpia `app.current_tenant` de la conexión.
- [ ] Todos los nodos del grafo que acceden a datos transaccionales usan `TenantScopedClient`.
- [ ] El `supabaseClient` (Service Role) solo es importado por: `memory.repository.ts`, `services/minion-producer.ts`, `scripts/onboard-tenant.ts`, y endpoints de upload.
- [ ] Suite de Data Bleed Tests con 100% de cobertura sobre la Matriz (§3.3).
- [ ] Zero resultados de `grep -rn "pool.connect()" src/` en nodos transaccionales (excluyendo `checkpointer.ts` y scripts de migración).
- [ ] Mission Control (`crm-agentico-panel`) sigue funcionando correctamente con las nuevas políticas RLS.

---

## Apéndice A: Decisión sobre `inbox_messages.tenant_id`

**¿Por qué desnormalizar en lugar de usar RLS transitivo?**

PostgreSQL RLS no soporta bien joins transitivos. Una política como:
```sql
USING (lead_id IN (SELECT id FROM leads WHERE tenant_id = current_setting('app.current_tenant')::uuid))
```
Genera un subplan por cada fila evaluada. Para tablas con millones de mensajes, esto es O(n²) en el peor caso. La desnormalización añade ~16 bytes por fila (UUID) pero convierte la política en una comparación directa O(1).

## Apéndice B: Diagrama de Secuencia — Request Completo con RLS

```
Browser/API → [x-tenant-id: AAA]
    │
    ▼
ingestion-gateway.ts
    │ tenantId = c.get('tenantId')
    ▼
webhook.ts
    │ workflowApp.invoke({ tenant_id: tenantId, ... })
    ▼
gatekeeper.ts
    │ state.tenant_id = 'AAA' (ya disponible)
    │ Clasifica → 'SALES'
    ▼
hydrateContextNode
    │ const dal = TenantScopedClient.create('AAA')
    │ → pool.connect() → SET app.current_tenant = 'AAA'
    │ → dal.query("SELECT ... FROM tenant_configs WHERE tenant_id = $1", [tenantId])
    │   → RLS: OK (tenant_id matches)
    │ dal.release() → RESET app.current_tenant
    ▼
sdrNode / ingestNode
    │ const dal = TenantScopedClient.create('AAA')
    │ → SET app.current_tenant = 'AAA'
    │ → dal.leads.findById(lead_id)
    │   → SELECT * FROM leads WHERE id = $1
    │   → RLS añade: AND tenant_id = 'AAA'
    │   → Si lead pertenece a Tenant BBB → 0 rows → "Lead not found"
    │ dal.release()
    ▼
retrievalNode
    │ supabaseClient.rpc('match_tenant_memories', { p_tenant_id: 'AAA', ... })
    │ → RPC SECURITY DEFINER: filtra por WHERE tenant_id = 'AAA' internamente
    ▼
dispatcher → respuesta al canal
```

## Apéndice C: Precedentes de la Industria

| Sistema | Mecanismo de Aislamiento |
|---------|--------------------------|
| **Supabase (nativo)** | RLS con `auth.uid()` + JWT claims |
| **Citus (PostgreSQL sharding)** | RLS + `SET citus.multi_shard_modify_mode` |
| **AWS SaaS Factory** | `SET app.tenant_context` + RLS policies |
| **Nile.dev** | Tenant-aware PostgreSQL con `SET nile.tenant_id` |

La aproximación de este RFC (`SET app.current_tenant` + RLS policies) es consistente con el patrón industrial estándar para multi-tenancy sobre PostgreSQL vanilla.
