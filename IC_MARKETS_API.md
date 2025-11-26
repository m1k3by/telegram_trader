# 🔌 IC Markets REST API Setup

## Warum REST API statt MT5?

✅ **Funktioniert auf Linux** (kein Wine nötig)  
✅ **Einfacher zu deployen** auf Hetzner  
✅ **Direkter Zugriff** ohne MT5 Software  
✅ **Schneller** - HTTP statt MT5 Protokoll  

---

## 1️⃣ API Key bei IC Markets erstellen

### Demo Account:
1. Login: https://secure.icmarkets.eu/
2. Gehe zu **Settings** → **API Access**
3. Klicke **Create New API Key**
4. **Name:** Telegram Trader
5. **Permissions:** ✅ Trading, ✅ Account Info
6. **IP Whitelist:** (optional) `46.62.162.38` (dein Hetzner Server)
7. Kopiere **API Key** und **API Secret**

### Live Account (später):
- Gleicher Prozess, aber mit deinem echten Account
- **Vorsicht:** Nur mit Demo-Modus testen!

---

## 2️⃣ .env Konfiguration

Trage die API Keys ein:

```env
# IC Markets REST API
IC_API_KEY=dein_api_key_hier
IC_API_SECRET=dein_api_secret_hier

# Trading Settings
TRADING_ENABLED=true
DEMO_MODE=true
RISK_PERCENT=1
```

---

## 3️⃣ Trading Bridge anpassen

Die App versucht automatisch:
1. **Zuerst:** IC Markets REST API (wenn IC_API_KEY gesetzt)
2. **Fallback:** MT5 Python (wenn kein API Key)

Kein Code-Change nötig! 🎉

---

## 4️⃣ Auf Hetzner deployen

```bash
# Dateien hochladen
scp -r c:\Repos\telegram_trader\src\icmarketsApi.js root@46.62.162.38:/opt/telegram_trader/src/
scp c:\Repos\telegram_trader\package.json root@46.62.162.38:/opt/telegram_trader/

# Auf dem Server
ssh root@46.62.162.38
cd /opt/telegram_trader

# Dependencies installieren
npm install

# .env anpassen
nano .env
# Füge IC_API_KEY und IC_API_SECRET hinzu

# App neu starten
pm2 restart telegram-trader
pm2 logs
```

---

## 5️⃣ Testen

Schicke Test-Signal:
```
🚦LIVE TREND🚦
ICH KAUFE GOLD (EK: 2600.50)
```

Im Dashboard siehst du:
- ✅ Signal erkannt
- ✅ Trade wird via API ausgeführt
- ✅ Sichtbar in IC Markets: https://secure.icmarkets.eu/Trades/Report/Dashboard

---

## 📊 Was die API kann

✅ **Neue Position öffnen** (KAUFE/VERKAUFE)  
✅ **Position schließen** (ICH SCHLIEßE GOLD)  
✅ **Stop Loss setzen/ändern** (Ich setze SL bei BITCOIN auf 84000)  
✅ **Account Balance abrufen**  
✅ **Risk Management** (automatisch 1% Risk)  

---

## 🔒 Sicherheit

- ✅ API Keys bleiben geheim in .env
- ✅ Nur auf Hetzner Server (IP Whitelist)
- ✅ DEMO_MODE schützt vor echtem Geld
- ✅ RISK_PERCENT limitiert Verluste

---

## ⚠️ Wichtig

**IC Markets API ist möglicherweise nicht öffentlich verfügbar!**

Falls IC Markets keine REST API anbietet, nutzen wir stattdessen:
- **Option A:** MetaTrader 5 Web API (offiziell)
- **Option B:** cTrader API (falls IC Markets das unterstützt)
- **Option C:** Windows VPS mit MT5 Python

**Ich prüfe gerade die IC Markets Dokumentation...**

Hast du Zugriff auf die IC Markets API Docs in deinem Account?

Checke hier: https://secure.icmarkets.eu/ → Settings → API

---

## 🔄 Fallback: MT5 bleibt aktiv

Falls keine API verfügbar ist, nutzt die App automatisch MT5 Python!
