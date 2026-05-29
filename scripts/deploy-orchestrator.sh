#!/bin/bash
PROJECT_ID="teseobot-487515"
REGION="us-central1"
SERVICE_NAME="crm-agentico-orchestrator"

# Determinar el directorio base dinámicamente
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$SCRIPT_DIR/../../crm-agentico-orchestrator"

if [ -f "fleetco-sdr-key.json" ]; then
    gcloud secrets versions add WORKSPACE_SERVICE_ACCOUNT_JSON \
        --data-file="fleetco-sdr-key.json" \
        --project=$PROJECT_ID || true
fi

echo ">>> Desplegando Orchestrator en Cloud Run con CPU Always Allocated..."
gcloud run deploy $SERVICE_NAME \
    --source . \
    --region $REGION \
    --project $PROJECT_ID \
    --allow-unauthenticated \
    --no-cpu-throttling \
    --update-env-vars="NODE_ENV=production,GOOGLE_APPLICATION_CREDENTIALS=/secrets/workspace-key.json" \
    --update-secrets="/secrets/workspace-key.json=WORKSPACE_SERVICE_ACCOUNT_JSON:latest"
