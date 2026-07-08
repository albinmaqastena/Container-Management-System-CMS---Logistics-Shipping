# scripts/rollback.sh
#!/bin/bash

# ============================================
# SKRIPT ROLLBACK
# ============================================

set -e

echo "🔄 Starting rollback..."

# Gjej imazhin e fundit të qëndrueshëm
LAST_KNOWN_GOOD=$(docker images --format "{{.Repository}}:{{.Tag}}" | grep backend | head -n 2 | tail -n 1)

if [ -z "$LAST_KNOWN_GOOD" ]; then
    echo "❌ No previous image found for rollback!"
    exit 1
fi

echo "🔙 Rolling back to: $LAST_KNOWN_GOOD"

# Përditëso docker-compose për të përdorur imazhin e vjetër
sed -i "s|image:.*backend.*|image: $LAST_KNOWN_GOOD|g" docker-compose.prod.yml

# Rinis container-at
docker-compose -f docker-compose.prod.yml down
docker-compose -f docker-compose.prod.yml up -d

echo "✅ Rollback completed!"