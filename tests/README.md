# 🧪 Telegram Trader Unit Tests

Umfassende Test-Suite für alle Trading-Signale und Instrument-Mappings.

## 📋 Was wird getestet?

### 1. Message Parser Tests (`messageParser.test.js`)
- ✅ **Position Open Signals** - Alle KAUFE/VERKAUFE Signale
  - Gold, Tesla, EUR/USD, Bitcoin, DAX, S&P500, Silber, Brent, Ethereum
  - Options-Signale (CALL/PUT mit Strike Price)
  - Forex-Paare (mit und ohne Slash)
  
- ✅ **Position Close Signals** - Alle SCHLIEßE Signale
  - Mit Gewinn (GEWINN)
  - Mit Verlust (VERLUST)
  - Verschiedene Instrumente
  
- ✅ **Stop Loss Updates** - SL AUF / SETZE SL
  - Numerische SL-Levels
  - Break Even (BE)
  
- ✅ **Take Profit Updates** - TP AUF / SETZE TP
  - Numerische TP-Levels
  
- ✅ **Edge Cases**
  - Komma vs. Punkt als Dezimaltrennzeichen
  - Multiple Leerzeichen
  - Groß-/Kleinschreibung
  - Extra Zeilenumbrüche
  
- ✅ **Invalid Messages**
  - Promo-Nachrichten
  - Leere Nachrichten
  - Nur Emojis

### 2. Instrument Mapping Tests (`instrumentMapping.test.js`)
- ✅ **Commodities** - Gold, Silber, Öl (Brent/WTI)
- ✅ **Indices** - DAX, S&P500, NASDAQ, DOW, FTSE
- ✅ **Forex** - EUR/USD, GBP/USD, USD/JPY, etc.
- ✅ **Crypto** - Bitcoin, Ethereum (mit Fallbacks)
- ✅ **US Stocks** - Tesla, Apple, Amazon, Microsoft, Nvidia
- ✅ **Fallback Logic** - Automatische EPIC-Generierung für unbekannte Ticker
- ✅ **Weekend Fallbacks** - Alternative EPICs für Wochenendhandel

## 🚀 Tests ausführen

### Alle Tests auf einmal:
```bash
cd tests
npm test
```

### Nur Message Parser Tests:
```bash
npm run test:parser
```

### Nur Instrument Mapping Tests:
```bash
npm run test:mapping
```

### Mit dem Test-Runner (empfohlen):
```bash
node tests/runTests.js
```

## 📊 Test-Ausgabe

### Erfolgreiche Tests:
```
✅ Gold VERKAUFE Signal
✅ Tesla CALL Option Signal
✅ EUR/USD KAUFE Signal
...

📊 TEST SUMMARY
============================================================
✅ Passed: 26
❌ Failed: 0
📈 Total: 26
🎯 Success Rate: 100.0%

✅ ALL TESTS PASSED!
```

### Fehlgeschlagene Tests:
```
❌ Gold VERKAUFE Signal
   Error: Expected 'POSITION_OPEN' but got 'UNKNOWN'

📊 TEST SUMMARY
============================================================
✅ Passed: 25
❌ Failed: 1
📈 Total: 26
🎯 Success Rate: 96.2%

❌ FAILED TEST DETAILS:
============================================================
1. Gold VERKAUFE Signal
   Expected 'POSITION_OPEN' but got 'UNKNOWN'
```

## 🔍 Getestete Szenarien

### Position Open Signale:
```javascript
'ICH KAUFE GOLD (EK: 4220.98)'
'ICH VERKAUFE DAX (EK: 19500.5)'
'ICH KAUFE TESLA CALL 440 (EK: 16.25)'
'ICH KAUFE EUR/USD (EK: 1.15954)'
'ICH KAUFE BITCOIN CALL 92000 (EK: 4435.00)'
```

### Position Close Signale:
```javascript
'ICH SCHLIEßE GOLD❗442€ GEWINN 🎉'
'ICH SCHLIEßE DAX❗-125€ VERLUST'
```

### Stop Loss Updates:
```javascript
'GOLD SL AUF 4200'
'DAX SETZE SL 19400'
'EUR/USD SL AUF BE'
```

### Take Profit Updates:
```javascript
'GOLD TP AUF 4250'
'DAX SETZE TP 19600'
```

## ✅ Vorteile der Test-Suite

1. **Regression Testing** - Stelle sicher, dass neue Änderungen alte Funktionen nicht brechen
2. **Dokumentation** - Tests zeigen, wie Signale verarbeitet werden
3. **Schnelles Feedback** - Finde Probleme sofort, nicht erst im Live-Trading
4. **Confidence** - Deploy mit Sicherheit, dass alles funktioniert
5. **Edge Cases** - Teste auch ungewöhnliche Eingaben

## 🔧 Eigene Tests hinzufügen

```javascript
test('Mein neuer Test', () => {
  const message = 'ICH KAUFE NEUES_INSTRUMENT (EK: 123.45)';
  const result = parseLiveTrend(message);
  
  assert.equal(result.type, 'POSITION_OPEN', 'Should be POSITION_OPEN');
  assert.equal(result.data.instrument, 'NEUES_INSTRUMENT', 'Should extract instrument');
  assert.equal(result.data.entryPrice, 123.45, 'Should extract price');
});
```

## 📝 Test Coverage

- **Message Types:** 100% (POSITION_OPEN, POSITION_CLOSE, SL_UPDATE, TP_UPDATE, UNKNOWN)
- **Commodities:** Gold, Silber, Brent, WTI
- **Indices:** DAX, S&P500, NASDAQ, DOW, FTSE, CAC
- **Forex:** EUR/USD, GBP/USD, USD/JPY, AUD/USD, USD/CAD, NZD/USD, EUR/GBP, EUR/JPY, GBP/JPY
- **Crypto:** Bitcoin, Ethereum, Bitcoin Cash (Fallback)
- **Stocks:** Tesla, Apple, Amazon, Microsoft, Nvidia, AMD, Intel, PayPal, Adobe, Shopify, Uber, Coinbase
- **Options:** CALL/PUT mit Strike Prices
- **Edge Cases:** Komma/Punkt, Leerzeichen, Groß-/Kleinschreibung, Emojis

## 🎯 Best Practices

1. **Tests vor Deployment ausführen:**
   ```bash
   npm test && npm run deploy
   ```

2. **Tests nach Code-Änderungen:**
   ```bash
   npm test
   ```

3. **Neue Instrumente? Neue Tests!**
   - Füge Tests in `messageParser.test.js` hinzu
   - Füge Mapping-Tests in `instrumentMapping.test.js` hinzu

4. **CI/CD Integration:**
   - Tests laufen automatisch bei jedem Commit
   - Deployment nur bei erfolgreichen Tests

## 🐛 Fehler gefunden?

Wenn ein Test fehlschlägt:

1. **Prüfe die Fehlermeldung** - Was wird erwartet vs. was kommt zurück?
2. **Prüfe den Code** - Stimmt das Regex-Pattern? Stimmt das Mapping?
3. **Fixe den Code** - Nicht den Test!
4. **Tests erneut ausführen** - Bis alles grün ist ✅

## 📚 Weitere Informationen

- Alle Tests nutzen Node.js `assert` (kein externes Framework nötig)
- Tests sind unabhängig voneinander
- Jeder Test ist self-contained und verständlich
- Exit Code 0 = Success, 1 = Failure (gut für CI/CD)
