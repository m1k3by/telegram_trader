# 🎯 IG Markets Setup Guide

Schritt-für-Schritt Anleitung zum Einrichten deines IG Markets Accounts und API Keys.

## 📝 Schritt 1: IG Demo Account erstellen

1. **Registrierung starten:**
   ```
   https://www.ig.com/de/demokonto
   ```

2. **Formular ausfüllen:**
   - Vorname, Nachname
   - E-Mail (das wird dein `IG_USERNAME`)
   - Telefonnummer
   - Passwort wählen (das wird dein `IG_PASSWORD`)
   - Land: Deutschland

3. **Account aktivieren:**
   - Bestätigungs-E-Mail öffnen
   - Link klicken
   - Login testen: https://www.ig.com/de/login

4. **Demo-Guthaben:**
   - Standard: 10.000€ virtuelles Guthaben
   - Konto kann jederzeit auf 10.000€ zurückgesetzt werden

## 🔑 Schritt 2: API Key generieren

1. **Zu IG Labs navigieren:**
   ```
   https://labs.ig.com/
   ```

2. **Login mit deinem IG Account:**
   - Verwende dieselben Credentials wie für IG.com
   - Username: Deine E-Mail
   - Passwort: Dein IG Passwort

3. **API Key erstellen:**
   - Klicke auf **"Dashboard"** (oben rechts)
   - Navigiere zu **"API Keys"**
   - Klicke **"Generate New Key"**
   - Name: z.B. "Telegram Trader"
   - Kopiere den generierten **API Key**

**Wichtig:** Bewahre den API Key sicher auf - er wird nur einmal angezeigt!

## 🧪 Schritt 3: API Zugriff testen

### Option A: IG API Companion (Web-Tool)

1. Öffne: https://labs.ig.com/sample-apps/api-companion/index.html

2. **Login testen:**
   - Endpoint: `/session`
   - Method: `POST`
   - Headers:
     ```
     X-IG-API-KEY: dein_api_key
     Version: 2
     ```
   - Body:
     ```json
     {
       "identifier": "deine_email@example.com",
       "password": "dein_passwort"
     }
     ```

3. **Response prüfen:**
   - Status: `200 OK`
   - Headers enthalten: `CST` und `X-SECURITY-TOKEN`
   - Body enthält: `currentAccountId`

### Option B: Node.js Test Script

```javascript
// test_ig_login.js
import fetch from 'node-fetch';

const API_KEY = 'dein_api_key';
const USERNAME = 'deine_email@example.com';
const PASSWORD = 'dein_passwort';

async function testLogin() {
  const response = await fetch('https://demo-api.ig.com/gateway/deal/session', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-IG-API-KEY': API_KEY,
      'Version': '2'
    },
    body: JSON.stringify({
      identifier: USERNAME,
      password: PASSWORD
    })
  });

  console.log('Status:', response.status);
  console.log('CST:', response.headers.get('CST'));
  console.log('Token:', response.headers.get('X-SECURITY-TOKEN'));
  
  const data = await response.json();
  console.log('Account ID:', data.currentAccountId);
}

testLogin();
```

Ausführen:
```powershell
node test_ig_login.js
```

## 🎯 Schritt 4: EPIC Codes finden

### Was sind EPIC Codes?

EPIC = Exchange, Product, Instrument, Currency  
Beispiel: `IX.D.DAX.IFD.IP` = Germany 40 (DAX) Index CFD

### Wie finde ich EPIC Codes?

**Option 1: IG Handelsplattform**

1. Login: https://www.ig.com/de/login
2. Suche nach Instrument (z.B. "DAX")
3. Klicke auf das Instrument
4. URL kopieren - enthält den EPIC:
   ```
   https://www.ig.com/de/indices/markets-indices/germany-40
   → EPIC: IX.D.DAX.IFD.IP
   ```

**Option 2: API Market Search**

```javascript
// GET /markets?searchTerm=DAX
const response = await fetch('https://demo-api.ig.com/gateway/deal/markets?searchTerm=DAX', {
  headers: {
    'X-IG-API-KEY': API_KEY,
    'CST': cst,
    'X-SECURITY-TOKEN': token,
    'Version': '1'
  }
});

const markets = await response.json();
console.log(markets.markets[0].epic); // IX.D.DAX.IFD.IP
```

**Option 3: Unsere Mapping-Tabelle**

Siehe `README.md` → "Unterstützte Instrumente" für vorgefertigte EPICs.

## 📊 Schritt 5: Account Details abrufen

```javascript
// GET /accounts
const response = await fetch('https://demo-api.ig.com/gateway/deal/accounts', {
  headers: {
    'X-IG-API-KEY': API_KEY,
    'CST': cst,
    'X-SECURITY-TOKEN': token,
    'Version': '1'
  }
});

const data = await response.json();
console.log('Accounts:', data.accounts);
```

**Response Beispiel:**
```json
{
  "accounts": [
    {
      "accountId": "ABC123",
      "accountName": "Demo-CFD",
      "preferred": true,
      "accountType": "CFD",
      "balance": {
        "balance": 10000.00,
        "deposit": 0.00,
        "profitLoss": 0.00,
        "available": 10000.00
      },
      "currency": "EUR",
      "canTransferFrom": false,
      "canTransferTo": false
    }
  ]
}
```

## 🚀 Schritt 6: Ersten Test-Trade platzieren

**Wichtig:** Nur im Demo-Modus testen!

```javascript
// POST /positions/otc
const orderPayload = {
  epic: 'IX.D.DAX.IFD.IP',     // Germany 40
  expiry: 'DFB',                // Daily Funded Bet (CFD)
  direction: 'BUY',
  size: 1,                      // Minimal size
  orderType: 'MARKET',
  timeInForce: 'FILL_OR_KILL',
  guaranteedStop: false,
  forceOpen: true,
  currencyCode: 'EUR'
};

const response = await fetch('https://demo-api.ig.com/gateway/deal/positions/otc', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-IG-API-KEY': API_KEY,
    'CST': cst,
    'X-SECURITY-TOKEN': token,
    'Version': '2'
  },
  body: JSON.stringify(orderPayload)
});

const result = await response.json();
console.log('Deal Reference:', result.dealReference);

// Confirm deal
const confirmResponse = await fetch(`https://demo-api.ig.com/gateway/deal/confirms/${result.dealReference}`, {
  headers: {
    'X-IG-API-KEY': API_KEY,
    'CST': cst,
    'X-SECURITY-TOKEN': token,
    'Version': '1'
  }
});

const confirmation = await confirmResponse.json();
console.log('Deal Status:', confirmation.dealStatus); // ACCEPTED
console.log('Deal ID:', confirmation.dealId);
```

## 🔄 Session Management

**Sessions ablaufen nach:**
- Standard: 6 Stunden
- Bei Inaktivität: 60 Minuten

**Automatisches Re-Login:**

Unsere `igApi.js` handhabt das automatisch:
- Speichert CST + X-SECURITY-TOKEN
- Prüft Session vor jedem Request
- Re-Login bei 401 Unauthorized

## 📚 Weiterführende Ressourcen

- **REST API Reference:** https://labs.ig.com/rest-trading-api-reference
- **Order Types:** https://labs.ig.com/apiorders
- **Sample Apps:** https://labs.ig.com/sample-apps
- **Support Forum:** https://labs.ig.com/node/557

## 🔐 Wichtige Sicherheitshinweise

1. **API Key schützen:**
   - Niemals in GitHub committen
   - Nur über `.env` Datei laden
   - Regelmäßig rotieren

2. **Demo vs Live unterscheiden:**
   - Demo API: `demo-api.ig.com`
   - Live API: `api.ig.com`
   - Immer `IG_DEMO_MODE=true` für Tests!

3. **Rate Limits beachten:**
   - Demo: 60 requests/minute
   - Live: 60 requests/minute
   - Trading: 200 requests/minute

## ✅ Checkliste

- [ ] IG Demo Account erstellt
- [ ] Login auf IG.com erfolgreich
- [ ] API Key auf labs.ig.com generiert
- [ ] API Login per Companion getestet
- [ ] Account ID notiert
- [ ] EPIC Codes für Instrumente gefunden
- [ ] Credentials in `.env` eingetragen
- [ ] Test-Trade platziert (Demo!)

## 🎉 Fertig!

Du bist jetzt bereit, den Telegram Trader mit IG Markets zu nutzen!

Nächster Schritt: Zurück zu `README.md` → "Installation & Setup"
