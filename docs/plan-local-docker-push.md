# Plan Técnico: Refactor a Local Build + Push + Deploy para Mission Control

## Contexto
GCP Cloud Build está presentando timeouts silenciosos y fallos recurrentes al utilizar la directiva `--source .` en `gcloud run deploy`. Para sortear el orquestador en la nube y garantizar despliegues rápidos y deterministas desde hardware local (Mac M1/M2/M3), el script `deploy-mission-control.sh` será reescrito para utilizar un enfoque de empaquetado local.

## Flujo de Ejecución Propuesto (Refactor)

El nuevo script deberá ejecutar las siguientes fases en orden estricto:

### 1. Extracción de Secretos y Preparación (Local)
Obtener los valores necesarios desde GCP Secret Manager y generar un archivo `.env.production` temporal en la máquina local.

### 2. Construcción de Imagen (Local Build)
Compilar la imagen de Docker. **Crítico:** Se debe forzar explícitamente la arquitectura `linux/amd64` para asegurar compatibilidad con la infraestructura de Cloud Run y evitar incompatibilidades con el chip ARM (Apple Silicon) del host.
```bash
docker build -t us-central1-docker.pkg.dev/teseobot-487515/crm-agentico/mission-control:latest --platform linux/amd64 .
```

### 3. Registro de Imagen (Push)
Subir la imagen compilada hacia el repositorio en Google Artifact Registry.
```bash
docker push us-central1-docker.pkg.dev/teseobot-487515/crm-agentico/mission-control:latest
```
*(Se asume que `gcloud auth configure-docker us-central1-docker.pkg.dev` ya está configurado en el host).*

### 4. Despliegue a Cloud Run (Deploy)
Lanzar la actualización en Cloud Run apuntando directamente a la imagen recién subida, conservando la configuración de entorno y todos los mapeos de secretos existentes en el script original.
```bash
gcloud run deploy mission-control \
  --image us-central1-docker.pkg.dev/teseobot-487515/crm-agentico/mission-control:latest \
  --region us-central1 \
  # ... mantener aquí el resto de flags (ej. --set-secrets)
```

### 5. Limpieza de Seguridad (Cleanup)
Eliminar inmediatamente el archivo de variables temporales para evitar riesgos de exposición en el sistema local.
```bash
rm -f .env.production
```