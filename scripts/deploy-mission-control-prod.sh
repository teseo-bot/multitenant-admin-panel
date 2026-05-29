#!/bin/bash
set -e

echo "Deploying crm-mission-control to Production (us-central1)..."
gcloud builds submit /Users/teseohome/projects/Teseo-AI-CRM/src/mission-control \
  --config /Users/teseohome/projects/Teseo-AI-CRM/src/mission-control/cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_SUPABASE_URL="https://jpmxqzrdeclkgpfuedjf.supabase.co",_NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbXhxenJkZWNsa2dwZnVlZGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTExNDAsImV4cCI6MjA5NTQ4NzE0MH0.F9qM_RVoo3MBeYGrhRicXLZ0gVM2uk2iukbO1tkQZ3I"

echo "Updating Cloud Run service..."
gcloud run deploy crm-mission-control \
  --image gcr.io/teseobot-487515/crm-mission-control:latest \
  --region us-central1 \
  --allow-unauthenticated --quiet

echo "Done."
