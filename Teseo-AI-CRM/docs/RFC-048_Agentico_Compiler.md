# RFC-048: CRM Agéntico Compiler — Microservicio Python de Compilación Documental

| Campo | Valor |
|---|---|
| **ID** | RFC-048 |
| **Estado** | Borrador |
| **Fecha** | 2026-04-23 |
| **Autor** | Builder (Teseo Squad) |
| **Bloque** | 10 — Fase 3 (Compilador RAG) |
| **Dominio** | Backend / Python / Procesamiento Documental |
| **Dependencias Upstream** | ADR-145 (Upload Pipeline), RFC-047 (Gestor Documental), RFC-001 (KDB Compiler), RFC-002 (Destilador), ADR-097 (Single-Tenant) |
| **Repositorio Destino** | `/Users/teseohome/projects/Teseo-AI-CRM/crm-agentico-compiler` |

---

## 0. Ley Marcial Documental — Aplicación

> Todo documento que ingrese al perímetro del sistema es tratado como **hostil hasta demostrar lo contrario**.

Se aplican las siguientes restricciones inalterables:

| Regla | Implementación en este RFC |
|---|---|
| **Zero-Trust sobre archivos externos** | Validación de MIME type real (magic bytes), no solo extensión. Sandbox de procesamiento en `/tmp` efímero. |
| **Sanitización obligatoria** | Stripping de metadatos (EXIF, revisiones OOXML, JS embebido en PDFs). Capa de texto pura extraída; objetos embebidos descartados. |
| **Idempotencia por checksum** | SHA-256 del contenido binario calculado pre-procesamiento. Si el hash ya existe en `documents`, se rechaza el re-procesamiento (estado `ready` preservado). |
| **Aislamiento de Tenant** | Toda operación valida `tenant_id` del payload contra el path del Storage. Cross-tenant access = error fatal + log de auditoría. |
| **Tamaño máximo** | 10 MB hard-limit validado por el backend (ADR-145). El compiler re-valida como segunda línea de defensa. |
| **Timeout de procesamiento** | 120s hard-kill por documento. Si excede, estado → `error` con mensaje descriptivo. |
| **Sin persistencia local** | Archivos temporales en `/tmp` eliminados en bloque `finally`. Cloud Run no preserva disco entre invocaciones. |

---

## 1. Contexto y Problema

El ecosistema CRM Agéntico necesita un **motor de compilación** que transforme documentos crudos (PDFs, TXT, CSV, DOCX) cargados por los tenants en **chunks vectorizados** almacenados en `tenant_memories` (pgvector). 

**Estado actual:**
- El frontend (`crm-agentico-panel`) ya sube archivos al bucket `asset_snapshots_bucket` de Supabase Storage (ADR-145).
- La migración `20260421230000_asset_studio_documents.sql` crea la tabla `documents` con enum de estados (`processing`, `ready`, `error`).
- La tabla `tenant_memories` ya existe con pgvector habilitado (768 dimensiones, Gemini `text-embedding-004`).
- Se diseñó un trigger `pg_net` que dispara un `POST` asíncrono al compilador cuando se inserta un documento con estado `processing` (RFC Storage Sync, Fase 2).

**Lo que falta:** El microservicio Python que recibe ese webhook, descarga el documento, lo procesa y lo inyecta en la base vectorial.

---

## 2. Objetivo

Diseñar la arquitectura del microservicio `crm-agentico-compiler` como un servicio FastAPI stateless desplegable en **Google Cloud Run**, que:

1. Reciba webhooks POST de `pg_net` con el payload `{document_id, tenant_id, file_path, status}`.
2. Descargue el archivo desde Supabase Storage (autenticado con `service_role` key).
3. Extraiga texto (OCR para imágenes/scans, parsing directo para PDFs con texto, lectura directa para TXT/CSV/DOCX).
4. Divida el texto en chunks semánticos (portando la lógica de `gbrain` semantic chunker).
5. Genere embeddings vectoriales (768d, Gemini `text-embedding-004`).
6. Haga UPSERT en `tenant_memories` vinculando cada chunk con su `document_id` padre.
7. Actualice el estado del documento a `ready` o `error`.

**Lo que NO hace este RFC:** Escribir código. Solo diseña la arquitectura, contratos, estructura de carpetas, y el WBS para el Ejecutor.

---

## 3. Arquitectura de Alto Nivel

```
┌──────────────────┐    INSERT con status='processing'
│  crm-agentico-   │──────────────────────────────────┐
│  panel (Next.js) │                                   │
└──────────────────┘                                   ▼
                                              ┌────────────────┐
                                              │   Supabase DB  │
                                              │  (documents)   │
                                              │                │
                                              │  pg_net trigger │
                                              └───────┬────────┘
                                                      │ POST /webhook/process-document
                                                      ▼
                                          ┌───────────────────────┐
                                          │  crm-agentico-compiler │
                                          │  (FastAPI / Cloud Run) │
                                          │                        │
                                          │  1. Validar payload    │
                                          │  2. Descargar archivo  │
                                          │  3. Extraer texto      │
                                          │  4. Chunking semántico │
                                          │  5. Embeddings         │
                                          │  6. UPSERT pgvector    │
                                          │  7. Update status      │
                                          └───────────────────────┘
                                                      │
                                     ┌────────────────┼────────────────┐
                                     ▼                ▼                ▼
                              ┌────────────┐  ┌─────────────┐  ┌────────────────┐
                              │  Supabase  │  │  Supabase   │  │ Gemini API     │
                              │  Storage   │  │  DB         │  │ (Embeddings)   │
                              │  (descarga)│  │  (pgvector) │  │ text-embed-004 │
                              └────────────┘  └─────────────┘  └────────────────┘
```

---

## 4. Estructura del Proyecto

```
crm-agentico-compiler/
├── Dockerfile
├── pyproject.toml                  # Dependencias (uv/pip)
├── README.md
├── .env.example
├── .dockerignore
│
├── app/
│   ├── __init__.py
│   ├── main.py                     # FastAPI app factory, lifespan, health
│   ├── config.py                   # Settings (Pydantic BaseSettings, env vars)
│   │
│   ├── api/
│   │   ├── __init__.py
│   │   ├── health.py               # GET /health, GET /ready
│   │   └── webhook.py              # POST /webhook/process-document
│   │
│   ├── services/
│   │   ├── __init__.py
│   │   ├── downloader.py           # Descarga desde Supabase Storage
│   │   ├── extractor.py            # Dispatcher: PDF→text, DOCX→text, TXT, CSV, OCR
│   │   ├── chunker.py              # Chunking semántico (port de gbrain)
│   │   ├── embedder.py             # Cliente Gemini text-embedding-004
│   │   └── ingester.py             # UPSERT en tenant_memories + update documents
│   │
│   ├── extractors/                 # Estrategias de extracción por tipo
│   │   ├── __init__.py
│   │   ├── pdf_extractor.py        # PyMuPDF (fitz) + fallback OCR
│   │   ├── docx_extractor.py       # python-docx
│   │   ├── txt_extractor.py        # Detección encoding (chardet)
│   │   ├── csv_extractor.py        # Conversión tabular → markdown
│   │   └── ocr_extractor.py        # Tesseract / Google Vision API (futuro)
│   │
│   ├── models/
│   │   ├── __init__.py
│   │   └── schemas.py              # Pydantic models: WebhookPayload, ChunkResult, etc.
│   │
│   ├── security/
│   │   ├── __init__.py
│   │   ├── sanitizer.py            # Stripping metadatos, validación magic bytes
│   │   └── auth.py                 # Validación de webhook secret (HMAC o bearer)
│   │
│   └── utils/
│       ├── __init__.py
│       ├── hashing.py              # SHA-256 checksum
│       └── tempfiles.py            # Context manager para cleanup de /tmp
│
└── tests/
    ├── __init__.py
    ├── conftest.py
    ├── test_webhook.py
    ├── test_extractor.py
    ├── test_chunker.py
    └── test_ingester.py
```

---

## 5. Contratos y Modelos de Datos

### 5.1 Webhook Payload (Entrada — desde `pg_net`)

```python
class WebhookPayload(BaseModel):
    document_id: UUID
    tenant_id: UUID
    file_path: str          # Path relativo en Supabase Storage
    status: str             # Siempre 'processing' al llegar

    @field_validator("status")
    def must_be_processing(cls, v):
        if v != "processing":
            raise ValueError("Solo se procesan documentos en estado 'processing'")
        return v
```

### 5.2 Webhook Response

```python
# Respuesta inmediata (< 3s para evitar timeout de pg_net)
class WebhookResponse(BaseModel):
    accepted: bool
    document_id: UUID
    message: str            # "Procesamiento encolado" o razón de rechazo
```

### 5.3 Chunk Result (Interno)

```python
class ChunkResult(BaseModel):
    content: str
    metadata: dict          # {"source": file_path, "page": int, "chunk_index": int}
    checksum: str           # SHA-256 del content
    embedding: list[float]  # 768 dimensiones
```

### 5.4 Tabla `documents` — Estados

```
processing → ready    (éxito)
processing → error    (fallo con error_message)
```

No existe transición `error → processing` automática. El retry es manual (re-trigger desde el panel).

---

## 6. Flujo de Procesamiento Detallado

### 6.1 Recepción del Webhook (`webhook.py`)

1. Recibir `POST /webhook/process-document`.
2. Validar autenticación (header `Authorization: Bearer <WEBHOOK_SECRET>` o `X-Webhook-Secret`).
3. Parsear body con `WebhookPayload`.
4. **Responder HTTP 202 Accepted inmediatamente** (no bloquear a `pg_net`).
5. Lanzar procesamiento en `BackgroundTasks` de FastAPI.

> **Decisión crítica:** El procesamiento es asíncrono respecto al HTTP response. `pg_net` tiene timeout corto (~5s). Responder rápido es obligatorio.

### 6.2 Pipeline de Procesamiento (Background Task)

```python
async def process_document(payload: WebhookPayload):
    try:
        # 1. Checksum guard — verificar si ya fue procesado
        doc = await db.get_document(payload.document_id)
        if doc.status == "ready":
            return  # Idempotente

        # 2. Descargar archivo desde Supabase Storage
        file_bytes = await downloader.fetch(payload.file_path)

        # 3. Calcular SHA-256
        checksum = compute_sha256(file_bytes)

        # 4. Validar integridad (magic bytes, tamaño)
        sanitizer.validate(file_bytes, doc.file_type)

        # 5. Extraer texto según tipo
        text = await extractor.extract(file_bytes, doc.file_type)

        # 6. Chunking semántico
        chunks = await chunker.chunk(text, embed_fn=embedder.embed_batch)

        # 7. Generar embeddings para todos los chunks
        embeddings = await embedder.embed_batch([c.content for c in chunks])

        # 8. UPSERT en tenant_memories
        await ingester.upsert_chunks(
            document_id=payload.document_id,
            tenant_id=payload.tenant_id,
            chunks=chunks,
            embeddings=embeddings,
            source_path=payload.file_path,
        )

        # 9. Marcar documento como ready
        await db.update_document_status(payload.document_id, "ready")

    except Exception as e:
        await db.update_document_status(
            payload.document_id, "error", error_message=str(e)[:500]
        )
        logger.error(f"Document {payload.document_id} failed: {e}")
    finally:
        # 10. Limpiar archivos temporales
        cleanup_temp(payload.document_id)
```

### 6.3 Descarga desde Supabase Storage (`downloader.py`)

- Usar **Supabase Python SDK** (`supabase-py`) con `service_role` key.
- Endpoint: `storage.from_("asset_snapshots_bucket").download(file_path)`.
- **Validación de tenant:** Verificar que `file_path` comience con `{tenant_id}/` antes de descargar.
- Timeout de descarga: 30s.
- Guardar en `/tmp/{document_id}/{filename}`.

> **Nota sobre buckets:** ADR-145 unificó a `asset_snapshots_bucket`. La migración legacy `20260421230000` aún referencia `tenant_documents`. El Ejecutor debe verificar consistencia.

### 6.4 Extracción de Texto (`extractor.py` + `extractors/`)

Patrón **Strategy** — un dispatcher que selecciona el extractor correcto:

| MIME Type | Extractor | Librería | Notas |
|---|---|---|---|
| `application/pdf` | `PdfExtractor` | `PyMuPDF` (fitz) | Extrae texto por página. Si una página tiene <30 chars, marca como candidata a OCR. |
| `application/vnd.openxmlformats-officedocument.wordprocessingml.document` | `DocxExtractor` | `python-docx` | Preserva estructura de headings y tablas → Markdown. |
| `text/plain` | `TxtExtractor` | `chardet` + stdlib | Auto-detecta encoding. Normaliza a UTF-8. |
| `text/csv` | `CsvExtractor` | `pandas` (read_csv) | Convierte cada fila a texto tabular Markdown. |
| `image/*` (futuro) | `OcrExtractor` | `pytesseract` / Google Vision | Fase 2 del Compiler. No se implementa ahora. |

**Sanitización post-extracción:**
- Strip de caracteres de control (`\x00`-`\x08`, `\x0e`-`\x1f`).
- Normalización de whitespace.
- Rechazo si texto extraído < 10 caracteres (archivo vacío o corrupto → `error`).

### 6.5 Chunking Semántico (`chunker.py`)

Port de la lógica de `gbrain/src/core/chunkers/semantic.ts` a Python:

1. **Splitear en oraciones** (regex + heurísticas de puntuación).
2. **Embeddings por oración** (batch call a Gemini).
3. **Similitud coseno entre oraciones adyacentes**.
4. **Filtro Savitzky-Golay** (ventana 5, polinomio orden 3) para suavizar la curva de similitud.
5. **Detectar mínimos locales** → Fronteras temáticas.
6. **Agrupar oraciones** entre fronteras.
7. **Fallback:** Si el texto tiene ≤3 oraciones o el embedding falla, usar chunker recursivo (split por caracteres con overlap).

**Parámetros por defecto:**
- `chunk_size`: 300 tokens (~1200 chars).
- `chunk_overlap`: 50 tokens (~200 chars).

### 6.6 Generación de Embeddings (`embedder.py`)

- **Modelo:** `text-embedding-004` de Google Gemini (768 dimensiones, consistente con `tenant_memories`).
- **Batch size:** 100 textos por llamada (límite de la API).
- **Rate limiting:** Exponential backoff con jitter (máx 3 reintentos).
- **Routing:** Directo a la API de Google. En futuro, si se centraliza vía AI Gateway, solo cambiar la base URL en config.

### 6.7 Ingesta en pgvector (`ingester.py`)

- Conectar a Supabase DB con `asyncpg` (connection string desde env).
- **Operación:** Para cada chunk:
  ```sql
  INSERT INTO tenant_memories (tenant_id, content, metadata, embedding, document_id)
  VALUES ($1, $2, $3, $4::vector, $5)
  ON CONFLICT DO NOTHING;
  ```
- **Pre-limpieza:** Antes del UPSERT, eliminar chunks existentes del mismo `document_id` (re-procesamiento limpio):
  ```sql
  DELETE FROM tenant_memories WHERE document_id = $1;
  ```
- **Transacción única:** Wrap en transacción. Si falla el INSERT de algún chunk, rollback completo → estado `error`.

---

## 7. Configuración y Variables de Entorno

```env
# === Supabase ===
SUPABASE_URL=https://xxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbG...
SUPABASE_DB_URL=postgresql://postgres:xxx@db.xxx.supabase.co:5432/postgres

# === Webhook Security ===
WEBHOOK_SECRET=<shared-secret-con-pg_net>

# === Gemini Embeddings ===
GOOGLE_API_KEY=AIza...
EMBEDDING_MODEL=text-embedding-004
EMBEDDING_DIMENSIONS=768

# === Processing Limits ===
MAX_FILE_SIZE_MB=10
PROCESSING_TIMEOUT_SECONDS=120
CHUNK_SIZE=300
CHUNK_OVERLAP=50

# === Server ===
PORT=8080
LOG_LEVEL=info
ENVIRONMENT=production
```

**Pydantic Settings** (`config.py`) carga todo con validación tipada y defaults sensatos.

---

## 8. Seguridad

### 8.1 Autenticación del Webhook

El trigger `pg_net` debe enviar un header de autenticación. Dos opciones (el Ejecutor elige una):

- **Opción A — Bearer Token:** Header `Authorization: Bearer {WEBHOOK_SECRET}`. Simple, suficiente para comunicación interna.
- **Opción B — HMAC-SHA256:** Header `X-Webhook-Signature: sha256={hmac}` sobre el body. Más robusto contra replay.

**Recomendación:** Opción A para MVP. El secret se configura tanto en la función SQL de `pg_net` como en la variable de entorno del compiler.

### 8.2 Validación de Magic Bytes

No confiar en `file_type` del payload. Validar los primeros bytes del archivo descargado:

| Formato | Magic Bytes |
|---|---|
| PDF | `%PDF-` (0x25504446) |
| DOCX | `PK\x03\x04` (ZIP) |
| PNG | `\x89PNG` |
| JPEG | `\xFF\xD8\xFF` |

Si magic bytes no coinciden con `file_type` declarado → rechazar + `error`.

### 8.3 Path Traversal Prevention

El `file_path` del payload se sanitiza:
- Prohibir `..`, `~`, caracteres nulos.
- Must start with `{tenant_id}/`.
- Regex allowlist: `/^[a-f0-9-]+\/[a-zA-Z0-9._-]+$/`.

---

## 9. Observabilidad

| Señal | Implementación |
|---|---|
| **Logs** | `structlog` con formato JSON. Campos obligatorios: `document_id`, `tenant_id`, `step`, `duration_ms`. |
| **Métricas** | Contador de documentos procesados/fallidos. Histograma de duración. Exponer vía `/metrics` (Prometheus format) o Cloud Run built-in. |
| **Health checks** | `GET /health` → liveness (siempre 200). `GET /ready` → readiness (verifica conexión DB + Storage). |
| **Error tracking** | Log de `error_message` en tabla `documents`. Alertas opcionales vía Cloud Monitoring. |

---

## 10. Dependencias Python

```toml
[project]
name = "crm-agentico-compiler"
version = "0.1.0"
requires-python = ">=3.11"
dependencies = [
    "fastapi>=0.115",
    "uvicorn[standard]>=0.30",
    "pydantic>=2.0",
    "pydantic-settings>=2.0",
    "supabase>=2.0",
    "asyncpg>=0.29",
    "httpx>=0.27",
    "google-genai>=1.0",         # Gemini SDK para embeddings
    "PyMuPDF>=1.24",             # Extracción PDF (fitz)
    "python-docx>=1.1",          # Extracción DOCX
    "chardet>=5.0",              # Detección de encoding
    "pandas>=2.0",               # CSV parsing
    "numpy>=1.26",               # Cosine similarity, Savitzky-Golay
    "scipy>=1.12",               # savgol_filter
    "structlog>=24.0",           # Logging estructurado
    "python-magic>=0.4",         # Validación magic bytes
]

[project.optional-dependencies]
ocr = ["pytesseract>=0.3"]       # Fase 2 — OCR
dev = ["pytest>=8.0", "pytest-asyncio>=0.23", "httpx"]
```

---

## 11. Dockerfile

```dockerfile
FROM python:3.12-slim

WORKDIR /app

# System deps para PyMuPDF y python-magic
RUN apt-get update && apt-get install -y --no-install-recommends \
    libmagic1 \
    && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml .
RUN pip install --no-cache-dir .

COPY app/ ./app/

EXPOSE 8080

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8080"]
```

---

## 12. Despliegue en Cloud Run

| Parámetro | Valor |
|---|---|
| **Región** | `us-central1` (colocalizar con Supabase) |
| **CPU** | 2 vCPU (procesamiento de documentos es CPU-bound) |
| **Memoria** | 1 GiB |
| **Min instances** | 0 (scale-to-zero, cost-effective) |
| **Max instances** | 5 (limitar blast radius) |
| **Concurrency** | 1 (un documento por instancia para evitar contención de `/tmp`) |
| **Timeout** | 300s (margen sobre los 120s de procesamiento) |
| **CPU always allocated** | Sí (ADR-101: evitar CPU throttling durante background tasks) |
| **Ingress** | Internal + Cloud Load Balancing (o All si Supabase no puede rutear internamente) |

---

## 13. Consideraciones Futuras (No en este MVP)

- **OCR completo:** Integración de `pytesseract` o Google Vision API para documentos escaneados.
- **RAG Query API:** Endpoint de búsqueda semántica expuesto al Orquestador LangGraph.
- **Re-procesamiento masivo:** Endpoint `POST /admin/reprocess-all` para re-vectorizar cuando se cambie el modelo de embeddings.
- **Webhook de callback:** Notificar al panel vía SSE/Realtime cuando un documento termine de procesarse.
- **Multi-idioma:** Detección de idioma y selección de modelo de embedding optimizado.

---

## 14. Relación con RFCs Existentes

| RFC/ADR | Relación |
|---|---|
| RFC-001 (KDB Compiler) | Este RFC es la **materialización en Python** del diseño conceptual del Compilador. RFC-001 definía el flujo GCS→Pub/Sub; este RFC lo adapta a Supabase Storage→pg_net webhook. |
| RFC-002 (Destilador) | El Destilador original procesaba desde Telegram→GCS. Este compiler absorbe la responsabilidad de extracción de texto directamente, eliminando el paso intermedio de GCS/Markdown para el flujo de Asset Studio. |
| RFC-006 (RAG Node) | Consumer downstream. El RAG Node busca en `tenant_memories` lo que este compiler inyecta. |
| RFC-047 (Gestor Documental) | Define la tabla `documents` y el flujo UI. Este RFC es su backend de procesamiento. |
| ADR-145 (Upload Pipeline) | Define las Fases 1-2 (frontend + DB trigger). Este RFC es la **Fase 3**. |
| ADR-097 (Single-Tenant) | El compiler se despliega por tenant (una instancia Cloud Run por cliente). Las env vars son tenant-specific. |

---

## 15. Work Breakdown Structure (WBS)

> Granular, numerado, secuencial. Listo para ingestión por el Ejecutor.
> Convención: `[ ]` = pendiente. Cada item es una unidad atómica de trabajo.

### Fase 1: Scaffold del Proyecto

```
1.1  [ ] Crear directorio /Users/teseohome/projects/Teseo-AI-CRM/crm-agentico-compiler/
1.2  [ ] Crear pyproject.toml con todas las dependencias listadas en §10
1.3  [ ] Crear .env.example con todas las variables de §7
1.4  [ ] Crear .dockerignore (excluir __pycache__, .env, .venv, tests/, .git)
1.5  [ ] Crear Dockerfile según §11
1.6  [ ] Crear README.md mínimo (nombre, propósito, instrucciones de ejecución local)
1.7  [ ] Crear estructura de carpetas vacía: app/, app/api/, app/services/, app/extractors/, app/models/, app/security/, app/utils/, tests/
1.8  [ ] Crear todos los __init__.py necesarios
```

### Fase 2: Configuración y Bootstrap

```
2.1  [ ] Implementar app/config.py — Pydantic BaseSettings cargando todas las env vars de §7 con validación tipada y defaults
2.2  [ ] Implementar app/main.py — FastAPI app factory con lifespan (startup: verificar conexión DB; shutdown: cerrar pools)
2.3  [ ] Implementar app/api/health.py — GET /health (liveness, siempre 200) y GET /ready (readiness: ping DB + ping Storage)
2.4  [ ] Registrar el router de health en main.py
2.5  [ ] Verificar que `uvicorn app.main:app --port 8080` levanta sin errores
```

### Fase 3: Seguridad y Validación del Webhook

```
3.1  [ ] Implementar app/security/auth.py — Dependency de FastAPI que extrae y valida el Bearer token del header Authorization contra WEBHOOK_SECRET
3.2  [ ] Implementar app/models/schemas.py — WebhookPayload (con field_validator de status='processing'), WebhookResponse, ChunkResult según §5
3.3  [ ] Implementar app/security/sanitizer.py — Función validate_magic_bytes(file_bytes, declared_type) usando python-magic. Tabla de magic bytes de §8.2
3.4  [ ] Implementar app/security/sanitizer.py — Función sanitize_file_path(file_path, tenant_id) con regex allowlist y validación de prefijo tenant_id/ según §8.3
3.5  [ ] Implementar app/utils/hashing.py — Función compute_sha256(data: bytes) → str
3.6  [ ] Implementar app/utils/tempfiles.py — Context manager async que crea /tmp/{document_id}/ y lo elimina en __aexit__ (bloque finally)
```

### Fase 4: Servicio de Descarga

```
4.1  [ ] Implementar app/services/downloader.py — Clase SupabaseDownloader con método fetch(file_path: str) → bytes
4.2  [ ] Usar supabase-py con service_role key para autenticarse
4.3  [ ] Descargar desde bucket 'asset_snapshots_bucket'
4.4  [ ] Validar que file_path inicia con tenant_id/ antes de descargar (llamar a sanitize_file_path)
4.5  [ ] Timeout de descarga: 30s (httpx timeout)
4.6  [ ] Escribir test: test_downloader.py — mock de supabase storage, verificar que descarga y que rechaza paths inválidos
```

### Fase 5: Extractores de Texto

```
5.1  [ ] Implementar app/extractors/pdf_extractor.py — Usa PyMuPDF (fitz). Itera páginas, extrae texto. Si una página tiene <30 chars, marcarla como "needs_ocr" en metadata (no procesar OCR ahora)
5.2  [ ] Implementar app/extractors/docx_extractor.py — Usa python-docx. Extraer párrafos preservando headings. Convertir tablas a formato Markdown
5.3  [ ] Implementar app/extractors/txt_extractor.py — Detectar encoding con chardet. Decodificar a UTF-8. Normalizar line endings
5.4  [ ] Implementar app/extractors/csv_extractor.py — Leer con pandas. Convertir a texto tabular Markdown (header + filas)
5.5  [ ] Implementar app/services/extractor.py — Dispatcher/Strategy que mapea MIME type → extractor correcto (tabla de §6.4). Post-sanitización: strip control chars, validar min 10 chars
5.6  [ ] Implementar app/extractors/ocr_extractor.py — Stub que levanta NotImplementedError("OCR no disponible en MVP. Fase 2 del Compiler.")
5.7  [ ] Escribir tests: test_extractor.py — fixtures con archivos de prueba (PDF con texto, TXT utf-8, CSV simple). Verificar texto extraído
```

### Fase 6: Chunker Semántico

```
6.1  [ ] Implementar app/services/chunker.py — Port del algoritmo de gbrain/src/core/chunkers/semantic.ts:
         - split_sentences(text) → list[str]
         - embed_sentences(sentences, embed_fn) → list[ndarray]
         - cosine_similarities(embeddings) → list[float]
         - savitzky_golay_filter(similarities, window=5, order=3) → list[float]
         - find_local_minima(smoothed) → list[int]
         - group_sentences(sentences, boundaries) → list[str]
6.2  [ ] Implementar fallback a chunker recursivo (split por caracteres con overlap) cuando oraciones ≤ 3 o embedding falle
6.3  [ ] Parámetros configurables desde config: CHUNK_SIZE (default 300), CHUNK_OVERLAP (default 50)
6.4  [ ] Escribir tests: test_chunker.py — texto largo conocido, verificar que produce chunks dentro del rango de tamaño esperado y que el fallback funciona
```

### Fase 7: Servicio de Embeddings

```
7.1  [ ] Implementar app/services/embedder.py — Clase GeminiEmbedder con método embed_batch(texts: list[str]) → list[list[float]]
7.2  [ ] Usar google-genai SDK, modelo configurable (default: text-embedding-004)
7.3  [ ] Batch de máximo 100 textos por llamada API. Si hay más, dividir en sub-batches
7.4  [ ] Exponential backoff con jitter (max 3 reintentos) para 429/5xx
7.5  [ ] Validar que cada embedding tiene exactamente EMBEDDING_DIMENSIONS (768) dimensiones
7.6  [ ] Escribir test: test_embedder.py — mock de la API, verificar batching y dimensiones
```

### Fase 8: Ingesta en pgvector

```
8.1  [ ] Implementar app/services/ingester.py — Clase PgVectorIngester
8.2  [ ] Método upsert_chunks(): Conectar con asyncpg usando SUPABASE_DB_URL
8.3  [ ] Pre-limpieza: DELETE FROM tenant_memories WHERE document_id = $1 (dentro de transacción)
8.4  [ ] INSERT batch de chunks con tenant_id, content, metadata (source, page, chunk_index), embedding::vector, document_id
8.5  [ ] Wrap en transacción única — si falla un chunk, rollback completo
8.6  [ ] Método update_document_status(document_id, status, error_message=None) — UPDATE documents SET status=$2, error_message=$3 WHERE id=$1
8.7  [ ] Escribir test: test_ingester.py — mock de asyncpg, verificar SQL generado y manejo de transacciones
```

### Fase 9: Orquestador del Webhook (Pipeline Completo)

```
9.1  [ ] Implementar app/api/webhook.py — POST /webhook/process-document
9.2  [ ] Inyectar dependency de auth (§3.1)
9.3  [ ] Parsear body como WebhookPayload
9.4  [ ] Responder HTTP 202 Accepted inmediatamente con WebhookResponse
9.5  [ ] Lanzar process_document() en BackgroundTasks de FastAPI
9.6  [ ] Implementar process_document() siguiendo el pseudocódigo de §6.2 (10 pasos: checksum guard → download → validate → extract → chunk → embed → upsert → update status → cleanup)
9.7  [ ] Wrap completo en try/except/finally — cualquier excepción no capturada → update status 'error'
9.8  [ ] Registrar el router de webhook en main.py
```

### Fase 10: Integración y Verificación Local

```
10.1  [ ] Crear archivo tests/conftest.py con fixtures comunes (mock supabase, mock gemini, test DB)
10.2  [ ] Ejecutar suite completa de tests con pytest
10.3  [ ] Probar manualmente: levantar uvicorn, enviar POST a /webhook/process-document con curl y payload de prueba
10.4  [ ] Verificar que el pipeline completo funciona end-to-end contra Supabase real (staging)
10.5  [ ] Validar que /health y /ready responden correctamente
10.6  [ ] Build del Docker image: docker build -t crm-agentico-compiler .
10.7  [ ] Run del contenedor: docker run -p 8080:8080 --env-file .env crm-agentico-compiler
10.8  [ ] Smoke test del contenedor con curl
```

### Fase 11: Conexión con Supabase Trigger

```
11.1  [ ] Verificar que la migración SQL del trigger pg_net (RFC Storage Sync §3) incluye el header Authorization con WEBHOOK_SECRET
11.2  [ ] Si no existe, crear nueva migración: ALTER FUNCTION notify_crm_compiler() para incluir headers:= '{"Content-Type":"application/json","Authorization":"Bearer <secret>"}'::jsonb
11.3  [ ] Verificar que la URL del webhook apunta al endpoint correcto del Cloud Run (o localhost para dev)
11.4  [ ] Test E2E: desde el panel, subir un documento → verificar que el trigger dispara → compiler procesa → documento pasa a status 'ready' → chunks aparecen en tenant_memories
```

---

**Fin del RFC-048.**

**Inicio de Ejecución Autorizado** — El Ejecutor puede proceder con la Fase 1 del WBS.
