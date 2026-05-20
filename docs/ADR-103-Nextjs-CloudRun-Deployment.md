# ADR 103: Estrategia de Empaquetado y Despliegue de Next.js a GCP Cloud Run

## 1. Contexto y Problema
El despliegue de **Mission Control** (Next.js App Router) hacia Google Cloud Run utilizando el flujo delegado `gcloud run deploy --source .` presentó dos fallas arquitectónicas severas:
1. **Timeouts en el Health Check (Port Binding):** La inicialización a través del orquestador genérico de NPM (`npm run start`) no permitía enlazar correctamente la variable dinámicas `$PORT` que GCP inyecta en tiempo de ejecución, provocando abortos por timeouts del contenedor.
2. **Fugas de Variables NEXT_PUBLIC:** Las credenciales de acceso cliente (Supabase URL y Anon Key) se quemaron nulas ("dummies") al no poder pasar transparentemente directivas `--build-arg` a la capa interna del *buildpack* de GCP, resultando en un Frontend con código roto `TypeError: Failed to fetch`.

## 2. Decisión Arquitectónica
- **Output:** Se declara el `output: "standalone"` en `next.config.ts`.
- **Inyección por Medio Físico:** Las credenciales en tiempo de CI/CD se inyectan localmente formando un archivo `.env.production` temporal durante el build y eliminado inmediatamente con `trap`, evitando el uso de comandos `ARG` de Dockerfile.
- **Construcción Local:** Queda **estrictamente prohibido** utilizar compiladores delegados en GCP (`gcloud run deploy --source .`) para frameworks estáticos de cliente. El empaquetado debe realizarse en la máquina anfitriona (`docker build --platform linux/amd64`), empujar al Artifact Registry (`docker push`) y luego apuntar Cloud Run a la imagen final.

## 3. Consecuencias
- **Positivas:** La compilación de la imagen nativa en Apple Silicon hacia arquitectura `linux/amd64` resolvió los bloqueos de Google Cloud Build. El contenedor de Cloud Run ahora arranca el servidor puro (`node server.js`), garantizando binding en el `0.0.0.0` y conectividad con la base de datos cliente.
- **Negativas:** El despliegue de UI requiere ancho de banda local para cargar contenedores ~100MB al registro remoto.

## 4. Estado
**Aceptado** (2026-04-19)
