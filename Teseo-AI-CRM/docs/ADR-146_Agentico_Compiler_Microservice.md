# ADR-146: Implementación de Microservicio Python Stateless para Ingesta RAG

| Campo | Valor |
|---|---|
| **ID** | ADR-146 |
| **Fecha** | 2026-04-23 |
| **Estado** | Aceptado |
| **Dominio** | Backend / RAG / Python |
| **Autores** | Escuadrón Táctico (Teseo, Builder, Ejecutor, Tester, Reviewer) |

## Contexto
El ecosistema CRM Agéntico requería un motor de compilación asíncrono para transformar documentos crudos cargados por los tenants en el `asset_snapshots_bucket` hacia chunks vectorizados en `tenant_memories`. Las restricciones de `pg_net` (timeouts cortos, <5s) forzaban el diseño de un receptor externo que no bloqueara el trigger de la base de datos, mientras que la extracción (PyMuPDF) y vectorización (Gemini SDK) dictaban el uso de Python.

## Decisión
Se construyó el proyecto `crm-agentico-compiler` como un microservicio independiente y stateless en FastAPI, diseñado para despliegue en Google Cloud Run. 

**Decisiones Arquitectónicas Clave:**
1. **Asincronía Real:** El endpoint `POST /webhook/process-document` valida el JWT (`HTTPBearer`) y responde inmediatamente `HTTP 202 Accepted`, enviando el pipeline de procesamiento masivo a `BackgroundTasks`.
2. **Zero-Trust:** 
   - Aislamiento de disco efímero: Uso de `app/utils/tempfiles.py` (context manager) para procesar el binario en `/tmp/{document_id}` con limpieza garantizada en bloque `finally`.
   - Seguridad de paths: Validación criptográfica para asegurar que el prefijo del path descargado siempre corresponde al `tenant_id` declarado en el webhook.
3. **Extracción y Chunking:** Extracción con `fitz` (PDF), `python-docx` (Word) y `chardet` (TXT). El chunking porta la lógica gbrain (Savitzky-Golay + Mínimos Locales) complementado con chunking recursivo estricto como fallback.
4. **Vectorización y Transaccionalidad:** Uso del SDK `google-genai` (text-embedding-004, 768 dims, batches limitados a 100). Ingesta con `asyncpg` bajo un esquema puramente transaccional: limpieza pre-ingesta (`DELETE`) y bulk `UPSERT` en `tenant_memories`.

## Consecuencias Positivas
- **Desacoplamiento:** El frontend, Supabase y el compilador escalan de forma independiente.
- **Tolerancia a fallos:** El sistema no tumba la base de datos ni afecta al usuario si la extracción de un PDF falla (estado → `error`).

## Deuda Técnica Generada (Next Sprint Actionables)
Aprobado con observaciones no bloqueantes (Reporte Reviewer):
- **H-1/H-2:** Dependencias ocultas transitivas (`tenacity` no explícito, `scikit-learn` faltante en el `uv.lock` local).
- **H-3:** El contenedor ejecuta Uvicorn como `root` interno en lugar de crear un usuario restringido.
- **H-4:** Resto de sentencias `print()` en vez de `structlog` en `chunker.py`.
- **H-5:** Ausencia de `.gitignore` en la raíz del proyecto.