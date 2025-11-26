/**
 * Live Trend Analyzer
 * Parses and analyzes LIVE TREND messages
 */

/**
 * Scale price for instruments that use different decimal formats
 * Some signals come in 2-digit format (61.00) but IG trades in 4-digit (6100)
 * @param {string} instrument - Instrument name (e.g., "BRENT", "GOLD")
 * @param {number} price - Price from message
 * @returns {number} - Scaled price
 */
function scalePrice(instrument, price) {
  // Instruments that need 100x scaling (2-digit → 4-digit)
  const needsScaling = ['BRENT', 'OIL', 'WTI'];
  
  if (!needsScaling.includes(instrument)) {
    return price;
  }
  
  // If price is already 4-digit (> 1000), don't scale
  if (price >= 1000) {
    return price;
  }
  
  // Scale 2-digit to 4-digit (61.00 → 6100)
  const scaled = price * 100;
  console.log(`   📐 Price scaling: ${instrument} ${price} → ${scaled}`);
  return scaled;
}

/**
 * Parse a LIVE TREND message and extract all relevant data
 * @param {string} messageText - The raw message text
 * @returns {Object} - Parsed trend data
 */
export function parseLiveTrend(messageText) {
  const trend = {
    raw: messageText,
    type: 'UNKNOWN',
    timestamp: new Date().toISOString(),
    data: {}
  };
  
  // 1. Check for POSITION OPEN (ICH KAUFE/VERKAUFE)
  // Example: "ICH KAUFE GOLD (EK: 4100.77)"
  // Example: "ICH KAUFE ETHEREUM CALL 3300 (EK: 137.98)"
  const openPattern = /ICH\s+(KAUFE|VERKAUFE)\s+([A-Z0-9]+)(?:\s+(CALL|PUT)\s+(\d+))?\s*\(EK:\s*(\d+(?:[.,]\d+)?)\)/i;
  const openMatch = messageText.match(openPattern);
  
  if (openMatch) {
    trend.type = 'POSITION_OPEN';
    const action = openMatch[1].toUpperCase();
    const instrument = openMatch[2].toUpperCase();
    const optionType = openMatch[3] ? openMatch[3].toUpperCase() : null;
    const strikePrice = openMatch[4] ? parseFloat(openMatch[4]) : null;
    let entryPrice = parseFloat(openMatch[5].replace(',', '.'));
    
    // Scale price if needed (e.g., BRENT 61.00 → 6100)
    entryPrice = scalePrice(instrument, entryPrice);
    
    trend.data.direction = action === 'KAUFE' ? 'BUY' : 'SELL';
    trend.data.instrument = instrument;
    trend.data.symbol = mapInstrumentToMT5Symbol(instrument);
    trend.data.price = entryPrice;
    trend.data.entryPrice = entryPrice;
    
    // Options data
    if (optionType) {
      trend.data.optionType = optionType; // CALL or PUT
      trend.data.strikePrice = strikePrice;
      trend.data.isOption = true;
      
      // For IG Markets: Trade the underlying asset with option direction logic
      // CALL = BUY the underlying (bullish)
      // PUT = SELL the underlying (bearish)
      trend.data.direction = optionType === 'CALL' ? 'BUY' : 'SELL';
      
      console.log(`📊 Option Signal: ${optionType} @ Strike ${strikePrice}`);
      console.log(`   → Trading underlying ${instrument} as ${trend.data.direction}`);
    }
    
    return trend;
  }
  
  // 2. Check for POSITION CLOSE (ICH SCHLIEßE)
  // Example: "ICH SCHLIEßE GOLD❗3.343€ GEWINN 🎉"
  // Example: "ICH SCHLIEßE ETHEREUM CALL 3300❗50.00€ GEWINN"
  // Example: "ICH SCHLIEßE DAX" (manual close without P/L info)
  const closePatternWithPL = /ICH\s+SCHLIE[ßS]E\s+([A-Z0-9]+)(?:\s+(CALL|PUT)\s+(\d+))?.*?(\d+(?:[.,]\d+)?)\s*€\s*(GEWINN|VERLUST)/i;
  const closePatternSimple = /ICH\s+SCHLIE[ßS]E\s+([A-Z0-9]+)(?:\s+(CALL|PUT)\s+(\d+))?/i;
  
  let closeMatch = messageText.match(closePatternWithPL);
  let hasProfit = true;
  
  if (!closeMatch) {
    closeMatch = messageText.match(closePatternSimple);
    hasProfit = false;
  }
  
  if (closeMatch) {
    trend.type = 'POSITION_CLOSE';
    const instrument = closeMatch[1].toUpperCase();
    const optionType = closeMatch[2] ? closeMatch[2].toUpperCase() : null;
    const strikePrice = closeMatch[3] ? parseFloat(closeMatch[3]) : null;
    
    trend.data.instrument = instrument;
    trend.data.symbol = mapInstrumentToMT5Symbol(instrument);
    
    if (hasProfit) {
      const amount = parseFloat(closeMatch[4].replace(',', '.'));
      const result = closeMatch[5].toUpperCase();
      trend.data.profit = result === 'GEWINN' ? amount : -amount;
      trend.data.result = result;
    } else {
      trend.data.profit = 0;
      trend.data.result = 'MANUAL_CLOSE';
    }
    
    // Options data
    if (optionType) {
      trend.data.optionType = optionType;
      trend.data.strikePrice = strikePrice;
      trend.data.isOption = true;
      console.log(`📊 Closing option: ${optionType} @ Strike ${strikePrice}`);
    }
    
    return trend;
  }
  
  // 3. Check for STOP LOSS UPDATE
  // Example: "Ich setze den SL bei BITCOIN auf 84376.00"
  // Example: "Ich setze den SL bei BRENT auf 6130"
  // Example: "Ich setze den SL bei TESLA PUT 390 auf 28.99"
  const slPattern = /(?:Ich\s+setze\s+den\s+)?SL\s+(?:bei\s+)?([A-Z0-9]+)(?:\s+(CALL|PUT)\s+(\d+))?\s+auf\s+(\d+(?:[.,]\d+)?)/i;
  const slMatch = messageText.match(slPattern);
  
  if (slMatch) {
    trend.type = 'STOP_LOSS_UPDATE';
    const instrument = slMatch[1].toUpperCase();
    const optionType = slMatch[2] ? slMatch[2].toUpperCase() : null;
    const strikePrice = slMatch[3] ? parseFloat(slMatch[3]) : null;
    let slPrice = parseFloat(slMatch[4].replace(',', '.'));
    
    // Scale price if needed (e.g., BRENT 61.00 → 6100)
    slPrice = scalePrice(instrument, slPrice);
    
    trend.data.instrument = instrument;
    trend.data.symbol = mapInstrumentToMT5Symbol(instrument);
    trend.data.stopLoss = slPrice;

    if (optionType) {
      trend.data.optionType = optionType;
      trend.data.strikePrice = strikePrice;
      trend.data.isOption = true;
    }
    
    return trend;
  }

  // 3b. Check for Short STOP LOSS UPDATE
  // Example: "BITCOIN PUT 88000 SL: 2367.00"
  const slPatternShort = /^([A-Z0-9]+)(?:\s+(CALL|PUT)\s+(\d+))?\s+SL:?\s+(\d+(?:[.,]\d+)?)/i;
  const slMatchShort = messageText.match(slPatternShort);

  if (slMatchShort) {
    trend.type = 'STOP_LOSS_UPDATE';
    const instrument = slMatchShort[1].toUpperCase();
    const optionType = slMatchShort[2] ? slMatchShort[2].toUpperCase() : null;
    const strikePrice = slMatchShort[3] ? parseFloat(slMatchShort[3]) : null;
    let slPrice = parseFloat(slMatchShort[4].replace(',', '.'));

    // Scale price if needed (e.g., BRENT 61.00 → 6100)
    slPrice = scalePrice(instrument, slPrice);

    trend.data.instrument = instrument;
    trend.data.symbol = mapInstrumentToMT5Symbol(instrument);
    trend.data.stopLoss = slPrice;

    if (optionType) {
      trend.data.optionType = optionType;
      trend.data.strikePrice = strikePrice;
      trend.data.isOption = true;
    }

    return trend;
  }

  // 3b. Check for TAKE PROFIT UPDATE
  // Example: "Ich setze den TP bei DOW auf 26160.0"
  const tpPattern = /(?:Ich\s+setze\s+den\s+)?TP\s+(?:bei\s+)?([A-Z0-9]+)(?:\s+(CALL|PUT)\s+(\d+))?\s+auf\s+(\d+(?:[.,]\d+)?)/i;
  const tpMatch = messageText.match(tpPattern);

  if (tpMatch) {
    trend.type = 'TAKE_PROFIT_UPDATE';
    const instrument = tpMatch[1].toUpperCase();
    const optionType = tpMatch[2] ? tpMatch[2].toUpperCase() : null;
    const strikePrice = tpMatch[3] ? parseFloat(tpMatch[3]) : null;
    let tpPrice = parseFloat(tpMatch[4].replace(',', '.'));

    // Scale price if needed (e.g., BRENT 61.00 → 6100)
    tpPrice = scalePrice(instrument, tpPrice);

    trend.data.instrument = instrument;
    trend.data.symbol = mapInstrumentToMT5Symbol(instrument);
    trend.data.takeProfit = tpPrice;
    trend.data.target = tpPrice;

    if (optionType) {
      trend.data.optionType = optionType;
      trend.data.strikePrice = strikePrice;
      trend.data.isOption = true;
    }

    return trend;
  }

  // 4. Check for POSITION OPEN with TP (ICH KAUFE ... UND SETZE TP AUF ...)
  // Example: "Ich verkaufe Bitcoin und setze TP auf 535.0"
  const openWithTpPattern = /ICH\s+(KAUFE|VERKAUFE)\s+([A-Z0-9]+)(?:\s+(CALL|PUT)\s+(\d+))?\s+UND\s+SETZE\s+TP\s+AUF\s+(\d+(?:[.,]\d+)?)/i;
  const openWithTpMatch = messageText.match(openWithTpPattern);

  if (openWithTpMatch) {
    trend.type = 'POSITION_OPEN';
    const action = openWithTpMatch[1].toUpperCase();
    const instrument = openWithTpMatch[2].toUpperCase();
    const optionType = openWithTpMatch[3] ? openWithTpMatch[3].toUpperCase() : null;
    const strikePrice = openWithTpMatch[4] ? parseFloat(openWithTpMatch[4]) : null;
    let tpPrice = parseFloat(openWithTpMatch[5].replace(',', '.'));

    // Scale price if needed (e.g., BRENT 61.00 → 6100)
    tpPrice = scalePrice(instrument, tpPrice);

    trend.data.direction = action === 'KAUFE' ? 'BUY' : 'SELL';
    trend.data.instrument = instrument;
    trend.data.symbol = mapInstrumentToMT5Symbol(instrument);
    trend.data.takeProfit = tpPrice;
    trend.data.target = tpPrice; // Set target as well

    // Options data
    if (optionType) {
      trend.data.optionType = optionType;
      trend.data.strikePrice = strikePrice;
      trend.data.isOption = true;
      trend.data.direction = optionType === 'CALL' ? 'BUY' : 'SELL';
    }

    return trend;
  }

  // 5. Check for POSITION OPEN with SL (ICH KAUFE ... UND SETZE SL AUF ...)
  // Example: "Ich verkaufe Bitcoin EK: 83931.78 und setze SL auf 535"
  const openWithSlPattern = /ICH\s+(KAUFE|VERKAUFE)\s+([A-Z0-9]+)(?:\s+(CALL|PUT)\s+(\d+))?(?:\s+EK:\s*(\d+(?:[.,]\d+)?))?\s+UND\s+SETZE\s+SL\s+AUF\s+(\d+(?:[.,]\d+)?)/i;
  const openWithSlMatch = messageText.match(openWithSlPattern);

  if (openWithSlMatch) {
    trend.type = 'POSITION_OPEN';
    const action = openWithSlMatch[1].toUpperCase();
    const instrument = openWithSlMatch[2].toUpperCase();
    const optionType = openWithSlMatch[3] ? openWithSlMatch[3].toUpperCase() : null;
    const strikePrice = openWithSlMatch[4] ? parseFloat(openWithSlMatch[4]) : null;
    let entryPrice = openWithSlMatch[5] ? parseFloat(openWithSlMatch[5].replace(',', '.')) : null;
    let slPrice = parseFloat(openWithSlMatch[6].replace(',', '.'));

    // Scale prices if needed (e.g., BRENT 61.00 → 6100)
    if (entryPrice) {
      entryPrice = scalePrice(instrument, entryPrice);
    }
    slPrice = scalePrice(instrument, slPrice);

    trend.data.direction = action === 'KAUFE' ? 'BUY' : 'SELL';
    trend.data.instrument = instrument;
    trend.data.symbol = mapInstrumentToMT5Symbol(instrument);
    trend.data.stopLoss = slPrice;
    
    if (entryPrice) {
        trend.data.price = entryPrice;
        trend.data.entryPrice = entryPrice;
    }

    // Options data
    if (optionType) {
      trend.data.optionType = optionType;
      trend.data.strikePrice = strikePrice;
      trend.data.isOption = true;
      trend.data.direction = optionType === 'CALL' ? 'BUY' : 'SELL';
    }

    return trend;
  }
  
  // 6. Fallback: Try to parse as generic LIVE TREND
  if (messageText.includes('LIVE TREND')) {
    trend.type = 'LIVE TREND';
    
    // Split message into lines for analysis
    const lines = messageText.split('\n').map(line => line.trim()).filter(line => line);
    
    lines.forEach(line => {
      // Look for symbols
      const symbolMatch = line.match(/([A-Z]{2,}\/[A-Z]{2,})|([A-Z]{3,}USD[T]?)/i);
      if (symbolMatch && !trend.data.symbol) {
        trend.data.symbol = symbolMatch[0];
      }
      
      // Look for direction
      if (/\b(BUY|LONG|KAUFE)\b/i.test(line) && !trend.data.direction) {
        trend.data.direction = 'BUY';
      } else if (/\b(SELL|SHORT|VERKAUFE)\b/i.test(line) && !trend.data.direction) {
        trend.data.direction = 'SELL';
      }
      
      // Look for prices
      const priceMatch = line.match(/(?:ek|preis|price|@|bei):?\s*(\d+(?:[.,]\d+)?)/i);
      if (priceMatch && !trend.data.price) {
        trend.data.price = parseFloat(priceMatch[1].replace(',', '.'));
        trend.data.entryPrice = trend.data.price;
      }
      
      // Look for targets
      const targetMatch = line.match(/(?:target|ziel|tp):?\s*(\d+(?:[.,]\d+)?)/i);
      if (targetMatch) {
        trend.data.target = parseFloat(targetMatch[1].replace(',', '.'));
        trend.data.takeProfit = trend.data.target;
      }
      
      // Look for stop loss
      const stopLossMatch = line.match(/(?:stop[\s-]?loss|sl):?\s*(\d+(?:[.,]\d+)?)/i);
      if (stopLossMatch) {
        trend.data.stopLoss = parseFloat(stopLossMatch[1].replace(',', '.'));
      }
      
      // Look for timeframe
      const timeframeMatch = line.match(/(\d+)[\s-]?(min|minute|hour|std|stunde|tag|day)/i);
      if (timeframeMatch) {
        trend.data.timeframe = timeframeMatch[0];
      }
    });
  }
  
  return trend;
}

/**
 * Map instrument names to IG Markets EPIC codes (CFD Version for EU)
 * @param {string} instrument - Instrument name (e.g., "DAX", "GOLD", "BITCOIN")
 * @returns {Object} - IG EPIC code, symbol name, and expiry
 */
function mapInstrumentToIG(instrument) {
  const mapping = {
    // Commodities (CFD)
    'GOLD': { 
      epic: 'CS.D.CFEGOLD.CEA.IP', 
      symbol: 'Gold', 
      expiry: '-',
      fallback: {
        epic: 'IX.D.SUNGOLD.CEA.IP',
        symbol: 'Weekend Gold',
        expiry: '-'
      }
    },
    'SILBER': { epic: 'CS.D.USSIGC.CFD.IP', symbol: 'Silver', expiry: '-' },
    'SILVER': { epic: 'CS.D.USSIGC.CFD.IP', symbol: 'Silver', expiry: '-' },
    'OIL': { epic: 'CC.D.LCO.UNC.IP', symbol: 'Oil - Brent Crude', expiry: '-' },
    'WTI': { epic: 'CC.D.CL.UNC.IP', symbol: 'Oil - US Crude', expiry: '-' },
    'BRENT': { epic: 'CC.D.LCO.UNC.IP', symbol: 'Oil - Brent Crude', expiry: '-' },

    // Indices (CFD)
    'DAX': { 
      epic: 'IX.D.DAX.IFMM.IP', 
      symbol: 'Germany 40', 
      expiry: '-',
      fallback: {
        epic: 'IX.D.SUNDAX.IGN.IP', // Correct Weekend EPIC
        symbol: 'Weekend Germany 40',
        expiry: '-'
      }
    },
    'DAX40': { 
      epic: 'IX.D.DAX.IFMM.IP', 
      symbol: 'Germany 40', 
      expiry: '-',
      fallback: {
        epic: 'IX.D.SUNDAX.IGN.IP', // Correct Weekend EPIC
        symbol: 'Weekend Germany 40',
        expiry: '-'
      }
    },
    'SP500': { 
      epic: 'IX.D.SPTRD.IFMM.IP', 
      symbol: 'US 500', 
      expiry: '-',
      // Fallback temporarily disabled - EPIC not found
      // fallback: {
      //   epic: 'IX.D.SPTRD.WKND.IP',
      //   symbol: 'Weekend US 500',
      //   expiry: '-'
      // }
    },
    'S&P500': { 
      epic: 'IX.D.SPTRD.IFMM.IP', 
      symbol: 'US 500', 
      expiry: '-',
      // Fallback temporarily disabled - EPIC not found
      // fallback: {
      //   epic: 'IX.D.SPTRD.WKND.IP',
      //   symbol: 'Weekend US 500',
      //   expiry: '-'
      // }
    },
    'NASDAQ': { 
      epic: 'IX.D.NASDAQ.IFMM.IP', 
      symbol: 'US Tech 100', 
      expiry: '-',
      fallback: {
        epic: 'IX.D.SUNNAS.IFE.IP', // Correct Weekend EPIC
        symbol: 'Weekend US Tech 100',
        expiry: '-'
      }
    },
    'DOW': { 
      epic: 'IX.D.DOW.IFMM.IP', 
      symbol: 'Wall Street', 
      expiry: '-',
      fallback: {
        epic: 'IX.D.SUNDOW.IFE.IP', // Correct Weekend EPIC
        symbol: 'Weekend Wall Street',
        expiry: '-'
      }
    },
    'FTSE': { 
      epic: 'IX.D.FTSE.IFMM.IP', 
      symbol: 'FTSE 100', 
      expiry: '-',
      fallback: {
        epic: 'IX.D.SUNFUN.IFE.IP', // Correct Weekend EPIC
        symbol: 'Weekend UK 100',
        expiry: '-'
      }
    },
    'CAC': { 
      epic: 'IX.D.CAC.IFMM.IP', 
      symbol: 'France 40', 
      expiry: '-',
      fallback: {
        epic: 'IX.D.SUNCAC.IMF.IP', // Correct Weekend EPIC
        symbol: 'Weekend France 40',
        expiry: '-'
      }
    },
    'NIKKEI': { epic: 'IX.D.NIKKEI.IFMM.IP', symbol: 'Japan 225', expiry: '-' },

    // Forex (Spot FX - CFD)
    'EURUSD': { epic: 'CS.D.EURUSD.MINI.IP', symbol: 'EUR/USD', expiry: '-' },
    'GBPUSD': { epic: 'CS.D.GBPUSD.MINI.IP', symbol: 'GBP/USD', expiry: '-' },
    'USDJPY': { epic: 'CS.D.USDJPY.MINI.IP', symbol: 'USD/JPY', expiry: '-' },
    'USDCHF': { epic: 'CS.D.USDCHF.MINI.IP', symbol: 'USD/CHF', expiry: '-' },
    'AUDUSD': { epic: 'CS.D.AUDUSD.MINI.IP', symbol: 'AUD/USD', expiry: '-' },
    'USDCAD': { epic: 'CS.D.USDCAD.MINI.IP', symbol: 'USD/CAD', expiry: '-' },
    'NZDUSD': { epic: 'CS.D.NZDUSD.MINI.IP', symbol: 'NZD/USD', expiry: '-' },

    // Crypto (24/7 CFDs)
    // Primary: Bitcoin (Standard), Fallback: Bitcoin Cash (BCH)
    'BITCOIN': { 
      epic: 'CS.D.BITCOIN.CFD.IP', 
      symbol: 'Bitcoin', 
      expiry: '-',
      fallback: {
        epic: 'CS.D.BCHUSD.CFD.IP',
        symbol: 'Bitcoin Cash (Backup)',
        expiry: '-'
      }
    },
    'BTC': { 
      epic: 'CS.D.BITCOIN.CFD.IP', 
      symbol: 'Bitcoin', 
      expiry: '-',
      fallback: {
        epic: 'CS.D.BCHUSD.CFD.IP',
        symbol: 'Bitcoin Cash (Backup)',
        expiry: '-'
      }
    },
    'BITCOIN CASH': { epic: 'CS.D.BCHUSD.CFD.IP', symbol: 'Bitcoin Cash', expiry: '-' },
    'BCH': { epic: 'CS.D.BCHUSD.CFD.IP', symbol: 'Bitcoin Cash', expiry: '-' },
    'ETHEREUM': { epic: 'CS.D.ETHUSD.CFD.IP', symbol: 'Ether', expiry: '-' },
    'ETH': { epic: 'CS.D.ETHUSD.CFD.IP', symbol: 'Ether', expiry: '-' },
    'SOLANA': { epic: 'CS.D.SOLUSD.CFD.IP', symbol: 'Solana', expiry: '-' },
    'SOL': { epic: 'CS.D.SOLUSD.CFD.IP', symbol: 'Solana', expiry: '-' },
    'RIPPLE': { epic: 'CS.D.XRPUSD.CFD.IP', symbol: 'Ripple', expiry: '-' },
    'XRP': { epic: 'CS.D.XRPUSD.CFD.IP', symbol: 'Ripple', expiry: '-' },
    'LITECOIN': { epic: 'CS.D.LTCUSD.CFD.IP', symbol: 'Litecoin', expiry: '-' },
    'LTC': { epic: 'CS.D.LTCUSD.CFD.IP', symbol: 'Litecoin', expiry: '-' },

    // US Stocks (24 Hours) - Using correct .CASH.IP EPICs
    'TESLA': { epic: 'UD.D.TSLA.CASH.IP', symbol: 'Tesla', expiry: '-' },
    'TSLA': { epic: 'UD.D.TSLA.CASH.IP', symbol: 'Tesla', expiry: '-' },
    'NETFLIX': { epic: 'UC.D.NFLX.CASH.IP', symbol: 'Netflix', expiry: '-' },
    'NFLX': { epic: 'UC.D.NFLX.CASH.IP', symbol: 'Netflix', expiry: '-' },
    'BROADCOM': { epic: 'UA.D.AVGO.CASH.IP', symbol: 'Broadcom', expiry: '-' },
    'AVGO': { epic: 'UA.D.AVGO.CASH.IP', symbol: 'Broadcom', expiry: '-' },
    'APPLE': { epic: 'UA.D.AAPL.CASH.IP', symbol: 'Apple', expiry: '-' },
    'AAPL': { epic: 'UA.D.AAPL.CASH.IP', symbol: 'Apple', expiry: '-' },
    'AMAZON': { epic: 'UB.D.AMZN.CASH.IP', symbol: 'Amazon', expiry: '-' },
    'AMZN': { epic: 'UB.D.AMZN.CASH.IP', symbol: 'Amazon', expiry: '-' },
    'GOOGLE': { epic: 'UC.D.GOOG.CASH.IP', symbol: 'Google', expiry: '-' },
    'GOOG': { epic: 'UC.D.GOOG.CASH.IP', symbol: 'Google', expiry: '-' },
    'META': { epic: 'UD.D.META.CASH.IP', symbol: 'Meta', expiry: '-' },
    'MSFT': { epic: 'UD.D.MSFT.CASH.IP', symbol: 'Microsoft', expiry: '-' },
    'MICROSOFT': { epic: 'UD.D.MSFT.CASH.IP', symbol: 'Microsoft', expiry: '-' },
    'NVDA': { epic: 'UD.D.NVDA.CASH.IP', symbol: 'Nvidia', expiry: '-' },
    'NVIDIA': { epic: 'UD.D.NVDA.CASH.IP', symbol: 'Nvidia', expiry: '-' },
    'AMD': { epic: 'UA.D.AMD.CASH.IP', symbol: 'AMD', expiry: '-' },
    'INTEL': { epic: 'UC.D.INTC.CASH.IP', symbol: 'Intel', expiry: '-' },
    'INTC': { epic: 'UC.D.INTC.CASH.IP', symbol: 'Intel', expiry: '-' },
    'PAYPAL': { epic: 'UD.D.PYPL.CASH.IP', symbol: 'PayPal', expiry: '-' },
    'PYPL': { epic: 'UD.D.PYPL.CASH.IP', symbol: 'PayPal', expiry: '-' },
    'ADOBE': { epic: 'UA.D.ADBE.CASH.IP', symbol: 'Adobe', expiry: '-' },
    'ADBE': { epic: 'UA.D.ADBE.CASH.IP', symbol: 'Adobe', expiry: '-' },
    'SHOPIFY': { epic: 'UC.D.SHOP.CASH.IP', symbol: 'Shopify', expiry: '-' },
    'SHOP': { epic: 'UC.D.SHOP.CASH.IP', symbol: 'Shopify', expiry: '-' },
    'UBER': { epic: 'UD.D.UBER.CASH.IP', symbol: 'Uber', expiry: '-' },
    'COINBASE': { epic: 'UB.D.COIN.CASH.IP', symbol: 'Coinbase', expiry: '-' },
    'COIN': { epic: 'UB.D.COIN.CASH.IP', symbol: 'Coinbase', expiry: '-' },
    // ...weitere gängige Aktien nach Bedarf ergänzen
  };

  // Fallback: Wenn Instrument wie ein US-Ticker aussieht, generiere Epic automatisch
  // Format: U[A-D].D.[TICKER].CASH.IP für US-Aktien (24 Hours)
  if (!mapping[instrument] && /^[A-Z]{2,6}$/.test(instrument)) {
    // Erste Buchstabe basierend auf Ticker: A-G=UA, H-N=UB, O-T=UC, U-Z=UD
    const firstLetter = instrument.charAt(0);
    let prefix = 'UD'; // Default
    if (firstLetter >= 'A' && firstLetter <= 'G') prefix = 'UA';
    else if (firstLetter >= 'H' && firstLetter <= 'N') prefix = 'UB';
    else if (firstLetter >= 'O' && firstLetter <= 'T') prefix = 'UC';
    
    return {
      epic: `${prefix}.D.${instrument}.CASH.IP`,
      symbol: instrument,
      expiry: '-'
    };
  }

  return mapping[instrument] || {
    epic: null,
    symbol: instrument,
    expiry: '-'
  };
}

/**
 * DEPRECATED: Legacy MT5 symbol mapping
 * @param {string} instrument - Instrument name
 * @returns {string} - Symbol name for display
 */
function mapInstrumentToMT5Symbol(instrument) {
  const ig = mapInstrumentToIG(instrument);
  return ig.symbol;
}

// Export the new IG mapping function
export { mapInstrumentToIG };

/**
 * Validate if a parsed trend has the minimum required data
 * @param {Object} trend - Parsed trend object
 * @returns {boolean} - True if valid
 */
export function isValidTrend(trend) {
  // Define minimum requirements
  const hasSymbol = trend.data.symbol !== undefined;
  const hasDirection = trend.data.direction !== undefined;
  
  return hasSymbol && hasDirection;
}

/**
 * Format a trend for display
 * @param {Object} trend - Parsed trend object
 * @returns {string} - Formatted string
 */
export function formatTrend(trend) {
  const parts = [];
  
  if (trend.data.symbol) {
    parts.push(`Symbol: ${trend.data.symbol}`);
  }
  
  if (trend.data.direction) {
    const prefix = trend.data.direction === 'BUY' ? '[BUY]' : '[SELL]';
    parts.push(`${prefix} Direction: ${trend.data.direction}`);
  }
  
  if (trend.data.price) {
    parts.push(`Price: ${trend.data.price}`);
  }
  
  if (trend.data.target) {
    parts.push(`Target: ${trend.data.target}`);
  }
  
  if (trend.data.stopLoss) {
    parts.push(`Stop Loss: ${trend.data.stopLoss}`);
  }
  
  if (trend.data.timeframe) {
    parts.push(`Timeframe: ${trend.data.timeframe}`);
  }
  
  return parts.join('\n');
}

/**
 * Store trends in memory (for quick access)
 */
class TrendStore {
  constructor(maxSize = 100) {
    this.trends = [];
    this.maxSize = maxSize;
  }
  
  add(trend) {
    this.trends.push(trend);
    
    // Keep only the most recent trends
    if (this.trends.length > this.maxSize) {
      this.trends.shift();
    }
  }
  
  getRecent(count = 10) {
    return this.trends.slice(-count);
  }
  
  getAll() {
    return this.trends;
  }
  
  getBySymbol(symbol) {
    return this.trends.filter(t => t.data.symbol === symbol);
  }
  
  clear() {
    this.trends = [];
  }
  
  getStats() {
    const total = this.trends.length;
    const byDirection = this.trends.reduce((acc, t) => {
      const dir = t.data.direction || 'UNKNOWN';
      acc[dir] = (acc[dir] || 0) + 1;
      return acc;
    }, {});
    
    const bySymbol = this.trends.reduce((acc, t) => {
      const sym = t.data.symbol || 'UNKNOWN';
      acc[sym] = (acc[sym] || 0) + 1;
      return acc;
    }, {});
    
    return {
      total,
      byDirection,
      bySymbol,
      mostTraded: Object.entries(bySymbol).sort((a, b) => b[1] - a[1])[0]
    };
  }
}

export const trendStore = new TrendStore();

/**
 * Calculate potential profit based on trend data
 * @param {Object} trend - Parsed trend object
 * @returns {Object|null} - Profit calculation or null
 */
export function calculatePotential(trend) {
  const { price, target, stopLoss, direction } = trend.data;
  
  if (!price || !target || !stopLoss) {
    return null;
  }
  
  let potentialProfit, potentialLoss, riskRewardRatio;
  
  if (direction === 'BUY') {
    potentialProfit = ((target - price) / price) * 100;
    potentialLoss = ((price - stopLoss) / price) * 100;
  } else if (direction === 'SELL') {
    potentialProfit = ((price - target) / price) * 100;
    potentialLoss = ((stopLoss - price) / price) * 100;
  }
  
  if (potentialLoss > 0) {
    riskRewardRatio = potentialProfit / potentialLoss;
  }
  
  return {
    potentialProfit: potentialProfit?.toFixed(2),
    potentialLoss: potentialLoss?.toFixed(2),
    riskRewardRatio: riskRewardRatio?.toFixed(2)
  };
}
