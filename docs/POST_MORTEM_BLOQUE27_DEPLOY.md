# Post-Mortem: Incidencia de Despliegue (Bloque 27)

## 1. Resumen del Incidente
Durante el proceso de despliegue correspondiente al Bloque 27 en Teseo-AI-CRM, se presentaron fallas críticas que impidieron la correcta sincronización de la base de datos y la construcción de la imagen en Google Cloud Run. El pipeline fue interrumpido por desincronización de migraciones y un path incorrecto en el proceso de build.

## 2. Detalle de Fallas y Soluciones Aplicadas

### Falla 1: Drift en Migraciones de Supabase
- **Causa Raíz:** Desincronización del historial de migraciones de Supabase (Drift) debido a una colisión de nomenclatura en el entorno local (versiones duplicadas).
- **Solución Aplicada:** Renombre sistemático de los archivos locales conflictivos para asegurar unicidad temporal, seguido de la inyección manual del estado en el registro de migraciones mediante el comando `npx supabase migration repair --status applied`.

### Falla 2: Falla de Contexto en Daemon de Docker
- **Causa Raíz:** Un bug en el script `scripts/deploy-panel-cloudrun.sh` modificaba el contexto de ejecución hacia un subdirectorio incorrecto (`crm-agentico-panel`). Esto impedía al daemon de Docker encontrar el `Dockerfile` raíz para construir la imagen.
- **Solución Aplicada:** Corrección de la ruta de ejecución en el script para que el build se orqueste desde el contexto adecuado en la raíz del proyecto.

## 3. Lecciones Aprendidas / Prevención
Para asegurar la resiliencia del pipeline de datos y prevenir colisiones de esquema en el futuro, se instaura la siguiente política preventiva:

- **Sincronización Pre-Desarrollo:** Se recomienda estrictamente el uso del comando `npx supabase db pull` antes de comenzar cada nuevo desarrollo en paralelo o rama de feature, garantizando así un baseline limpio y mitigando los riesgos de colisión de nomenclatura y *drift* en las migraciones.
