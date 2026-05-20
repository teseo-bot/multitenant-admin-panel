# Post-Mortem: Bloque 36 - Fricción de Supply Chain y Nacimiento de Trirreme
**Fecha:** 26 Abril 2026
**Incidente:** Fallo en despliegue de Cloud Run debido a políticas restrictivas de Artifact Registry y GHCR Auth Bloqueos.

## Síntomas
Al intentar despachar el Data Plane (`crm-agentico-orchestrator`) hacia GCP, Cloud Run rebotó el manifiesto `service.yaml` porque el contenedor sidecar (`obscura`) dependía de un registro externo en GitHub (`ghcr.io`). Posteriormente, el intento de auditar y extraer la imagen falló por falta de autenticación y la inexistencia de la imagen pública.

## Causa Raíz
Dependencia de registros de terceros (Single Point of Failure) y violación de la política Zero-Trust. El entorno esperaba descargar tensores compilados por terceros sin auditoría previa.

## Resolución (Plan B)
- **Abortar GHCR/DockerHub:** Se clonó el código fuente limpio del autor.
- **Build from Source:** Se escribió un `Dockerfile` multietapa en local.
- **Renombramiento Táctico:** Se bautizó al contenedor como `trirreme:latest`.
- **Bóveda Acorazada:** Se subió el artefacto directamente a GCP Artifact Registry (`us-central1-docker.pkg.dev/.../trirreme:latest`), resolviendo la dependencia externa.

## Prevención
Ningún `service.yaml` en producción puede apuntar a registries fuera de `*.pkg.dev`. Todo sidecar debe ser construido desde código fuente (Build from Source) y auditado antes de inyectarse en el ecosistema.