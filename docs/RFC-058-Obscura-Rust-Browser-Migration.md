# RFC-058: Migración del Motor de Navegación — Puppeteer/Playwright → Obscura (Rust Headless Browser)

| Campo | Valor |
|---|---|
| **ID** | RFC-058 |
| **Estado** | Borrador |
| **Fecha** | 2026-04-25 |
| **Autor** | Builder (Teseo Squad) |
| **Bloque** | 33 — Fase 2 (Integración Obscura + SSE) |
| **Dominio** | Backend / Rust / Navegación Autónoma / SSE |
| **Dependencias Upstream** | PRD-BLOQUE33-SSE-Integrations, POST_MORTEM_BLOQUE32 (KDB: `compiled/tools/obscura.md`), RFC-048 (Agentico Compiler), SSE Schemas (`sse-events.ts`) |
| **Repositorios Impactados** | `crm-agentico-orchestrator`, `Teseo-AI-CRM` (Command Center) |

---

## 0. Resumen Ejecutivo

Este RFC define la arquitectura para reemplazar **Playwright/Chromium** por **Obscura** (`h4ckf0r0day/obscura`) como motor de navegación headless en el ecosistema CRM Agéntico. Obscura es un browser engine escrito en Rust con soporte nativo de V8, Chrome DevTools Protocol (CDP), y compatibilidad drop-in con Puppeteer/Playwright. La migración reduce el footprint de memoria (~300 MB → ~50 MB por instancia), elimina la dependencia de binarios pesados de Chromium en Cloud Run, y habilita la transmisión de logs de navegación en tiempo real hacia el flujo SSE `research.progress` ya implementado.

---

## 1. Contexto y Problema

### 1.1 Estado Actual

El ecosistema tiene **dos puntos de uso** de navegación headless:

| Ubicación | Archivo | Motor Actual | Propósito |
|---|---|---|---|
| **Command Center** (Next.js) | `app/api/asset-studio/snapshots/generate/route.ts` | `playwright-core` + `chromium.launch()` | Generación de snapshots PNG de templates del Asset Studio |
| **Orquestador** (Hono/LangGraph) | `src/tools/scraping.ts` | **Mock** (stub que retorna texto simulado) | Scraping de websites de prospectos para el nodo Investigador (SDR) |

**Hallazgos críticos:**

1. **El nodo Investigador no tiene motor de navegación real.** El tool `scrape_website` en el Orquestador es un mock que retorna texto estático. Para habilitar la investigación real de prospectos (LinkedIn, sitios corporativos, noticias), se necesita un browser real.
2. **El Asset Studio usa Playwright pesado.** Cloud Run carga binarios de Chromium (~400 MB) para generar screenshots — ineficiente y costoso.
3. **El POST_MORTEM_BLOQUE32 ya dictaminó la adopción de Obscura** como estándar interno, descartando Chrome pesado. El KDB compilado (`compiled/tools/obscura.md`) ya documenta la herramienta.

### 1.2 ¿Por qué Obscura?

| Característica | Chromium/Playwright | Obscura |
|---|---|---|
| **Footprint** | ~400 MB binario + ~300 MB RAM | ~15 MB binario + ~50 MB RAM |
| **Startup** | 2-5s cold start | <500ms |
| **Protocolo** | CDP (Chrome DevTools Protocol) | CDP nativo (drop-in compatible) |
| **Lenguaje** | C++ | Rust (memory-safe, sin GC) |
| **JS Engine** | V8 (embebido en Chrome) | V8 (embebido directo) |
| **Cloud Run** | Requiere `--no-sandbox`, binarios especiales | Binary estático, sin dependencias de sistema |
| **Logs de navegación** | Requiere instrumentación manual | Eventos estructurados nativos vía CDP |
| **Puppeteer/Playwright compat** | Nativo | Drop-in via CDP endpoint |

---

## 2. Arquitectura Propuesta

### 2.1 Topología de Despliegue

Obscura se despliega como un **sidecar container** en el mismo servicio Cloud Run del Orquestador, comunicándose vía `localhost` sobre CDP (WebSocket).

```
┌─────────────────────────────────────────────────────────────────────┐
│                    Cloud Run Service: crm-agentico-orchestrator      │
│                                                                      │
│  ┌──────────────────────────┐    CDP (ws://localhost:9222)          │
│  │  Container 1:            │◄──────────────────────────────┐       │
│  │  Obscura (Rust Binary)   │                               │       │
│  │  Port: 9222              │   Eventos CDP / Logs ─────────┤       │
│  │  Headless Browser Engine │                               │       │
│  └──────────────────────────┘                               │       │
│                                                              │       │
│  ┌──────────────────────────────────────────────────────┐   │       │
│  │  Container 2: Orquestador (Hono + LangGraph)         │   │       │
│  │                                                       │   │       │
│  │  ┌─────────────────┐  ┌────────────────────────┐     │   │       │
│  │  │  ObscuraClient   │──│  NavigationLogStreamer  │─────┤──┘       │
│  │  │  (CDP over WS)  │  │  (CDP Events → SSE)    │     │           │
│  │  └─────────────────┘  └────────────────────────┘     │           │
│  │          │                        │                   │           │
│  │          ▼                        ▼                   │           │
│  │  ┌─────────────┐     ┌──────────────────────┐       │           │
│  │  │ scraping.ts  │     │  EventBus (in-memory) │       │           │
│  │  │ (real impl)  │     │  → SSE /api/events    │       │           │
│  │  └─────────────┘     └──────────────────────┘       │           │
│  └──────────────────────────────────────────────────────┘           │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
          │                              │
          ▼                              ▼
   ┌──────────────┐            ┌──────────────────┐
   │  Web Targets  │            │  Command Center   │
   │  (LinkedIn,   │            │  (EventSource     │
   │   Corp sites) │            │   ProspectCanvas)  │
   └──────────────┘            └──────────────────┘
```

### 2.2 ¿Por qué Sidecar y no Microservicio Separado?

| Opción | Latencia | Complejidad | Costo |
|---|---|---|---|
| **Sidecar en mismo Cloud Run** | <1ms (localhost) | Baja (un solo deploy) | Bajo (comparte instancia) |
| Microservicio separado en Cloud Run | ~10-50ms (red interna) | Alta (service discovery, auth S2S) | Medio (instancia dedicada) |
| Microservicio en GKE/VM | ~5-20ms (VPC) | Muy alta (Kubernetes) | Alto |

**Decisión:** Sidecar. Cloud Run soporta multi-container desde 2023. Obscura consume ~50 MB RAM y ~0.1 vCPU en idle, compatible con los límites del Orquestador (2 vCPU, 1 GiB).

### 2.3 Alternativa para el Command Center (Asset Studio Snapshots)

El Asset Studio (`Teseo-AI-CRM`) puede migrar a Obscura de forma independiente. Dado que ese endpoint (`/api/asset-studio/snapshots/generate`) usa Playwright para screenshots de templates locales, la migración es:

1. **Corto plazo (Fase 2A):** Mantener Playwright en el Command Center — solo afecta screenshots internos, no investigación de prospectos.
2. **Largo plazo (Fase 2B):** Reemplazar `playwright-core` por un cliente CDP apuntando a un sidecar Obscura en el Cloud Run del Command Center, o delegar screenshots al Orquestador.

**Este RFC se enfoca en la Fase 2A: Orquestador + nodo Investigador.**

---

## 3. Diseño del Módulo `ObscuraClient`

### 3.1 Capa de Abstracción CDP

Se crea un cliente TypeScript que habla CDP puro sobre WebSocket, sin dependencia de `puppeteer` ni `playwright`.

```
src/
  services/
    obscura/
      client.ts            # ObscuraClient — CDP connection manager
      page.ts              # PageHandle — high-level page API
      navigation-logger.ts # Intercepta eventos CDP y emite logs estructurados
      types.ts             # Tipos CDP y contracts internos
      index.ts             # Re-exports
```

### 3.2 `ObscuraClient` (`client.ts`)

```typescript
interface ObscuraClientOptions {
  cdpEndpoint: string;   // default: "ws://localhost:9222"
  connectTimeout: number; // default: 5000ms
  maxPages: number;       // default: 3 (limitar RAM)
}

class ObscuraClient {
  private ws: WebSocket;

  // Lifecycle
  async connect(): Promise<void>;
  async disconnect(): Promise<void>;
  async healthCheck(): Promise<boolean>;

  // Page management
  async newPage(): Promise<PageHandle>;
  async closePage(pageId: string): Promise<void>;
  async listPages(): Promise<PageInfo[]>;
}
```

### 3.3 `PageHandle` (`page.ts`)

Abstracción de alto nivel sobre una pestaña CDP:

```typescript
class PageHandle {
  private targetId: string;
  private sessionId: string;

  // Navegación
  async goto(url: string, opts?: { waitUntil?: 'load' | 'networkidle' | 'domcontentloaded'; timeout?: number }): Promise<NavigationResult>;
  async waitForSelector(selector: string, timeout?: number): Promise<ElementHandle>;

  // Extracción
  async content(): Promise<string>;         // document.documentElement.outerHTML
  async textContent(): Promise<string>;     // document.body.innerText (limpio)
  async evaluate<T>(fn: string): Promise<T>; // Runtime.evaluate

  // Screenshots (para Asset Studio migration futura)
  async screenshot(opts?: { selector?: string; format?: 'png' | 'jpeg' }): Promise<Buffer>;

  // CDP Events (para NavigationLogger)
  on(event: string, handler: (params: any) => void): void;
  off(event: string, handler: (params: any) => void): void;

  // Cleanup
  async close(): Promise<void>;
}
```

### 3.4 Eventos CDP Interceptados

Obscura emite los mismos eventos CDP que Chrome. Los relevantes para el log de navegación:

| Evento CDP | Uso en el CRM |
|---|---|
| `Network.requestWillBeSent` | Log: "Navegando a {url}" |
| `Network.responseReceived` | Log: "Respuesta {status} de {url}" |
| `Page.loadEventFired` | Log: "Página cargada" |
| `Page.navigatedWithinDocument` | Log: "Navegación SPA detectada" |
| `Runtime.consoleAPICalled` | Log: errores JS de la página target |
| `Page.javascriptDialogOpening` | Log: "Diálogo detectado, descartando" |

---

## 4. Integración con el Nodo Investigador y LangGraph

### 4.1 Reemplazo del Tool `scrape_website`

El tool mock actual se reemplaza por una implementación real:

```typescript
// src/tools/scraping.ts — NUEVA IMPLEMENTACIÓN

import { z } from "zod";
import { tool } from "@langchain/core/tools";
import { getObscuraClient } from "../services/obscura/index.js";
import { NavigationLogStreamer } from "../services/obscura/navigation-logger.js";

export const scrapeWebsiteSchema = z.object({
  url: z.string().url(),
  focus_area: z.enum(["about", "pricing", "contact", "general"]).optional(),
});

export const scrapeWebsiteTool = tool(
  async ({ url, focus_area }, runManager) => {
    const client = getObscuraClient();
    const page = await client.newPage();
    const logger = new NavigationLogStreamer(page);

    try {
      // 1. Iniciar captura de logs de navegación
      logger.start();

      // 2. Navegar
      await page.goto(url, { waitUntil: 'networkidle', timeout: 30_000 });

      // 3. Extraer contenido textual
      const text = await page.textContent();

      // 4. Truncar a ventana de contexto razonable (8K chars)
      const truncated = text.slice(0, 8192);

      // 5. Detener logger y recopilar eventos
      const navLogs = logger.stop();

      // 6. Emitir logs hacia el EventBus (para SSE)
      // El streamer ya los emitió incrementalmente durante la navegación

      return JSON.stringify({
        url,
        focus_area: focus_area || 'general',
        content: truncated,
        content_length: text.length,
        navigation_events: navLogs.length,
      });
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return JSON.stringify({ url, error: msg, content: null });
    } finally {
      await page.close();
    }
  },
  {
    name: "scrape_website",
    description: "Navega a una URL usando Obscura (headless browser) y extrae el contenido textual de la página.",
    schema: scrapeWebsiteSchema,
  }
);
```

### 4.2 Nuevo Nodo: `investigadorNode`

El grafo LangGraph actualmente no tiene un nodo Investigador explícito — el SDR usa `scrape_website` como tool. Para la Fase 2, se propone un nodo dedicado:

```
src/nodes/investigador.ts    # Nodo LangGraph para investigación profunda
src/nodes/prompts.ts         # (actualizar con prompt del Investigador)
```

El nodo Investigador se integra al grafo como un sub-pipeline que puede:
1. Recibir un `prospect_id` + `domain` desde el Gatekeeper o SDR.
2. Ejecutar una secuencia de navegaciones (LinkedIn, sitio corporativo, Crunchbase, noticias).
3. Emitir eventos `research.progress` en cada paso.
4. Consolidar hallazgos en `research.completed`.

**Integración en `graph.ts`:**

```typescript
// Nuevos edges en el grafo
.addNode("investigador", investigadorNode)
.addConditionalEdges("gatekeeper", routeFromGatekeeper, {
  sdr: "sdr",
  investigador: "investigador",  // Nueva ruta
  rag: "retrieval",
  __end__: END,
})
.addEdge("investigador", "sdr")  // Investigador alimenta al SDR
```

---

## 5. Transmisión de Logs de Navegación → SSE (`research.progress`)

### 5.1 Arquitectura del Flujo de Eventos

```
┌──────────────┐     CDP Events      ┌────────────────────┐
│   Obscura    │─────────────────────▶│ NavigationLogStreamer│
│  (Browser)   │   (WebSocket)       │  (Interceptor)      │
└──────────────┘                      └────────┬───────────┘
                                               │
                                    Transforma CDP → SSEEvent
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │    EventBus           │
                                    │  (In-Memory Pub/Sub)  │
                                    │                       │
                                    │  topic: research.*    │
                                    └──────────┬───────────┘
                                               │
                                    SSE write() al stream
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │  /api/events/         │
                                    │  prospects/:id        │
                                    │  (Hono SSE endpoint)  │
                                    └──────────┬───────────┘
                                               │
                                    EventSource (HTTP)
                                               │
                                               ▼
                                    ┌──────────────────────┐
                                    │  ProspectCanvas       │
                                    │  (Command Center UI)  │
                                    │                       │
                                    │  Badge: "Navegando…"  │
                                    │  Timeline de acciones  │
                                    └──────────────────────┘
```

### 5.2 `NavigationLogStreamer` (`navigation-logger.ts`)

Componente que suscribe a eventos CDP de una `PageHandle` y los transforma en eventos SSE compatibles con el schema `research.progress`:

```typescript
interface NavigationLogEntry {
  timestamp: string;
  action: 'navigating' | 'loaded' | 'extracting' | 'error' | 'screenshot';
  url: string;
  detail: string;
  duration_ms?: number;
}

class NavigationLogStreamer {
  private page: PageHandle;
  private logs: NavigationLogEntry[] = [];
  private eventBus: EventBus;

  constructor(page: PageHandle, eventBus?: EventBus);

  start(): void {
    // Suscribirse a eventos CDP
    this.page.on('Network.requestWillBeSent', (params) => {
      const entry: NavigationLogEntry = {
        timestamp: new Date().toISOString(),
        action: 'navigating',
        url: params.request.url,
        detail: `Navegando a ${new URL(params.request.url).hostname}...`,
      };
      this.logs.push(entry);
      this.emitSSE(entry);
    });

    this.page.on('Page.loadEventFired', () => {
      const entry: NavigationLogEntry = {
        timestamp: new Date().toISOString(),
        action: 'loaded',
        url: this.currentUrl,
        detail: 'Página cargada correctamente',
      };
      this.logs.push(entry);
      this.emitSSE(entry);
    });
    // ... más eventos
  }

  private emitSSE(entry: NavigationLogEntry): void {
    // Transforma NavigationLogEntry → research.progress SSE event
    const sseEvent = {
      event: 'research.progress',
      data: {
        run_id: this.runId,
        agent_node: 'investigador',
        step: this.mapActionToStep(entry.action),
        step_label: entry.detail,
        progress_pct: this.calculateProgress(),
        detail: `[${entry.action.toUpperCase()}] ${entry.url} — ${entry.detail}`,
        source: entry.url,
        partial_artifacts: [],
      },
    };
    this.eventBus.publish(`research.progress.${this.prospectId}`, sseEvent);
  }

  stop(): NavigationLogEntry[] {
    // Unsuscribir eventos CDP
    return [...this.logs];
  }

  private mapActionToStep(action: string): string {
    const map: Record<string, string> = {
      navigating: 'company_analysis',
      loaded: 'company_analysis',
      extracting: 'tech_stack_scan',
      error: 'custom',
      screenshot: 'custom',
    };
    return map[action] || 'custom';
  }

  private calculateProgress(): number {
    // Heurística: progreso basado en pasos completados vs esperados
    const expectedSteps = 5; // linkedin, site, crunchbase, news, scoring
    return Math.min(Math.round((this.logs.length / expectedSteps) * 100), 95);
  }
}
```

### 5.3 `EventBus` — Pub/Sub In-Memory

El endpoint SSE actual (`src/routes/events.ts`) mantiene una conexión abierta pero **no recibe eventos del grafo** — solo envía pings. Se necesita un bus de eventos in-memory:

```typescript
// src/services/event-bus.ts

import { EventEmitter } from 'node:events';

class EventBus {
  private emitter = new EventEmitter();

  constructor() {
    this.emitter.setMaxListeners(100); // múltiples clientes SSE
  }

  publish(topic: string, payload: any): void {
    this.emitter.emit(topic, payload);
  }

  subscribe(topic: string, handler: (payload: any) => void): () => void {
    this.emitter.on(topic, handler);
    return () => this.emitter.off(topic, handler); // unsubscribe function
  }
}

// Singleton global
export const eventBus = new EventBus();
```

### 5.4 Modificación del Endpoint SSE (`events.ts`)

El endpoint actual se modifica para suscribirse al `EventBus`:

```typescript
// src/routes/events.ts — PATCH

import { eventBus } from '../services/event-bus.js';

eventsRouter.get('/prospects/:prospectId', async (c) => {
  // ... (auth existente se preserva) ...

  return streamSSE(c, async (stream) => {
    let isConnected = true;

    c.req.raw.signal.addEventListener('abort', () => {
      isConnected = false;
    });

    // Suscribirse a eventos del bus para este prospecto
    const unsubResearch = eventBus.subscribe(
      `research.progress.${prospectId}`,
      async (event) => {
        if (isConnected && !stream.aborted && !stream.closed) {
          try {
            await stream.writeSSE({
              event: event.event,
              data: JSON.stringify(event.data),
              id: crypto.randomUUID(),
            });
          } catch { isConnected = false; }
        }
      }
    );

    const unsubCompleted = eventBus.subscribe(
      `research.completed.${prospectId}`,
      async (event) => {
        if (isConnected && !stream.aborted && !stream.closed) {
          try {
            await stream.writeSSE({
              event: event.event,
              data: JSON.stringify(event.data),
              id: crypto.randomUUID(),
            });
          } catch { isConnected = false; }
        }
      }
    );

    // Ping keepalive
    const pingInterval = setInterval(async () => {
      if (isConnected && !stream.aborted && !stream.closed) {
        try { await stream.write(':ping\n\n'); }
        catch { isConnected = false; }
      } else { clearInterval(pingInterval); }
    }, 30_000);

    // Mantener conexión
    while (isConnected && !stream.aborted && !stream.closed) {
      await stream.sleep(1000);
    }

    // Cleanup
    clearInterval(pingInterval);
    unsubResearch();
    unsubCompleted();
  });
});
```

---

## 6. Configuración y Variables de Entorno

### 6.1 Orquestador (`crm-agentico-orchestrator`)

```env
# === Obscura Sidecar ===
OBSCURA_CDP_ENDPOINT=ws://localhost:9222    # CDP WebSocket del sidecar
OBSCURA_CONNECT_TIMEOUT=5000                # Timeout de conexión CDP (ms)
OBSCURA_MAX_PAGES=3                          # Páginas concurrentes máximas
OBSCURA_NAVIGATION_TIMEOUT=30000             # Timeout de navegación por página (ms)

# === Feature Flags ===
FEATURE_OBSCURA_ENABLED=true                 # Kill-switch para rollback a mock
FEATURE_SSE_NAVIGATION_LOGS=true             # Emitir logs de navegación vía SSE
```

### 6.2 Cloud Run Multi-Container (`service.yaml`)

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: crm-agentico-orchestrator
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2
        run.googleapis.com/cpu-throttling: "false"   # ADR-101
    spec:
      containerConcurrency: 10
      containers:
        # Container 1: Orquestador (principal)
        - name: orchestrator
          image: gcr.io/PROJECT/crm-agentico-orchestrator:latest
          ports:
            - containerPort: 3000
          resources:
            limits:
              cpu: "2"
              memory: 1Gi
          env:
            - name: OBSCURA_CDP_ENDPOINT
              value: "ws://localhost:9222"
          startupProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5

        # Container 2: Obscura Sidecar
        - name: obscura
          image: ghcr.io/h4ckf0r0day/obscura:latest  # o build propio
          ports:
            - containerPort: 9222
          resources:
            limits:
              cpu: "1"
              memory: 512Mi
          args:
            - "--port=9222"
            - "--headless"
            - "--disable-gpu"
          startupProbe:
            tcpSocket:
              port: 9222
            initialDelaySeconds: 2
            periodSeconds: 3

      # Total: 3 vCPU, 1.5 GiB RAM
```

---

## 7. Seguridad

### 7.1 Aislamiento de Red

| Preocupación | Mitigación |
|---|---|
| **Obscura expuesto externamente** | CDP solo escucha en `localhost` (sidecar). No hay ingress externo al puerto 9222. |
| **Navegación a sitios maliciosos** | URL allowlist configurable. Dominios bloqueados: `*.internal`, `metadata.google.internal`, `169.254.*`. |
| **Exfiltración de datos** | El browser sidecar no tiene acceso a variables de entorno del Orquestador ni a la DB. |
| **JS malicioso en páginas target** | Obscura ejecuta V8 en sandbox. El Orquestador solo extrae `textContent()`, no ejecuta JS arbitrario de retorno. |
| **Denial of Service (páginas pesadas)** | Timeout de 30s por navegación. Máximo 3 páginas simultáneas. Kill automático si RAM >400 MB. |

### 7.2 Sanitización de URLs

```typescript
// src/services/obscura/url-validator.ts

const BLOCKED_PATTERNS = [
  /^https?:\/\/metadata\.google\.internal/,
  /^https?:\/\/169\.254\./,
  /^https?:\/\/localhost/,
  /^https?:\/\/127\./,
  /^https?:\/\/10\./,
  /^https?:\/\/172\.(1[6-9]|2[0-9]|3[0-1])\./,
  /^https?:\/\/192\.168\./,
  /^file:\/\//,
  /^data:/,
  /^javascript:/,
];

export function validateNavigationUrl(url: string): boolean {
  return !BLOCKED_PATTERNS.some(pattern => pattern.test(url));
}
```

---

## 8. Observabilidad

| Señal | Implementación |
|---|---|
| **Logs estructurados** | Cada navegación emite: `{ tool: "scrape_website", url, duration_ms, status, content_length, prospect_id, tenant_id }` |
| **Métricas** | Contador de navegaciones exitosas/fallidas. Histograma de duración. Gauge de páginas activas. |
| **Health del sidecar** | Startup probe en TCP 9222. El Orquestador verifica `obscura.healthCheck()` en el readiness probe. |
| **SSE Observability** | Contador de clientes SSE conectados. Eventos emitidos por segundo. |
| **Alertas** | Si el sidecar falla 3 veces consecutivas → log `CRITICAL`, fallback a mock (feature flag). |

---

## 9. Plan de Rollback

Si Obscura presenta inestabilidad en producción:

1. **Feature Flag `FEATURE_OBSCURA_ENABLED=false`** → El tool `scrape_website` revierte al mock original.
2. **Eliminar sidecar del `service.yaml`** → Deploy del Orquestador sin Obscura, reduciendo recursos.
3. **Playwright fallback** → En caso extremo, implementar `scrape_website` con `playwright-core` como se hacía en el Asset Studio.

**El rollback es reversible en <5 minutos** (cambio de env var + redeploy automático via GitOps).

---

## 10. Migración Gradual — Fases

### Fase 2A: Integración Core (Este Bloque — 33)

| # | Tarea | Impacto |
|---|---|---|
| 2A.1 | Crear `src/services/obscura/` con `client.ts`, `page.ts`, `types.ts` | Orquestador |
| 2A.2 | Crear `src/services/obscura/navigation-logger.ts` | Orquestador |
| 2A.3 | Crear `src/services/event-bus.ts` (Singleton Pub/Sub) | Orquestador |
| 2A.4 | Reescribir `src/tools/scraping.ts` con implementación real Obscura | Orquestador |
| 2A.5 | Patchear `src/routes/events.ts` para suscribirse al EventBus | Orquestador |
| 2A.6 | Agregar variables de entorno Obscura a `.env.example` y Cloud Build | Orquestador |
| 2A.7 | Crear `service.yaml` multi-container con sidecar Obscura | Infra/Cloud Run |
| 2A.8 | Tests unitarios: ObscuraClient mock, NavigationLogStreamer, EventBus | Orquestador |
| 2A.9 | Test E2E: Trigger tool → navegación real → evento SSE recibido en cliente | E2E |

### Fase 2B: Nodo Investigador Completo (Bloque 34+)

| # | Tarea | Impacto |
|---|---|---|
| 2B.1 | Crear `src/nodes/investigador.ts` con secuencia multi-step (LinkedIn, site, news) | Orquestador |
| 2B.2 | Agregar nodo al grafo LangGraph (`graph.ts`) con ruta desde Gatekeeper | Orquestador |
| 2B.3 | Emitir `research.completed` con artifacts consolidados y BANT signals | Orquestador |
| 2B.4 | Frontend: Timeline de investigación en ProspectCanvas | Command Center |
| 2B.5 | Migrar Asset Studio snapshots de Playwright a Obscura CDP | Command Center |

---

## 11. Work Breakdown Structure (WBS) — Fase 2A

> Granular, numerado, secuencial. Listo para ingestión por el Ejecutor.

### Etapa 1: Scaffold del Módulo Obscura

```
1.1  [ ] Crear directorio src/services/obscura/
1.2  [ ] Crear src/services/obscura/types.ts — tipos CDP, NavigationLogEntry, ObscuraClientOptions
1.3  [ ] Crear src/services/obscura/client.ts — ObscuraClient (connect, disconnect, healthCheck, newPage, closePage, listPages)
1.4  [ ] Crear src/services/obscura/page.ts — PageHandle (goto, waitForSelector, content, textContent, evaluate, screenshot, on/off CDP events, close)
1.5  [ ] Crear src/services/obscura/index.ts — Re-exports + getObscuraClient() singleton factory
1.6  [ ] Crear src/services/obscura/url-validator.ts — validateNavigationUrl() con BLOCKED_PATTERNS según §7.2
```

### Etapa 2: Navigation Logger + EventBus

```
2.1  [ ] Crear src/services/event-bus.ts — EventBus class con publish/subscribe sobre EventEmitter, singleton export
2.2  [ ] Crear src/services/obscura/navigation-logger.ts — NavigationLogStreamer (start, stop, emitSSE, mapActionToStep, calculateProgress)
2.3  [ ] El streamer debe suscribirse a eventos CDP: Network.requestWillBeSent, Network.responseReceived, Page.loadEventFired, Page.navigatedWithinDocument
2.4  [ ] Cada evento CDP interceptado se transforma a research.progress SSE event y se publica en el EventBus con topic `research.progress.{prospectId}`
2.5  [ ] Implementar rate-limiting en el streamer: máximo 1 evento SSE por segundo por prospecto (debounce, no throttle — último evento gana)
```

### Etapa 3: Reemplazo del Tool de Scraping

```
3.1  [ ] Reescribir src/tools/scraping.ts — reemplazar mock por implementación real según §4.1
3.2  [ ] Feature flag: si FEATURE_OBSCURA_ENABLED !== 'true', retornar el mock original
3.3  [ ] Integrar NavigationLogStreamer: crear instancia por invocación del tool, start() antes de goto(), stop() después
3.4  [ ] Sanitización de URL: llamar validateNavigationUrl() antes de navegar. Si falla, retornar error estructurado sin navegar
3.5  [ ] Truncar contenido extraído a 8192 caracteres (ventana de contexto del LLM)
3.6  [ ] Error handling: timeout, DNS failure, HTTP errors — retornar JSON con campo error, no lanzar excepción
```

### Etapa 4: Patch del Endpoint SSE

```
4.1  [ ] Modificar src/routes/events.ts — importar eventBus singleton
4.2  [ ] Dentro del streamSSE callback, suscribirse a `research.progress.{prospectId}` y `research.completed.{prospectId}`
4.3  [ ] Escribir cada evento recibido al stream con writeSSE({ event, data, id })
4.4  [ ] Cleanup: unsuscribirse del EventBus al detectar desconexión del cliente (abort signal)
4.5  [ ] Preservar ping keepalive existente (cada 30s)
```

### Etapa 5: Configuración e Infraestructura

```
5.1  [ ] Agregar variables OBSCURA_* y FEATURE_* a .env.example del Orquestador
5.2  [ ] Crear service.yaml multi-container para Cloud Run según §6.2
5.3  [ ] Actualizar cloudbuild.yaml para incluir el sidecar Obscura en el deploy
5.4  [ ] Agregar health check del sidecar al readiness probe del Orquestador (/health verifica CDP conexión)
5.5  [ ] Documentar la configuración en README del Orquestador
```

### Etapa 6: Tests

```
6.1  [ ] Test unitario: ObscuraClient — mock de WebSocket, verificar connect/disconnect/newPage
6.2  [ ] Test unitario: PageHandle — mock de CDP session, verificar goto/textContent/close
6.3  [ ] Test unitario: NavigationLogStreamer — mock de PageHandle events, verificar transformación a SSE events
6.4  [ ] Test unitario: EventBus — publish/subscribe/unsubscribe, verificar que no hay memory leaks
6.5  [ ] Test unitario: url-validator — URLs bloqueadas y permitidas
6.6  [ ] Test de integración: scrapeWebsiteTool con ObscuraClient mockeado → verificar output JSON estructurado
6.7  [ ] Test E2E: Levantar Obscura local (Docker) + Orquestador → invocar tool → verificar evento SSE en cliente EventSource
```

### Etapa 7: Verificación en Staging

```
7.1  [ ] Deploy a Cloud Run staging con multi-container
7.2  [ ] Verificar startup: Obscura sidecar levanta en <5s, Orquestador conecta via CDP
7.3  [ ] Trigger real: enviar webhook con URL de prospecto → verificar navegación + extracción
7.4  [ ] Verificar SSE: conectar EventSource desde browser → verificar eventos research.progress llegando
7.5  [ ] Load test: 3 navegaciones concurrentes, verificar que max_pages=3 se respeta y no hay OOM
7.6  [ ] Rollback test: setear FEATURE_OBSCURA_ENABLED=false → verificar que tool retorna mock
```

---

## 12. Relación con RFCs/ADRs Existentes

| RFC/ADR | Relación |
|---|---|
| PRD-BLOQUE33 (SSE Integrations) | Este RFC materializa la §3 "Resolución Técnica de Obscura" del PRD. |
| POST_MORTEM_BLOQUE32 | Dictaminó la adopción de Obscura como estándar. Este RFC ejecuta esa decisión. |
| SSE Schemas (`sse-events.ts`) | Los eventos `research.progress` y `research.completed` ya están definidos con Zod. Este RFC los usa tal cual. |
| RFC-048 (Agentico Compiler) | El Compiler procesa documentos. Este RFC procesa *páginas web*. Son complementarios para el RAG. |
| RFC-035 (LangGraph SDR) | Define el grafo original. Este RFC agrega un nodo Investigador al grafo. |
| ADR-101 (CPU Throttling) | El sidecar requiere `cpu-throttling: false` para navegación sin latencia. Ya está habilitado. |
| ADR-097 (Single-Tenant) | El deploy multi-container sigue siendo single-tenant por instancia Cloud Run. |

---

## 13. Diagrama de Secuencia — Flujo Completo

```
┌─────────┐    ┌────────────┐    ┌─────────┐    ┌──────────────┐    ┌───────────┐
│ Prospect │    │ Gatekeeper │    │   SDR   │    │ Investigador │    │ Obscura   │
│ (WhatsApp│    │   Node     │    │  Node   │    │    Node      │    │ (Sidecar) │
└────┬─────┘    └─────┬──────┘    └────┬────┘    └──────┬───────┘    └─────┬─────┘
     │                │               │                │                  │
     │  "Soy de X.com"│               │                │                  │
     │───────────────▶│               │                │                  │
     │                │  route:investigador             │                  │
     │                │──────────────────────────────▶  │                  │
     │                │               │                │  CDP: newPage()  │
     │                │               │                │────────────────▶ │
     │                │               │                │                  │
     │                │               │                │  goto(x.com)     │
     │                │               │                │────────────────▶ │
     │                │               │                │                  │
     │                │               │  ◄─ SSE: research.progress ──────│
     │                │               │    "Navegando a x.com..."        │
     │                │               │                │                  │
     │                │               │                │  textContent()   │
     │                │               │                │────────────────▶ │
     │                │               │                │  ◄── HTML text   │
     │                │               │                │                  │
     │                │               │  ◄─ SSE: research.progress ──────│
     │                │               │    "Extrayendo datos de x.com"   │
     │                │               │                │                  │
     │                │               │                │  closePage()     │
     │                │               │                │────────────────▶ │
     │                │               │                │                  │
     │                │               │  research.completed (artifacts)   │
     │                │               │◄───────────────│                  │
     │                │               │                │                  │
     │  "Cuéntame más │  SDR con contexto enriquecido  │                  │
     │   de tu flota" │◄──────────────│                │                  │
     │◄───────────────│               │                │                  │
```

---

## 14. Consideraciones Futuras (No en Fase 2A)

- **Multi-page research:** El Investigador navega secuencialmente 3-5 URLs por prospecto. Paralelizar con pool de pages.
- **Stealth mode:** Configurar Obscura con fingerprinting evasion (User-Agent rotation, viewport randomization) para LinkedIn.
- **Screenshot artifacts:** Guardar screenshots de páginas investigadas en Supabase Storage como evidencia.
- **Caching de navegación:** Cache de contenido extraído por URL+hash con TTL de 24h para evitar re-scraping.
- **Asset Studio migration:** Reemplazar Playwright en el Command Center (Fase 2B.5).

---

**Fin del RFC-058.**

**Inicio de Ejecución Autorizado** — El Ejecutor puede proceder con la Etapa 1 del WBS (Fase 2A).
