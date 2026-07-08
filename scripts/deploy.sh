# scripts/deploy.sh
#!/bin/bash

# ============================================
# SKRIPT DEPLOY PËR PRODHIM
# ============================================

set -e

echo "🚀 Starting deployment..."

# Ngarko variablat e mjedisit
if [ -f .env.production ]; then
    export $(cat .env.production | grep -v '^#' | xargs)
else
    echo "❌ .env.production file not found!"
    exit 1
fi

# 1. Build images
echo "📦 Building Docker images..."
docker-compose -f docker-compose.prod.yml build

# 2. Stop containers
echo "🛑 Stopping old containers..."
docker-compose -f docker-compose.prod.yml down

# 3. Start containers
echo "▶️ Starting new containers..."
docker-compose -f docker-compose.prod.yml up -d

# 4. Wait for services to be ready
echo "⏳ Waiting for services to be ready..."
sleep 15

# 5. Health check
echo "🔍 Running health checks..."
if curl -f http://localhost/health; then
    echo "✅ Health check passed!"
else
    echo "❌ Health check failed!"
    docker-compose -f docker-compose.prod.yml logs
    exit 1
fi

# 6. Cleanup
echo "🧹 Cleaning up old images..."
docker system prune -f --filter "until=24h"

echo "🎉 Deployment completed successfully!"