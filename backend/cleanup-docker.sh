#!/bin/bash

# Docker cleanup script for low-disk environments
# This script aggressively cleans Docker resources to free up space

echo "🧹 Starting Docker cleanup..."

# Remove all stopped containers
echo "Removing stopped containers..."
docker container prune -f

# Remove dangling images
echo "Removing dangling images..."
docker image prune -f

# Remove unused images (be careful with this one)
echo "Removing unused images..."
docker image prune -a -f

# Remove build cache
echo "Removing build cache..."
docker builder prune -a -f

# Remove unused volumes
echo "Removing unused volumes..."
docker volume prune -f

# Remove unused networks
echo "Removing unused networks..."
docker network prune -f

# Show disk usage
echo ""
echo "📊 Current Docker disk usage:"
docker system df

echo ""
echo "✅ Cleanup complete!"
echo ""
echo "💡 Additional space-saving tips:"
echo "   - Run: sudo apt-get clean"
echo "   - Run: sudo apt-get autoremove"
echo "   - Run: sudo journalctl --vacuum-time=3d"
echo "   - Check: df -h"
