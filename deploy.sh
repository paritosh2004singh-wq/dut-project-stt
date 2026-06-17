#!/bin/bash
set -e

echo "Setting up e2-micro deployment for backend..."

# 1. Create a 2GB swap file if it doesn't exist
if [ ! -f /swapfile ]; then
    echo "Creating 2GB swap file..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
else
    echo "Swap file already exists."
fi

# 2. Get the public IP address
PUBLIC_IP=$(curl -s ifconfig.me)
if [ -z "$PUBLIC_IP" ]; then
    echo "Could not detect public IP. Please ensure the VM has internet access."
    exit 1
fi

DOMAIN="${PUBLIC_IP//./-}.nip.io"
echo "========================================================="
echo "Your nip.io domain is: $DOMAIN"
echo "Please set VITE_WS_BASE_URL=wss://$DOMAIN/ws/transcribe"
echo "in your Render dashboard for the frontend."
echo "========================================================="

# 3. Export DOMAIN for docker-compose to pass to Caddy
export DOMAIN

# 4. Check for .env file
if [ ! -f backend/.env ]; then
    echo "backend/.env not found! Creating a template..."
    echo "MISTRAL_API_KEY=your_key_here" > backend/.env
    echo "GROQ_API_KEY=your_key_here" >> backend/.env
    echo "Please edit backend/.env with your actual API keys, then run this script again."
    exit 1
fi

# 5. Run docker-compose
echo "Building and starting containers..."
cd backend
docker compose -f docker-compose.prod.yml up -d --build

echo "Deployment complete! Backend is securely running at wss://$DOMAIN/ws/transcribe"
