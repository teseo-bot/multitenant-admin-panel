# ADR-145: Pipeline de Carga y Sincronización del Asset Studio

**Fecha:** 23 de Abril de 2026
**Estado:** Aceptado
**Autor:** Escuadrón Táctico (Teseo)

## Contexto
El "Asset Studio" requiere una funcionalidad robusta para la ingesta de documentos (PDFs, TXT, CSV) de los tenants, los cuales posteriormente serán procesados y convertidos en embeddings vectoriales (`pgvector`) por el motor de compilación en Python (`crm-agentico-compiler`). Se necesitaba diseñar un flujo que garantice una excelente experiencia de usuario, seguridad perimetral (tamaño y tipo de archivo), aislamiento multitenant estricto (RLS), y desacoplamiento asíncrono para el procesamiento pesado.

## Decisión
Se ha implementado una arquitectura en 3 fases, de las cuales las Fases 1 y 2 han sido completadas:

1. **Frontend (Carga en Lote):** Se adoptó `react-dropzone` en el componente `crm-agentico-panel` para reemplazar los frágiles eventos HTML5 nativos, permitiendo validación en cliente y carga múltiple.
2. **Seguridad Backend (API Route):** El endpoint de Next.js incluye un "Allowlist" estricto de tipos MIME y un límite absoluto de 10MB, con mitigación de Path Traversal (`/[^a-zA-Z0-9.\-_]/g`).
3. **Storage & RLS:** Los archivos se almacenan en el `asset_snapshots_bucket` en Supabase. Se diseñaron políticas RLS estrictas que aseguran que tanto las operaciones de inserción como de lectura validen que el primer segmento del path del archivo coincida con el `tenant_id` extraído del JWT del usuario (`auth.uid()`).
4. **Desacoplamiento (Webhook Asíncrono):** Para evitar bloqueos en el hilo del frontend y timeouts, la orquestación del procesamiento se delegó a la base de datos. Se creó un Trigger SQL que utiliza la extensión `pg_net` para lanzar una petición HTTP POST asíncrona hacia el `crm-agentico-compiler` cada vez que se inserta un documento con estado `'processing'`.

## Consecuencias
* **Positivas:** El frontend permanece rápido y responsivo. El aislamiento de datos por tenant está garantizado criptográficamente por Supabase a nivel de Storage y BD. La arquitectura es resiliente a fallos de procesamiento, ya que el estado se mantiene en la tabla `documents`.
* **Negativas / Riesgos:** Aumenta la complejidad operativa al depender de la extensión `pg_net` y de la gestión de reintentos del webhook en caso de que el orquestador Python esté caído.