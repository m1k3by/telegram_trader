$SERVER = "root@46.62.162.38"
$REMOTE_PATH = "/opt/telegram_trader_live"

Write-Host "🚀 Deploying LIVE Instance to $REMOTE_PATH..." -ForegroundColor Cyan

# 1. Create Directory
Write-Host "📂 Creating remote directory..."
ssh $SERVER "mkdir -p $REMOTE_PATH/src $REMOTE_PATH/public $REMOTE_PATH/data $REMOTE_PATH/logs"

# 2. Upload Files
Write-Host "📦 Uploading files..."
scp -r src $SERVER`:$REMOTE_PATH/
scp -r public $SERVER`:$REMOTE_PATH/
scp package.json $SERVER`:$REMOTE_PATH/
scp ecosystem.config.live.cjs $SERVER`:$REMOTE_PATH/
scp generate_session.js $SERVER`:$REMOTE_PATH/

# 3. Upload Config
Write-Host "🔑 Uploading LIVE configuration..."
scp .env.live $SERVER`:$REMOTE_PATH/.env

# 4. Install Dependencies & Start
Write-Host "⚙️  Installing dependencies and starting..."
ssh $SERVER "cd $REMOTE_PATH && npm install --production && pm2 start ecosystem.config.live.cjs && pm2 save"

Write-Host "✅ LIVE Deployment complete!" -ForegroundColor Green
Write-Host "📊 Dashboard available at: http://46.62.162.38:3001" -ForegroundColor Yellow
