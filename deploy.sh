#!/bin/bash

# ==========================================
# TELEGRAM TRADER - HETZNER DEPLOYMENT
# ==========================================

echo "🚀 Starting deployment..."

# Update system
echo "📦 Updating system..."
sudo apt update && sudo apt upgrade -y

# Install Node.js 18 (if not installed)
if ! command -v node &> /dev/null; then
    echo "📦 Installing Node.js 18..."
    curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
    sudo apt install -y nodejs
fi

# Install PM2 globally (if not installed)
if ! command -v pm2 &> /dev/null; then
    echo "📦 Installing PM2..."
    sudo npm install -g pm2
fi

# Create project directory
echo "📁 Setting up project directory..."
cd /opt || exit
sudo mkdir -p telegram_trader
sudo chown -R $USER:$USER telegram_trader
cd telegram_trader || exit

# Copy files (assumes you're running this after uploading via git/scp)
echo "📋 Installing dependencies..."
npm install

# Create logs directory
mkdir -p logs

# Copy production environment
if [ -f .env.production ]; then
    cp .env.production .env
    echo "✅ Production environment configured"
else
    echo "⚠️  Warning: .env.production not found!"
fi

# Setup Telegram session (auto-generates if missing)
echo "🔐 Setting up Telegram session..."
if ! grep -q "SESSION_STRING=" .env || grep -q "SESSION_STRING=$" .env || grep -q "SESSION_STRING=''" .env || grep -q 'SESSION_STRING=""' .env; then
    echo "⚠️  No session found. Running interactive setup..."
    echo "📱 Please complete the Telegram authentication:"
    npm run setup
else
    echo "✅ Session already configured"
fi

# Start with PM2
echo "🔄 Starting application with PM2..."
pm2 start ecosystem.config.cjs
pm2 save
pm2 startup

# Configure firewall
echo "🔒 Configuring firewall..."
sudo ufw allow 3000/tcp
sudo ufw allow OpenSSH
sudo ufw --force enable

echo ""
echo "✅ Deployment complete!"
echo ""
echo "📊 Dashboard: http://YOUR_SERVER_IP:3000"
echo ""
echo "Useful PM2 commands:"
echo "  pm2 status          - Show app status"
echo "  pm2 logs            - Show live logs"
echo "  pm2 restart all     - Restart app"
echo "  pm2 stop all        - Stop app"
echo "  pm2 monit           - Monitor resources"
echo ""
