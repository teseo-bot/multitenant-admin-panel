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
  --substitutions=_NEXT_PUBLIC_SUPABASE_URL="https://jpmxqzrdeclkgpfuedjf.supabase.co",_NEXT_PUBLIC_SUPABASE_ANON_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpwbXhxenJkZWNsa2dwZnVlZGpmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Nzk5MTExNDAsImV4cCI6MjA5NTQ4NzE0MH0.F9qM_RVoo3MBeYGrhRicXLZ0gVM2uk2iukbO1tkQZ3I"

echo "Updating Cloud Run service..."
gcloud run deploy crm-agentico-panel \
  --image gcr.io/teseobot-487515/crm-agentico-panel:latest \
  --region us-central1 \
  --remove-env-vars DATABASE_URL \
  --allow-unauthenticated --quiet

echo "Done."
