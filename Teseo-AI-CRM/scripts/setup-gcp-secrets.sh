#!/bin/bash
# scripts/setup-gcp-secrets.sh
# Utilidad de aprovisionamiento de secretos para Google Cloud Secret Manager.
# Este script debe ejecutarse localmente con privilegios de gcloud admin.

# Salir inmediatamente si un comando falla
set -e

PROJECT_ID="teseo-ai-dev"

echo "[Teseo] Iniciando aprovisionamiento de secretos en GCP ($PROJECT_ID)..."

# Array de secretos críticos (LLMs, DB, Auth)
SECRETS=(
  "SUPABASE_URL"
  "SUPABASE_SERVICE_ROLE_KEY"
  "OPENAI_API_KEY"
  "GEMINI_API_KEY"
  "ZUSTAND_ENCRYPTION_KEY"
)

# Activar API de Secret Manager si no está activa
gcloud services enable secretmanager.googleapis.com --project="$PROJECT_ID" || true

for SECRET_NAME in "${SECRETS[@]}"; do
  echo "Creando definición de secreto: $SECRET_NAME"
  
  # Crea el contenedor del secreto si no existe
  gcloud secrets create "$SECRET_NAME" \
    --replication-policy="automatic" \
    --project="$PROJECT_ID" || echo "El secreto $SECRET_NAME ya existe. Omitiendo creación."

  # Nota: La inyección de los valores (payload) se hará manual por seguridad,
  # o leyendo de un archivo .env.local seguro que no se sube al repo.
  echo "=> Recuerda inyectar el valor real con: gcloud secrets versions add $SECRET_NAME --data-file=tu_archivo_seguro.txt --project=$PROJECT_ID"
  echo "-------------------------------------------"
done

echo "[Teseo] Preparación de infraestructura de secretos completada."
