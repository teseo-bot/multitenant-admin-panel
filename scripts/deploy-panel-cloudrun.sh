#!/bin/bash

# ==============================================================================
# Script de Despliegue Zero-Trust - Tenant OS (crm-agentico-panel)
# Target: Google Cloud Run
# ==============================================================================

PROJECT_ID="teseobot-487515"
REGION="us-central1"
SERVICE_NAME="crm-agentico-panel"
IMAGE_TAG="gcr.io/${PROJECT_ID}/${SERVICE_NAME}:latest"

SUPABASE_URL="https://jpmxqzrdeclkgpfuedjf.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbXhxenJkZWNsa2dwZnVlZGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTExNDAsImV4cCI6MjA5NTQ4NzE0MH0.F9qM_RVoo3MBeYGrhRicXLZ0gVM2uk2iukbO1tkQZ3I"

echo "================================================="
echo "Iniciando Pipeline de Despliegue hacia Cloud Run"
echo "Servicio: $SERVICE_NAME"
echo "================================================="

cd /Users/teseohome/projects/Teseo-AI-CRM || exit

echo "[0/3] Generando .env.production temporal para el build estático..."
trap 'rm -f .env.production; echo "🧹 Archivo temporal .env.production limpiado."' EXIT INT TERM
cat <<ENVEOF > .env.production
NEXT_PUBLIC_SUPABASE_URL=${SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${SUPABASE_KEY}
ENVEOF

echo "[1/3] Construyendo imagen Docker (Multi-stage Standalone)..."
docker build --platform linux/amd64 -t $IMAGE_TAG .

echo "[2/3] Subiendo imagen a Google Container Registry (GCR)..."
docker push $IMAGE_TAG

echo "[3/3] Desplegando en Cloud Run..."
gcloud run deploy $SERVICE_NAME \
  --image $IMAGE_TAG \
  --platform managed \
  --region $REGION \
  --allow-unauthenticated \
  --memory 512Mi \
  --cpu 1 \
  --min-instances 1 \
  --max-instances 5 \
  --port 3000 \
  --update-env-vars NEXT_PUBLIC_SUPABASE_URL="${SUPABASE_URL}",NEXT_PUBLIC_SUPABASE_ANON_KEY="${SUPABASE_KEY}"

echo "================================================="
echo "Despliegue Finalizado."
echo "================================================="
