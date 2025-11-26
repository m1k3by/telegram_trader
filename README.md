local: 
# 1. Lokalen Bot stoppen (falls läuft)
# Strg+C im Terminal

# 2. Neue Session für lokale Maschine erstellen
npm run setup

# 3. Bot starten
npm start

Server: 
# 1. Dateien hochladen
scp setup_session.js package.json deploy.sh root@46.62.162.38:/opt/telegram_trader/

# 2. Auf Server einloggen
ssh root@46.62.162.38

# 3. In Verzeichnis wechseln
cd /opt/telegram_trader

# 4. Alte Session entfernen (wenn vorhanden)
sed -i 's/SESSION_STRING=.*/SESSION_STRING=/' .env

# 5. Session automatisch generieren
npm run setup

# 6. Bot starten
pm2 delete telegram-trader
pm2 start ecosystem.config.cjs
pm2 logs


# Schnelles Update (alle JS Dateien)
scp src/*.js root@46.62.162.38:/opt/telegram_trader/src/

# Komplettes Deployment
scp -r src package.json .env root@46.62.162.38:/opt/telegram_trader/

# Bot neustarten
ssh root@46.62.162.38 "pm2 restart telegram-trader"

# Telegram Trader - IG Markets

Automatisches Trading-System: Telegram-Signale → IG Markets REST API

## Features

- Real-time Telegram Monitoring
- IG Markets REST API Integration
- Deutsche Signal-Parser (ICH KAUFE/VERKAUFE)
- Web Dashboard (Socket.io)
- Demo & Live Trading
- 24/7 VPS Ready

## Voraussetzungen

1. Node.js v18+
2. Telegram API Credentials: https://my.telegram.org/apps
3. IG Markets Account: https://www.ig.com/de/demokonto
4. IG API Key: https://labs.ig.com/

## Quick Start

```bash
# Installation
npm install

# .env konfigurieren
cp .env.example .env
nano .env

# Session erstellen (interaktiv)
npm run setup

# Starten
npm start
```

### .env Beispiel

```env
# Telegram
API_ID=12345678
API_HASH=your_hash
PHONE_NUMBER=+491234567890
TARGET_CHAT=Live Trends & Ergebnisse
# SESSION_STRING wird automatisch von 'npm run setup' generiert

# IG Markets
IG_USERNAME=your_email
IG_PASSWORD=your_password
IG_API_KEY=your_api_key
IG_DEMO_MODE=true
TRADING_ENABLED=true
FIXED_RISK_AMOUNT=50
```

## Dashboard

- **Lokal:** http://localhost:3000
- **Server:** http://YOUR_SERVER_IP:3000

## Signal-Formate

```
LIVE TREND
ICH KAUFE DAX (EK: 22900.00)

ICH SCHLIEßE DAX

Ich setze den SL bei DAX auf 22500
```

## Hetzner Deployment

```bash
# Code hochladen
scp -r src public package.json .env.production ecosystem.config.cjs deploy.sh setup_session.js root@YOUR_IP:/opt/telegram_trader/

# Auf Server
ssh root@YOUR_IP
cd /opt/telegram_trader
chmod +x deploy.sh
./deploy.sh  # ← generiert automatisch Session wenn fehlt

# PM2 Commands
pm2 status
pm2 logs
pm2 restart telegram-trader
```

**Wichtig:** Die Session wird beim ersten `./deploy.sh` automatisch generiert. Du musst nur die Telegram-SMS eingeben.

## Disclaimer

**Nur für Bildungszwecke. Trading birgt Verlustrisiken.**

- Teste immer erst mit Demo
- Trade nur mit Geld, das du verlieren kannst
- Keine Finanzberatung - DYOR

**Keine Haftung für finanzielle Verluste.**
