# Learner Report: Bloque 16 (Motor de Ingesta Multimodal RAG)

## 1. Patrones Destilados de TeseoKDB (`/compiled/`)
Tras auditar los repositorios y la base de conocimiento destilada, se extraen los siguientes patrones inquebrantables para la arquitectura RAG:
- **Procedencia Estricta (Provenance):** Los archivos de origen en crudo nunca se mutan ni eliminan. Se preservan, y los fragmentos (chunks) siempre deben incluir una cita/apuntador al ID del archivo original.
- **Procesamiento Multimodal y Continuo:** Separación clara del ciclo de vida en fases: 1) Captura cruda (upload), 2) Procesamiento/extracción de texto/entidades, 3) Generación de embeddings, 4) Sincronización a la base de datos vectorial.
- **Offloading Asíncrono:** Todas las tareas pesadas de red y extracción de embeddings se delegan a trabajadores en segundo plano para no entorpecer los tiempos de respuesta del webhook/orquestador principal.

## 2. Estado de la Infraestructura en `Teseo-AI-CRM`
La auditoría del código base revela que la fundación de la base de datos y mensajería ya está sólidamente implementada:

- **Almacenamiento Vectorial (`tenant_memories`):**
  - La tabla ya existe con `pgvector` (768 dimensiones), afinado para `text-embedding-004` (Google Gemini).
  - Incluye recientemente soporte relacional (`document_id` referenciando a la tabla `documents` con `ON DELETE CASCADE`).
- **Seguridad Zero-Trust y RLS:**
  - `tenant_memories` tiene políticas RLS habilitadas (`tenant_isolation_memories`).
  - La lectura de vectores (RAG Retrieval) no se hace de forma abierta, sino mediante la función RPC estricta `match_tenant_memories(..., p_tenant_id)`, que fuerza el aislamiento del tenant a nivel SQL.
- **Worker y Colas (`pg-boss`):**
  - `pg-boss` (^12.15.0) **ya está instalado y en uso**.
  - Existe un daemon de consumo (`src/orchestrator/src/worker/daemon.ts`) procesando la cola `gbrain:learn`.
  - El flujo actual intercepta comandos `[LEARN]` en LangGraph, adjunta multimedia a un payload y delega la inserción a la cola de `pg-boss`.
- **Ecosistema (Microservicios vs Typescript):**
  - Los documentos de arquitectura previos (ADR-146) describen que para tareas intensivas (ej. PyMuPDF, embeddings complejos) puede utilizarse un microservicio asíncrono/compiler aparte, que escriba vía bulk UPSERTs con limpieza pre-ingesta (`DELETE FROM tenant_memories WHERE document_id = $1`).

## 3. Conclusión y Recomendaciones para el Builder
La fontanería principal ya existe. El esfuerzo arquitectónico para el Bloque 16 no necesita reinventar colas ni la tabla vectorial, sino centrarse en expandir las capacidades de **ingesta multimodal** conectándolas al flujo actual.

**Siguientes pasos sugeridos para Builder:**
1. **Flujo de Vida Documental:** Refinar cómo los documentos subidos pasan de un estado inicial (en `documents`) al servicio de extracción, y cómo reportan su progreso (pending/processing/ready).
2. **Handlers Multimodales:** Extender o crear los submódulos dentro del compilador o minion-worker (`daemon.ts` o un servicio Python) para procesar de manera robusta archivos de imágenes (OCR, Vision) y audio (Whisper o similar), segmentarlos y enviarlos como "chunks" compatibles con `tenant_memories`.
3. **Mantenimiento del Gatekeeper:** Asegurar que LangGraph, al usar el "Multimodal Dispatcher", continúe alimentando la cola `gbrain:learn` con los metadatos y punteros de almacenamiento necesarios sin romper la latencia sincrónica del webhook.