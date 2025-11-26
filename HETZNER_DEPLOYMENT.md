# 🚀 Hetzner Server Deployment Guide

## Server Setup - Linux mit MT5 über Wine

Da MetaTrader 5 eine Windows-Anwendung ist, nutzen wir Wine auf deinem Linux-Server.

---

## 1️⃣ Verbindung zum Server

```bash
ssh root@DEINE_SERVER_IP
```

---

## 2️⃣ System vorbereiten

```bash
# System aktualisieren
apt update && apt upgrade -y

# Node.js installieren (v18 LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Git installieren
apt install -y git

# Python 3 und pip (für MT5)
apt install -y python3 python3-pip

# PM2 für Prozess-Management
npm install -g pm2
```

---

## 3️⃣ Wine installieren (für MT5)

```bash
# 32-bit Architektur aktivieren (MT5 benötigt 32-bit)
dpkg --add-architecture i386

# Wine Repository hinzufügen
mkdir -pm755 /etc/apt/keyrings
wget -O /etc/apt/keyrings/winehq-archive.key https://dl.winehq.org/wine-builds/winehq.key

# Für Ubuntu 22.04 (passe an deine Version an)
wget -NP /etc/apt/sources.list.d/ https://dl.winehq.org/wine-builds/ubuntu/dists/jammy/winehq-jammy.sources

# Wine installieren
apt update
apt install -y --install-recommends winehq-stable

# Wine konfigurieren
winecfg
```

**Wichtig**: Bei `winecfg` wähle **Windows 10** als Version.

---

## 4️⃣ MetaTrader 5 installieren

```bash
# Xvfb für virtuelles Display (MT5 braucht GUI)
apt install -y xvfb x11vnc

# MT5 herunterladen
cd /opt
wget https://download.mql5.com/cdn/web/ic.markets.eu.limited/mt5/icmarketseu5setup.exe

# MT5 installieren (mit virtuellem Display)
Xvfb :99 -screen 0 1024x768x24 &
export DISPLAY=:99
wine icmarketseu5setup.exe /auto

# Warte bis Installation fertig ist (ca. 2-3 Minuten)
```

MT5 wird installiert nach: `~/.wine/drive_c/Program Files (x86)/IC Markets (EU)/MetaTrader 5/`

---

## 5️⃣ MetaTrader5 Python Package installieren

```bash
# MT5 Python API
pip3 install MetaTrader5

# Überprüfen
python3 -c "import MetaTrader5 as mt5; print(mt5.__version__)"
```

---

## 6️⃣ Telegram Trader App deployen

```bash
# Arbeitsverzeichnis erstellen
mkdir -p /opt/telegram_trader
cd /opt/telegram_trader

# Repository klonen (oder Code hochladen)
# Option A: Mit Git
git clone https://github.com/DEIN_USERNAME/telegram_trader.git .

# Option B: Code manuell hochladen (von deinem PC)
# Nutze FileZilla oder SCP:
# scp -r c:\Repos\telegram_trader/* root@DEINE_SERVER_IP:/opt/telegram_trader/
```

---

## 7️⃣ Dependencies installieren

```bash
cd /opt/telegram_trader
npm install
```

---

## 8️⃣ .env Datei konfigurieren

```bash
nano .env
```

Füge deine Konfiguration ein:

```env
# Telegram API
API_ID=DEINE_API_ID
API_HASH=DEINE_API_HASH
PHONE_NUMBER=+491234567890
SESSION_STRING=DEIN_SESSION_STRING

# Target Chats (komma-getrennt)
TARGET_CHAT=Live Trends & Ergebnisse,Telegram_Trader

# MT5 Configuration
MT5_PATH=/root/.wine/drive_c/Program Files (x86)/IC Markets (EU)/MetaTrader 5/terminal64.exe
MT5_LOGIN=DEIN_MT5_LOGIN
MT5_PASSWORD=DEIN_MT5_PASSWORD
MT5_SERVER=ICMarkets-Demo
DEMO_MODE=true

# Trading Settings
TRADING_ENABLED=false
RISK_PERCENT=1.0
MAX_SLIPPAGE=10

# Dashboard
DASHBOARD_PORT=3000
```

**Speichern**: `Ctrl+X`, dann `Y`, dann `Enter`

---

## 9️⃣ Firewall für Dashboard öffnen

```bash
# UFW Firewall konfigurieren
ufw allow 22/tcp    # SSH
ufw allow 3000/tcp  # Dashboard
ufw enable
```

---

## 🔟 App mit PM2 starten

```bash
cd /opt/telegram_trader

# App starten
pm2 start src/index.js --name telegram-trader --interpreter node

# PM2 beim Systemstart automatisch starten
pm2 startup
pm2 save

# Logs anschauen
pm2 logs telegram-trader

# Status prüfen
pm2 status
```

---

## 📱 Dashboard öffnen

Öffne auf deinem Handy:
```
http://DEINE_SERVER_IP:3000
```

Du siehst jetzt:
- ✅ Live Signale in Echtzeit
- 📊 Trading Statistiken
- 📈 Erfolgsrate
- ⏱️ Uptime

---

## 🔧 Nützliche PM2 Befehle

```bash
# App stoppen
pm2 stop telegram-trader

# App neu starten
pm2 restart telegram-trader

# App löschen
pm2 delete telegram-trader

# Logs anschauen
pm2 logs telegram-trader

# Logs leeren
pm2 flush

# Ressourcen-Monitor
pm2 monit
```

---

## 🔒 Trading aktivieren (wenn bereit)

Wenn du bereit bist, echtes Trading zu starten:

```bash
nano /opt/telegram_trader/.env
```

Ändere:
```env
TRADING_ENABLED=true
DEMO_MODE=false  # Nur für Live-Account!
MT5_SERVER=ICMarkets-Live  # Für Live-Account
```

Dann:
```bash
pm2 restart telegram-trader
```

---

## 🐛 Troubleshooting

### MT5 Python Fehler

```bash
# MT5 Pfad prüfen
ls -la ~/.wine/drive_c/Program\ Files\ \(x86\)/IC\ Markets\ \(EU\)/MetaTrader\ 5/

# Wine neu konfigurieren
winecfg
```

### App startet nicht

```bash
# Logs prüfen
pm2 logs telegram-trader --lines 100

# Manuell starten (für Debugging)
cd /opt/telegram_trader
node src/index.js
```

### Dashboard nicht erreichbar

```bash
# Firewall prüfen
ufw status

# Port 3000 öffnen
ufw allow 3000/tcp

# App neu starten
pm2 restart telegram-trader
```

### Session String fehlt

Wenn du noch keinen SESSION_STRING hast:

```bash
# Lokal auf deinem PC ausführen
cd c:\Repos\telegram_trader
npm start

# SESSION_STRING kopieren und in Server .env einfügen
```

---

## 📊 Monitoring

### Server Ressourcen überwachen

```bash
# CPU & RAM
htop

# Disk Space
df -h

# PM2 Monitor
pm2 monit
```

### App Logs live anschauen

```bash
pm2 logs telegram-trader --lines 50
```

---

## 🔄 Updates deployen

Wenn du Code-Änderungen machst:

```bash
# Option A: Mit Git
cd /opt/telegram_trader
git pull
npm install
pm2 restart telegram-trader

# Option B: Manuell hochladen
# scp -r c:\Repos\telegram_trader/* root@DEINE_SERVER_IP:/opt/telegram_trader/
cd /opt/telegram_trader
npm install
pm2 restart telegram-trader
```

---

## 💡 Alternative: Ohne MT5 (nur Monitoring)

Wenn du erstmal nur Signale monitoren willst (ohne Trading):

```bash
# .env anpassen
TRADING_ENABLED=false
```

Dann brauchst du **kein** Wine/MT5. Die App läuft trotzdem und zeigt alle Signale im Dashboard!

---

## 🎯 Checkliste für Go-Live

- [ ] Hetzner Server läuft
- [ ] Node.js installiert
- [ ] Python 3 installiert
- [ ] Wine + MT5 installiert (optional)
- [ ] App-Code hochgeladen
- [ ] `.env` konfiguriert
- [ ] `npm install` ausgeführt
- [ ] Firewall Port 3000 offen
- [ ] PM2 läuft: `pm2 status`
- [ ] Dashboard erreichbar: `http://SERVER_IP:3000`
- [ ] Logs sauber: `pm2 logs`

---

## 🚀 Quick Start Commands

```bash
# Komplette Installation auf frischem Hetzner Server
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs git python3 python3-pip
npm install -g pm2
mkdir -p /opt/telegram_trader
cd /opt/telegram_trader
# Code hochladen (scp oder git clone)
npm install
nano .env  # Konfiguration einfügen
pm2 start src/index.js --name telegram-trader
pm2 startup
pm2 save
ufw allow 22/tcp
ufw allow 3000/tcp
ufw enable
```

Dashboard öffnen: `http://DEINE_SERVER_IP:3000`

---

**Viel Erfolg! 🎉**
