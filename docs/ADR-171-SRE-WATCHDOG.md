# ADR-103: Arquitectura SRE / Watchdog — Monitoreo Continuo de Producción

**Status:** PROPOSED  
**Date:** 2026-04-29  
**Authored by:** Builder/Learner (Teseo Squad)  
**Awaiting authorization:** Jorge García (CEO)  
**Next action:** Ejecutor implementa Fase 1 (previa autorización del CEO)

---

**Update (2026-04-29):** La visualización del Watchdog ha sido implementada como un **Panel Agregador Global (NOC)** en `teseo-mission-control` (ruta `/alerts`), alimentado por la tabla `global_watchdog_events`. Esto elimina la fricción operativa de navegar tenant-por-tenant, centralizando los fallos cronológicamente y permitiendo *drill-down* hacia inquilinos específicos.

---

## 1. Contexto y Motivación

### 1.1 Ecosistema Auditado

El core productivo de `teseo.lat` es el servicio `crm-agentico-orchestrator` corriendo en **Cloud Run Gen2** (`us-central1`). Este servicio es el único punto de entrada de todos los canales de comunicación:

```
[Telegram Bot]  ──┐
[Meta / WhatsApp] ─┤─→ Webhook → crm-agentico-orchestrator → [Gatekeeper → SDR/RAG] → [Odoo JSON-RPC]
[Web Widget]    ──┘                        │
                                           └→ [Gemini LLM] (gemini-3.1-flash-preview)
```

**Dependencias Críticas Identificadas:**
| Dependencia | Endpoint | Failure Mode Conocido |
|---|---|---|
| Telegram Webhook | `api.telegram.org` | Silencio sin 5xx; CPU freeze post-200 OK |
| Meta/WhatsApp Webhook | `graph.facebook.com` | Atasco en Gatekeeper (regex falla silenciosamente) |
| Gemini LLM | `generativelanguage.googleapis.com` | HTTP 400 por historial de checkpoints corrupto |
| Odoo JSON-RPC | `http://34.171.158.23:8069/jsonrpc` | Timeout, IP pública sin redundancia, auth-fail silencioso |
| PostgreSQL Checkpoints | Supabase | Historial roto → Gemini 400 cascada |

### 1.2 Brechas de Observabilidad Actuales

1. **El modo de falla más peligroso no emite logs:** Si Cloud Run congela la CPU (política `cpu: request`) mientras ejecuta una promesa asíncrona de LangGraph, el webhook ya devolvió `200 OK` a Telegram/Meta y el sistema queda **mudo sin registrar error alguno**.
2. **Los errores de Gatekeeper son silenciosos:** El Gatekeeper (`gatekeeper.ts`) emite el fallback `"Por favor, dime más sobre tu empresa"` como string, no como excepción. Cloud Run nunca verá un 5xx.
3. **Odoo no tiene health-check nativo** en el stack. Su caída solo se detecta cuando un lead real intenta crearse.
4. **Gemini 400 está atado al estado del checkpoint:** Un historial corrupto en PostgreSQL causa `400 Bad Request` en cascada para ese `thread_id`, pero el servicio principal sigue operativo para otros hilos.

---

## 2. Requisitos del Watchdog

| Pilar | Métrica Clave | Umbral de Alerta |
|---|---|---|
| **Canal (Telegram/Meta)** | Ausencia de mensajes procesados en ventana de N min | 0 mensajes en 30 min (horario laboral) |
| **Canal (Telegram/Meta)** | Tasa de respuestas de fallback (`"dime más sobre tu empresa"`) | >50% de respuestas en 10 min |
| **LLM Latencia** | P95 de `llm_inference_ms` por nodo (Gatekeeper/SDR/RAG) | >15,000 ms |
| **LLM Salud** | Tasa de error HTTP 400/429/500 al LLM provider | >3 errores en 5 min |
| **Odoo** | Tiempo de respuesta del endpoint `/jsonrpc` (authenticate) | Timeout > 5s o HTTP non-200 |
| **Odoo** | Tiempo de respuesta de `createLead` | Timeout > 10s |
| **Orquestador** | HTTP 5xx del propio Cloud Run | 1 error en 1 min |
| **Orquestador** | Cold-start count | >2 cold-starts en 5 min |

---

## 3. Análisis de Opciones

### Opción A — Log-based Metrics en GCP + Cloud Monitoring Alert Policies

**Descripción:** Configurar filtros de logs en Cloud Logging para extraer métricas (contadores, histogramas) y crear Alert Policies que disparen notificaciones.

**Pros:**
- Zero-code en el orquestador.
- Disponible hoy mismo, sin deploy adicional.
- Excelente para errores que ya se loguean (5xx, errores de runtime Node.js).

**Contras:**
- ❌ **No detecta silencio.** Si no llegan mensajes, no hay logs → no hay métricas → no hay alerta. Este es el modo de falla más frecuente confirmado en producción.
- ❌ El fallback silencioso del Gatekeeper no es un error logueable; es un `console.log` sin label estructurado.
- ❌ Requiere que el orquestador ya esté instrumentado con logs estructurados (aún no lo está).
- No puede hacer una prueba E2E real (¿el bot realmente responde?).

**Veredicto:** Necesaria como capa reactiva complementaria, **insuficiente como solución primaria**.

---

### Opción B — Cloud Run Job (Cron) + Watchdog Service Independiente

**Descripción:** Un micro-servicio `crm-agentico-watchdog` dedicado (Node.js, mínimo) que se ejecuta como **Cloud Run Job programado por Cloud Scheduler** (no un servidor persistente). Cada 5 minutos realiza health-checks activos (E2E sintéticos):
1. `GET /health` al orquestador → valida HTTP 200.
2. `POST /jsonrpc` a Odoo con `common.version()` → valida conectividad.
3. `LLM stub` (llamada mínima sin historial) → mide latencia de Gemini.
4. Si el Job detecta falla → envía alerta a Telegram (canal privado de Mission Control).

**Pros:**
- ✅ **Detecta el silencio activamente.** El probe corre independientemente del tráfico real.
- ✅ Completamente desacoplado del orquestador: si el orquestador muere, el Watchdog sigue corriendo.
- ✅ Costo prácticamente cero: Cloud Run Jobs facturan por invocación (< 30s de CPU cada 5 min = centavos al mes).
- ✅ Ya existe el repo `fleetco-ai-monitor` como base de despliegue.

**Contras:**
- Requiere un deploy adicional (pero trivial: ~150 líneas de Node.js).
- No detecta anomalías entre ciclos de probe (ventana ciega de hasta 5 min).

**Veredicto:** **Solución primaria recomendada** para detección activa.

---

### Opción C — Middleware Heartbeat Interno → Webhook de Mission Control

**Descripción:** Un middleware dentro del orquestador que emite un "latido" (heartbeat) a un endpoint de Mission Control cada N minutos, confirmando que está vivo.

**Pros:**
- No requiere servicio adicional.
- Muy bajo overhead en runtime.

**Contras:**
- ❌ **Dead Man's Switch Problem:** Si el orquestador crashea (o CPU se congela), el heartbeat también muere. El sistema que se monitorea a sí mismo no puede reportar su propia muerte.
- ❌ No valida dependencias externas (Odoo, Gemini API).
- ❌ Agrega acoplamiento a Mission Control (que puede no estar disponible).
- La instrumentación adicional en el orquestador viola el principio de responsabilidad única.

**Veredicto:** Anti-patrón para el caso principal (detección de caída total). **Descartada como primaria.** Puede ser útil SOLO como métrica de "actividad" complementaria.

---

## 4. Decisión Arquitectónica

### 🏆 Ruta Seleccionada: Hybrid A+B — "Active Probe + Passive Log Drain"

**Rationale central:** El modo de falla más crítico (silencio del bot) no es detectable con logs pasivos. Se requiere un agente externo activo que verifique el sistema desde afuera, como lo haría un lead real.

**La arquitectura de dos capas:**

```
┌─────────────────────────────────────────────────────────────────┐
│  CAPA 1: ACTIVE PROBE (Opción B)                                │
│  Cloud Scheduler (cron: */5 * * * *)                            │
│       │                                                         │
│       ▼                                                         │
│  crm-agentico-watchdog (Cloud Run Job)                          │
│  ├── Probe A: GET /health → orchestrator                        │
│  ├── Probe B: POST /jsonrpc → Odoo (common.version)             │
│  ├── Probe C: Gemini API stub (latency check)                   │
│  └── Alert: POST → Telegram Bot (Mission Control channel)       │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│  CAPA 2: PASSIVE LOG DRAIN (Opción A)                           │
│  Cloud Logging → Log-based Metrics                              │
│  ├── Métrica: http_5xx_count (Cloud Run request logs)           │
│  ├── Métrica: gemini_error_count (structured log: level=error)  │
│  ├── Métrica: cold_start_count (Cloud Run: "Starting container")│
│  └── Alert Policy → Notification Channel: Telegram Bot          │
└─────────────────────────────────────────────────────────────────┘
```

---

## 5. Especificación de Implementación (Para el Ejecutor)

### 5.1 Repo Base

Usar el repo existente `fleetco-ai-monitor` como base para el Watchdog. Renombrar/refactorizar para separar el Copilot Chat (endpoint `/v1/copilot/chat`) del Watchdog (Cloud Run Job).

> **Opción:** Si el Ejecutor determina que la mezcla de responsabilidades es problemática, crear repo independiente `crm-agentico-watchdog`. Decisión delegada al Ejecutor con criterio de separación de concerns.

### 5.2 Módulos del Watchdog (Node.js / TypeScript)

#### `src/probes/orchestratorProbe.ts`
```
Endpoint: GET https://crm-agentico-orchestrator-[hash].us-central1.run.app/health
Método: fetch con timeout de 5s
Éxito: HTTP 200
Falla: timeout / non-200
Métrica: responseTimeMs, statusCode
```

**Requisito previo (Ejecutor):** El orquestador DEBE exponer un endpoint `GET /health` que devuelva `{ status: "ok", version: "x.x.x" }`. Este endpoint es el único que necesita el probe. **Si no existe, el Ejecutor debe añadirlo al orquestador como primera sub-tarea.**

#### `src/probes/odooProbe.ts`
```
Endpoint: POST http://34.171.158.23:8069/jsonrpc
Payload: { jsonrpc: "2.0", method: "call", params: { service: "common", method: "version", args: [] } }
Método: fetch con timeout de 5s
Éxito: HTTP 200 + data.result contiene { server_version: string }
Falla: timeout / HTTP non-200 / data.error presente
Métrica: responseTimeMs, serverVersion
```

> **Nota de Seguridad:** Este probe NO usa credenciales. `common.version` es un endpoint público. Las credenciales de Odoo NO deben incluirse en el Watchdog.

#### `src/probes/llmProbe.ts`
```
Modelo: gemini-3.1-flash-preview (mismo que producción)
Prompt: "Responde solo con la palabra 'ok'."
Configuración: maxOutputTokens: 5, temperature: 0
Éxito: HTTP 200 + respuesta en < 10s
Falla: HTTP 400/429/500 o timeout > 10s
Métrica: latencyMs, modelUsed, errorCode
```

> **Costo:** Una llamada de ~10 tokens cada 5 minutos = ~2,880 calls/día = insignificante en Gemini Flash.

#### `src/alerter/telegramAlerter.ts`
```
Destino: WATCHDOG_ALERT_BOT_TOKEN (secret GCP) → chat_id WATCHDOG_CHAT_ID
Formato del mensaje:
  🚨 WATCHDOG ALERT
  Pilar: [Orchestrator|Odoo|LLM]
  Probe: [nombre del probe]
  Error: [descripción]
  Latencia: [ms]
  Timestamp: [ISO8601]
  Env: production
```

#### `src/index.ts` (Entry Point del Job)
```typescript
// Flujo secuencial, no paralelo, para facilitar debugging
async function runWatchdog() {
  const results = [];
  results.push(await runOrchestratorProbe());
  results.push(await runOdooProbe());
  results.push(await runLlmProbe());
  
  const failures = results.filter(r => r.status === 'fail');
  if (failures.length > 0) {
    await sendTelegramAlert(failures);
    process.exit(1); // Cloud Run Job marca el Job como fallido → visible en GCP
  }
  process.exit(0);
}
```

### 5.3 Infraestructura GCP

#### Cloud Run Job (deploy)
```yaml
# cloud-run-job.yaml
apiVersion: run.googleapis.com/v1
kind: Job
metadata:
  name: crm-agentico-watchdog
  namespace: default
spec:
  template:
    spec:
      template:
        spec:
          containers:
            - image: gcr.io/PROJECT_ID/crm-agentico-watchdog:latest
              env:
                - name: WATCHDOG_ALERT_BOT_TOKEN
                  valueFrom:
                    secretKeyRef:
                      name: watchdog-telegram-token
                      key: latest
                - name: WATCHDOG_CHAT_ID
                  valueFrom:
                    secretKeyRef:
                      name: watchdog-chat-id
                      key: latest
                - name: ORCHESTRATOR_URL
                  value: "https://crm-agentico-orchestrator-1067632954359.us-central1.run.app"
                - name: ODOO_URL
                  value: "http://34.171.158.23:8069"
                - name: GEMINI_API_KEY
                  valueFrom:
                    secretKeyRef:
                      name: gemini-api-key
                      key: latest
          maxRetries: 1
          timeoutSeconds: 60
```

#### Cloud Scheduler (trigger)
```bash
gcloud scheduler jobs create http crm-agentico-watchdog-trigger \
  --schedule="*/5 * * * *" \
  --uri="https://run.googleapis.com/v1/namespaces/PROJECT_ID/jobs/crm-agentico-watchdog:run" \
  --http-method=POST \
  --oauth-service-account-email=watchdog-sa@PROJECT_ID.iam.gserviceaccount.com \
  --location=us-central1
```

#### Service Account & Secrets
```bash
# Service Account con permisos mínimos
gcloud iam service-accounts create watchdog-sa \
  --display-name="CRM Watchdog Service Account"

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:watchdog-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/run.invoker"  # Para ejecutar el Job

gcloud projects add-iam-policy-binding PROJECT_ID \
  --member="serviceAccount:watchdog-sa@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"  # Para leer tokens

# Crear secrets
gcloud secrets create watchdog-telegram-token --data-file=<(echo -n "BOT_TOKEN_AQUI")
gcloud secrets create watchdog-chat-id --data-file=<(echo -n "CHAT_ID_AQUI")
```

### 5.4 Capa Pasiva: Log-based Metrics (GCP Cloud Monitoring)

El Ejecutor debe configurar vía Terraform o gcloud CLI:

```
Métrica 1: orchestrator/http_5xx
  Filter: resource.type="cloud_run_revision"
          resource.labels.service_name="crm-agentico-orchestrator"
          httpRequest.status>=500
  Alert: threshold=1 error/min, notification=telegram

Métrica 2: orchestrator/gemini_error
  Filter: resource.type="cloud_run_revision"
          jsonPayload.level="error"
          jsonPayload.provider="gemini"
  Alert: threshold=3 errors/5min, notification=email+telegram

Métrica 3: orchestrator/cold_start
  Filter: resource.type="cloud_run_revision"
          textPayload=~"Starting container"
  Alert: threshold=3 cold_starts/5min (indica inestabilidad de instancias)
```

**Requisito previo:** El orquestador debe emitir logs estructurados (JSON) con campos `level`, `provider`, `nodeId` para que los filtros funcionen. Si actualmente usa `console.log` sin estructura, el Ejecutor debe migrar a un logger estructurado (ej. `pino`) como parte de esta misma tarea.

### 5.5 Endpoint `/health` en el Orquestador (Sub-tarea del Ejecutor)

El orquestador debe exponer:
```typescript
// En src/index.ts (Hono router)
app.get('/health', (c) => {
  return c.json({
    status: 'ok',
    service: 'crm-agentico-orchestrator',
    version: process.env.npm_package_version || 'unknown',
    uptime: process.uptime(),
    timestamp: new Date().toISOString()
  }, 200);
});
```

---

## 6. Dependencias Técnicas (Orden de Ejecución para el Ejecutor)

El Ejecutor **debe seguir este orden estricto de dependencias** (Bottom-Up):

```
1. [ORCHESTRATOR] Agregar endpoint GET /health (dependencia dura de Probe A)
   └─ Sub-repo: crm-agentico-orchestrator/src/index.ts

2. [ORCHESTRATOR] Migrar console.log → pino (logger estructurado)
   └─ Sub-repo: crm-agentico-orchestrator/src/
   └─ Campos obligatorios: { level, nodeId, provider, latencyMs, error? }

3. [WATCHDOG] Implementar módulos de probes (orchestratorProbe, odooProbe, llmProbe)
   └─ Sub-repo: fleetco-ai-monitor (o nuevo crm-agentico-watchdog)

4. [WATCHDOG] Implementar telegramAlerter + entry point index.ts

5. [WATCHDOG] Dockerfile + cloudbuild.yaml (Cloud Run Job)

6. [GCP INFRA] Crear Service Account, Secrets en Secret Manager

7. [GCP INFRA] Deploy Cloud Run Job (crm-agentico-watchdog)

8. [GCP INFRA] Crear Cloud Scheduler trigger (*/5 * * * *)

9. [GCP MONITORING] Configurar Log-based Metrics (3 métricas)

10. [GCP MONITORING] Crear Alert Policies + Notification Channel (Telegram bot)

11. [TESTER] Prueba de integración: matar el orquestador manualmente →
    verificar que en < 10 minutos llega la alerta a Telegram.
```

---

## 7. Análisis de Costos

| Componente | Costo Estimado/mes |
|---|---|
| Cloud Run Job (288 ejecuciones/día × 30s CPU × 0.25 vCPU) | ~$0.05 USD |
| Cloud Scheduler (1 job) | $0.10 USD |
| Gemini Flash API (288 calls/día × ~10 tokens × 30 días) | ~$0.01 USD |
| Log-based Metrics (GCP) | $0.00 (primeros 150 MB/mes free) |
| Cloud Monitoring Alert Policies | $0.00 (free tier) |
| **TOTAL ESTIMADO** | **~$0.16 USD/mes** |

---

## 8. Decisiones Secundarias Registradas

| # | Decisión | Razonamiento |
|---|---|---|
| D1 | El Watchdog usa un **bot de Telegram dedicado** (no el bot de producción `@fleetcobot`) | Evitar que las alertas se mezclen con conversaciones de leads reales. El canal de alertas debe ser un grupo privado de Mission Control. |
| D2 | El LLM Probe usa `gemini-3.1-flash-preview`, no `gemini-3.1-pro` | El probe mide disponibilidad del servicio, no calidad. Flash es suficiente y más barato. |
| D3 | Los probes se ejecutan **secuencialmente**, no en paralelo | Facilita el debugging. El volumen es bajo (3 calls cada 5 min). |
| D4 | El Watchdog **no simula un lead real** (no envía mensaje a Telegram) | Evita contaminar el historial de checkpoints de PostgreSQL con datos sintéticos. El E2E real se valida en ambiente de staging, no prod. |
| D5 | `fleetco-ai-monitor` se evalúa como base del Watchdog | Ejecutor tiene autoridad para separar en repo nuevo si la deuda técnica del repo actual lo justifica. |

---

## 9. Riesgos y Mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| El Watchdog falla y no alerta sobre su propio fallo | Media | Alto | Cloud Run Jobs fallidos son visibles en GCP Console y alertan automáticamente por email al owner del proyecto. |
| Odoo en IP pública sin HTTPS genera falsos positivos por inestabilidad de red | Media | Media | Configurar 3 reintentos antes de emitir alerta. Considerar migración a dominio estable en ADR posterior. |
| El LLM Probe genera latencia alta debido a cold-start de Gemini | Baja | Bajo | Umbral generoso de 10s. El probe mide disponibilidad, no SLA de latencia. |
| Alertas de Telegram inundan el canal (alert storm) | Media | Media | Implementar backoff: no alertar el mismo pilar más de 1 vez cada 15 min (estado de silencio). |

---

## 10. Referencias

- `MASTER_ARCHITECTURE.md` (27-28 April 2026)
- `memory/2026-04-29-channel-status.md` — Diagnóstico de CPU freeze y bucle de fallback
- `memory/2026-04-29-fleetco-auth.md` — Gemini 400 por historial corrupto
- `crm-agentico-orchestrator/src/services/odoo.ts` — Implementación JSON-RPC existente
- `ADR-096` — Abandono de `teseo-ai-gateway` para tool calling
- `fleetco-ai-monitor/` — Repo base candidato para el Watchdog

---

*ADR-103 listo para revisión del CEO. No se ha modificado ningún código base.*
