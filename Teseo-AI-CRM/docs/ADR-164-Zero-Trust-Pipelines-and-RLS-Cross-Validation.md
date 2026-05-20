# [DEPRECATED] - Superseded by MASTER_ARCHITECTURE.md v1.0.0nn
# ADR-164: Consolidación Zero-Trust y Validación Cruzada RLS en Staging

**Estado:** Aprobado
**Fecha:** 24 Abril 2026
**Autor:** Teseo AIDevops

## Contexto
El Bloque 26 requería el levantamiento del entorno de Staging y la separación estricta de dominios entre `Mission Control` (Super-Admin) y `Command Center` (Tenant Client). Durante el proceso de encendido en la nube se detectó deuda técnica severa: contenedores huérfanos, despliegues manuales fuera de CI/CD y pipelines rotos por inyección fallida de variables de entorno de Supabase en modo Standalone.

## Decisiones Técnicas Implementadas
1. **Scorched Earth (Infraestructura como Código estricta):** Se eliminaron contenedores manuales (ej. `fleetco-web`, `crm-agentico`) y se homologó la arquitectura "Quad-Core" en GCP mediante Artifact Registry.
2. **Inyección Dinámica de Credenciales (GitHub Secrets):** Para solventar el "Client-side Exception" y el "Internal Server Error" durante la compilación de Next.js Standalone, se eludió la dependencia del Secret Manager de GCP, pasando las llaves `SUPABASE_URL` y `SUPABASE_ANON_KEY` vía secretos directos de GitHub inyectados al paso de compilación del `Dockerfile` (Argumentos en etapa `builder` persistidos hacia el `ENV` de la etapa `runner`).
3. **Validación Cruzada:** Se aprovisionó el Tenant maestro de Teseo (`teseo@teseo.lat`) y un Tenant fresco de pruebas (`innoteca@teseo.lat`) usando el CLI del orquestador.

## Consecuencias
- La separación topológica ha sido confirmada exitosamente en GCP.
- Los accesos humanos han sido validados en Staging con la base de datos de Producción en Supabase, respetando las fronteras lógicas del RLS.
- **El Bloque 26 ha finalizado con éxito.** El sistema en nube está vivo, seguro e inmutable.
