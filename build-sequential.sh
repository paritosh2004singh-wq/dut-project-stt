#!/bin/bash

# Sequential Docker build script for low-disk environments
# This script provides multiple build strategies for resource-constrained VMs

set -e  # Exit on error

echo "=========================================="
echo "Sequential Docker Build"
echo "=========================================="
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
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

# Show menu
show_menu() {
    echo "Choose build method:"
    echo ""
    echo -e "${BLUE}1)${NC} Single-threaded build ${GREEN}(RECOMMENDED for e2-micro)${NC}"
    echo "   Uses BUILDKIT_MAX_PARALLEL_BUILDS=1 to build one service at a time"
    echo "   Most reliable for low-memory VMs (1GB RAM)"
    echo ""
    echo -e "${BLUE}2)${NC} Manual sequential build"
    echo "   Builds services individually with cleanup between each"
    echo "   Good for troubleshooting specific service builds"
    echo ""
    echo -e "${BLUE}3)${NC} Exit"
    echo ""
}

# Method 1: Single-threaded build
single_threaded_build() {
    echo "=========================================="
    echo -e "${YELLOW}Single-Threaded Build${NC}"
    echo "=========================================="
    echo ""
    
    echo "This will build all services sequentially (one at a time)."
    echo "Expected time: 5-10 minutes depending on your VM."
    echo ""
    
    # Show disk space
    check_disk_space
    
    # Initial cleanup
    cleanup_docker
    
    echo -e "${YELLOW}Starting build with BUILDKIT_MAX_PARALLEL_BUILDS=1...${NC}"
    echo ""
    
    # Build with single-threaded mode
    if BUILDKIT_MAX_PARALLEL_BUILDS=1 docker compose up --build -d; then
        echo ""
        echo -e "${GREEN}✓ Build completed successfully!${NC}"
        echo ""
        return 0
    else
        echo ""
        echo -e "${RED}✗ Build failed${NC}"
        echo ""
        return 1
    fi
}

# Method 2: Manual sequential build
manual_sequential_build() {
    echo "=========================================="
    echo -e "${YELLOW}Manual Sequential Build${NC}"
    echo "=========================================="
    echo ""
    
    # Initial disk space check
    check_disk_space
    
    # Initial cleanup
    cleanup_docker
    
    # Build services one by one
    SERVICES=("stt-worker" "llm-worker")
    
    for SERVICE in "${SERVICES[@]}"; do
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
        
        # Brief pause between builds
        sleep 2
    done
    
    # Start services
    echo -e "${YELLOW}Starting services...${NC}"
    if docker-compose up -d; then
        echo -e "${GREEN}✓ Services started${NC}"
        return 0
    else
        echo -e "${RED}✗ Failed to start services${NC}"
        return 1
    fi
}

# Main execution
echo "This script helps build Docker images on resource-constrained VMs."
echo ""

# Show menu and get choice
show_menu
read -p "Select option (1-3): " choice

case $choice in
    1)
        if single_threaded_build; then
            SUCCESS=true
        else
            SUCCESS=false
        fi
        ;;
    2)
        if manual_sequential_build; then
            SUCCESS=true
        else
            SUCCESS=false
        fi
        ;;
    3)
        echo "Exiting..."
        exit 0
        ;;
    *)
        echo -e "${RED}Invalid option${NC}"
        exit 1
        ;;
esac

# Final summary
if [ "$SUCCESS" = true ]; then
    echo ""
    echo "=========================================="
    echo -e "${GREEN}Build completed successfully!${NC}"
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
    
    echo "Running containers:"
    docker-compose ps
    echo ""
    
    echo -e "${GREEN}✓ Services are running!${NC}"
    echo ""
    echo "View logs with: docker-compose logs -f"
else
    echo ""
    echo "=========================================="
    echo -e "${RED}Build failed!${NC}"
    echo "=========================================="
    echo ""
    echo "Troubleshooting tips:"
    echo "1. Run: bash backend/cleanup-docker.sh"
    echo "2. Check: df -h"
    echo "3. See: DEPLOY_LOW_DISK.md"
    echo ""
    exit 1
fi
