#!/bin/bash
set -e

# Polyglot Scholar Deployment Script
# Usage: ./deploy.sh <image_repo> <tag>

IMAGE_REPO=$1
IMAGE_TAG=$2

if [ -z "$IMAGE_REPO" ] || [ -z "$IMAGE_TAG" ]; then
    echo "Usage: $0 <image_repo> <image_tag>"
    exit 1
fi

FULL_IMAGE="$IMAGE_REPO:$IMAGE_TAG"
CONTAINER_NAME="polyglot-scholar"

echo "Deploying $FULL_IMAGE..."

# 1. Pull latest image
echo "Pulling latest image..."
docker pull $FULL_IMAGE

# 2. Stop old container
if docker ps -a --format '{{.Names}}' | grep -q "^${CONTAINER_NAME}$"; then
    echo "Stopping old container..."
    docker stop $CONTAINER_NAME || true
    docker rm $CONTAINER_NAME || true
fi

# 3. Start new container
echo "Starting new container..."
docker run -d \
    --name $CONTAINER_NAME \
    --restart always \
    -p 8080:3000 \
    --env-file .env \
    $FULL_IMAGE

# 4. Cleanup
echo "Cleaning up old images..."
docker image prune -f

echo "✅ Deployment successful!"
