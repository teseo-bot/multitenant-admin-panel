#!/bin/bash
set -e
echo "=========================================================="
echo "🚀 Iniciando despliegue NATIVO (DOCKER) de Mission Control"
echo "=========================================================="

cd /Users/teseohome/projects/Teseo-AI-CRM/src/mission-control

echo "🔐 Extrayendo secretos de GCP Secret Manager para el Build..."
REAL_SUPABASE_URL=$(gcloud secrets versions access latest --secret="MISSION_CONTROL_SUPABASE_URL")
REAL_ANON_KEY=$(gcloud secrets versions access latest --secret="MISSION_CONTROL_SUPABASE_ANON_KEY")

if [ -z "$REAL_SUPABASE_URL" ] || [ -z "$REAL_ANON_KEY" ]; then
    echo "❌ Error: No se pudieron extraer los secretos de Supabase."
    exit 1
fi

echo "Generando .env.production temporal para el build..."
trap 'rm -f .env.production; echo "🧹 Archivo temporal .env.production limpiado."' EXIT INT TERM
cat <<EOF > .env.production
NEXT_PUBLIC_SUPABASE_URL=${REAL_SUPABASE_URL}
NEXT_PUBLIC_SUPABASE_ANON_KEY=${REAL_ANON_KEY}
EOF

echo "🐳 Construyendo imagen Docker localmente (linux/amd64)..."
docker build -t us-central1-docker.pkg.dev/teseobot-487515/crm-agentico/mission-control:latest --platform linux/amd64 .

echo "⬆️ Subiendo imagen a Google Artifact Registry..."
docker push us-central1-docker.pkg.dev/teseobot-487515/crm-agentico/mission-control:latest

echo "🚀 Desplegando en Cloud Run usando la imagen subida..."
gcloud run deploy mission-control \
  --image us-central1-docker.pkg.dev/teseobot-487515/crm-agentico/mission-control:latest \
  --region us-central1 \
  --allow-unauthenticated \
  --port 3000 \
  --set-secrets="NEXT_PUBLIC_SUPABASE_URL=MISSION_CONTROL_SUPABASE_URL:latest,NEXT_PUBLIC_SUPABASE_ANON_KEY=MISSION_CONTROL_SUPABASE_ANON_KEY:latest,INTERNAL_API_KEY=MISSION_CONTROL_INTERNAL_API_KEY:latest"

echo "✅ Despliegue completado."
