# Plan de Ajuste: Inyección de Variables de Entorno en Build Time (GCP Cloud Run)

## Contexto y Problema
Actualmente, el despliegue de la aplicación en Google Cloud Run falla en la etapa de empaquetado (Cloud Build). 
**Causa:** El `Dockerfile` declara variables `ARG` y `ENV` para inyectar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`, y el script de bash intenta pasarlas usando el flag `--set-build-env-vars`. Sin embargo, Cloud Buildpack / `gcloud run deploy` con `--source .` no mapea automáticamente estas `build-env-vars` como `--build-arg` hacia el `Dockerfile` nativo sin configuraciones adicionales complejas (como un `cloudbuild.yaml` dedicado).
Dado que Next.js requiere estas variables en el *build time* (para "hornearlas" en el JS del frontend y evitar fallos en pre-renderizado estático), el build se rompe.

## Solución Propuesta (Approach: `.env.production` temporal)
Vamos a simplificar el proceso inyectando un archivo físico `.env.production` localmente justo antes de enviar el contexto de construcción a GCP, permitiendo que Next.js lo lea de forma nativa.

### Tareas para el Ejecutor (Night)

**1. Modificar el `Dockerfile` (app/Dockerfile)**
- Eliminar las declaraciones `ARG NEXT_PUBLIC_SUPABASE_URL`, `ARG NEXT_PUBLIC_SUPABASE_ANON_KEY`, etc., en la fase del `builder`.
- Eliminar las declaraciones `ENV NEXT_PUBLIC...` que dependían de esos ARGs.
- Dejar que `npm run build` dependa enteramente de la presencia del archivo `.env.production` que se subirá temporalmente.

**2. Asegurar inclusión en `.dockerignore`**
- Verificar que el archivo `.dockerignore` **NO** esté ignorando `.env.production`. 
- Si hay una regla genérica como `.env*`, agregar una excepción explícita al final del `.dockerignore`: 
  ```dockerignore
  !.env.production
  ```
- *Nota:* Asegurarse de que en `.gitignore` sí se encuentre ignorado para evitar comitear credenciales por accidente.

**3. Modificar el script de despliegue (`scripts/deploy-mission-control.sh`)**
- Justo antes de ejecutar el comando `gcloud run deploy ...`:
  - Generar el archivo dinámicamente con los valores reales rescatados de Google Secret Manager o las variables de entorno actuales:
    ```bash
    echo "Generando .env.production temporal para el build..."
    cat <<EOF > .env.production
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${NEXT_PUBLIC_SUPABASE_ANON_KEY}
EOF
    ```
- Modificar el comando `gcloud run deploy` para **eliminar** el parámetro `--set-build-env-vars` que ya no es necesario (o mantener solo variables estrictas del server, pero quitar las `NEXT_PUBLIC_`).
- Implementar limpieza estricta (Cleanup):
  - Borrar el archivo justo después del deploy: `rm -f .env.production`
  - *Best practice:* Agregar un `trap 'rm -f .env.production' EXIT INT TERM` al inicio del script para garantizar que el archivo se borre incluso si el build de gcloud falla o se cancela a la mitad.

## Resultado Esperado
Al ejecutar el script de deploy, el archivo viajará en el contexto de `--source .` hacia GCP. El `Dockerfile` correrá `npm run build`, Next.js tomará los valores nativamente de `.env.production`, el empaquetado terminará en verde y el contenedor resultante no dependerá de ARGs de Docker. El archivo en la máquina local se destruirá instantáneamente.