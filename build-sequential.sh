#!/bin/bash

# Sequential Docker build script for low-disk environments
# This script builds images one at a time with cleanup in between

set -e  # Exit on error

echo "=========================================="
echo "Sequential Docker Build"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check disk space
check_disk_space() {
    echo -e "${YELLOW}Checking disk space...${NC}"
    df -h / | grep -v Filesystem
    AVAILABLE=$(df / | tail -1 | awk '{print $4}')
    echo "Available: ${AVAILABLE}K"
    echo ""
    
    if [ "$AVAILABLE" -lt 3000000 ]; then
        echo -e "${RED}WARNING: Less than 3GB free space available!${NC}"
        echo "Consider running cleanup or freeing up space."
        read -p "Continue anyway? (y/N) " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Function to cleanup Docker
cleanup_docker() {
    echo -e "${YELLOW}Cleaning up Docker resources...${NC}"
    docker container prune -f > /dev/null 2>&1 || true
    docker image prune -f > /dev/null 2>&1 || true
    docker builder prune -f > /dev/null 2>&1 || true
    echo -e "${GREEN}✓ Cleanup complete${NC}"
    echo ""
}

# Function to build a service
build_service() {
    SERVICE=$1
    echo "=========================================="
    echo -e "${YELLOW}Building: $SERVICE${NC}"
    echo "=========================================="
    
    # Show disk space before build
    echo "Disk space before build:"
    df -h / | grep -v Filesystem
    echo ""
    
    # Build with BuildKit
    export DOCKER_BUILDKIT=1
    if docker-compose build "$SERVICE"; then
        echo ""
        echo -e "${GREEN}✓ $SERVICE built successfully${NC}"
    else
        echo ""
        echo -e "${RED}✗ $SERVICE build failed${NC}"
        return 1
    fi
    
    # Show disk space after build
    echo ""
    echo "Disk space after build:"
    df -h / | grep -v Filesystem
    echo ""
    
    # Cleanup after each build
    cleanup_docker
}

# Main execution
echo "This script will build Docker images sequentially to minimize disk usage."
echo ""

# Initial disk space check
check_disk_space

# Initial cleanup
cleanup_docker

# Build services one by one
SERVICES=("stt-worker" "llm-worker")

for SERVICE in "${SERVICES[@]}"; do
    if ! build_service "$SERVICE"; then
        echo ""
        echo -e "${RED}Build failed for $SERVICE${NC}"
        echo "Check the error messages above."
        echo ""
        echo "Troubleshooting tips:"
        echo "1. Run: bash backend/cleanup-docker.sh"
        echo "2. Check: df -h"
        echo "3. See: DEPLOY_LOW_DISK.md"
        exit 1
    fi
    
    # Brief pause between builds
    sleep 2
done

# Final summary
echo "=========================================="
echo -e "${GREEN}All builds completed successfully!${NC}"
echo "=========================================="
echo ""

echo "Docker images:"
docker images | grep -E "backend|worker" || true
echo ""

echo "Docker disk usage:"
docker system df
echo ""

echo "System disk usage:"
df -h /
echo ""

echo -e "${GREEN}✓ Ready to start services with: docker-compose up -d${NC}"
