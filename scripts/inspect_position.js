#!/usr/bin/env node
import { igApi } from '../src/igApi.js';
import { getExchangeRateToEURCached } from '../src/exchangeRates.js';

async function inspect() {
  try {
    console.log('\n🔐 Logging in to IG API...');
    await igApi.login();

    console.log('\n📒 Account summary:');
    const acct = await igApi.getAccountInfo();
    console.log(JSON.stringify(acct, null, 2));

    console.log('\n📡 Fetching open positions...');
    const positions = await igApi.getOpenPositions();
    console.log(`Found ${positions.length} position(s).\n`);

    for (const p of positions) {
      try {
        const dealId = p.position.dealId;
        const epic = p.market.epic;
        const instrument = p.market.instrumentName;
        const size = p.position.size;
        const direction = p.position.direction; // BUY / SELL
        const entry = p.position.level;
        const apiProfit = p.position.profit !== undefined ? p.position.profit : null;

        // Try to get live price from market snapshot
        let marketDetails = await igApi.getMarketDetails(epic).catch(() => null);
        let currentPrice = p.market.bid || p.market.offer || null;

        if (!currentPrice && marketDetails) {
          currentPrice = marketDetails.bid || marketDetails.offer || marketDetails.closePrice || null;
        }

        // If still no price, fetch last minute candle
        if (!currentPrice) {
          const candles = await igApi.getPrices(epic, 'MINUTE', 1).catch(() => []);
          if (candles && candles.length > 0) {
            const last = candles[candles.length - 1];
            currentPrice = (last.closePrice && (last.closePrice.bid || last.closePrice.ask || last.closePrice.lastTraded)) || null;
          }
        }

        // Determine contractSize and marginFactor
        let contractSize = 1;
        let marginFactor = 0.05; // fallback 5%
        if (marketDetails) {
          if (marketDetails.rawData?.instrument?.contractSize) contractSize = Number(marketDetails.rawData.instrument.contractSize) || 1;
          if (marketDetails.marginFactor) marginFactor = (Number(marketDetails.marginFactor) || marginFactor) / 100;
          else if (marketDetails.marginDepositBands && marketDetails.marginDepositBands[0]) marginFactor = (marketDetails.marginDepositBands[0].margin || marginFactor * 100) / 100;
        }

        // Use API-provided P&L if present
        let profitEUR = null;
        let usedApiProfit = false;
        if (apiProfit !== null && apiProfit !== undefined) {
          profitEUR = Number(apiProfit);
          usedApiProfit = true;
        } else if (currentPrice !== null) {
          // calculate manually in quote currency then convert to EUR if needed
          const multiplier = direction === 'BUY' ? 1 : -1; // for SELL profit = (open - current)
          const profitInQuote = (currentPrice - entry) * multiplier * Number(size) * contractSize;

          // convert to EUR if position currency differs
          const quoteCurrency = p.position.currency || marketDetails?.currencyCode || 'EUR';
          let exch = 1.0;
          if (quoteCurrency && quoteCurrency !== 'EUR') {
            exch = await getExchangeRateToEURCached(quoteCurrency).catch(() => 1.0);
          }
          profitEUR = profitInQuote * exch;
        }

        // margin calculation (approx)
        let marginValue = null;
        if (currentPrice !== null) {
          marginValue = currentPrice * Number(size) * contractSize * marginFactor;
          // convert to EUR if needed
          const quoteCurrency = p.position.currency || marketDetails?.currencyCode || 'EUR';
          if (quoteCurrency && quoteCurrency !== 'EUR') {
            const exch = await getExchangeRateToEURCached(quoteCurrency).catch(() => 1.0);
            marginValue = marginValue * exch;
          }
        }

        console.log('-----------------------------------------------');
        console.log(`Deal ID: ${dealId}`);
        console.log(`Epic: ${epic}`);
        console.log(`Instrument: ${instrument}`);
        console.log(`Size: ${size} | Direction: ${direction}`);
        console.log(`Entry level: ${entry}`);
        console.log(`Current price: ${currentPrice !== null ? currentPrice : 'N/A'}`);
        console.log(`API P&L present: ${usedApiProfit ? 'YES' : 'NO'}`);
        console.log(`P&L (EUR): ${profitEUR !== null ? profitEUR.toFixed(2) : 'N/A'}`);
        console.log(`Margin (EUR approx): ${marginValue !== null ? marginValue.toFixed(2) : 'N/A'}`);
        console.log(`Stop Level: ${p.position.stopLevel || 'N/A'}`);
        console.log(`Open at: ${p.position.createdDateUTC || p.position.createdDate || 'N/A'}`);
        console.log('Raw position object (short):', JSON.stringify({ level: p.position.level, dealId: p.position.dealId, profit: p.position.profit, currency: p.position.currency }, null, 2));
      } catch (inner) {
        console.error('Error inspecting position:', inner.message);
      }
    }

  } catch (error) {
    console.error('Error in inspect:', error.message);
    process.exitCode = 1;
  }
}

inspect();
