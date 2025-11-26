# IC Markets Demo Trading Setup

## Voraussetzungen

1. **Demo-Account bei IC Markets:**
   - Gehe zu: https://secure.icmarkets.eu/ClientTest
   - Erstelle einen Demo MT5 Account
   - Notiere: Login, Passwort, Server

2. **MetaTrader 5 installieren:**
   - Download: https://www.metatrader5.com/en/download
   - Installiere MT5 auf deinem PC
   - Login mit deinen Demo-Credentials

3. **Python installieren:**
   - Download: https://www.python.org/downloads/
   - Version 3.8 oder höher
   - Wichtig: "Add to PATH" aktivieren bei Installation

## Installation der MT5 Library

```powershell
pip install MetaTrader5
```

## Konfiguration

Füge zu deiner `.env` Datei hinzu:

```env
# IC Markets MT5 Demo Account
MT5_LOGIN=your_demo_account_number
MT5_PASSWORD=your_demo_password
MT5_SERVER=ICMarketsSC-Demo
MT5_PATH=C:\Program Files\MetaTrader 5\terminal64.exe

# Trading Settings
TRADING_ENABLED=false  # Setze auf true wenn du bereit bist
DEMO_MODE=true         # true = Demo, false = Real Money
RISK_PERCENT=1         # Risiko pro Trade in %
```

## Unterstützte Instrumente

- **DAX**: GER40 (Germany 40 Index)
- **S&P 500**: US500
- **NASDAQ**: NAS100
- **EUR/USD**: EURUSD
- **Gold**: XAUUSD
- **Crude Oil**: USOIL

## Signal-Format

Die App erkennt automatisch:

```
ICH KAUFE DAX (EK: 23467.1)
ICH VERKAUFE DAX (EK: 23467.1)
```

Wird umgewandelt in:
- Symbol: GER40
- Action: BUY / SELL
- Entry Price: 23467.1

## Sicherheit

- **DEMO_MODE=true**: Nur virtuelle Trades, kein echtes Geld
- **TRADING_ENABLED=false**: Trades werden nur geloggt, nicht ausgeführt
- Erst nach Test auf **true** setzen

## Test-Workflow

1. Start mit `TRADING_ENABLED=false` - nur Logs
2. Prüfe, ob Signale korrekt erkannt werden
3. Setze `TRADING_ENABLED=true` im Demo-Mode
4. Teste mit kleinen Beträgen
5. Nach erfolgreichen Tests: Real Account

## Wichtig!

- MT5 muss während der App-Laufzeit geöffnet sein
- Demo-Account hat virtuelles Geld (kein Risiko)
- Erst nach erfolgreichen Tests auf Real-Account wechseln
