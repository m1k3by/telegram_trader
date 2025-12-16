$SERVER = "root@46.62.162.38"
$REMOTE_PATH = "/opt/telegram_trader"

Write-Host "📦 Uploading fixed files..." -ForegroundColor Cyan

scp src/igApi.js $SERVER`:$REMOTE_PATH/src/
scp src/index.js $SERVER`:$REMOTE_PATH/src/
scp test_nvidia_debug.js $SERVER`:$REMOTE_PATH/

Write-Host "✅ Upload complete!" -ForegroundColor Green