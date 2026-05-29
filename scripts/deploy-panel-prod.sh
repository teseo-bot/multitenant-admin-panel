#!/bin/bash
set -e

cat << 'CBEOF' > /Users/teseohome/projects/Teseo-AI-CRM/cloudbuild.yaml
steps:
- name: 'gcr.io/cloud-builders/docker'
  args:
  - 'build'
  - '--build-arg'
  - 'NEXT_PUBLIC_SUPABASE_URL=${_NEXT_PUBLIC_SUPABASE_URL}'
  - '--build-arg'
  - 'NEXT_PUBLIC_SUPABASE_ANON_KEY=${_NEXT_PUBLIC_SUPABASE_ANON_KEY}'
  - '-t'
  - 'gcr.io/teseobot-487515/crm-agentico-panel'
  - '.'
- name: 'gcr.io/cloud-builders/docker'
  args: ['push', 'gcr.io/teseobot-487515/crm-agentico-panel']
images:
- 'gcr.io/teseobot-487515/crm-agentico-panel'
CBEOF

echo "Deploying crm-agentico-panel to Production (us-central1)..."
gcloud builds submit /Users/teseohome/projects/Teseo-AI-CRM \
  --config /Users/teseohome/projects/Teseo-AI-CRM/cloudbuild.yaml \
  --substitutions=_NEXT_PUBLIC_SUPABASE_URL="https://lrptuwekwgbjutklctwr.supabase.co",_NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxycHR1d2Vrd2dianV0a2xjdHdyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY1NTM0MDksImV4cCI6MjA5MjEyOTQwOX0.vMVT21nNhqOxYAlHospzHlY1M2SgGX5UJzAAwVZYSa4"

echo "Updating Cloud Run service..."
gcloud run deploy crm-agentico-panel \
  --image gcr.io/teseobot-487515/crm-agentico-panel:latest \
  --region us-central1 \
  --remove-env-vars DATABASE_URL \
  --allow-unauthenticated --quiet

echo "Done."
