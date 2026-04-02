#!/bin/bash
# scripts/setup-gcp.sh
# Run this once to set up the GCP project for OpenClaw Platform

set -euo pipefail

PROJECT_ID="openclaw-platform"
REGION="us-central1"
TF_STATE_BUCKET="openclaw-platform-tf-state"

echo "=== Creating GCP Project ==="
gcloud projects create $PROJECT_ID --name="OpenClaw Platform" || echo "Project exists"
gcloud config set project $PROJECT_ID

echo "=== Enabling APIs ==="
gcloud services enable compute.googleapis.com
gcloud services enable dns.googleapis.com

echo "=== Creating Terraform state bucket ==="
gcloud storage buckets create gs://$TF_STATE_BUCKET --location=$REGION || echo "Bucket exists"

echo "=== Creating service account ==="
gcloud iam service-accounts create openclaw-terraform \
  --display-name="OpenClaw Terraform" || echo "SA exists"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclaw-terraform@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/compute.admin"

gcloud projects add-iam-policy-binding $PROJECT_ID \
  --member="serviceAccount:openclaw-terraform@$PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/storage.admin"

echo "=== Generating key file ==="
gcloud iam service-accounts keys create ./terraform-sa-key.json \
  --iam-account=openclaw-terraform@$PROJECT_ID.iam.gserviceaccount.com

echo "=== Initializing Terraform ==="
cd terraform
terraform init

echo ""
echo "Done! Add these to .env.local:"
echo "  GCP_PROJECT_ID=$PROJECT_ID"
echo "  GCP_CREDENTIALS_PATH=$(pwd)/../terraform-sa-key.json"
