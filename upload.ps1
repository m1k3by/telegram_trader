# Quick Upload Script - Nur wichtige Files
# Stoppt SCP falls es läuft und lädt nur Source-Code hoch

$SERVER = "root@46.62.162.38"
$REMOTE_PATH = "/opt/telegram_trader"

Write-Host "📦 Uploading only essential files..." -ForegroundColor Cyan

# Einzelne wichtige Ordner/Files
scp -r src $SERVER`:$REMOTE_PATH/
scp -r public $SERVER`:$REMOTE_PATH/
scp package.json $SERVER`:$REMOTE_PATH/
scp .env.production $SERVER`:$REMOTE_PATH/.env
scp ecosystem.config.cjs $SERVER`:$REMOTE_PATH/
scp deploy.sh $SERVER`:$REMOTE_PATH/

Write-Host "✅ Upload complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "  ssh to server" -ForegroundColor White
Write-Host "  cd to directory" -ForegroundColor White
Write-Host "  run deploy script" -ForegroundColor White
