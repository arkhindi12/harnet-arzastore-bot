#!/bin/bash
# Deploy ArzaBot ke VPS
# Jalankan: bash deploy.sh
# Akan minta password 2x (upload + setup)

VPS_HOST="43.133.136.244"
VPS_USER="ubuntu"
VPS_PATH="/www/wwwroot/bot.arzastore.com"

echo "🚀 Deploying ArzaBot ke $VPS_HOST..."
echo "Password VPS: UPM-ULq-F6s-2ZK"
echo ""

# 1. Upload files
echo "📦 Step 1: Upload files (masukkan password)..."
rsync -avz --progress \
  --exclude node_modules \
  --exclude .git \
  --exclude client/node_modules \
  --exclude data/app.db \
  --exclude data/uploads \
  --exclude tmp_* \
  -e ssh ./ "$VPS_USER@$VPS_HOST:$VPS_PATH/"

if [ $? -ne 0 ]; then
  echo "❌ Upload gagal. Cek koneksi/password."
  exit 1
fi

# 2. Remote setup
echo ""
echo "⚙️ Step 2: Setup di VPS (masukkan password lagi)..."
ssh "$VPS_USER@$VPS_HOST" << 'REMOTE'
cd /www/wwwroot/bot.arzastore.com

# Install Node.js 20
if ! command -v node &> /dev/null || [[ $(node -v) != v20* ]]; then
  echo "Installing Node.js 20..."
  curl -fsSL https://deb.nodesource.com/setup_20.x | sudo bash -
  sudo apt install -y nodejs
fi

echo "Node: $(node -v)"
echo "NPM: $(npm -v)"

# Install deps
echo "📥 Installing server dependencies..."
npm install --production

echo "📥 Installing client dependencies..."
cd client && npm install && echo "🔨 Building frontend..." && npm run build && cd ..

# Chromium
echo "🌐 Installing Chromium for Patchright..."
npx patchright install chromium 2>/dev/null || true

# Folders
mkdir -p data/uploads

# .env
if [ ! -f .env ]; then
  JWT=$(openssl rand -hex 16)
  cat > .env << EOF
PORT=3001
JWT_SECRET=arzabot-$JWT
BROWSER_MAX_CONCURRENT=3
NODE_ENV=production
EOF
  echo "✅ .env created"
fi

# PM2
if ! command -v pm2 &> /dev/null; then
  echo "Installing PM2..."
  sudo npm install -g pm2
fi

pm2 stop arzabot 2>/dev/null || true
pm2 delete arzabot 2>/dev/null || true
pm2 start server/index.js --name arzabot
pm2 save
sudo env PATH=$PATH:/usr/bin pm2 startup systemd -u ubuntu --hp /home/ubuntu 2>/dev/null || true

echo ""
echo "========================================="
echo "✅ DEPLOY SELESAI!"
echo "🌐 http://43.133.136.244:3001"
echo "========================================="
pm2 status
REMOTE

echo ""
echo "🎉 Done! Buka http://43.133.136.244:3001"
