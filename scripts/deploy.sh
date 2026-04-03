#!/bin/bash
set -euo pipefail

# ─────────────────────────────────────────────
# One Assist — Deploy to Cloud Run
# Domain: app.one-assist.app
# ─────────────────────────────────────────────

PROJECT_ID="one-assist"
REGION="us-south1"
SERVICE_NAME="one-assist-app"
DOMAIN="app.one-assist.app"
IMAGE="gcr.io/${PROJECT_ID}/${SERVICE_NAME}"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

info()  { echo -e "${GREEN}▸${NC} $1"; }
warn()  { echo -e "${YELLOW}▸${NC} $1"; }
error() { echo -e "${RED}✗${NC} $1"; exit 1; }

# ── Pre-flight checks ──
command -v gcloud >/dev/null 2>&1 || error "gcloud CLI not installed"
command -v docker >/dev/null 2>&1 || error "docker not installed"

# Check required env file
ENV_FILE=".env.prod"
if [ ! -f "$ENV_FILE" ]; then
  error "Missing ${ENV_FILE} — create it with your production env vars."
fi

# Source env file
set -a
source "$ENV_FILE"
set +a

# Validate required vars
for var in NEXT_PUBLIC_SUPABASE_URL NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY SUPABASE_SECRET_KEY OPENAI_API_KEY PLATFORM_URL; do
  [ -n "${!var:-}" ] || error "Missing $var in $ENV_FILE"
done

# ── Set GCP project ──
info "Setting GCP project to ${PROJECT_ID}"
gcloud config set project "$PROJECT_ID" --quiet

# ── Enable required APIs (idempotent) ──
info "Enabling required APIs..."
gcloud services enable \
  run.googleapis.com \
  containerregistry.googleapis.com \
  cloudbuild.googleapis.com \
  --quiet

# ── Build Docker image ──
info "Building Docker image..."
docker build \
  --build-arg NEXT_PUBLIC_SUPABASE_URL="$NEXT_PUBLIC_SUPABASE_URL" \
  --build-arg NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY="$NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY" \
  --platform linux/amd64 \
  -t "$IMAGE" .

# ── Push to GCR ──
info "Pushing image to GCR..."
gcloud auth configure-docker --quiet 2>/dev/null
docker push "$IMAGE"

# ── Build env vars string for Cloud Run ──
# Only server-side secrets (NEXT_PUBLIC_* are baked into the build)
ENV_VARS=$(cat <<ENVVARS
SUPABASE_SECRET_KEY=${SUPABASE_SECRET_KEY},\
OPENAI_API_KEY=${OPENAI_API_KEY},\
PLATFORM_URL=${PLATFORM_URL},\
PLATFORM_DOMAIN=${PLATFORM_DOMAIN},\
GCP_PROJECT_ID=${GCP_PROJECT_ID},\
GCP_DNS_ZONE_NAME=${GCP_DNS_ZONE_NAME},\
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL},\
NEXT_PUBLIC_SUPABASE_URL=${NEXT_PUBLIC_SUPABASE_URL},\
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=${NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}
ENVVARS
)

# ── Deploy to Cloud Run ──
info "Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$IMAGE" \
  --region "$REGION" \
  --platform managed \
  --allow-unauthenticated \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 0 \
  --max-instances 3 \
  --timeout 300 \
  --set-env-vars "$ENV_VARS" \
  --quiet

# ── Get service URL ──
SERVICE_URL=$(gcloud run services describe "$SERVICE_NAME" --region "$REGION" --format="value(status.url)")
info "Deployed to: ${SERVICE_URL}"

# ── Custom domain mapping ──
echo ""
info "Setting up custom domain: ${DOMAIN}"

# Check if domain mapping already exists
if gcloud run domain-mappings describe --domain="$DOMAIN" --region="$REGION" 2>/dev/null; then
  info "Domain mapping already exists for ${DOMAIN}"
else
  warn "Creating domain mapping for ${DOMAIN}..."
  gcloud run domain-mappings create \
    --service="$SERVICE_NAME" \
    --domain="$DOMAIN" \
    --region="$REGION" \
    --quiet || true
fi

echo ""
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo -e "${GREEN} Deployment complete!${NC}"
echo -e "${GREEN}═══════════════════════════════════════════${NC}"
echo ""
echo -e " Cloud Run URL:  ${SERVICE_URL}"
echo -e " Custom domain:  https://${DOMAIN}"
echo ""
echo -e "${YELLOW} DNS Setup (if first time):${NC}"
echo -e " Add a CNAME record in your DNS:"
echo -e "   ${DOMAIN} → ghs.googlehosted.com."
echo ""
echo -e " Or verify with:"
echo -e "   gcloud run domain-mappings describe --domain=${DOMAIN} --region=${REGION}"
echo ""
