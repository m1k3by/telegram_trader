# 24/7 Deployment Guide - VPS Setup

## Warum VPS statt Vercel/Railway?

Diese App benötigt:
- **Persistente WebSocket-Verbindung** zu Telegram (24/7)
- **MetaTrader 5** (läuft nur auf Windows/Linux Desktop)
- **Python** für MT5 API
- **Lange Laufzeit** ohne Timeouts

→ **Vercel/Railway/Render funktionieren NICHT**
→ **VPS (Virtual Private Server) ist die einzige Lösung**

## 🎯 Empfohlene VPS-Anbieter

### 1. Contabo VPS (Günstig & Gut)
- **Preis:** ~6€/Monat
- **OS:** Windows Server 2022
- **RAM:** 6-8 GB empfohlen
- **Link:** https://contabo.com/de/vps/
- **Setup Zeit:** 10-15 Minuten

### 2. Vultr
- **Preis:** ~12€/Monat
- **OS:** Windows Server
- **RAM:** 4-8 GB
- **Link:** https://www.vultr.com/
- **Vorteil:** Schnelle Verbindung, gute Performance

### 3. IC Markets VPS (Speziell für Trading)
- **Preis:** Variiert (oft kostenlos bei aktiven Tradern)
- **Optimiert** für MT5 Trading
- **Link:** https://www.icmarkets.com/global/en/trading-tools/vps
- **Vorteil:** Direkt beim Broker, optimale Latenz

## 📝 Schritt-für-Schritt Setup (Contabo Beispiel)

### Schritt 1: VPS bestellen

1. Gehe zu https://contabo.com/de/vps/
2. Wähle: **VPS M** oder **VPS L** (min. 6GB RAM)
3. Betriebssystem: **Windows Server 2022**
4. Standort: Europa (näher = schneller)
5. Bestellen & Zugangsdaten per Email erhalten

### Schritt 2: Per RDP verbinden

1. Windows: Öffne "Remotedesktopverbindung" (RDP)
2. IP-Adresse vom VPS eingeben
3. Login mit Benutzername & Passwort

### Schritt 3: Software installieren

Auf dem VPS:

```powershell
# 1. Node.js installieren
# Download: https://nodejs.org/
# Installer ausführen

# 2. Python installieren
# Download: https://www.python.org/downloads/
# Wichtig: "Add to PATH" aktivieren!

# 3. Git installieren (optional)
# Download: https://git-scm.com/

# 4. MetaTrader 5 installieren
# Download: https://www.metatrader5.com/en/download
```

### Schritt 4: Projekt hochladen

**Option A: Git (empfohlen)**
```powershell
cd C:\
git clone https://github.com/dein-username/telegram_trader.git
cd telegram_trader
```

**Option B: Manuell**
- Dateien per RDP kopieren (Zwischenablage)
- Oder via FTP hochladen

### Schritt 5: Dependencies installieren

```powershell
# Node.js Packages
npm install

# Python MT5 Library
pip install MetaTrader5
```

### Schritt 6: .env Datei erstellen

Erstelle `C:\telegram_trader\.env`:

```env
# Telegram
API_ID=deine_api_id
API_HASH=dein_api_hash
PHONE_NUMBER=+49...
SESSION_STRING=dein_session_string
TARGET_CHAT=Live Trends & Ergebnisse,Telegram_Trader

# MT5
MT5_LOGIN=demo_account
MT5_PASSWORD=demo_password
MT5_SERVER=ICMarketsSC-Demo
MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe

# Trading
TRADING_ENABLED=false
DEMO_MODE=true
RISK_PERCENT=1
```

### Schritt 7: MT5 einrichten

1. MT5 auf VPS öffnen
2. Mit Demo-Account einloggen
3. MT5 **offen lassen** (minimiert im Hintergrund)

### Schritt 8: App als Windows Service einrichten

Damit die App automatisch startet:

**Option A: PM2 (Process Manager)**

```powershell
# PM2 global installieren
npm install -g pm2
npm install -g pm2-windows-startup

# PM2 als Windows Service
pm2-startup install

# App starten
cd C:\telegram_trader
pm2 start src/index.js --name telegram-trader

# Auto-Start bei Neustart
pm2 save
```

**Option B: Task Scheduler**

1. Öffne "Aufgabenplanung" (Task Scheduler)
2. Neue Aufgabe erstellen
3. Trigger: "Bei Systemstart"
4. Aktion: `node C:\telegram_trader\src\index.js`
5. Einstellungen: "Aufgabe bei Fehler neu starten"

### Schritt 9: App starten & testen

```powershell
cd C:\telegram_trader
npm start
```

Die App läuft jetzt 24/7!

## 🔍 Monitoring & Logs

**PM2 Status prüfen:**
```powershell
pm2 status
pm2 logs telegram-trader
pm2 restart telegram-trader
```

**Logs ansehen:**
```powershell
pm2 logs telegram-trader --lines 100
```

## 🛡️ Sicherheit

1. **Firewall:** Nur RDP (Port 3389) offen lassen
2. **Windows Updates:** Automatisch aktivieren
3. **Starkes Passwort:** Für RDP-Zugang
4. **Backup:** `.env` Datei regelmäßig sichern

## 💰 Kosten

**VPS:** ~6-12€/Monat
**MT5 Demo:** Kostenlos
**IC Markets:** Demo = 0€, Real = je nach Trading

**Gesamt für Testing:** ~6€/Monat

## ⚡ Alternativen (Nicht empfohlen)

### Deinen PC 24/7 laufen lassen
✅ Kostenlos
❌ Stromkosten
❌ Verschleiß
❌ Keine Redundanz
❌ Wenn PC abstürzt = Trading stoppt

### Cloud-Anbieter wie AWS/Azure
✅ Sehr zuverlässig
❌ TEUER (20-50€+/Monat)
❌ Kompliziert einzurichten

## 🎯 Empfehlung

**Für Anfang: Contabo VPS**
- Günstig (6€/Monat)
- Einfach einzurichten
- Windows Server inkl.
- Perfekt zum Testen

**Später bei Erfolg: IC Markets VPS**
- Optimiert für Trading
- Niedrige Latenz
- Oft kostenlos für aktive Trader

## 📞 Support

Bei Problemen:
1. VPS Support kontaktieren
2. MT5 Logs prüfen
3. App Logs ansehen (`pm2 logs`)

## Next Steps

1. VPS bestellen
2. Software installieren (Node, Python, MT5)
3. Projekt hochladen
4. .env konfigurieren
5. PM2 einrichten
6. App starten
7. Testen!
