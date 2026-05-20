# ADR-100: Auditoría de Falla en Cascada — Causa Raíz Sistémica y Plan de Estabilización

**Fecha:** 28 Abril 2026  
**Estado:** Propuesto  
**Autor:** Builder (Claude Opus 4.6) — Comisionado por Teseo  
**Severidad:** P0 — Bloqueante para Producción  
**Alcance:** `crm-agentico-orchestrator`, `trirreme` (sidecar), Pipeline CI/CD, Esquema de BD

---

## 1. Resumen Ejecutivo

En las últimas 24 horas, el orquestador sufrió **tres fallos en cascada** aparentemente independientes (conflicto ARM64, ETIMEDOUT a BD, crash por variables/esquema faltante). Esta auditoría demuestra que **no son incidentes aislados**: son síntomas de **cinco deficiencias estructurales** en el pipeline de despliegue que garantizan que cada deploy a producción sea una ruleta rusa.

**Veredicto:** El sistema no tiene un contrato de despliegue atómico. Las migraciones de BD, la inyección de secretos y la validación de estado de LangGraph son procesos manuales, desconectados y frágiles. Hasta que esto se resuelva, **cada fix introducirá el siguiente fallo**.

---

## 2. Cronología del Incidente

| # | Síntoma | Parche Aplicado | Causa Raíz Real |
|---|---------|-----------------|-----------------|
| 1 | Sidecar `trirreme` falla en Cloud Run (ARM64 vs AMD64) | `--platform linux/amd64` forzado | Sin spec de plataforma en Dockerfile ni validación en CI |
| 2 | `ETIMEDOUT` a PostgreSQL/Supabase | Direct VPC Egress configurado | Networking nunca fue parte del checklist de deploy |
| 3a | `GEMINI_DIRECT_KEY` undefined → LLM sin API key | — (pendiente) | Secret no declarado en `service.yaml` ni en GCP Secret Manager |
| 3b | `S2S_API_KEY` undefined → Endpoints internos 503 | — (pendiente) | Secret no declarado en `service.yaml` ni en GCP Secret Manager |
| 3c | Tabla `tenant_configs` no existe → setupContext falla | — (pendiente) | Cero framework de migraciones; init-db.ts solo crea `thread_locks` |
| 3d | Endpoint `/api/internal/graph/interrupt` escribe `pipeline_status` que no existe en `GraphState` | — (pendiente) | Fallo de diseño: campo pertenece a `SDRTriageState`, no al grafo principal |

---

## 3. Las Cinco Deficiencias Estructurales

### 3.1 — Brecha Crítica de Secretos (Secret Propagation Gap)

**Evidencia:** `service.yaml` declara solo 5 secretos de los ~15 que el código consume.

| Secret en Código | ¿En `service.yaml`? | ¿En GCP Secret Manager? | Estado |
|---|---|---|---|
| `DATABASE_URL` | ✅ | ✅ | OK |
| `WHATSAPP_TOKEN` | ✅ | ✅ | OK |
| `WHATSAPP_PHONE_ID` | ✅ | ✅ | OK |
| `META_VERIFY_TOKEN` | ✅ | ✅ | OK |
| `TELEGRAM_BOT_TOKEN` | ✅ | ✅ | OK |
| **`GEMINI_DIRECT_KEY`** | ❌ | ❌ | **FATAL** — LLM no funciona |
| **`S2S_API_KEY` / `INTERNAL_API_KEY`** | ❌ | ❌ | **FATAL** — Endpoints internos deshabilitados |
| **`M2M_API_KEY`** | ❌ | ❌ | **ALTO** — Tenant OS inoperable |
| **`AI_GATEWAY_TOKEN`** | ❌ | ❌ | Medio — Fallback OpenAI roto |
| **`GOOGLE_API_KEY`** | ❌ | ❌ | Medio |
| **`TENANT_OS_URL`** | ❌ | ❌ | Medio — Webhooks silenciados |
| **`META_APP_SECRET`** | ❌ | ❌ | Medio — Validación de firma deshabilitada |
| **`SUPABASE_URL`** | ❌ | ❌ | **FATAL** — Sub-grafo SDR Triage inoperable |
| **`SUPABASE_SERVICE_ROLE_KEY`** | ❌ | ❌ | **FATAL** — Sub-grafo SDR Triage inoperable |

**Impacto:** El orquestador arranca sin error (los `process.env` simplemente son `undefined`), pero falla en runtime cuando cualquier usuario envía un mensaje y se invoca `getLLM()` → `new ChatGoogleGenerativeAI({ apiKey: "" })`.

### 3.2 — Ausencia Total de Framework de Migraciones

**Evidencia:**
- `find . -name "*.sql"` → 0 resultados.
- `init-db.ts` solo crea `thread_locks` y ejecuta `checkpointer.setup()` (tablas internas de LangGraph).
- El código asume la existencia de: `tenant_configs`, `tenant_api_keys`, `chunks`, `leads`, `playbooks`, `inbox_messages`.
- **Ninguna de estas tablas se crea en ningún lugar del repositorio.**

**Impacto:** Cualquier deploy contra una BD limpia (o nueva instancia de Supabase) fallará silenciosamente. `setupContextNode` retornará `prompts: {}` sin error, pero el gatekeeper operará sin contexto del tenant.

### 3.3 — Fallo de Diseño: Graph-Interrupt contra Esquema Inexistente

**Evidencia en** `src/routes/internal/graph-interrupt.ts:31-32`:
```typescript
await workflowApp.updateState(
  { configurable: { thread_id } },
  { 
    pipeline_status: action === 'pause' || action === 'take_over' ? 'paused' : action,
    current_agent: 'human'
  }
);
```

**Problema:** `GraphState` (definido en `src/state.ts`) **no tiene** los campos `pipeline_status` ni `current_agent`. Estos campos pertenecen a `SDRTriageState` (sub-grafo de triage, compilado por separado en `sdr-triage.ts`).

El `updateState()` de LangGraph **ignora silenciosamente campos no declarados en el Annotation schema**. Resultado: el endpoint retorna `{ success: true }` pero el agente **jamás se pausa**.

### 3.4 — Divergencia de Pipelines CI/CD (Split-Brain)

Existen **dos rutas de despliegue** que producen resultados diferentes:

| Pipeline | Archivo | Sidecar | Secrets | Migraciones |
|---|---|---|---|---|
| **Cloud Build** | `cloudbuild.yaml` | ✅ (vía `service.yaml`) | Parcial (5 de 15) | ❌ |
| **GitHub Actions** | `.github/workflows/cloud-run.yml` | ❌ (usa `deploy-cloudrun@v2` sin `service.yaml`) | ❌ (cero secrets, cero env_vars) | ❌ |

**GH Actions despliega un contenedor ciego:** sin sidecar `trirreme`, sin secretos, sin variables de entorno. Si alguien hace push a `main` y el trigger de GH Actions está activo, sobreescribe el servicio de Cloud Run con un deployment roto.

### 3.5 — Sin Paridad Local (Zero Local Dev Parity)

- `docker-compose.yml` referencia `ghcr.io/aspect-build/aspect-workflows/obscura:latest` — imagen que ya fue declarada rota en el Post-Mortem (Bloque 36).
- No incluye servicio de PostgreSQL/pgvector.
- No pasa secretos vía `environment:` (solo `NODE_ENV`, `PORT`, `GOOGLE_APPLICATION_CREDENTIALS`).
- No hay script de seed/setup para recrear el entorno local.

**Consecuencia:** Es imposible reproducir un fallo de producción localmente.

---

## 4. Diagrama de Dependencias del Fallo

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOY A CLOUD RUN                            │
│                                                                  │
│  cloudbuild.yaml                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────────┐  ┌────────────┐  │
│  │ docker   │→ │ docker   │→ │ sed (render  │→ │ gcloud run │  │
│  │ build    │  │ push     │  │ service.yaml)│  │ services   │  │
│  └──────────┘  └──────────┘  └──────────────┘  │ replace    │  │
│                                                  └─────┬──────┘  │
│                                                        │         │
│  ¿Migraciones BD?  ── NO HAY PASO ──────── ❌         │         │
│  ¿Validar Secrets? ── NO HAY PASO ──────── ❌         │         │
│  ¿Smoke Test?      ── NO HAY PASO ──────── ❌         │         │
│                                                        │         │
└────────────────────────────────────────────────────────┼─────────┘
                                                         │
                                                         ▼
┌───────────────────── CLOUD RUN ────────────────────────┐
│                                                         │
│  Container arranca → SELECT 1 → ✅ (BD conecta)        │
│                    → /health → 200 OK ✅                │
│                                                         │
│  Usuario envía WhatsApp:                                │
│    → setupContextNode → tenant_configs? → ❌ NO EXISTE  │
│    → gatekeeperNode → getLLM() → GEMINI_DIRECT_KEY=""   │
│      → Gemini rechaza → ❌ CRASH                        │
│                                                         │
│  Operator llama /api/internal/graph/interrupt:           │
│    → S2S_API_KEY = undefined → ❌ 503                   │
│    → (si pasara auth) → updateState({pipeline_status})  │
│      → GraphState no tiene pipeline_status → NOOP       │
│                                                         │
└─────────────────────────────────────────────────────────┘
```

---

## 5. Solución Técnica: Contrato de Despliegue Atómico

### Principio Rector
> **"Si la BD no tiene esquema, si los secretos no están inyectados, si el estado de LangGraph no es coherente, EL DEPLOY NO SUCEDE."**

### 5.0 — Ratificación Inquebrantable de Infraestructura Declarativa (Zero-Trust)

**Resolución Obligatoria:** Se ratifica como estándar inquebrantable para arquitecturas Multi-Container la **Opción 1: Cloud Build + `service.yaml`**.
Queda **estrictamente prohibido**:
1. El uso de despliegues imperativos (estrategias `merge` o comandos `gcloud run deploy` directos sin manifiesto yaml).
2. El uso de valores "dummy" o *placeholders* para secretos en GCP. Todo secreto inyectado en Secret Manager debe ser un valor real extraído del archivo `.env` verificado.

### 5.1 — Paso 1: Registro de Secretos en GCP Secret Manager + service.yaml

**Acción:** Crear los secretos faltantes en GCP y declararlos en `service.yaml`.

Secretos a crear en GCP Secret Manager:
```
GEMINI_DIRECT_KEY
S2S_API_KEY
M2M_API_KEY
AI_GATEWAY_TOKEN
GOOGLE_API_KEY
TENANT_OS_URL
META_APP_SECRET
SUPABASE_URL
SUPABASE_SERVICE_ROLE_KEY
```

Bloque a agregar en `service.yaml` (container `orchestrator`, sección `env`):
```yaml
- name: GEMINI_DIRECT_KEY
  valueFrom:
    secretKeyRef:
      name: GEMINI_DIRECT_KEY
      key: latest
- name: S2S_API_KEY
  valueFrom:
    secretKeyRef:
      name: S2S_API_KEY
      key: latest
- name: M2M_API_KEY
  valueFrom:
    secretKeyRef:
      name: M2M_API_KEY
      key: latest
- name: TENANT_OS_URL
  valueFrom:
    secretKeyRef:
      name: TENANT_OS_URL
      key: latest
- name: SUPABASE_URL
  valueFrom:
    secretKeyRef:
      name: SUPABASE_URL
      key: latest
- name: SUPABASE_SERVICE_ROLE_KEY
  valueFrom:
    secretKeyRef:
      name: SUPABASE_SERVICE_ROLE_KEY
      key: latest
```

### 5.2 — Paso 2: Framework de Migraciones (Drizzle-Kit o SQL Puro)

**Acción:** Crear directorio `migrations/` con archivos SQL versionados y un paso de ejecución atómica pre-deploy.

**Estructura propuesta:**
```
migrations/
├── 001_thread_locks.sql          (lo que hace init-db.ts hoy)
├── 002_tenant_configs.sql        (tabla de prompts por tenant)
├── 003_tenant_api_keys.sql       (vault de API keys)
├── 004_chunks_pgvector.sql       (tabla de chunks + extensión pgvector)
├── 005_leads.sql                 (CRM leads)
├── 006_playbooks.sql             (playbooks por tenant)
├── 007_inbox_messages.sql        (historial de interacciones)
└── 008_migration_log.sql         (tabla para tracking de migraciones aplicadas)
```

**Script ejecutor** (`scripts/run-migrations.sh`):
```bash
#!/bin/bash
set -euo pipefail
# Ejecuta cada migración que no haya sido aplicada aún
for f in migrations/*.sql; do
  MIGRATION_NAME=$(basename "$f")
  ALREADY=$(psql "$DATABASE_URL" -tAc \
    "SELECT 1 FROM migration_log WHERE name='$MIGRATION_NAME'" 2>/dev/null || echo "")
  if [ "$ALREADY" != "1" ]; then
    echo "▸ Aplicando: $MIGRATION_NAME"
    psql "$DATABASE_URL" -f "$f"
    psql "$DATABASE_URL" -c \
      "INSERT INTO migration_log(name, applied_at) VALUES('$MIGRATION_NAME', NOW())"
  fi
done
```

**Integración en `cloudbuild.yaml`:** Agregar paso 2.5 (entre Push y Render):
```yaml
- id: migrate-db
  name: 'gcr.io/cloud-builders/docker'
  entrypoint: 'bash'
  args:
    - '-c'
    - |
      apt-get update && apt-get install -y postgresql-client
      bash scripts/run-migrations.sh
  secretEnv: ['DATABASE_URL']
  waitFor: ['push']
```

### 5.3 — Paso 3: Reparar el Endpoint de Interrupción (Graph-Interrupt)

**Dos opciones (mutuamente excluyentes):**

**Opción A (Recomendada): Agregar campos al `GraphState` principal.**
```typescript
// src/state.ts — agregar:
pipeline_status: Annotation<'active' | 'paused' | 'human_takeover'>({
  reducer: (_, right) => right,
  default: () => 'active',
}),
current_operator: Annotation<string | null>({
  reducer: (_, right) => right ?? null,
  default: () => null,
}),
```

Y modificar el router para respetar el estado:
```typescript
// src/edges/router.ts — al inicio de routeFromGatekeeper:
if (state.pipeline_status === 'paused' || state.pipeline_status === 'human_takeover') {
  return "__end__";
}
```

**Opción B:** Eliminar el endpoint hasta que haya un mecanismo real de Human-in-the-Loop (ej. `interrupt()` nativo de LangGraph v0.2+).

### 5.4 — Paso 4: Unificar el Pipeline CI/CD (Eliminar Split-Brain)

**Acción:** Desactivar o eliminar `.github/workflows/cloud-run.yml`. El pipeline canónico es `cloudbuild.yaml` porque es el único que soporta multi-container (`services replace` con `service.yaml`).

Si se desea mantener GH Actions como pipeline, se debe reescribir para:
1. Hacer `gcloud run services replace service.yaml` (no `deploy-cloudrun@v2`)
2. Ejecutar migraciones pre-deploy
3. Inyectar secrets

### 5.5 — Paso 5: Startup Validation (Fail-Fast Mejorado)

Agregar al `startServer()` en `src/index.ts` verificaciones obligatorias:

```typescript
async function startServer() {
  // ── 1. Validar Secretos Críticos ──
  const requiredEnv = [
    'DATABASE_URL',
    'GEMINI_DIRECT_KEY',
    'TELEGRAM_BOT_TOKEN',
  ];
  const missing = requiredEnv.filter(k => !process.env[k]);
  if (missing.length > 0) {
    console.error(`❌ FATAL: Variables de entorno faltantes: ${missing.join(', ')}`);
    process.exit(1);
  }

  // ── 2. Validar Esquema de BD ──
  const client = await dbPool.connect();
  try {
    await client.query('SELECT 1');
    console.log('✅ Conexión a PostgreSQL verificada.');
    
    // Verificar tablas críticas
    const tableCheck = await client.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('thread_locks', 'tenant_configs', 'chunks')
    `);
    const existingTables = tableCheck.rows.map(r => r.table_name);
    const requiredTables = ['thread_locks', 'tenant_configs'];
    const missingTables = requiredTables.filter(t => !existingTables.includes(t));
    
    if (missingTables.length > 0) {
      console.error(`❌ FATAL: Tablas faltantes: ${missingTables.join(', ')}. Ejecutar migraciones.`);
      process.exit(1);
    }
    
    client.release();
  } catch (err) {
    console.error('❌ FATAL: Error de conexión a BD:', err);
    process.exit(1);
  }

  // ── 3. Continuar arranque normal ──
  await checkpointer.setup();
  // ...
}
```

### 5.6 — Paso 6: Corregir docker-compose.yml para Paridad Local

```yaml
version: '3.8'
services:
  db:
    image: ankane/pgvector:latest
    environment:
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: orchestrator_dev
    ports:
      - "5436:5432"
    volumes:
      - pgdata:/var/lib/postgresql/data
      - ./migrations:/docker-entrypoint-initdb.d

  orchestrator:
    build: .
    env_file: .env
    environment:
      - NODE_ENV=development
      - PORT=3000
      - DATABASE_URL=postgres://postgres:postgres@db:5432/orchestrator_dev
    ports:
      - "3000:3000"
    depends_on:
      db:
        condition: service_healthy

  trirreme:
    build:
      context: ../trirreme
      dockerfile: Dockerfile
    platform: linux/amd64
    ports:
      - "9222:9222"
    command: ["serve", "--port=9222"]

volumes:
  pgdata:
```

### 5.7 — Paso 7: Actualizar `.env.example` como Contrato

```env
# === REQUERIDOS (Fatal si faltan) ===
DATABASE_URL=
GEMINI_DIRECT_KEY=
S2S_API_KEY=
TELEGRAM_BOT_TOKEN=

# === REQUERIDOS PARA WHATSAPP ===
WHATSAPP_TOKEN=
WHATSAPP_PHONE_ID=
META_VERIFY_TOKEN=
META_APP_SECRET=

# === REQUERIDOS PARA TENANT OS ===
M2M_API_KEY=
TENANT_OS_URL=

# === REQUERIDOS PARA SUB-GRAFO SDR TRIAGE ===
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=

# === OPCIONALES ===
PORT=8080
AI_GATEWAY_TOKEN=
AI_GATEWAY_URL=
GOOGLE_API_KEY=
ODOO_URL=
ODOO_DB=
ODOO_USER=
ODOO_PASS=
```

---

## 6. Matriz de Prioridad de Ejecución

| Orden | Acción | Bloqueante | Esfuerzo | Responsable |
|-------|--------|------------|----------|-------------|
| **1** | Crear secretos en GCP + actualizar `service.yaml` | SÍ | 30 min | Ejecutor |
| **2** | Crear `migrations/` con SQL de tablas faltantes | SÍ | 1-2 hrs | Ejecutor |
| **3** | Reparar `graph-interrupt.ts` (Opción A: agregar campos a GraphState) | SÍ | 30 min | Ejecutor |
| **4** | Agregar startup validation (fail-fast) a `index.ts` | SÍ | 20 min | Ejecutor |
| **5** | Desactivar/unificar GH Actions workflow | ALTO | 15 min | Ejecutor |
| **6** | Agregar paso `migrate-db` a `cloudbuild.yaml` | ALTO | 30 min | Ejecutor |
| **7** | Reescribir `docker-compose.yml` para paridad local | MEDIO | 30 min | Ejecutor |
| **8** | Actualizar `.env.example` | BAJO | 10 min | Ejecutor |

**Estimación total:** ~4-5 horas de trabajo del Ejecutor.

---

## 7. Criterio de Cierre (Definition of Done)

El ADR-100 se considera resuelto cuando:

- [ ] `gcloud secrets list` muestra TODOS los secretos requeridos
- [ ] `service.yaml` declara TODOS los secretos como `secretKeyRef`
- [ ] `migrations/` contiene DDL para TODAS las tablas que el código referencia
- [ ] `cloudbuild.yaml` ejecuta migraciones ANTES de `services replace`
- [ ] `GraphState` incluye `pipeline_status` y `current_operator`
- [ ] `startServer()` aborta con `process.exit(1)` si falta cualquier variable crítica o tabla
- [ ] Solo existe UN pipeline canónico de despliegue (Cloud Build)
- [ ] `docker-compose up` levanta BD + orquestador + trirreme localmente
- [ ] Tester ejecuta E2E completo (`scripts/e2e_simulate_lead.ts`) contra entorno local sin errores

---

## 8. Notas Arquitectónicas Adicionales

### 8.1 — Pool de Conexiones Duplicado
`checkpointer.ts` y `db.ts` crean instancias de `Pool` independientes contra el mismo `DATABASE_URL`. En producción con `containerConcurrency: 10`, esto puede alcanzar 20 conexiones simultáneas (10 por pool × 2 pools). **Recomendación:** Unificar en un solo pool exportado desde un módulo compartido.

### 8.2 — Enrichment Node Escala con Modelo Caro
`bantScorer.ts` usa `gemini-2.5-pro` (el modelo más caro) para CADA conversación que supere 5 mensajes. Con `containerConcurrency: 10`, esto son potencialmente 10 llamadas concurrentes al modelo más caro. **Recomendación:** Mover a `gemini-2.5-flash` para scoring y reservar Pro para casos de alta confianza.

### 8.3 — Trirreme Dockerfile sin `--platform`
El `Dockerfile` de trirreme no especifica `FROM --platform=linux/amd64`. Si Cloud Build corre en AMD64 hoy funciona por coincidencia, pero no hay garantía contractual. **Agregar explícitamente.**

---

*Documento generado por Builder (Claude Opus 4.6) — ADR-100 v1.0*
*Comisionado por Teseo, Gerente AIDevops @ teseo.lat*
