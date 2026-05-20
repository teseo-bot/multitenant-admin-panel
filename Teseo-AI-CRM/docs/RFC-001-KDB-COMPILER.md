# RFC-001: KDB Compiler & Ingestion Pipeline

## 1. Resumen Ejecutivo
Este documento define la arquitectura y el diseño técnico del pipeline de ingesta y compilación para la Base de Conocimiento (KDB). El objetivo es procesar documentos entrantes, estructurarlos y vectorizarlos de manera eficiente, manteniendo una estricta separación de responsabilidades entre los sistemas transaccionales y de conocimiento.

## 2. Separación de Responsabilidades (SSOT)
Es crucial mantener una delimitación clara:
* **Odoo MCP:** Single Source of Truth (SSOT) **Transaccional**. Maneja flujos de negocio, estados y relaciones estructuradas.
* **pgvector (PostgreSQL):** Single Source of Truth (SSOT) de **Conocimiento No Estructurado**. Almacena los embeddings vectoriales y el contenido procesado para operaciones de Retrieval-Augmented Generation (RAG).

## 3. Arquitectura del Flujo de Datos

### 3.1 Fase de Ingesta
El flujo de captura de documentos sigue estos pasos:
1. **Carga:** Los usuarios cargan archivos directamente por **Telegram**.
2. **Destilador:** Se envía el documento a un servicio **Destilador** alojado en **Cloud Run**.
3. **Conversión:** El Destilador procesa el archivo original y lo convierte a formato **Markdown** estándar.
4. **Almacenamiento:** El archivo `.md` resultante se deposita en el **Bucket GCS del cliente** (Google Cloud Storage).

### 3.2 Compilador (Core RAG)
Una vez que el documento Markdown se almacena en GCS, arranca el procesamiento base:
1. **Trigger de Evento:** El depósito del archivo `.md` en GCS emite un evento vía **Pub/Sub**.
2. **Servicio Compilador:** Un servicio en **Cloud Run** ("Compilador") recibe el evento y se activa.
3. **Validación:** El Compilador lee el archivo `.md` y extrae/calcula su **checksum** para evitar el re-procesamiento innecesario y garantizar la idempotencia.
4. **Almacenamiento Vectorial:** Divide el documento en chunks y ejecuta un **UPSERT en pgvector**.

## 4. Benchmark e Implementación Técnica (Referencia Obligatoria)
Para la implementación técnica del proceso de chunking y almacenamiento vectorial, **no se deben inventar patrones desde cero**. Toda la implementación deberá basarse en la lógica validada del proyecto **gbrain**:
* **Chunking Semántico:** La división de los documentos debe seguir de manera estricta los patrones implementados en `/Users/teseohome/Documents/teseokdb/raw/gbrain/src/core/chunkers/semantic.ts`.
* **Integración pgvector:** El manejo optimizado de checksums y los UPSERTs rápidos en pgvector deberán basarse en el motor implementado en `/Users/teseohome/Documents/teseokdb/raw/gbrain/src/core/postgres-engine.ts`.

## 5. FinOps y Centralización
Para mantener el control financiero, auditoría y métricas de consumo:
* Todas las peticiones de vectorización de los chunks **deben pasar obligatoriamente por `fleetco-AI-gateway`**.
* El gateway se encargará de delegar las peticiones hacia **Vertex AI**, sirviendo como único punto de salida para la facturación de embeddings.

## 6. Work Breakdown Structure (WBS) - Ejecución Bottom-Up

En esta sección, debes detallar las 4 fases de ejecución estrictas de este pipeline, de abajo hacia arriba:

1. **Fase 1: Schema de Base de Datos (pgvector):** Creación de tablas (`documents`, `chunks`), configuración de la extensión pgvector, índices HNSW y estructura de validación de checksums (MD5/SHA).
2. **Fase 2: Motor Core de Compilación:** Adaptación de los módulos de `gbrain` (`semantic.ts` y `postgres-engine.ts`), incluyendo el cliente para pasar las llamadas de embeddings a través del `fleetco-AI-gateway`.
3. **Fase 3: Capa de Infraestructura (Cloud Run / Eventos):** Wrapper del servicio para recibir payloads de Pub/Sub, e implementación del Adaptador VFS (GCS vs Local) para leer el archivo `.md`.
4. **Fase 4: Destilador de Ingesta (Telegram):** El servicio top-level que procesa los archivos crudos enviados por chat, los pasa a Markdown y los deposita en el bucket de GCS.
