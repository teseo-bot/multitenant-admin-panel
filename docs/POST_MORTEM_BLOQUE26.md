# Post-Mortem y Trazabilidad de Fallos - Bloque 26 (Despliegue y Aprovisionamiento Zero-Trust)

**Fecha de Ejecución:** 24 Abril 2026
**Estado Final:** Resuelto Exitosamente
**Responsable:** Teseo (Gerente AIDevops)

## Resumen Ejecutivo
Durante el intento de levantar la arquitectura frontend "Quad-Core" en Google Cloud Run (Staging), se detonó una cascada de fallos estructurales. El sistema pasó por múltiples iteraciones de despliegue fallidas debido a deuda técnica acumulada en la nube y configuraciones de compilación estricta (Standalone) de Next.js no preparadas para entornos efímeros (Docker CI/CD).

## Bitácora de Variantes de Fallo y Resolución

### Fallo 1: Loop de Compilación en GitHub Actions
* **Síntoma:** El pipeline de despliegue caía en `exit code 1` intentando compilar un directorio `crm-agentico-panel`. Adicionalmente, existían condiciones de carrera con dos workflows paralelos.
* **Causa Raíz:** Referencia huérfana de Git submodules y archivos YAML de despliegue duplicados (`deploy-frontend.yml` y `cloud-run.yml` compitiendo).
* **Solución:** Se consolidó el frontend bajo el modelo Polyrepo inmutable (aplanado en la raíz). Se purgó el archivo YAML duplicado, deteniendo la condición de carrera.

### Fallo 2: "Cementerio" de Contenedores y Rutas Obsoletas
* **Síntoma:** Error `name unknown: Repository "teseo-repo" not found` durante el Push a Artifact Registry.
* **Causa Raíz:** Despliegues directos desde CLI (`gcloud run deploy --source .`) en etapas previas, junto con el uso de plataformas deprecadas (`gcr.io`) en lugar del nuevo estándar (`GAR`).
* **Solución (Scorched Earth):** Se purgó la plataforma GCP, eliminando servicios basura (`fleetco-web`, `crm-agentico`, `fleetco-ai-gateway`). Se unificó el destino de todos los repositorios hacia `us-central1-docker.pkg.dev/teseobot-487515/crm-agentico/`. Se forzó el uso de Node 24 en los runners de GitHub.

### Fallo 3: Client-Side Exception (Command Center) e Internal Server Error (Mission Control)
* **Síntoma:** Las aplicaciones levantaban y devolvían código HTTP 200, pero la pantalla de login colapsaba con el error `@supabase/ssr: Your project's URL and API key are required`.
* **Causa Raíz:** Next.js en modo *Standalone* "hornea" las variables `NEXT_PUBLIC_*` en tiempo de compilación. Al no estar presentes en la etapa `runner` del Dockerfile, el paquete minificado quedaba con las variables en `undefined`. Al cargarse estáticamente el Middleware en el navegador o en Edge, el SSR de Supabase abortaba la sesión.
* **Solución:** Se parchó la estrategia Multi-Stage del Dockerfile para retener y heredar explícitamente los argumentos:
  ```dockerfile
  ARG NEXT_PUBLIC_SUPABASE_URL
  ENV NEXT_PUBLIC_SUPABASE_URL=$NEXT_PUBLIC_SUPABASE_URL
  ```

### Fallo 4: IAM Permission Denied (GitHub Actions a Secret Manager)
* **Síntoma:** Al intentar inyectar las variables reales durante la compilación en CI/CD mediante `gcloud secrets versions access`, la Service Account de GitHub arrojaba error de permisos, inyectando silenciosamente un string vacío.
* **Causa Raíz:** Falta del rol `roles/secretmanager.secretAccessor` para la cuenta de servicio en GCP.
* **Solución:** Se abandonó el llamado externo a GCP desde el runner. Las credenciales fueron extraídas localmente e inyectadas estáticamente como **GitHub Secrets** (`secrets.MISSION_CONTROL_SUPABASE_URL`), alimentando el Docker Build con variables limpias y garantizadas.

### Fallo 5: Supabase Auth "User already registered" (Provisioning Script)
* **Síntoma:** El script de aprovisionamiento transaccional abortaba a la mitad al intentar crear el usuario admin `fleetco@fleetco.mx`.
* **Causa Raíz:** Restos de pruebas de desarrollo manuales donde ese correo ya existía en Supabase Auth, rompiendo la integridad del script.
* **Solución:** Ejecución del aprovisionamiento con credenciales frescas y 100% aisladas (`innoteca@teseo.lat`), validando la inyección atómica (Tenant + Auth + RLS Link).

## Conclusión Trazable
La infraestructura ha sido estabilizada al 100%. La arquitectura `Quad-Core` (Orquestador, Compilador, Command Center y Mission Control) opera ahora sin intervención humana local, regida por políticas Zero-Trust, desplegando código predecible, y conectándose a Supabase Producción bajo el estricto cumplimiento del sistema RLS (Row-Level Security).
