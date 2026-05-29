#!/bin/bash
set -e

echo "Deploying crm-mission-control to Production (us-central1)..."
gcloud builds submit /Users/teseohome/projects/Teseo-AI-CRM/src/mission-control \
  --config /Users/teseohome/projects/Teseo-AI-CRM/src/mission-control/cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_SUPABASE_URL="https://lrptuwekwgbjutklctwr.supabase.co",_NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHR1d2Vrd2dianV0a2xjdHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTM0MDksImV4cCI6MjA5MjEyOTQwOX0.vMVT21nNhqOxYAlHospzHlY1M2SgGX5UJzAAwVZYSa4"

echo "Updating Cloud Run service..."
gcloud run deploy crm-mission-control \
  --image gcr.io/teseobot-487515/crm-mission-control:latest \
  --region us-central1 \
  --allow-unauthenticated --quiet

echo "Done."
