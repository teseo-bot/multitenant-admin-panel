# RFC-002: Destilador de Ingesta Omnicanal

## 1. Resumen Ejecutivo
Este documento define la arquitectura para la **Fase 4 del WBS**: el Destilador de Ingesta Omnicanal. Su objetivo principal es servir como la puerta de entrada segura del sistema para documentos no estructurados. Recibirá archivos (principalmente vía Telegram), los someterá a estrictas medidas de seguridad, extraerá su contenido y lo destilará en un formato Markdown estructurado, para finalmente depositarlo en Google Cloud Storage (GCS).

## 2. Componentes de Arquitectura

### 2.1 Frontend (Canal de Recepción)
El punto de entrada primario se gestiona a través del canal de mensajería del usuario.
* **Integración Telegram:** Se utilizará un **Webhook de la API de Telegram** o la integración directa mediante **OpenClaw Gateway**.
* **Flujo de Recepción:** El sistema detecta la recepción de un documento, valida el mime-type, extrae el `file_id` y delega la descarga a un proceso asíncrono.

### 2.2 Procesamiento del Archivo (El Destilador)
El pipeline de procesamiento consta de los siguientes pasos:
1. **Descarga Temporal:** El archivo se descarga a un sistema de archivos temporal seguro (ej. `/tmp` en Cloud Run) limitando su tiempo de vida.
2. **Extracción Multiformato:**
   * **PDF:** Lectura del flujo de texto posicionando correctamente las coordenadas para no romper columnas de lectura.
   * **Word (.docx):** Parseo del XML interno preservando formato.
   * **TXT:** Lectura directa y validación de codificación (preferiblemente UTF-8).
3. **Conversión Estructurada a Markdown:** Se aplicarán **heurísticas de formato** para reconstruir la estructura lógica del documento:
   * Identificación de Títulos y Subtítulos (H1, H2, H3) basándose en tamaños de fuente o metadatos de estilo.
   * Detección de listas y jerarquías.
   * Transformación de tablas a sintaxis tabular Markdown estándar.

### 2.3 Seguridad (Sanitización Obligatoria)
El sistema opera bajo un enfoque *Zero-Trust* hacia todo archivo externo:
* **Limpieza de Metadatos:** Se eliminarán metadatos de usuario (historial de revisiones, tags ocultos, información del dispositivo) para prevenir fugas de datos y envenenamiento de contexto.
* **Neutralización de Scripts:** Al procesar **PDFs**, el sistema extraerá únicamente las capas de texto, ignorando y evadiendo activamente objetos embebidos (OLED), macros o inyecciones de JavaScript malicioso que puedan intentar ejecutar código durante el parseo.

### 2.4 Output (GCS Trigger)
El Destilador tiene una responsabilidad de entrega bien delimitada:
* **Almacenamiento GCS:** El documento, ya destilado como un único archivo `.md` estandarizado, se deposita en el **Bucket de Google Cloud Storage (GCS)** del cliente correspondiente.
* **Activador (Trigger):** Esta acción completa la Fase 4 del WBS y actúa de puente hacia la **Fase 3**. La creación del objeto en GCS gatillará automáticamente el evento Pub/Sub que despierta al "Servicio Compilador" (documentado en el RFC-001), quien se encargará del checksum, chunking semántico y vectorización.

## 3. Estrategia de Fallos
* Archivos cifrados, corruptos o que no superen la barrera de seguridad serán purgados inmediatamente y se regresará un error claro al canal de origen (Telegram).
* Documentos sin capa de texto (solo imágenes/scans) se marcarán como inválidos hasta que se integre un módulo posterior de OCR.
