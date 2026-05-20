# RFC-047: Asset Studio - Gestor Documental (RAG Ingestion)

## 1. Contexto y Objetivo
El Gestor Documental (`/asset-studio/documents`) permite a los Tenants subir su base de conocimiento corporativo (PDFs, TXT, CSV) para que el Orquestador (LangGraph / RAG Node) pueda consumirlo mediante similitud vectorial.

## 2. Base de Datos y Storage (Builder)

### 2.1. Tabla `documents`
La migración `tenant_memories` (RFC-106) introdujo pgvector, pero necesitamos un registro padre que rastree el estatus de procesamiento de los archivos. Se creará la tabla `documents` y se vinculará con `tenant_memories` (chunks).

### 2.2. Supabase Storage
Se creará un Bucket privado llamado `tenant_documents` protegido por RLS (Row Level Security), asegurando que un Tenant solo pueda acceder a los archivos que subió.

## 3. Flujo de Ingesta (Upload & Chunking)

El flujo de procesamiento constará de dos etapas para evitar timeouts en Cloud Run / Next.js Edge:
1. **Síncrono (Frontend -> Backend):**
   - El cliente sube el archivo a Supabase Storage directamente o vía el route handler `POST /api/asset-studio/documents/upload`.
   - Se inserta un registro en la tabla `documents` con estatus `processing`.
2. **Asíncrono (LangGraph Ingestor o Worker):**
   - Un trigger (Webhook de Storage o cron) tomará el archivo, extraerá el texto, lo dividirá en Chunks, generará Embeddings y lo inyectará en `tenant_memories`.

## 4. Work Breakdown Structure (Ejecutor)

1. **DB Migration:** Inyectar el esquema de `documents` y actualizar `tenant_memories`.
2. **APIs:** Reubicar `/api/documents` a `/api/asset-studio/documents` y refactorizar para asegurar el bypass single-tenant/multi-tenant (RLS).
3. **UI Frontend:**
   - Crear `/app/(dashboard)/asset-studio/documents/page.tsx` con un área de Drag & Drop (usando `react-dropzone` o input file nativo) y una Tabla de datos (shadcn).
   - Componente de visualización de progreso.

---
**Inicio de Ejecución Autorizado.**
