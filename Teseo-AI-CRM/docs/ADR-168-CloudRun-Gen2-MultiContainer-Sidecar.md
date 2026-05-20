# ADR-168: Adopción del Patrón Cloud Run Gen2 Multi-Container Sidecar

| Campo | Valor |
|---|---|
| **Estado** | Aceptada |
| **Fecha** | 2026-04-25 |
| **Autor** | Builder (Teseo Squad) |
| **Bloque** | 34 |
| **Servicios Afectados** | `crm-agentico-orchestrator` + Obscura sidecar |
| **Dependencias** | ADR-101 (CPU Throttling Off), RFC-058 (Obscura Migration), PRD-BLOQUE34 |

---

## 1. Contexto

El Orquestador (`crm-agentico-orchestrator`) necesita un motor de navegación headless real (Obscura) para habilitar el nodo Investigador del grafo LangGraph. Las opciones eran: (a) desplegar Obscura como microservicio separado en Cloud Run, o (b) desplegarlo como **sidecar container** dentro del mismo servicio.

Simultáneamente, el pipeline de CI/CD usaba `gcloud run deploy --image`, que solo permite un contenedor por servicio y no soporta la especificación Knative completa necesaria para multi-container.

## 2. Decisión

Adoptamos **Cloud Run Gen2 Multi-Container Sidecar** con despliegue declarativo vía `gcloud run services replace service.yaml`.

### 2.1 Topología de Contenedores

```
┌────────────────────── Cloud Run Service ──────────────────────┐
│                                                                │
│  ┌─────────────────────────┐    ws://127.0.0.1:9222 (CDP)    │
│  │  Sidecar: Obscura       │◄────────────────────────┐       │
│  │  Rust headless browser  │                          │       │
│  │  Port: 9222             │                          │       │
│  │  CPU: 1 vCPU, 512 Mi   │                          │       │
│  └─────────────────────────┘                          │       │
│                                                       │       │
│  ┌─────────────────────────────────────────────────┐  │       │
│  │  Principal: Orquestador (Hono + LangGraph)      │  │       │
│  │  Port: 3000                                     │  │       │
│  │  CPU: 2 vCPU, 1 Gi                             │  │       │
│  │  ObscuraClient ── CDP WebSocket ────────────────┘  │       │
│  │  NavigationLogStreamer ── EventBus ── SSE           │       │
│  └─────────────────────────────────────────────────┘          │
│                                                                │
│  Total: 3 vCPU, ~1.5 GiB RAM                                 │
└────────────────────────────────────────────────────────────────┘
```

### 2.2 Pipeline CI/CD — `services replace` con inyección dinámica

```
┌─────────┐    ┌──────────┐    ┌──────────────────┐    ┌──────────────────┐
│  Build   │───▶│  Push    │───▶│  Render YAML     │───▶│  services replace│
│  Docker  │    │  to GCR  │    │  sed placeholder  │    │  service.yaml    │
└─────────┘    └──────────┘    └──────────────────┘    └──────────────────┘
```

**`service.yaml`** contiene un placeholder `ORCHESTRATOR_IMAGE` que Cloud Build reemplaza vía `sed` con la URI inmutable `gcr.io/$PROJECT_ID/crm-agentico-orchestrator:$COMMIT_SHA` antes de invocar `gcloud run services replace`.

## 3. Justificación

### 3.1 ¿Por qué Sidecar en lugar de Microservicio Separado?

| Criterio | Sidecar (elegido) | Microservicio separado |
|---|---|---|
| **Latencia CDP** | < 1 ms (localhost) | 10–50 ms (red VPC interna) |
| **Complejidad de deploy** | Un solo `service.yaml` | Dos servicios, service discovery, auth S2S |
| **Costo** | Comparten instancia y billing | Instancia dedicada adicional |
| **Acoplamiento** | Natural — el browser ES del orquestador | Artificial — requiere contratos HTTP/gRPC |
| **Escalado** | 1:1 automático | Desincronización posible |
| **Feature flag / rollback** | `FEATURE_OBSCURA_ENABLED=false` → mock sin redeploy | Requiere cambio de routing |

### 3.2 ¿Por qué `services replace` en lugar de `run deploy`?

| Criterio | `gcloud run deploy --image` | `gcloud run services replace service.yaml` |
|---|---|---|
| **Multi-container** | ❌ No soportado | ✅ Nativo (Knative serving spec) |
| **Declarativo** | Imperativo, flags dispersos | YAML versionado en Git (GitOps-ready) |
| **Reproducibilidad** | Depende del estado CLI | Idempotente — mismo YAML = mismo resultado |
| **Annotations complejas** | Verboso con `--update-annotations` | Naturales en YAML |
| **Container dependencies** | No disponible | `container-dependencies` annotation |
| **Probes / liveness** | Flags limitados | Especificación completa de Knative |
| **Auditoría** | Difícil de reconstruir qué se deployó | `git log service.yaml` = historial completo |

### 3.3 ¿Por qué `sed` y no `envsubst`?

- `sed` está disponible en todas las imágenes de Cloud Build sin dependencias adicionales.
- Solo se reemplaza un placeholder (`ORCHESTRATOR_IMAGE`), no hay riesgo de colisión con variables de entorno del sistema.
- `envsubst` requiere `gettext` que no está garantizado en `gcr.io/cloud-builders/gcloud`.
- Para plantillas más complejas en el futuro, se puede migrar a `envsubst` o `kustomize` sin cambiar el patrón general.

## 4. Especificación Técnica

### 4.1 `service.yaml` — Campos Clave

```yaml
apiVersion: serving.knative.dev/v1
kind: Service
metadata:
  name: crm-agentico-orchestrator
  annotations:
    run.googleapis.com/launch-stage: BETA          # habilita multi-container
spec:
  template:
    metadata:
      annotations:
        run.googleapis.com/execution-environment: gen2
        run.googleapis.com/cpu-throttling: "false"
        run.googleapis.com/container-dependencies: '{"orchestrator":["obscura"]}'
    spec:
      containers:
        - name: orchestrator
          image: ORCHESTRATOR_IMAGE                 # ← placeholder
          ports: [{name: http1, containerPort: 3000}]
        - name: obscura
          image: ghcr.io/teseo-lat/obscura:latest
          ports: [{containerPort: 9222}]
```

**Notas:**
- `launch-stage: BETA` es requerido por GCP para habilitar sidecars en Cloud Run.
- `container-dependencies` garantiza que Obscura esté healthy (startup probe OK) antes de iniciar el orquestador.
- El port `http1` en el contenedor principal define el ingress; el sidecar solo expone puertos internos.

### 4.2 `cloudbuild.yaml` — Flujo de Inyección

```yaml
steps:
  - id: build       # docker build con tag $COMMIT_SHA + latest
  - id: push        # docker push --all-tags
  - id: render      # sed -i "s|ORCHESTRATOR_IMAGE|gcr.io/…:$COMMIT_SHA|g" service.yaml
  - id: deploy      # gcloud run services replace service.yaml --region us-central1
```

La imagen se pinea al `$COMMIT_SHA` completo (inmutable), no a `latest`, asegurando que cada deploy es trazable al commit exacto.

### 4.3 Feature Flags

| Flag | Default | Efecto |
|---|---|---|
| `FEATURE_OBSCURA_ENABLED` | `true` | `false` → el tool `scrape_website` usa el mock, sin tocar el sidecar |
| `FEATURE_SSE_NAVIGATION_LOGS` | `true` | `false` → no emite eventos `research.progress` vía SSE |

Los flags permiten rollback instantáneo sin redesplegar contenedores.

## 5. Consecuencias

### Positivas

- **Latencia mínima** — comunicación CDP por localhost, < 1 ms.
- **Un solo deploy atómico** — orquestador + browser se despliegan y escalan juntos.
- **GitOps** — `service.yaml` versionado = historial completo de la infraestructura.
- **Reproducibilidad** — image pinning por commit SHA; `services replace` es idempotente.
- **Rollback simple** — feature flag para el mock, `gcloud run services replace` con YAML anterior para infra.

### Negativas

- **Recursos compartidos** — si Obscura consume exceso de memoria, afecta al orquestador (mitigado con `resources.limits`).
- **Acoplamiento de ciclo de vida** — actualizar Obscura requiere redesplegar el servicio completo (aceptable dado el bajo cambio esperado).
- **Beta feature** — `launch-stage: BETA` implica que multi-container en Cloud Run aún no es GA en todas las regiones (mitigado: `us-central1` soporta GA desde 2024).

### Riesgos Mitigados

| Riesgo | Mitigación |
|---|---|
| Sidecar no arranca | `container-dependencies` + startup probes previenen tráfico al orquestador |
| Memory leak en Obscura | `resources.limits.memory: 512Mi` — OOM kill aislado al sidecar |
| Imagen corrupta | Pinning por `$COMMIT_SHA`; `latest` solo como conveniencia |
| Placeholder sin reemplazar | `set -euo pipefail` + `cat service.yaml` en paso render para validación visual en logs |

## 6. Alternativas Consideradas

### 6.1 Microservicio Obscura Separado
Rechazado. Agrega latencia de red (10–50 ms por call CDP), complejidad de service discovery, auth service-to-service, y desincronización de escalado. No justificado para un componente que es inherente al orquestador.

### 6.2 Puppeteer/Playwright Embebido en el Orquestador
Rechazado. Chromium pesa ~400 MB en la imagen Docker, tarda 2–5s en cold start, y consume ~300 MB de RAM. Obscura: ~15 MB binario, < 500 ms startup, ~50 MB RAM.

### 6.3 `gcloud run deploy` con `--add-container` flags
Rechazado. Imperativo, difícil de versionar, no soporta todas las annotations necesarias, y propenso a drift entre lo declarado y lo desplegado.

### 6.4 `kustomize` / Helm para templating
Considerado para el futuro. Actualmente `sed` es suficiente (un solo placeholder). Si el `service.yaml` crece con secretos, configmaps, o múltiples entornos (staging/prod), se evaluará `kustomize overlays`.

## 7. Referencias

- [RFC-058: Obscura Migration](./RFC-058-Obscura-Rust-Browser-Migration.md)
- [PRD-BLOQUE34: Obscura Sprint](./PRD-BLOQUE34-Obscura-Migration.md)
- [ADR-101: Cloud Run No CPU Throttling](./ADR-101_CloudRun_No_CPU_Throttling.md)
- [Google Cloud — Deploying multi-container services](https://cloud.google.com/run/docs/deploying#sidecars)
- [Knative Serving API spec](https://knative.dev/docs/reference/api/serving-api/)
