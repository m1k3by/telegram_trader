# 🚀 Quick Start Guide - LIVE TREND Monitoring

## Was macht die App?

Die App überwacht deinen Telegram-Chat **"Live Trends & Ergebnisse"** und reagiert NUR auf Nachrichten, die **"LIVE TREND"** enthalten.

## Features

✅ **Intelligentes Filtern**: Nur "LIVE TREND" Nachrichten werden verarbeitet  
✅ **Automatisches Parsen**: Extrahiert Symbol, Direction, Price, Target, Stop Loss  
✅ **Risk/Reward Berechnung**: Zeigt Gewinn-/Verlustpotential an  
✅ **Auto-Trading**: Integration mit IC Markets MT5  
✅ **Web Dashboard**: Mobile-freundliche Echtzeit-Übersicht  
✅ **Statistiken**: Speichert alle Trends und zeigt Zusammenfassung  
✅ **Echtzeit**: Reagiert sofort auf neue Nachrichten  

## So startest du die App

### Lokal testen (Windows)

1. **Starte die App:**
   ```powershell
   npm start
   ```

2. **Beim ersten Start:**
   - Gib den Telegram-Code ein
   - Kopiere den SESSION_STRING in deine `.env` Datei

3. **Dashboard öffnen:**
   - Browser: `http://localhost:3000`
   - Zeigt Live-Signale und Trading-Statistiken

### Auf Hetzner Server deployen (24/7)

Siehe **[HETZNER_DEPLOYMENT.md](HETZNER_DEPLOYMENT.md)** für komplette Anleitung!

## Was passiert bei einer "LIVE TREND" Nachricht?

Wenn eine Nachricht mit "LIVE TREND" im Chat "Live Trends & Ergebnisse" erscheint:

```
🔥 LIVE TREND DETECTED!
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Chat: Live Trends & Ergebnisse
Message ID: 12345

📝 Message Content:
[Die komplette Nachricht wird angezeigt]

🔍 Analyzing LIVE TREND...

📊 Symbol: BTCUSDT
🟢 Direction: BUY
💰 Price: 45000
🎯 Target: 46500
🛑 Stop Loss: 44500

✅ Valid trend signal detected!

📈 Risk/Reward Analysis:
   Potential Profit: 3.33%
   Potential Loss: 1.11%
   Risk/Reward Ratio: 3.00:1

💾 Trend stored in memory
📊 Total trends stored: 1
```

## Anpassung an dein Nachrichtenformat

Die App versucht automatisch folgende Informationen zu extrahieren:

- **Symbol**: z.B. BTCUSDT, EURUSD, BTC/USD
- **Direction**: BUY, SELL, LONG, SHORT
- **Price**: Der Einstiegspreis
- **Target**: Das Gewinnziel (TP)
- **Stop Loss**: Der Stop Loss (SL)
- **Timeframe**: z.B. 5min, 1h, etc.

### Beispiel-Nachricht, die gut funktioniert:

```
🔥 LIVE TREND 🔥

Symbol: BTCUSDT
Direction: BUY
Price: 45000
Target: 46500
Stop Loss: 44500
Timeframe: 15min
```

## Wichtige Dateien

- **`src/index.js`**: Hauptdatei mit Telegram-Verbindung
- **`src/trendAnalyzer.js`**: Parst und analysiert LIVE TREND Nachrichten
- **`src/helpers.js`**: Hilfsfunktionen für Statistiken
- **`.env`**: Deine Konfiguration (nicht ins Git committen!)

## Nächste Schritte

Sobald die App läuft und LIVE TRENDS erkennt, kannst du:

1. **Automatisch handeln**: API-Integration zu deinem Broker
2. **Benachrichtigungen**: Webhook zu Discord/Slack
3. **Datenbank**: Trends dauerhaft speichern
4. **Filter**: Nur bestimmte Symbole oder Risk/Reward Ratios
5. **Dashboard**: Web-Interface für Statistiken

## Anpassung der Parsing-Logik

Wenn deine Nachrichten ein anderes Format haben, passe die Datei `src/trendAnalyzer.js` an:

```javascript
// Beispiel: Andere Schlüsselwörter
const symbolMatch = line.match(/Coin:?\s*([A-Z]{3,})/i);
```

## Statistiken anzeigen

Drücke **Ctrl+C** zum Beenden - die App zeigt dann eine Zusammenfassung aller erkannten Trends:

```
═══════════════════════════════════════
          TREND SUMMARY REPORT         
═══════════════════════════════════════

Total Trends: 15
Buy Signals: 9 (60.0%)
Sell Signals: 6 (40.0%)

Trends by Symbol:
  BTCUSDT: 5 signals
  ETHUSDT: 4 signals
  EURUSD: 6 signals

═══════════════════════════════════════
```

## Troubleshooting

**Keine LIVE TRENDS werden erkannt?**
- Prüfe, ob der Chat-Name genau "Live Trends & Ergebnisse" ist
- Stelle sicher, dass "LIVE TREND" in der Nachricht steht (Groß-/Kleinschreibung egal)

**Daten werden nicht korrekt geparst?**
- Schau dir eine Beispiel-Nachricht an
- Passe die Regex-Patterns in `trendAnalyzer.js` an

**App stürzt ab?**
- Prüfe die Logs
- Stelle sicher, dass SESSION_STRING in `.env` ist

## Support

Bei Fragen oder Problemen, schau in die Logs oder passe die Parsing-Logik an!
