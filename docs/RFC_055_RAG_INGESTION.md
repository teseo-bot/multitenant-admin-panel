# RFC-055: Arquitectura del Motor de Ingesta Multimodal RAG (Bloque 16)

## 1. Contexto y Objetivo
El Bloque 16 busca expandir las capacidades del Teseo AI CRM para procesar, destilar y almacenar de manera asíncrona información multimodal (texto, imágenes, audio y documentos) proveniente de diferentes canales (Telegram, HTTP Webhooks).

De acuerdo con el reporte del Learner, la infraestructura base ya existe:
- Tabla `tenant_memories` con `pgvector` y RLS habilitado.
- Cola de tareas `gbrain:learn` orquestada mediante `pg-boss` (`daemon.ts`).
- Uso de `text-embedding-004` (Google Gemini) para vectores.

**Objetivo:** Diseñar el flujo completo de ingesta, garantizando alta disponibilidad (fast-ack en el webhook), idempotencia, aislamiento multitenant y modularidad en los workers de destilación.

---

## 2. Topología y Flujo de Arquitectura

El flujo se divide en 3 capas bien delimitadas:

### Fase 1: Ingesta (Webhook / API Layer)
1. El Webhook (Telegram o API HTTP) recibe un mensaje con o sin adjuntos multimodales.
2. **Idempotencia:** Se genera un hash o se utiliza el `message_id` + `tenant_id` como clave única para evitar duplicidades.
3. Se sube el archivo original (raw) a un Cloud Storage Bucket (preservación de origen).
4. Se crea/actualiza un registro en la tabla `documents` con estado `pending` y la URL del archivo.
5. Se encola un trabajo en `pg-boss` (`gbrain:learn`) pasando el `document_id` y `tenant_id`.
6. El webhook retorna un código `200/202 Accepted` de inmediato (Fast-Ack).

### Fase 2: Procesamiento Asíncrono (`gbrain:learn` Worker)
1. `daemon.ts` consume la tarea de `pg-boss`.
2. Actualiza el estado del documento en DB a `processing`.
3. Según el `mime_type` del documento, redirige el flujo al **Motor de Destilación** (handlers específicos).

### Fase 3: Motor de Destilación y Embeddings
1. **Extracción:**
   - **Texto/PDFs:** PyMuPDF / Tika o extracción de texto directa.
   - **Imágenes:** Llamada a un modelo Vision (ej. Gemini 1.5 Pro) para OCR descriptivo / comprensión visual.
   - **Audio:** STT (Whisper) para transcripción.
2. **Chunking (Segmentación):** El texto resultante se divide en chunks semánticos (superposición controlada, retención de contexto).
3. **Embeddings:** Llamada al modelo `text-embedding-004` para cada chunk.
4. **Persistencia (Atomicidad):**
   - Se ejecuta limpieza previa: `DELETE FROM tenant_memories WHERE document_id = $1` (por si es un reintento).
   - Inserción masiva (bulk UPSERT) en `tenant_memories` (asociando `tenant_id`, `document_id` y el chunk).
5. Se actualiza el estado en `documents` a `ready` (o `failed` en caso de error persistente).

---

## 3. Diseño de la API (Idempotente)

La interfaz de ingesta HTTP deberá tener la siguiente firma para integraciones directas o desde el router del bot (LangGraph):

```http
POST /api/v1/ingest
Content-Type: application/json
Idempotency-Key: <unique-uuid-or-message-id>

{
  "tenant_id": "uuid",
  "source": "telegram",
  "external_id": "msg-44512",
  "payload": {
    "text": "Contexto opcional del mensaje...",
    "media": {
      "mime_type": "application/pdf",
      "url": "https://bucket.../raw_file.pdf",
      "size_bytes": 102400
    }
  }
}
```

**Respuesta Esperada:**
```json
// 202 Accepted
{
  "status": "accepted",
  "document_id": "uuid",
  "job_id": "pg-boss-job-uuid",
  "message": "Enqueued for processing"
}
```

---

## 4. WBS (Work Breakdown Structure) - Tareas para el Ejecutor

Estas tareas deberán ser implementadas paso a paso por el agente Ejecutor.

### [Task 1] Actualización del Esquema Relacional (`documents`)
- **Descripción:** Asegurar que la tabla `documents` contenga una columna `status` (`ENUM: pending, processing, ready, failed`), `source`, `external_id`, y `raw_file_url`.
- **Criterio de Aceptación:** Migración SQL (Drizzle/TypeORM/Supabase) creada y ejecutada de forma segura, respetando la FK existente hacia `tenant_id`.

### [Task 2] Endpoint de Ingesta y Fast-Ack (API Layer)
- **Descripción:** Implementar o refactorizar el webhook/API `/api/v1/ingest`.
- **Lógica:** Implementar verificación de idempotencia (consultando `external_id` en `documents`). Si no existe, crear el registro `pending`, subir a bucket si viene en Base64/Stream, e insertar la tarea en `pg-boss` (`gbrain:learn`).
- **Criterio de Aceptación:** El endpoint debe responder en <500ms retornando un código HTTP 202 y el identificador de la tarea.

### [Task 3] Worker de Orquestación (`daemon.ts`)
- **Descripción:** Refactorizar el consumer de `gbrain:learn` en `src/orchestrator/src/worker/daemon.ts` para manejar estados y enrutar.
- **Lógica:** Al arrancar el job, cambiar el status del documento a `processing`. Implementar un `switch` o `Strategy Pattern` en base al `mime_type` para delegar al handler de destilación correcto. Al finalizar, cambiar a `ready` o atrapar errores (`failed`).

### [Task 4] Motor de Destilación: Handlers Multimodales
- **Descripción:** Implementar las clases/funciones extractoras.
  - `TextHandler`: Extracción directa o parsing básico.
  - `VisionHandler`: Enviar la imagen/PDF-renderizado al modelo visual para extraer descripción/texto.
  - `AudioHandler`: Integración con la API de transcripción (Whisper o similar).
- **Criterio de Aceptación:** Cada handler recibe un input raw y retorna un string gigante de texto limpio.

### [Task 5] Chunking y Generación de Embeddings
- **Descripción:** Implementar un servicio de fragmentación (TextSplitter) y consumo de API vectorial.
- **Lógica:** Tomar el texto del handler, aplicar un `RecursiveCharacterTextSplitter` (o similar), e invocar al proveedor (`text-embedding-004`) para obtener los vectores de 768 dimensiones. Manejar rate limits.

### [Task 6] Persistencia Segura (`tenant_memories`)
- **Descripción:** Grabar los chunks y vectores generados.
- **Lógica:** Ejecutar una transacción: 
  1. `DELETE FROM tenant_memories WHERE document_id = [DOC_ID]`
  2. `INSERT INTO tenant_memories (tenant_id, document_id, content, embedding) VALUES ...` (Bulk insert).
- **Criterio de Aceptación:** Inserción exitosa comprobada a través de las RLS y sin duplicación de vectores por documento.

---
*Fin del RFC. Teseo puede tomar control para aprobar y delegar el WBS al Ejecutor.*