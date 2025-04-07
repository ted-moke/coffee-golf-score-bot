#!/bin/bash

# Exit on any error
set -e

# Load environment variables from .env file, handling Windows line endings
if [ -f .env ]; then
    echo "📝 Loading configuration from .env file..."
    export $(cat .env | tr -d '\r' | grep -v '^#' | xargs)
else
    echo "❌ .env file not found!"
    exit 1
fi

# Clean variables
PROJECT_ID=$(echo "${PROJECT_ID}" | tr -d '\r')
REGION=$(echo "${REGION:-us-central1}" | tr -d '\r')
SERVICE_NAME=$(echo "${SERVICE_NAME:-coffee-golf-discord-bot}" | tr -d '\r')
IMAGE_NAME=$(echo "${IMAGE_NAME:-coffee-golf-discord-bot}" | tr -d '\r')

echo "🔍 Using configuration:"
echo "  Project ID: $PROJECT_ID"
echo "  Region: $REGION"
echo "  Service: $SERVICE_NAME"
echo "  Image: $IMAGE_NAME"

echo "🏗️ Building TypeScript..."
npm run build

echo "🐳 Building Docker image..."
docker build -t "$REGION-docker.pkg.dev/$PROJECT_ID/coffee-golf-repo/$IMAGE_NAME" .

echo "⬆️ Pushing Docker image..."
docker push "$REGION-docker.pkg.dev/$PROJECT_ID/coffee-golf-repo/$IMAGE_NAME"

echo "🚀 Deploying to Cloud Run..."
gcloud run deploy "$SERVICE_NAME" \
  --image "$REGION-docker.pkg.dev/$PROJECT_ID/coffee-golf-repo/$IMAGE_NAME" \
  --platform managed \
  --region "$REGION" \
  --memory 1Gi \
  --cpu 1 \
  --min-instances 1 \
  --concurrency 80 \
  --timeout 3600 \
  --allow-unauthenticated \
  --set-secrets="DISCORD_TOKEN=DISCORD_TOKEN:latest,CHANNEL_ID=CHANNEL_ID:latest,BUCKET_NAME=BUCKET_NAME:latest,GOOGLE_APPLICATION_CREDENTIALS_JSON=GOOGLE_APPLICATION_CREDENTIALS_JSON:latest"

echo "✅ Deployment complete!"
