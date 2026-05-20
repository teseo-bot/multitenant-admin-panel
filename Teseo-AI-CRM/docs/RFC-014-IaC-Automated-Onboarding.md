# RFC-014: Onboarding Automático de Inquilinos (IaC) en Modelo Single-Tenant

| Campo | Valor |
|---|---|
| **ID** | RFC-014 |
| **Estado** | Propuesto |
| **Fecha** | 2026-04-19 |
| **Autor** | Escuadrón Bravo (Builder/Learner) |
| **Aprobador** | Jorge García (CEO) |

## 1. Contexto
En base a la decisión estratégica del **ADR-097** de adoptar un modelo **Single-Tenant** (infraestructura dedicada y aislada por cliente), el despliegue manual de cada inquilino se vuelve un cuello de botella logístico y propenso a errores. El orquestador Agentico, ubicado en `src/orchestrator/`, empaquetado en su propio `Dockerfile`, debe ser desplegado en Google Cloud Run en un esquema aislado.

Se requiere un diseño técnico para un flujo de automatización (Infraestructura como Código usando Bash y `gcloud` CLI) que permita crear el entorno de ejecución para un nuevo inquilino en cuestión de minutos, inyectando las credenciales correspondientes a sus canales.

## 2. Arquitectura de Automatización

### 2.1 Interfaz de Ejecución
El CEO o el panel de Mission Control desencadenarán el despliegue ejecutando un script interactivo o parametrizado:

```bash
./scripts/deploy_tenant.sh <TENANT_ID> <GCP_PROJECT_ID> <REGION> [PATH_A_ENV_FILE]
```

- `TENANT_ID`: Identificador único del cliente (ej. `inmobiliaria-x`).
- `GCP_PROJECT_ID`: ID del proyecto de Google Cloud dedicado (o donde se alojará el Cloud Run aislado).
- `REGION`: Región del despliegue (ej. `us-central1`).
- `PATH_A_ENV_FILE`: Archivo temporal que contiene las variables y secretos para ese inquilino.

### 2.2 Flujo de Ejecución del Script (WBS)
El script `deploy_tenant.sh` ejecutará de forma secuencial:

1. **Habilitación de APIs:** Asegura que los servicios base estén activos en el proyecto GCP.
   ```bash
   gcloud services enable run.googleapis.com secretmanager.googleapis.com cloudbuild.googleapis.com --project="${GCP_PROJECT_ID}"
   ```
2. **Inyección de Secretos:** Lee el archivo `.env` proporcionado y crea/actualiza los secretos en GCP Secret Manager.
3. **Despliegue del Orquestador:** Empaqueta y despliega la aplicación Node.js utilizando el `Dockerfile` de la ruta `src/orchestrator/`.

### 2.3 Variables de Entorno y Manejo de Secretos

La aplicación espera múltiples variables (verificadas desde el código). Se dividirán en dos categorías:

**Variables de Entorno Públicas (`--set-env-vars`)**
Variables de configuración base, inyectadas directamente al servicio de Cloud Run:
- `TENANT_ID=${TENANT_ID}`
- `NODE_ENV=production`
- `PORT=3000`
- `ODOO_URL`, `ODOO_DB`, `ODOO_USER`

**Secretos de Infraestructura y Negocio (`--set-secrets`)**
Variables sensibles que **no** deben existir en texto plano en la configuración del servicio de Cloud Run. Se almacenarán en Google Cloud Secret Manager y se vincularán al servicio para que se expongan como variables de entorno seguras durante la ejecución:
- `DATABASE_URL` (Conexión a la DB Postgres Vectorial)
- `OPENAI_API_KEY`, `GEMINI_API_KEYS`
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_ID`
- `META_VERIFY_TOKEN`, `META_APP_SECRET`
- `TELEGRAM_BOT_TOKEN`, `TELEGRAM_WEBHOOK_SECRET`
- `ODOO_PASS`
- `INTERNAL_API_KEY`

*Ejemplo de comando de creación de secreto en el script:*
```bash
printf "%s" "$WHATSAPP_TOKEN" | gcloud secrets create "WHATSAPP_TOKEN_${TENANT_ID}" --data-file=- --project="${GCP_PROJECT_ID}"
```

### 2.4 Comando Core de Despliegue en Cloud Run

El comando fundamental que ejecutará el script (utilizando despliegue desde código fuente que orquesta Cloud Build por debajo) será:

```bash
gcloud run deploy "orchestrator-${TENANT_ID}" \
  --source "src/orchestrator/" \
  --project="${GCP_PROJECT_ID}" \
  --region="${REGION}" \
  --allow-unauthenticated \
  --service-account="orchestrator-sa@${GCP_PROJECT_ID}.iam.gserviceaccount.com" \
  --set-env-vars="TENANT_ID=${TENANT_ID},NODE_ENV=production" \
  --set-secrets="DATABASE_URL=DATABASE_URL_${TENANT_ID}:latest,\
WHATSAPP_TOKEN=WHATSAPP_TOKEN_${TENANT_ID}:latest,\
META_VERIFY_TOKEN=META_VERIFY_TOKEN_${TENANT_ID}:latest,\
TELEGRAM_BOT_TOKEN=TELEGRAM_BOT_TOKEN_${TENANT_ID}:latest,\
OPENAI_API_KEY=OPENAI_API_KEY_${TENANT_ID}:latest"
```

*Nota: La cuenta de servicio referenciada (`orchestrator-sa`) deberá tener permisos otorgados de "Secret Manager Secret Accessor" previamente en el flujo del script para poder montar los valores.*

## 3. Criterios de Éxito
- Al correr el script se provisiona el Orquestador listo para recibir tráfico en su propia URL (`https://orchestrator-tenant-x-xyz.a.run.app`).
- El servicio en GCP no revela las credenciales del inquilino en texto plano; éstas residen en Secret Manager.
- Ningún inquilino comparte variables de entorno ni recursos de memoria con otro.