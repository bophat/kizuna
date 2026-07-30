#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ID="${1:-${PROJECT_ID:-}}"
REGION="${REGION:-asia-southeast1}"
SERVICE="${SERVICE:-kizuna-backend}"
RUNTIME_SA_NAME="${RUNTIME_SA_NAME:-kizuna-backend-runtime}"
BUCKET="${GCS_BUCKET_NAME:-${PROJECT_ID}-kizuna-media}"
DATABASE_SECRET="${DATABASE_SECRET:-kizuna-database-url}"
DJANGO_SECRET="${DJANGO_SECRET:-kizuna-django-secret-key}"
EMAIL_PASSWORD_SECRET="${EMAIL_PASSWORD_SECRET:-kizuna-email-host-password}"
WEBSITE_URL="${WEBSITE_URL:-}"
ADMIN_URL="${ADMIN_URL:-}"
EMAIL_HOST="${EMAIL_HOST:-}"
EMAIL_PORT="${EMAIL_PORT:-587}"
EMAIL_HOST_USER="${EMAIL_HOST_USER:-}"
EMAIL_HOST_PASSWORD="${EMAIL_HOST_PASSWORD:-}"
EMAIL_USE_TLS="${EMAIL_USE_TLS:-True}"
EMAIL_USE_SSL="${EMAIL_USE_SSL:-False}"
DEFAULT_FROM_EMAIL="${DEFAULT_FROM_EMAIL:-}"
CLOUD_RUN_CPU="${CLOUD_RUN_CPU:-1}"
CLOUD_RUN_MEMORY="${CLOUD_RUN_MEMORY:-512Mi}"
CLOUD_RUN_CONCURRENCY="${CLOUD_RUN_CONCURRENCY:-20}"
MIN_INSTANCES="${MIN_INSTANCES:-0}"
MAX_INSTANCES="${MAX_INSTANCES:-3}"

if [[ -z "$PROJECT_ID" ]]; then
  echo "Usage: ./deploy-cloud-run.sh <GCP_PROJECT_ID>"
  exit 2
fi

for command in gcloud openssl; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command"
    exit 2
  fi
done

if [[ -z "$WEBSITE_URL" ]]; then
  read -r -p "Vercel website URL (https://...): " WEBSITE_URL
fi
if [[ -z "$ADMIN_URL" ]]; then
  read -r -p "Vercel admin URL (https://...): " ADMIN_URL
fi
if [[ -z "$EMAIL_HOST" ]]; then
  read -r -p "SMTP host: " EMAIL_HOST
fi
if [[ -z "$EMAIL_HOST_USER" ]]; then
  read -r -p "SMTP username: " EMAIL_HOST_USER
fi
if [[ -z "$DEFAULT_FROM_EMAIL" ]]; then
  read -r -p "From email (for example KIZUNA <no-reply@example.com>): " DEFAULT_FROM_EMAIL
fi

WEBSITE_URL="${WEBSITE_URL%/}"
ADMIN_URL="${ADMIN_URL%/}"
for frontend_url in "$WEBSITE_URL" "$ADMIN_URL"; do
  if [[ ! "$frontend_url" =~ ^https:// ]]; then
    echo "Vercel URLs must start with https://"
    exit 2
  fi
done
if [[ -z "$EMAIL_HOST" || -z "$EMAIL_HOST_USER" || -z "$DEFAULT_FROM_EMAIL" ]]; then
  echo "SMTP host, username and from email are required."
  exit 2
fi
case "$EMAIL_USE_TLS" in
  1|true|TRUE|True|yes|YES) EMAIL_USE_TLS="True" ;;
  0|false|FALSE|False|no|NO) EMAIL_USE_TLS="False" ;;
  *) echo "EMAIL_USE_TLS must be True or False."; exit 2 ;;
esac
case "$EMAIL_USE_SSL" in
  1|true|TRUE|True|yes|YES) EMAIL_USE_SSL="True" ;;
  0|false|FALSE|False|no|NO) EMAIL_USE_SSL="False" ;;
  *) echo "EMAIL_USE_SSL must be True or False."; exit 2 ;;
esac
if [[ "$EMAIL_USE_TLS" == "True" && "$EMAIL_USE_SSL" == "True" ]]; then
  echo "EMAIL_USE_TLS and EMAIL_USE_SSL cannot both be True."
  exit 2
fi
if [[ ! "$EMAIL_PORT" =~ ^[0-9]+$ ]]; then
  echo "EMAIL_PORT must be a number."
  exit 2
fi

RUNTIME_SA="${RUNTIME_SA_NAME}@${PROJECT_ID}.iam.gserviceaccount.com"

secret_exists() {
  gcloud secrets describe "$1" --project "$PROJECT_ID" >/dev/null 2>&1
}

create_or_update_secret() {
  local secret_id="$1"
  local secret_value="$2"

  if secret_exists "$secret_id"; then
    if [[ -n "$secret_value" ]]; then
      printf '%s' "$secret_value" \
        | gcloud secrets versions add "$secret_id" \
            --project "$PROJECT_ID" \
            --data-file=- >/dev/null
      echo "Updated secret: $secret_id"
    else
      echo "Reusing secret: $secret_id"
    fi
  else
    printf '%s' "$secret_value" \
      | gcloud secrets create "$secret_id" \
          --project "$PROJECT_ID" \
          --replication-policy=automatic \
          --data-file=- >/dev/null
    echo "Created secret: $secret_id"
  fi
}

echo "Configuring Google Cloud project: $PROJECT_ID"
gcloud config set project "$PROJECT_ID" >/dev/null
gcloud services enable \
  run.googleapis.com \
  cloudbuild.googleapis.com \
  artifactregistry.googleapis.com \
  secretmanager.googleapis.com \
  storage.googleapis.com \
  iam.googleapis.com \
  --project "$PROJECT_ID"

if ! gcloud iam service-accounts describe "$RUNTIME_SA" \
  --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud iam service-accounts create "$RUNTIME_SA_NAME" \
    --project "$PROJECT_ID" \
    --display-name="KIZUNA backend Cloud Run runtime"
fi

if ! gcloud storage buckets describe "gs://${BUCKET}" \
  --project "$PROJECT_ID" >/dev/null 2>&1; then
  gcloud storage buckets create "gs://${BUCKET}" \
    --project "$PROJECT_ID" \
    --location "$REGION" \
    --uniform-bucket-level-access
fi

gcloud storage buckets add-iam-policy-binding "gs://${BUCKET}" \
  --member="serviceAccount:${RUNTIME_SA}" \
  --role="roles/storage.objectAdmin" >/dev/null

database_value="${DATABASE_URL:-}"
if ! secret_exists "$DATABASE_SECRET" && [[ -z "$database_value" ]]; then
  read -r -s -p "Existing Neon DATABASE_URL: " database_value
  echo
fi
if ! secret_exists "$DATABASE_SECRET" && [[ -z "$database_value" ]]; then
  echo "DATABASE_URL cannot be empty."
  exit 2
fi
create_or_update_secret "$DATABASE_SECRET" "$database_value"

django_secret_value="${DJANGO_SECRET_KEY:-}"
if ! secret_exists "$DJANGO_SECRET" && [[ -z "$django_secret_value" ]]; then
  django_secret_value="$(openssl rand -base64 48)"
fi
create_or_update_secret "$DJANGO_SECRET" "$django_secret_value"

if ! secret_exists "$EMAIL_PASSWORD_SECRET" && [[ -z "$EMAIL_HOST_PASSWORD" ]]; then
  read -r -s -p "SMTP password or API key: " EMAIL_HOST_PASSWORD
  echo
fi
if ! secret_exists "$EMAIL_PASSWORD_SECRET" && [[ -z "$EMAIL_HOST_PASSWORD" ]]; then
  echo "SMTP password or API key cannot be empty."
  exit 2
fi
create_or_update_secret "$EMAIL_PASSWORD_SECRET" "$EMAIL_HOST_PASSWORD"

for secret_id in "$DATABASE_SECRET" "$DJANGO_SECRET" "$EMAIL_PASSWORD_SECRET"; do
  gcloud secrets add-iam-policy-binding "$secret_id" \
    --project "$PROJECT_ID" \
    --member="serviceAccount:${RUNTIME_SA}" \
    --role="roles/secretmanager.secretAccessor" >/dev/null
done

echo "Building and deploying Django backend: $SERVICE"
echo "Region: $REGION | min instances: $MIN_INSTANCES | max instances: $MAX_INSTANCES"
gcloud run deploy "$SERVICE" \
  --project "$PROJECT_ID" \
  --source "$SCRIPT_DIR/backend" \
  --region "$REGION" \
  --allow-unauthenticated \
  --service-account "$RUNTIME_SA" \
  --cpu="$CLOUD_RUN_CPU" \
  --memory="$CLOUD_RUN_MEMORY" \
  --concurrency="$CLOUD_RUN_CONCURRENCY" \
  --min="$MIN_INSTANCES" \
  --max="$MAX_INSTANCES" \
  --timeout=300 \
  --set-env-vars="^|^DJANGO_DEBUG=False|DJANGO_ALLOWED_HOSTS=.run.app|GCS_BUCKET_NAME=${BUCKET}|SECURE_SSL_REDIRECT=True|SOURCE_IMPORT_USE_FAKE_PROVIDERS=False|CORS_ALLOWED_ORIGINS=${WEBSITE_URL},${ADMIN_URL}|CSRF_TRUSTED_ORIGINS=${WEBSITE_URL},${ADMIN_URL}|WEBSITE_URL=${WEBSITE_URL}|EMAIL_BACKEND=django.core.mail.backends.smtp.EmailBackend|EMAIL_HOST=${EMAIL_HOST}|EMAIL_PORT=${EMAIL_PORT}|EMAIL_HOST_USER=${EMAIL_HOST_USER}|EMAIL_USE_TLS=${EMAIL_USE_TLS}|EMAIL_USE_SSL=${EMAIL_USE_SSL}|DEFAULT_FROM_EMAIL=${DEFAULT_FROM_EMAIL}|EMAIL_VERIFICATION_TIMEOUT=86400" \
  --set-secrets="DATABASE_URL=${DATABASE_SECRET}:latest,DJANGO_SECRET_KEY=${DJANGO_SECRET}:latest,EMAIL_HOST_PASSWORD=${EMAIL_PASSWORD_SECRET}:latest"

NON_DETERMINISTIC_SERVICE_URL="$(
  gcloud run services describe "$SERVICE" \
    --project "$PROJECT_ID" \
    --region "$REGION" \
    --format='value(status.url)'
)"
PROJECT_NUMBER="$(
  gcloud projects describe "$PROJECT_ID" \
    --format='value(projectNumber)'
)"
DETERMINISTIC_SERVICE_NAME="${SERVICE}-${PROJECT_NUMBER}"
if (( ${#DETERMINISTIC_SERVICE_NAME} <= 63 )); then
  SERVICE_URL="https://${DETERMINISTIC_SERVICE_NAME}.${REGION}.run.app"
else
  SERVICE_URL="$NON_DETERMINISTIC_SERVICE_URL"
fi

echo
echo "Backend deploy complete: $SERVICE_URL"
echo "Health check: $SERVICE_URL/api/health/"
echo
echo "Update both Vercel projects and redeploy them:"
echo "VITE_API_BASE_URL=$SERVICE_URL/api"
echo "VITE_MEDIA_BASE_URL=$SERVICE_URL"
