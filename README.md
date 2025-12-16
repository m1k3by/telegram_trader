# Telegram Trader

Automatisches CFD-Trading via Telegram → IG Markets API

## Quick Start

```bash
npm install
npm run setup    # Telegram Session generieren
npm start        # Bot starten
```

## .env Konfiguration

```env
# Telegram (https://my.telegram.org/apps)
API_ID=12345678
API_HASH=your_hash
PHONE_NUMBER=+491234567890
TARGET_CHAT=Trading Coach

# IG Markets (https://www.ig.com/de/demokonto)
IG_USERNAME=your_email
IG_PASSWORD=your_password
IG_API_KEY=your_api_key
IG_DEMO_MODE=true

# Trading
TRADING_ENABLED=true
FIXED_RISK_AMOUNT=50
```

## Signal-Formate

```
🚦LIVE TREND🚦
ICH KAUFE GOLD (EK: 4201.25)

ICH SCHLIEßE GOLD❗1.768€ GEWINN

Ich setze den SL bei GOLD auf 4204.00
```

## Features

✅ **Resiliente Trade-Ausführung**
- 3-stufige Fallback-Logik (Primary → Weekend → Alternative)
- Automatische Market-Suche bei geschlossenen Märkten
- Fuzzy Position-Matching für CLOSE/SL/TP

✅ **Umfassende Test-Abdeckung**
- 56 Unit Tests (Parser + Mappings)
- 12 Integration Tests (End-to-End Flows)
- 5 Retry-Logik Tests

✅ **Intelligente Position-Verwaltung**
- API-basierte Contract-Sizing (min 0.1 für DAX 25€)
- Multi-Position Support mit korrektem Matching
- Echtzeit-Dashboard (http://localhost:3000)

## Tests

```bash
npm test                  # Alle Tests (Unit + Integration + Retry)
npm run test:unit         # Nur Parser + Mappings
npm run test:integration  # End-to-End Flows
npm run test:retry        # Retry-Logik
```

## Deployment (Hetzner)

```bash
# Lokal → Server
scp src/*.js root@46.62.162.38:/opt/telegram_trader/src/
ssh root@46.62.162.38 "pm2 restart telegram-trader"

# Initial Setup auf Server
ssh root@46.62.162.38
cd /opt/telegram_trader
npm run setup             # Session generieren
pm2 start ecosystem.config.cjs
pm2 logs telegram-trader
```

## Unterstützte Instrumente

**Indizes:** DAX, NASDAQ, S&P 500, DOW JONES  
**Rohstoffe:** Gold, Silber, Öl (Brent/WTI)  
**Krypto:** Bitcoin, Ethereum (+ Options)  
**Forex:** EUR/USD, GBP/USD, USD/JPY  
**Aktien:** Tesla, Netflix, Amazon (+ Options)

## Retry-Logik Beispiel

```
📡 ATTEMPT 1: Trying UC.D.NFLX.CASH.IP (Primary)
❌ Failed: Market closed or no bid/offer

📡 ATTEMPT 2: Trying UC.D.NFLX.WEEKEND.IP (Weekend Fallback)
❌ Failed: No weekend contract

📡 ATTEMPT 3: Searching alternatives for "Netflix"
✅ Found UC.D.NFLX.CFD.IP (TRADEABLE, bid: 108.70)
✅ Trade executed successfully
```

## Disclaimer

⚠️ **Nur für Bildungszwecke. Trading = Verlustrisiko.**  
Teste mit Demo-Account. Keine Finanzberatung. DYOR.
