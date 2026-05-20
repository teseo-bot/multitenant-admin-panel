# PRD-BLOQUE34: Migración a Obscura — Motor de Navegación Real para el Orquestador

| Campo | Valor |
|---|---|
| **Bloque** | 34 |
| **Estado** | Activo |
| **Fecha** | 2026-04-25 |
| **Autor** | Builder (Teseo Squad) |
| **RFC Base** | RFC-058-Obscura-Rust-Browser-Migration.md |
| **Repositorios** | `crm-agentico-orchestrator` (principal), `Teseo-AI-CRM` (docs) |
| **Épica** | Reemplazo de motor de navegación: mock → Obscura (Rust headless browser) |

---

## 1. Objetivo del Sprint

> **Dotar al Orquestador de un motor de navegación real** basado en Obscura (Rust headless browser) desplegado como sidecar en Cloud Run, reemplazando el mock actual de `scrape_website`. Al finalizar el bloque, el nodo Investigador podrá navegar URLs reales de prospectos (LinkedIn, sitios corporativos) y transmitir logs de navegación en tiempo real vía SSE al Command Center.

### Entregables Clave

1. **Módulo `ObscuraClient`** — cliente CDP (Chrome DevTools Protocol) sobre WebSocket que habla con el sidecar Obscura.
2. **Tool `scrape_website` real** — reemplazo del mock actual con navegación real + extracción de texto.
3. **EventBus + NavigationLogStreamer** — pipeline de eventos CDP → SSE `research.progress`.
4. **Nodo Investigador** — nuevo nodo LangGraph con secuencia multi-step de navegación.
5. **Infra multi-container** — `service.yaml` Cloud Run con sidecar Obscura + Dockerfile dual.
6. **Feature flag de rollback** — `FEATURE_OBSCURA_ENABLED` para revertir al mock en <5 min.

### Criterio de Éxito

- El Orquestador, en Cloud Run staging, navega a `https://www.linkedin.com/company/tesla` sin bloqueo y extrae texto legible.
- Un cliente EventSource conectado a `/api/events/prospects/:id` recibe eventos `research.progress` durante la navegación.
- El feature flag `FEATURE_OBSCURA_ENABLED=false` revierte al mock sin redeploy del contenedor.

---

## 2. Estado Actual (Pre-Bloque 34)

| Componente | Estado | Archivo |
|---|---|---|
| `scrape_website` tool | **Mock** — retorna texto estático | `src/tools/scraping.ts` |
| Módulo Obscura | **No existe** | — |
| EventBus | **No existe** | — |
| Endpoint SSE | **Existe** — solo envía pings, sin eventos del grafo | `src/routes/events.ts` |
| Nodo Investigador | **No existe** — SDR usa `scrape_website` como tool | — |
| service.yaml (multi-container) | **No existe** — deploy single-container | `Dockerfile` |
| Variables de entorno Obscura | **No existen** | `.env.example` |

---

## 3. Requisitos de Contenedor (Cloud Run Multi-Container)

### 3.1 Topología

Obscura corre como **sidecar container** en el mismo servicio Cloud Run del Orquestador, comunicándose vía `localhost:9222` sobre CDP WebSocket.

```
┌──────────────────────────── Cloud Run Service ────────────────────────────┐
│                                                                           │
│  ┌──────────────────────────┐     ws://localhost:9222 (CDP)              │
│  │  Sidecar: Obscura        │◄────────────────────────────────┐          │
│  │  Image: obscura:latest   │                                 │          │
│  │  Port: 9222              │                                 │          │
│  │  CPU: 1 vCPU             │                                 │          │
│  │  RAM: 512 Mi             │                                 │          │
│  └──────────────────────────┘                                 │          │
│                                                                │          │
│  ┌────────────────────────────────────────────────────────────┐│          │
│  │  Principal: Orquestador (Hono + LangGraph)                 ││          │
│  │  Port: 3000                                                ││          │
│  │  CPU: 2 vCPU | RAM: 1 Gi                                  ││          │
│  │                                                            ││          │
│  │  ObscuraClient ──► CDP WS ────────────────────────────────┘│          │
│  │       │                                                     │          │
│  │  NavigationLogStreamer ──► EventBus ──► SSE /api/events     │          │
│  └────────────────────────────────────────────────────────────┘           │
│                                                                           │
│  Total: 3 vCPU, ~1.5 GiB RAM                                            │
└───────────────────────────────────────────────────────────────────────────┘
```

### 3.2 ¿Por qué Sidecar?

| Criterio | Sidecar (elegido) | Microservicio separado |
|---|---|---|
| Latencia CDP | <1 ms (localhost) | 10-50 ms (red interna) |
| Complejidad | Baja (un deploy) | Alta (service discovery, auth S2S) |
| Costo | Bajo (comparte instancia) | Medio (instancia dedicada) |

### 3.3 `service.yaml` — Especificación Multi-Container

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
        run.googleapis.com/cpu-throttling: "false"     # ADR-101
    spec:
      containerConcurrency: 10
      containers:
        # Principal: Orquestador
        - name: orchestrator
          image: gcr.io/PROJECT_ID/crm-agentico-orchestrator:latest
          ports:
            - containerPort: 3000
          resources:
            limits:
              cpu: "2"
              memory: 1Gi
          env:
            - name: OBSCURA_CDP_ENDPOINT
              value: "ws://localhost:9222"
            - name: FEATURE_OBSCURA_ENABLED
              value: "true"
          startupProbe:
            httpGet:
              path: /health
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5

        # Sidecar: Obscura
        - name: obscura
          image: ghcr.io/aspect-build/aspect-workflows/obscura:latest
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
```

### 3.4 Variables de Entorno Nuevas

```env
# === Obscura Sidecar ===
OBSCURA_CDP_ENDPOINT=ws://localhost:9222
OBSCURA_CONNECT_TIMEOUT=5000
OBSCURA_MAX_PAGES=3
OBSCURA_NAVIGATION_TIMEOUT=30000

# === Feature Flags ===
FEATURE_OBSCURA_ENABLED=true
FEATURE_SSE_NAVIGATION_LOGS=true
```

### 3.5 Desarrollo Local

Para desarrollo, Obscura corre en Docker:

```bash
docker run -d --name obscura -p 9222:9222 \
  ghcr.io/aspect-build/aspect-workflows/obscura:latest \
  --port=9222 --headless --disable-gpu
```

El Orquestador en local apunta a `ws://localhost:9222` por defecto.

---

## 4. Lista Priorizada de Tareas (Bottom-Up para el Ejecutor)

> **Orden de ejecución estricto.** Cada tarea depende de las anteriores. El Ejecutor debe seguir esta secuencia sin saltar pasos.

### Fase A — Scaffold del Módulo Obscura

| # | Tarea | Archivo(s) | Detalle |
|---|---|---|---|
| **A1** | Crear directorio del módulo | `src/services/obscura/` | Crear la carpeta |
| **A2** | Tipos CDP y contratos internos | `src/services/obscura/types.ts` | Interfaces: `ObscuraClientOptions`, `NavigationLogEntry`, `NavigationResult`, `PageInfo`, `ElementHandle`. Tipos CDP relevantes: `CDPMessage`, `CDPResponse`. |
| **A3** | URL validator | `src/services/obscura/url-validator.ts` | Función `validateNavigationUrl(url)` → `boolean`. Bloquear: `metadata.google.internal`, `169.254.*`, `localhost`, `127.*`, `10.*`, `172.16-31.*`, `192.168.*`, `file://`, `data:`, `javascript:`. (ver RFC-058 §7.2) |
| **A4** | ObscuraClient — connection manager CDP | `src/services/obscura/client.ts` | Clase con: `connect()`, `disconnect()`, `healthCheck()`, `newPage()`, `closePage(id)`, `listPages()`. Usa WebSocket nativo contra `OBSCURA_CDP_ENDPOINT`. Máximo `OBSCURA_MAX_PAGES` páginas simultáneas. Reconnect automático con backoff exponencial. |
| **A5** | PageHandle — API de alto nivel por pestaña | `src/services/obscura/page.ts` | Clase con: `goto(url, opts)`, `waitForSelector(sel, timeout)`, `content()`, `textContent()`, `evaluate(fn)`, `screenshot(opts)`, `on(event, handler)`, `off(event, handler)`, `close()`. Cada método manda comandos CDP al session del target. |
| **A6** | Re-exports + singleton factory | `src/services/obscura/index.ts` | Exportar todo. Función `getObscuraClient()` que retorna singleton conectado. Lee config de env vars. |

### Fase B — EventBus + NavigationLogStreamer

| # | Tarea | Archivo(s) | Detalle |
|---|---|---|---|
| **B1** | EventBus in-memory Pub/Sub | `src/services/event-bus.ts` | Clase `EventBus` sobre `EventEmitter`. Métodos: `publish(topic, payload)`, `subscribe(topic, handler) → unsubscribe()`. Singleton exportado. Max listeners: 100. |
| **B2** | NavigationLogStreamer | `src/services/obscura/navigation-logger.ts` | Se suscribe a eventos CDP de un `PageHandle`: `Network.requestWillBeSent`, `Network.responseReceived`, `Page.loadEventFired`, `Page.navigatedWithinDocument`. Transforma cada evento a `NavigationLogEntry` y publica en EventBus como `research.progress.{prospectId}`. Rate-limit: máximo 1 evento SSE por segundo por prospecto (debounce). |

### Fase C — Tool de Scraping Real

| # | Tarea | Archivo(s) | Detalle |
|---|---|---|---|
| **C1** | Reescribir `scrape_website` con Obscura | `src/tools/scraping.ts` | Reemplazar mock por implementación real. Flujo: validar URL → `getObscuraClient()` → `newPage()` → crear `NavigationLogStreamer` → `page.goto(url, { waitUntil: 'networkidle', timeout: 30s })` → `page.textContent()` → truncar a 8192 chars → `page.close()`. Retornar JSON: `{ url, focus_area, content, content_length, navigation_events }`. |
| **C2** | Feature flag de rollback | `src/tools/scraping.ts` | Si `FEATURE_OBSCURA_ENABLED !== 'true'`, ejecutar el mock original. No tocar la interfaz del tool. |
| **C3** | Error handling robusto | `src/tools/scraping.ts` | Capturar timeout, DNS failure, HTTP errors. Retornar `{ url, error: msg, content: null }`. Nunca lanzar excepción — el grafo LangGraph necesita un retorno string. |
| **C4** | Sanitización pre-navegación | `src/tools/scraping.ts` | Llamar `validateNavigationUrl(url)` antes de crear página. Si falla: retornar error sin navegar. |

### Fase D — Patch del Endpoint SSE

| # | Tarea | Archivo(s) | Detalle |
|---|---|---|---|
| **D1** | Integrar EventBus al endpoint SSE | `src/routes/events.ts` | Importar `eventBus`. Dentro de `streamSSE`, suscribirse a `research.progress.{prospectId}` y `research.completed.{prospectId}`. Escribir cada evento con `writeSSE({ event, data, id })`. |
| **D2** | Cleanup de suscripciones | `src/routes/events.ts` | Al detectar `abort` del cliente, llamar `unsubscribe()` de ambos topics. Preservar ping keepalive existente (30s). |

### Fase E — Nodo Investigador en LangGraph

| # | Tarea | Archivo(s) | Detalle |
|---|---|---|---|
| **E1** | Crear nodo Investigador | `src/nodes/investigador.ts` | Nodo LangGraph que recibe `prospect_id` + `domain` desde estado. Ejecuta secuencia: (1) sitio corporativo, (2) LinkedIn company page, (3) fuentes de noticias. Usa `scrapeWebsiteTool` internamente. Emite `research.completed` al terminar con artifacts consolidados. |
| **E2** | Prompt del Investigador | `src/nodes/prompts.ts` | Agregar prompt system del Investigador: instrucciones para analizar contenido web, extraer señales BANT, consolidar findings. |
| **E3** | Integrar al grafo | `src/graph.ts` | Agregar `.addNode("investigador", investigadorNode)`. Actualizar `routeFromGatekeeper` para incluir ruta `investigador`. Edge: `investigador → sdr` (alimentar al SDR con contexto enriquecido). |
| **E4** | Actualizar router del Gatekeeper | `src/edges/router.ts` | Agregar lógica: si el prospecto menciona su empresa/dominio y no se ha investigado → ruta `investigador`. |

### Fase F — Infraestructura y Configuración

| # | Tarea | Archivo(s) | Detalle |
|---|---|---|---|
| **F1** | Variables de entorno | `.env.example` | Agregar: `OBSCURA_CDP_ENDPOINT`, `OBSCURA_CONNECT_TIMEOUT`, `OBSCURA_MAX_PAGES`, `OBSCURA_NAVIGATION_TIMEOUT`, `FEATURE_OBSCURA_ENABLED`, `FEATURE_SSE_NAVIGATION_LOGS`. |
| **F2** | service.yaml multi-container | `service.yaml` (raíz) | Crear según §3.3 de este PRD. Dos containers: orchestrator + obscura sidecar. |
| **F3** | Actualizar cloudbuild.yaml | `cloudbuild.yaml` | Agregar step para desplegar con `service.yaml` en vez de `--image` directo. Asegurar que Cloud Run usa el manifiesto multi-container. |
| **F4** | Health check del sidecar | `src/routes/health.ts` (o equivalente) | El endpoint `/health` del Orquestador debe verificar `obscuraClient.healthCheck()`. Si falla y feature flag activo: retornar degraded (200 con warning), no unhealthy. |
| **F5** | README del Orquestador | `README.md` | Documentar: setup local de Obscura (docker run), variables de entorno, topología multi-container. |

### Fase G — Tests

| # | Tarea | Archivo(s) | Detalle |
|---|---|---|---|
| **G1** | Test: ObscuraClient | `src/services/obscura/client.test.ts` | Mock de WebSocket. Verificar connect, disconnect, newPage, closePage, healthCheck. Verificar que excede `maxPages` lanza error. |
| **G2** | Test: PageHandle | `src/services/obscura/page.test.ts` | Mock de CDP session. Verificar goto retorna NavigationResult, textContent retorna string limpio, close libera recursos. |
| **G3** | Test: NavigationLogStreamer | `src/services/obscura/navigation-logger.test.ts` | Mock de PageHandle events. Verificar: (1) transforma CDP → NavigationLogEntry, (2) publica en EventBus, (3) debounce funciona. |
| **G4** | Test: EventBus | `src/services/event-bus.test.ts` | Verificar publish/subscribe/unsubscribe. Verificar que no hay memory leaks (listeners se limpian). |
| **G5** | Test: url-validator | `src/services/obscura/url-validator.test.ts` | URLs bloqueadas retornan false. URLs legítimas retornan true. Edge cases: IPv6, punycode, encoded chars. |
| **G6** | Test: scrapeWebsiteTool integración | `src/tools/scraping.test.ts` | ObscuraClient mockeado. Verificar output JSON estructurado. Verificar feature flag retorna mock. Verificar URL inválida retorna error sin navegar. |
| **G7** | Test E2E: navegación completa | `tests/e2e/obscura-navigation.test.ts` | Requiere Obscura local (Docker). Trigger `scrapeWebsiteTool` → verificar: (1) contenido extraído no es vacío, (2) evento SSE emitido en EventBus, (3) NavigationLogEntries tienen timestamps. |

---

## 5. Casos de Prueba para el Tester

> El Tester debe validar estos escenarios **después** de que el Ejecutor complete las fases A-G.

### 5.1 Navegación Básica

| ID | Caso | Input | Resultado Esperado |
|---|---|---|---|
| **T01** | Navegar a sitio público | URL: `https://www.tesla.com` | Contenido extraído incluye "Tesla" y texto relevante. No error. `content_length > 0`. |
| **T02** | Navegar a LinkedIn sin bloqueo | URL: `https://www.linkedin.com/company/tesla` | Retorna contenido parcial (puede ser login wall), pero NO error de timeout ni conexión rechazada. El browser no es bloqueado por anti-bot básico. |
| **T03** | Navegar a URL inexistente | URL: `https://esto-no-existe-xyz-9999.com` | Retorna `{ error: "...", content: null }`. No crash. No excepción no manejada. |
| **T04** | Navegar a URL bloqueada (SSRF) | URL: `http://169.254.169.254/latest/meta-data` | Retorna error de validación **antes** de navegar. No se abre página. |
| **T05** | Timeout de navegación | URL de un sitio extremadamente lento (o mock) | Retorna error de timeout después de `OBSCURA_NAVIGATION_TIMEOUT` ms. Página se cierra correctamente. |

### 5.2 Feature Flag y Rollback

| ID | Caso | Config | Resultado Esperado |
|---|---|---|---|
| **T06** | Mock activo con flag off | `FEATURE_OBSCURA_ENABLED=false` | `scrape_website` retorna texto simulado (mock original). No intenta conectar a CDP. |
| **T07** | Flag on con Obscura caído | `FEATURE_OBSCURA_ENABLED=true`, sidecar no corre | Retorna error de conexión CDP. No crash del Orquestador. Health check reporta degraded. |
| **T08** | Toggle en caliente | Cambiar flag de true→false sin redeploy | Siguiente invocación usa mock. (Nota: requiere lectura de env en cada invocación, no al inicio.) |

### 5.3 SSE y Logs de Navegación

| ID | Caso | Acción | Resultado Esperado |
|---|---|---|---|
| **T09** | Eventos SSE durante navegación | Conectar EventSource a `/api/events/prospects/:id`, trigger navegación | Recibir al menos 2 eventos `research.progress` (navigating + loaded). Cada evento tiene `timestamp`, `action`, `url`. |
| **T10** | Debounce de eventos | Navegar a sitio con muchos sub-recursos (CDN, tracking) | No más de 1 evento SSE por segundo. El cliente no se inunda. |
| **T11** | Cleanup al desconectar | Cerrar EventSource durante navegación activa | No memory leaks. Listeners del EventBus se limpian. No errores en logs del Orquestador. |

### 5.4 Límites y Concurrencia

| ID | Caso | Acción | Resultado Esperado |
|---|---|---|---|
| **T12** | Máximo de páginas | Invocar `scrape_website` 4 veces simultáneamente (max=3) | Primeras 3 navegan. La 4ª recibe error "max pages reached" o espera hasta que una se libere. |
| **T13** | Contenido truncado | Navegar a página con >10K chars de texto | El campo `content` tiene exactamente 8192 chars. `content_length` refleja el tamaño real. |
| **T14** | Sanitización de output | Navegar a página con scripts/styles inline | `textContent()` retorna solo texto visible — no HTML, no `<script>`, no `<style>`. |

### 5.5 Nodo Investigador (E2E Graph)

| ID | Caso | Input | Resultado Esperado |
|---|---|---|---|
| **T15** | Ruta investigador en el grafo | Mensaje de prospecto: "Somos de acme.com, tenemos 50 camiones" | Gatekeeper rutea a Investigador → navega `acme.com` → extrae info → pasa contexto al SDR → SDR responde con conocimiento del sitio. |
| **T16** | research.completed emitido | Mismo trigger que T15 | Evento `research.completed` publicado en EventBus con artifacts: `{ company_info, signals, sources }`. |
| **T17** | Investigador con URL fallida | Prospecto dice "somos de sitio-caido.com" | Investigador marca la fuente como fallida, continúa con otras fuentes. No bloquea el flujo. |

### 5.6 Infraestructura Cloud Run

| ID | Caso | Validación |
|---|---|---|
| **T18** | Deploy multi-container staging | `service.yaml` aplicado. Ambos containers arrancan. Startup probes pasan. |
| **T19** | Sidecar health | TCP 9222 accesible desde el container del Orquestador. `obscuraClient.healthCheck()` retorna true. |
| **T20** | Cold start total | Desde 0 instancias, primer request tarda <10s (Obscura <2s + Orquestador <5s). |
| **T21** | Recursos dentro de límites | Bajo carga (3 navegaciones concurrentes), RAM total no excede 1.5 GiB. No OOM kills. |

---

## 6. Dependencias y Riesgos

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Obscura no soporta CDP completo | Media | Alto | Verificar compatibilidad en Fase A (task A4). Si falla, evaluar `chromedp` o Puppeteer ligero como fallback. |
| LinkedIn bloquea headless browser | Alta | Medio | Fase futura: fingerprinting evasion (User-Agent rotation, viewport random). Para B34: aceptar contenido parcial (login wall). |
| Cloud Run multi-container tiene limitaciones | Baja | Alto | Ya validado en producción (GA desde 2023). Startup probes manejan orden de arranque. |
| RAM del sidecar excede 512 Mi | Media | Medio | Monitorear en staging. Si excede: subir a 768 Mi o reducir `maxPages` a 2. |
| EventBus pierde eventos bajo carga | Baja | Bajo | In-memory EventEmitter es síncrono dentro del process. Solo se pierden si el subscriber es lento → el debounce lo cubre. |

---

## 7. Definición de Done (Bloque 34)

- [ ] Módulo `src/services/obscura/` completo con client, page, types, url-validator, navigation-logger, index.
- [ ] `src/services/event-bus.ts` funcional con publish/subscribe.
- [ ] `src/tools/scraping.ts` usa Obscura real con feature flag de rollback.
- [ ] `src/routes/events.ts` integrado con EventBus para eventos `research.progress`.
- [ ] `src/nodes/investigador.ts` integrado al grafo LangGraph.
- [ ] `service.yaml` multi-container creado y desplegable.
- [ ] Variables de entorno documentadas en `.env.example`.
- [ ] Tests unitarios pasan (G1-G6).
- [ ] Test E2E pasa con Obscura local en Docker (G7).
- [ ] Deploy exitoso a staging con ambos containers corriendo.
- [ ] Al menos T01, T02, T06, T09, T18 validados por el Tester.

---

## 8. Relación con Documentos Previos

| Documento | Relación |
|---|---|
| **RFC-058** | Este PRD ejecuta la arquitectura definida en RFC-058 (Fases 2A + inicio de 2B). |
| **POST_MORTEM_BLOQUE32** | Dictaminó adopción de Obscura. Este bloque lo materializa. |
| **PRD-BLOQUE33** | SSE integrations. Los schemas `research.progress` / `research.completed` ya existen. Este bloque los conecta a un browser real. |
| **ADR-101** | `cpu-throttling: false` requerido para el sidecar. Ya habilitado. |
| **ADR-097** | Single-tenant. Deploy multi-container sigue siendo single-tenant. |

---

**Inicio de ejecución autorizado.** El Ejecutor debe comenzar por la Fase A (scaffold del módulo Obscura).
