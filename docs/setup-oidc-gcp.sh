# GUÍA: Configurar Workload Identity Federation (OIDC) en GCP
# ────────────────────────────────────────────────────────────────
# IMPORTANTE: Ejecutar con una cuenta Owner del proyecto:
#   - jorge.garcia@innoteca.mx  ✅ Owner
#   - daguilar@innoteca.mx      ✅ Owner
#
# teseo@teseo.lat NO tiene este permiso (solo Editor, sin iam.workloadIdentityPools.create)
# ────────────────────────────────────────────────────────────────

PROJECT_ID="teseobot-487515"
POOL_NAME="github-actions-pool"
PROVIDER_NAME="github-provider"
SA_NAME="github-actions-deployer"
REPO_OWNER="teseo-bot"   # Org de GitHub confirmada por git remote
REPO_PATTERN="teseo-bot/*"

# ── 0. (OPCIONAL) Elevar permisos de teseo@teseo.lat para futuros setups ──────
# Ejecutar este bloque una sola vez con una cuenta Owner.
# Después, teseo@teseo.lat podrá gestionar el pool sin necesitar Owner.
# Descomentar y ejecutar con jorge.garcia@innoteca.mx o daguilar@innoteca.mx:
#
# gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
#   --member="user:teseo@teseo.lat" \
#   --role="roles/iam.workloadIdentityPoolAdmin"
#
# gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
#   --member="user:teseo@teseo.lat" \
#   --role="roles/iam.serviceAccountAdmin"

# ── 1. Crear el Workload Identity Pool ────────────────────────────────────────
gcloud iam workload-identity-pools create "${POOL_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# ── 2. Crear el Proveedor OIDC dentro del Pool ────────────────────────────────
gcloud iam workload-identity-pools providers create-oidc "${PROVIDER_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_NAME}" \
  --display-name="GitHub Provider" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository,attribute.repository_owner=assertion.repository_owner" \
  --attribute-condition="assertion.repository_owner == '${REPO_OWNER}'" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# ── 3. Crear la Service Account para GitHub Actions ───────────────────────────
gcloud iam service-accounts create "${SA_NAME}" \
  --project="${PROJECT_ID}" \
  --display-name="GitHub Actions Deployer"

# ── 4. Asignar roles mínimos a la SA ─────────────────────────────────────────
# --condition=None es obligatorio cuando la política del proyecto ya tiene bindings condicionales
for ROLE in \
  "roles/run.admin" \
  "roles/artifactregistry.writer" \
  "roles/secretmanager.secretAccessor" \
  "roles/iam.serviceAccountTokenCreator"; do
  gcloud projects add-iam-policy-binding "${PROJECT_ID}" \
    --member="serviceAccount:${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="${ROLE}" \
    --condition=None
done

# ── 5. Vincular el Pool con la Service Account (solo repos de la org) ─────────
POOL_RESOURCE="projects/$(gcloud projects describe ${PROJECT_ID} --format='value(projectNumber)')/locations/global/workloadIdentityPools/${POOL_NAME}"

gcloud iam service-accounts add-iam-policy-binding \
  "${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project="${PROJECT_ID}" \
  --role="roles/iam.workloadIdentityUser" \
  --condition=None \
  --member="principalSet://iam.googleapis.com/${POOL_RESOURCE}/attribute.repository_owner/${REPO_OWNER}"

# ── 6. Obtener los valores para los GitHub Secrets ────────────────────────────
echo "=== VALORES PARA GITHUB SECRETS ==="
echo ""
echo "GCP_SERVICE_ACCOUNT:"
echo "  ${SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"
echo ""
echo "GCP_WORKLOAD_IDENTITY_PROVIDER:"
gcloud iam workload-identity-pools providers describe "${PROVIDER_NAME}" \
  --project="${PROJECT_ID}" \
  --location="global" \
  --workload-identity-pool="${POOL_NAME}" \
  --format="value(name)"
