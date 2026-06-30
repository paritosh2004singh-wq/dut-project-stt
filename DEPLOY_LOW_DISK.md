# Deployment Guide for Low-Disk Environments (e2-micro)

This guide helps you deploy on VMs with limited disk space like GCP e2-micro instances.

## Problem
Docker builds fail with `E: You don't have enough free space in /var/cache/apt/archives/`

## Solutions

### 1. **Pre-Build Cleanup** (Run this first!)

```bash
# Clean Docker resources
bash backend/cleanup-docker.sh

# Or manually:
docker system prune -a -f
docker builder prune -a -f

# Clean system packages
sudo apt-get clean
sudo apt-get autoremove -y

# Clean journal logs
sudo journalctl --vacuum-time=3d

# Check available space
df -h
```

### 2. **Build Images One at a Time** (Recommended for e2-micro)

Instead of building all services at once, build sequentially:

```bash
# Build workers first (smaller footprint)
docker-compose build stt-worker
docker system prune -f  # Clean after each build

docker-compose build llm-worker
docker system prune -f

# Start services
docker-compose up -d
```

### 3. **Use Pre-built Images** (Best for production)

Instead of building on the VM, build elsewhere and push to a registry:

```bash
# On your local machine or CI/CD:
docker build -t your-registry/stt-worker:latest -f backend/Dockerfile.worker backend/
docker push your-registry/stt-worker:latest

docker build -t your-registry/llm-worker:latest -f backend/Dockerfile.worker backend/
docker push your-registry/llm-worker:latest

# On the VM, update docker-compose.yml to use pre-built images:
# stt-worker:
#   image: your-registry/stt-worker:latest
#   # Remove build section
```

### 4. **Increase Swap Space**

```bash
# Check current swap
free -h

# Create 2GB swap file
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile

# Make permanent
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

# Verify
free -h
```

### 5. **Monitor Disk Usage**

```bash
# Check overall disk usage
df -h

# Check Docker disk usage
docker system df

# Check largest directories
du -sh /* 2>/dev/null | sort -h | tail -10

# Monitor in real-time during build
watch -n 5 'df -h && echo "" && docker system df'
```

## Dockerfile Optimizations Applied

### ✅ Multi-stage builds
- **Builder stage**: Installs dependencies and compiles
- **Runner stage**: Only runtime files, no build tools

### ✅ Aggressive cleanup in RUN commands
```dockerfile
RUN apt-get update && \
    apt-get install -y --no-install-recommends curl ca-certificates && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/* /tmp/* /var/tmp/* /var/cache/apt/archives/*
```

### ✅ Removed cache mounts
- Cache mounts keep data between builds, consuming disk space
- Better for CI/CD, but problematic on low-disk VMs

### ✅ Deleted unnecessary files
```dockerfile
RUN uv pip install --system --no-cache -r requirements.txt && \
    find /usr/local -type f -name '*.pyc' -delete && \
    find /usr/local -type d -name '__pycache__' -delete
```

### ✅ .dockerignore files
- Reduces build context size
- Excludes unnecessary files from being sent to Docker daemon

## Space Requirements

| Service | Builder Stage | Runner Stage | Total |
|---------|--------------|--------------|-------|
| stt-worker | ~500MB | ~200MB | ~700MB |
| llm-worker | ~500MB | ~200MB | ~700MB |
| Redis | - | ~50MB | ~50MB |

**Total**: ~1.5GB for Docker images + ~1GB for build process = **~2.5GB minimum**

## Recommended VM Specs

- **Minimum**: 10GB disk, 1GB RAM (e2-micro with swap)
- **Recommended**: 20GB disk, 2GB RAM (e2-small)
- **Optimal**: 30GB+ disk, 4GB+ RAM (e2-medium)

## Emergency: Build Failing?

```bash
# 1. Stop everything
docker-compose down

# 2. Nuclear cleanup
docker system prune -a -f --volumes
sudo apt-get clean
sudo apt-get autoremove -y

# 3. Check space (should have at least 3GB free)
df -h

# 4. If still low on space, check for large files
sudo du -sh /var/* 2>/dev/null | sort -h | tail -10

# 5. Build one at a time
docker-compose build stt-worker

# 6. If that succeeds, continue
docker-compose build llm-worker
docker-compose up -d
```

## Alternative: Remote Docker Build

Build on a machine with more resources, then export/import:

```bash
# On powerful machine:
docker build -t stt-worker -f backend/Dockerfile.worker backend/
docker save stt-worker | gzip > stt-worker.tar.gz

# Transfer to VM:
scp stt-worker.tar.gz user@vm:/tmp/

# On VM:
docker load < /tmp/stt-worker.tar.gz
rm /tmp/stt-worker.tar.gz
```

## Monitoring

Add this to your deployment script:

```bash
#!/bin/bash
echo "=== Disk Space Before Build ==="
df -h /
echo ""

echo "=== Docker Disk Usage ==="
docker system df
echo ""

# Your build commands here

echo "=== Disk Space After Build ==="
df -h /
```
