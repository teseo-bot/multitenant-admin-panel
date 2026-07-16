# CI/CD del panel → micontexto-control (ADR-206)

Provisión **una sola vez** de la federación GitHub Actions ↔ `micontexto-control` para que
`.github/workflows/cloud-run.yml` pueda desplegar. Ejecutar con la cuenta con acceso
(`jorge.garcia@innoteca.mx`). Son cambios de IAM/seguridad — por eso van aquí como runbook,
no en el workflow.

Valores reales (verificados contra el servicio Cloud Run vivo):

| Recurso | Valor |
|---|---|
| Proyecto / número | `micontexto-control` / `1025015138700` |
| Región | `us-central1` |
| Artifact Registry | `panel-repo` |
| Servicio Cloud Run | `multitenant-admin-panel` |
| SA de runtime | `panel-runtime@micontexto-control.iam.gserviceaccount.com` |
| Repo GitHub | `teseo-bot/multitenant-admin-panel` |

```bash
export ACCOUNT=jorge.garcia@innoteca.mx
export PROJECT=micontexto-control
export PROJECT_NUMBER=1025015138700
export REPO=teseo-bot/multitenant-admin-panel
export DEPLOYER=github-deployer@micontexto-control.iam.gserviceaccount.com
export RUNTIME=panel-runtime@micontexto-control.iam.gserviceaccount.com
gcloud config set account $ACCOUNT

# 1) SA que despliega
gcloud iam service-accounts create github-deployer \
  --project=$PROJECT --display-name="GitHub Actions deployer"

# 2) Roles del deployer: build/push a AR, deploy a Cloud Run, y actuar como el SA de runtime
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$DEPLOYER" --role="roles/run.admin"
gcloud projects add-iam-policy-binding $PROJECT \
  --member="serviceAccount:$DEPLOYER" --role="roles/artifactregistry.writer"
gcloud iam service-accounts add-iam-policy-binding $RUNTIME \
  --project=$PROJECT --member="serviceAccount:$DEPLOYER" \
  --role="roles/iam.serviceAccountUser"

# 3) Workload Identity pool + provider OIDC de GitHub
gcloud iam workload-identity-pools create github-actions \
  --project=$PROJECT --location=global --display-name="GitHub Actions"

gcloud iam workload-identity-pools providers create-oidc github-provider \
  --project=$PROJECT --location=global --workload-identity-pool=github-actions \
  --display-name="GitHub OIDC" \
  --issuer-uri="https://token.actions.githubusercontent.com" \
  --attribute-mapping="google.subject=assertion.sub,attribute.repository=assertion.repository" \
  --attribute-condition="assertion.repository=='${REPO}'"

# 4) Permitir que SOLO este repo suplante al deployer
gcloud iam service-accounts add-iam-policy-binding $DEPLOYER \
  --project=$PROJECT --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions/attribute.repository/${REPO}"
```

## 5) Config web de Identity Platform (build-arg)

`NEXT_PUBLIC_FIREBASE_CONFIG` se hornea en el bundle cliente en build. La config web de
Firebase **no es secreta** (Google la publica), así que va como *variable de repo* de GitHub,
no como secreto:

**GitHub → repo → Settings → Secrets and variables → Actions → Variables → New variable**
- Nombre: `NEXT_PUBLIC_FIREBASE_CONFIG`
- Valor: el JSON de config de la app web en Identity Platform de `micontexto-control`
  (Firebase console → Project settings → tu app web → `firebaseConfig`), en una sola línea.

## Verificar

Merge a `main` (o **Actions → Deploy Mission Control → Run workflow**) dispara build+deploy.
El `env_vars`/`secrets` del workflow ya reflejan el servicio vivo (DATABASE_URL←CONTROL_DATABASE_URL,
COLD_TIER_URL←COLD_TIER_URL_ORCH, M2M_API_KEY, APP_URL, KDB_COMPILER_URL, COMPILER_INTERNAL_URL,
MAILER_DRY_RUN) y las 2 instancias Cloud SQL.
