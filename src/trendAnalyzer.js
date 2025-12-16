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
  const needsScaling = ['OIL', 'WTI', 'BRENT'];
  
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
  // Example: "ICH KAUFE EUR/USD (EK: 1.15954)"
  // Example: "ICH KAUFE BITCOIN CASH (EK: 500.00)"
  const openPattern = /ICH\s+(KAUFE|VERKAUFE)\s+(.+?)(?:\s+(CALL|PUT)\s+(\d+))?\s*\(EK:\s*(\d+(?:[.,]\d+)?)\)/i;
  const openMatch = messageText.match(openPattern);
  
  if (openMatch) {
    trend.type = 'POSITION_OPEN';
    const action = openMatch[1].toUpperCase();
    const instrument = openMatch[2].trim().toUpperCase(); // Trim whitespace!
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
  const closePatternWithPL = /ICH\s+SCHLIE[ßS]E\s+([A-Z0-9\/&]+)(?:\s+(CALL|PUT)\s+(\d+))?[\s\S]*?([+-]?\d+(?:[.,]\d+)?)\s*€\s*(GEWINN|VERLUST)/i;
  const closePatternSimple = /ICH\s+SCHLIE[ßS]E\s+([A-Z0-9\/&]+)(?:\s+(CALL|PUT)\s+(\d+))?/i;
  
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
  // Example: "GOLD SL AUF 4200"
  // Example: "Ich setze den SL bei TESLA PUT 390 auf 28.99"
  const slPattern = /(?:(?:Ich\s+setze\s+den\s+)?SL\s+(?:bei\s+)?([A-Z0-9\/&]+)|([A-Z0-9\/&]+)\s+SL)(?:\s+(CALL|PUT)\s+(\d+))?\s+[Aa][Uu][Ff]\s+(\d+(?:[.,]\d+)?)/i;
  const slMatch = messageText.match(slPattern);
  
  if (slMatch) {
    trend.type = 'SL_UPDATE';
    const instrument = (slMatch[1] || slMatch[2]).toUpperCase();
    const optionType = slMatch[3] ? slMatch[3].toUpperCase() : null;
    const strikePrice = slMatch[4] ? parseFloat(slMatch[4]) : null;
    let slPrice = parseFloat(slMatch[5].replace(',', '.'));
    
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
  const slPatternShort = /^([A-Z0-9\/&]+)(?:\s+(CALL|PUT)\s+(\d+))?\s+SL:?\s+(\d+(?:[.,]\d+)?)/i;
  const slMatchShort = messageText.match(slPatternShort);

  if (slMatchShort) {
    trend.type = 'SL_UPDATE';
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

  // 3c. Check for TAKE PROFIT UPDATE
  // Example: "Ich setze den TP bei DOW auf 26160.0"
  // Example: "GOLD TP AUF 4250"
  const tpPattern = /(?:(?:Ich\s+setze\s+den\s+)?TP\s+(?:bei\s+)?([A-Z0-9\/&]+)|([A-Z0-9\/&]+)\s+TP)(?:\s+(CALL|PUT)\s+(\d+))?\s+[Aa][Uu][Ff]\s+(\d+(?:[.,]\d+)?)/i;
  const tpMatch = messageText.match(tpPattern);

  if (tpMatch) {
    trend.type = 'TP_UPDATE';
    const instrument = (tpMatch[1] || tpMatch[2]).toUpperCase();
    const optionType = tpMatch[3] ? tpMatch[3].toUpperCase() : null;
    const strikePrice = tpMatch[4] ? parseFloat(tpMatch[4]) : null;
    let tpPrice = parseFloat(tpMatch[5].replace(',', '.'));

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
 * Check if it's weekend (Saturday or Sunday)
 * @returns {boolean} - True if weekend
 */
function isWeekend() {
  const now = new Date();
  const day = now.getUTCDay(); // 0 = Sunday, 6 = Saturday
  return day === 0 || day === 6;
}

/**
 * Map instrument names to IG Markets EPIC codes (CFD Version for EU)
 * Automatically uses weekend contracts on Saturdays and Sundays
 * 
 * HOW TO ADD NEW INSTRUMENTS:
 * 1. Find the EPIC code using the search script: node search_epics.js "Name"
 *    Or use the IG API / Platform to find the 'epic' (e.g., CS.D.BTCUSD.CFD.IP)
 * 2. Add a new entry to the mapping object below. Key is the uppercase instrument name from the signal.
 * 3. Optional: Add a 'fallback' object if you want to try another instrument if the first one fails
 *    Example: fallback: { epic: '...', symbol: '...' }
 * 
 * @param {string} instrument - Instrument name (e.g., "DAX", "GOLD", "BITCOIN", "EUR/USD")
 * @returns {Object} - IG EPIC code, symbol name, and expiry
 */
function mapInstrumentToIG(instrument) {
  // Normalize forex pairs: "EUR/USD" → "EURUSD"
  const normalizedInstrument = instrument.replace(/\//g, '').toUpperCase();
  
  const mapping = {
    // Commodities (CFD) - Real margins from IG API
    'GOLD': { 
      epic: 'CS.D.CFEGOLD.CEA.IP', 
      symbol: 'Gold', 
      expiry: '-',
      marginPercent: 0.05, // 5% (verified via API)
      fallback: {
        epic: 'IX.D.SUNGOLD.CEA.IP',
        symbol: 'Weekend Gold',
        expiry: '-'
      }
    },
    'SILBER': { epic: 'CS.D.USSIGC.CFD.IP', symbol: 'Silver', expiry: '-', marginPercent: 0.05 },
    'SILVER': { epic: 'CS.D.USSIGC.CFD.IP', symbol: 'Silver', expiry: '-', marginPercent: 0.05 },
    'OIL': { 
      epic: 'CC.D.LCO.UME.IP', // Öl - Brent-Rohöl (1€)
      symbol: 'Oil - Brent Crude (1€)', 
      expiry: '-', 
      marginPercent: 0.10,
      contractSize: 1, // 1€ per point? Need to verify. Usually 1€ contract means 1€ per point per contract.
      priceScaling: 100, // Signal 63.0 -> IG 6300.0
      minDealSize: 0.25,
      dealSizeIncrement: 0.01
    },
    'WTI': { 
      epic: 'CC.D.CL.UNC.IP', 
      symbol: 'Oil - US Crude', 
      expiry: '-', 
      marginPercent: 0.10,
      contractSize: 10,
      priceScaling: 100 // Signal 63.0 -> IG 6300.0
    },
    'BRENT': { 
      epic: 'CC.D.LCO.UME.IP', // Öl - Brent-Rohöl (1€)
      symbol: 'Oil - Brent Crude (1€)', 
      expiry: '-', 
      marginPercent: 0.10,
      contractSize: 1, // 1€ contract
      priceScaling: 100, // Signal 63.0 -> IG 6300.0
      minDealSize: 0.25,
      dealSizeIncrement: 0.01
    },

    // Indices (CFD)
    'DAX': { 
      epic: 'IX.D.DAX.IFMM.IP', // 1€ contract (Mini) - Better for risk management
      symbol: 'Germany 40', 
      expiry: '-',
      marginPercent: 0.05, // 5% margin requirement
      dealSizeIncrement: 0.01, // Force 2 decimals to avoid 0.125 rejection (rounds to 0.13)
      fallback: {
        epic: 'IX.D.SUNDAX.IGN.IP', // Correct Weekend EPIC
        symbol: 'Weekend Germany 40',
        expiry: '-'
      }
    },
    'DAX40': { 
      epic: 'IX.D.DAX.IFMM.IP', // 1€ contract (Mini)
      symbol: 'Germany 40', 
      expiry: '-',
      marginPercent: 0.05, // 5% margin requirement
      dealSizeIncrement: 0.01, // Force 2 decimals
      fallback: {
        epic: 'IX.D.SUNDAX.IGN.IP', // Correct Weekend EPIC
        symbol: 'Weekend Germany 40',
        expiry: '-'
      }
    },
    'SP500': { 
      epic: 'IX.D.SPTRD.IFE.IP', 
      symbol: 'US 500', 
      expiry: '-',
      marginPercent: 0.05 // 5% margin requirement
      // Fallback temporarily disabled - EPIC not found
      // fallback: {
      //   epic: 'IX.D.SPTRD.WKND.IP',
      //   symbol: 'Weekend US 500',
      //   expiry: '-'
      // }
    },
    'S&P500': { 
      epic: 'IX.D.SPTRD.IFE.IP', 
      symbol: 'US 500', 
      expiry: '-',
      marginPercent: 0.05,
      minDealSize: 1,
      fallback: {
        epic: 'IX.D.SPTRD.WKND.IP',
        symbol: 'Weekend US 500',
        expiry: '-'
      }
    },
    'NASDAQ': { 
      epic: 'IX.D.NASDAQ.IAE.IP', // 1€ Contract (Kassa) - Correct for small accounts
      symbol: 'US Tech 100', 
      expiry: '-',
      minDealSize: 0.2, 
      fallback: {
        epic: 'IX.D.NASDAQ.IEA.IP', // 1$ Contract as fallback
        symbol: 'US Tech 100 (1$)',
        expiry: '-'
      }
    },
    'DOW': { 
      epic: 'IX.D.DOW.IAE.IP', // 1€ Contract (Kassa)
      symbol: 'Wall Street', 
      expiry: '-',
      fallback: {
        epic: 'IX.D.SUNDOW.IFE.IP', // Correct Weekend EPIC
        symbol: 'Weekend Wall Street',
        expiry: '-'
      }
    },
    'FTSE': { 
      epic: 'IX.D.FTSE.IFE.IP', // 1€ Contract (Kassa)
      symbol: 'FTSE 100', 
      expiry: '-',
      fallback: {
        epic: 'IX.D.SUNFUN.IFE.IP', // Correct Weekend EPIC
        symbol: 'Weekend UK 100',
        expiry: '-'
      }
    },
    'CAC': { 
      epic: 'IX.D.CAC.IFE.IP', // 1€ Contract (Kassa)
      symbol: 'France 40', 
      expiry: '-',
      fallback: {
        epic: 'IX.D.SUNCAC.IMF.IP', // Correct Weekend EPIC
        symbol: 'Weekend France 40',
        expiry: '-'
      }
    },
    'NIKKEI': { epic: 'IX.D.NIKKEI.IFMM.IP', symbol: 'Japan 225', expiry: '-' },

    // Forex (Spot FX - Mini contracts with 10k units, lower margin requirements)
    // Mini = 10,000 units contract size, better for smaller accounts
    'EURUSD': { epic: 'CS.D.EURUSD.CEAM.IP', symbol: 'EUR/USD Mini', expiry: '-', marginPercent: 0.033, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'GBPUSD': { epic: 'CS.D.GBPUSD.MINI.IP', symbol: 'GBP/USD Mini', expiry: '-', marginPercent: 0.05, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'USDJPY': { epic: 'CS.D.USDJPY.MINI.IP', symbol: 'USD/JPY Mini', expiry: '-', marginPercent: 0.033, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'USDCHF': { epic: 'CS.D.USDCHF.MINI.IP', symbol: 'USD/CHF Mini', expiry: '-', marginPercent: 0.033, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'AUDUSD': { epic: 'CS.D.AUDUSD.MINI.IP', symbol: 'AUD/USD Mini', expiry: '-', marginPercent: 0.033, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'USDCAD': { epic: 'CS.D.USDCAD.MINI.IP', symbol: 'USD/CAD Mini', expiry: '-', marginPercent: 0.033, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'NZDUSD': { epic: 'CS.D.NZDUSD.MINI.IP', symbol: 'NZD/USD Mini', expiry: '-', marginPercent: 0.033, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'EURGBP': { epic: 'CS.D.EURGBP.MINI.IP', symbol: 'EUR/GBP Mini', expiry: '-', marginPercent: 0.033, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'EURJPY': { epic: 'CS.D.EURJPY.MINI.IP', symbol: 'EUR/JPY Mini', expiry: '-', marginPercent: 0.033, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'GBPJPY': { epic: 'CS.D.GBPJPY.MINI.IP', symbol: 'GBP/JPY Mini', expiry: '-', marginPercent: 0.0333, minDealSize: 0.025, dealSizeIncrement: 0.025 },
    'CADJPY': { epic: 'CS.D.CADJPY.MINI.IP', symbol: 'CAD/JPY Mini', expiry: '-', marginPercent: 0.0333, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'GBPZAR': { epic: 'CS.D.GBPZAR.MINI.IP', symbol: 'GBP/ZAR Mini', expiry: '-', marginPercent: 0.05, minDealSize: 0.1, dealSizeIncrement: 0.01 },
    'NZDCAD': { epic: 'CS.D.NZDCAD.MINI.IP', symbol: 'NZD/CAD Mini', expiry: '-', marginPercent: 0.05, minDealSize: 0.1, dealSizeIncrement: 0.01 },

    // Commodities
    'SILBER': { epic: 'CS.D.CFDSILVER.CFM.IP', symbol: 'Silver', expiry: '-', marginPercent: 0.10, minDealSize: 0.5 },
    'SILVER': { epic: 'CS.D.CFDSILVER.CFM.IP', symbol: 'Silver', expiry: '-', marginPercent: 0.10, minDealSize: 0.5 },
    'XAGUSD': { epic: 'CS.D.CFDSILVER.CFM.IP', symbol: 'Silver', expiry: '-', marginPercent: 0.10, minDealSize: 0.5 },

    // Crypto (24/7 CFDs)
    // Bitcoin
    'BITCOIN': { 
      epic: 'CS.D.BTCUSD.CFD.IP',
      symbol: 'Bitcoin',
      expiry: '-',
      marginPercent: 0.50, // 50% für Crypto
      minDealSize: 0.01, // Minimum 0.01 Kontrakte (IG Standard)
      // Fallback to Bitcoin Cash if Bitcoin is not tradeable
      fallback: {
        epic: 'CS.D.BCHUSD.CFD.IP',
        symbol: 'Bitcoin Cash',
        expiry: '-'
      }
    },
    'BTC': { 
      epic: 'CS.D.BTCUSD.CFD.IP',
      symbol: 'Bitcoin',
      expiry: '-',
      marginPercent: 0.50,
      minDealSize: 0.01,
      fallback: {
        epic: 'CS.D.BCHUSD.CFD.IP',
        symbol: 'Bitcoin Cash',
        expiry: '-'
      }
    },
    'BITCOIN CASH': { 
      epic: 'CS.D.BCHUSD.CFD.IP', 
      symbol: 'Bitcoin Cash', 
      expiry: '-', 
      marginPercent: 0.50,
      minDealSize: 0.2
    },
    'BCH': { 
      epic: 'CS.D.BCHUSD.CFD.IP', 
      symbol: 'Bitcoin Cash', 
      expiry: '-', 
      marginPercent: 0.50,
      minDealSize: 0.2
    },
    'ETHEREUM': { 
      epic: 'CS.D.ETHUSD.CFD.IP', 
      symbol: 'Ethereum', 
      expiry: '-', 
      marginPercent: 0.50,
      minDealSize: 0.2
    },
    'ETH': { 
      epic: 'CS.D.ETHUSD.CFD.IP', 
      symbol: 'Ethereum', 
      expiry: '-', 
      marginPercent: 0.50,
      minDealSize: 0.2
    },
    'ETH': { epic: 'CS.D.ETHUSD.CFD.IP', symbol: 'Ether', expiry: '-', marginPercent: 0.50 }, // 50%
    'SOLANA': { epic: 'CS.D.SOLUSD.CFD.IP', symbol: 'Solana', expiry: '-', marginPercent: 0.50 }, // 50%
    'SOL': { epic: 'CS.D.SOLUSD.CFD.IP', symbol: 'Solana', expiry: '-', marginPercent: 0.50 }, // 50%
    'RIPPLE': { epic: 'CS.D.XRPUSD.CFD.IP', symbol: 'Ripple', expiry: '-', marginPercent: 0.50 }, // 50%
    'XRP': { epic: 'CS.D.XRPUSD.CFD.IP', symbol: 'Ripple', expiry: '-', marginPercent: 0.50 }, // 50%
    'LITECOIN': { epic: 'CS.D.LTCUSD.CFD.IP', symbol: 'Litecoin', expiry: '-', marginPercent: 0.50 },
    'LTC': { epic: 'CS.D.LTCUSD.CFD.IP', symbol: 'Litecoin', expiry: '-', marginPercent: 0.50 },

    // US Stocks (24 Hours) - Real margins from IG API (all 20%!)
    // DISABLED due to high commissions (10$ per trade)
    'TESLA': { epic: 'UD.D.TSLA.CASH.IP', symbol: 'Tesla', expiry: '-', marginPercent: 0.20, disabled: true },
    'TSLA': { epic: 'UD.D.TSLA.CASH.IP', symbol: 'Tesla', expiry: '-', marginPercent: 0.20, disabled: true },
    'NETFLIX': { epic: 'UC.D.NFLX.CASH.IP', symbol: 'Netflix', expiry: '-', marginPercent: 0.20, disabled: true },
    'NFLX': { epic: 'UC.D.NFLX.CASH.IP', symbol: 'Netflix', expiry: '-', marginPercent: 0.20, disabled: true },
    'BROADCOM': { epic: 'UA.D.AVGO.CASH.IP', symbol: 'Broadcom', expiry: '-', marginPercent: 0.20, disabled: true },
    'AVGO': { epic: 'UA.D.AVGO.CASH.IP', symbol: 'Broadcom', expiry: '-', marginPercent: 0.20, disabled: true },
    'APPLE': { epic: 'UA.D.AAPL.CASH.IP', symbol: 'Apple', expiry: '-', marginPercent: 0.20, disabled: true },
    'AAPL': { epic: 'UA.D.AAPL.CASH.IP', symbol: 'Apple', expiry: '-', marginPercent: 0.20, disabled: true },
    'AMAZON': { epic: 'UB.D.AMZN.CASH.IP', symbol: 'Amazon', expiry: '-', marginPercent: 0.20, disabled: true },
    'AMZN': { epic: 'UB.D.AMZN.CASH.IP', symbol: 'Amazon', expiry: '-', marginPercent: 0.20, disabled: true },
    'GOOGLE': { epic: 'UC.D.GOOG.CASH.IP', symbol: 'Google', expiry: '-', marginPercent: 0.20, disabled: true },
    'GOOG': { epic: 'UC.D.GOOG.CASH.IP', symbol: 'Google', expiry: '-', marginPercent: 0.20, disabled: true },
    'META': { epic: 'UD.D.META.CASH.IP', symbol: 'Meta', expiry: '-', marginPercent: 0.20, disabled: true },
    'MSFT': { epic: 'UD.D.MSFT.CASH.IP', symbol: 'Microsoft', expiry: '-', marginPercent: 0.20, disabled: true },
    'MICROSOFT': { epic: 'UD.D.MSFT.CASH.IP', symbol: 'Microsoft', expiry: '-', marginPercent: 0.20, disabled: true },
    'NVDA': { epic: 'UC.D.NVDA.CASH.IP', symbol: 'Nvidia', expiry: '-', marginPercent: 0.20, disabled: true },
    'NVIDIA': { epic: 'UC.D.NVDA.CASH.IP', symbol: 'Nvidia', expiry: '-', marginPercent: 0.20, disabled: true },
    'AMD': { epic: 'UA.D.AMD.CASH.IP', symbol: 'AMD', expiry: '-', marginPercent: 0.20, disabled: true },
    'INTEL': { epic: 'UC.D.INTC.CASH.IP', symbol: 'Intel', expiry: '-', marginPercent: 0.20, disabled: true },
    'INTC': { epic: 'UC.D.INTC.CASH.IP', symbol: 'Intel', expiry: '-', marginPercent: 0.20, disabled: true },
    'PAYPAL': { epic: 'UD.D.PYPL.CASH.IP', symbol: 'PayPal', expiry: '-', marginPercent: 0.20, disabled: true },
    'PYPL': { epic: 'UD.D.PYPL.CASH.IP', symbol: 'PayPal', expiry: '-', marginPercent: 0.20, disabled: true },
    'ADOBE': { epic: 'UA.D.ADBE.CASH.IP', symbol: 'Adobe', expiry: '-', marginPercent: 0.20, disabled: true },
    'ADBE': { epic: 'UA.D.ADBE.CASH.IP', symbol: 'Adobe', expiry: '-', marginPercent: 0.20, disabled: true },
    'SHOPIFY': { epic: 'UC.D.SHOP.CASH.IP', symbol: 'Shopify', expiry: '-', marginPercent: 0.20, disabled: true },
    'SHOP': { epic: 'UC.D.SHOP.CASH.IP', symbol: 'Shopify', expiry: '-', marginPercent: 0.20, disabled: true },
    'UBER': { epic: 'UD.D.UBER.CASH.IP', symbol: 'Uber', expiry: '-', marginPercent: 0.20, disabled: true },
    'COINBASE': { epic: 'UB.D.COIN.CASH.IP', symbol: 'Coinbase', expiry: '-', marginPercent: 0.20, disabled: true },
    'COIN': { epic: 'UB.D.COIN.CASH.IP', symbol: 'Coinbase', expiry: '-', marginPercent: 0.20, disabled: true },
    'GITLAB': { epic: 'UA.D.GTLB.CASH.IP', symbol: 'GitLab', expiry: '-', marginPercent: 0.20, disabled: true },
    'GTLB': { epic: 'UA.D.GTLB.CASH.IP', symbol: 'GitLab', expiry: '-', marginPercent: 0.20, disabled: true },
    // ...weitere gängige Aktien nach Bedarf ergänzen
  };

  // Fallback: Wenn Instrument wie ein US-Ticker aussieht, generiere Epic automatisch
  // Format: U[A-D].D.[TICKER].CASH.IP für US-Aktien (24 Hours)
  if (!mapping[normalizedInstrument] && /^[A-Z]{2,6}$/.test(normalizedInstrument)) {
    // Erste Buchstabe basierend auf Ticker: A-G=UA, H-N=UB, O-T=UC, U-Z=UD
    const firstLetter = normalizedInstrument.charAt(0);
    let prefix = 'UD'; // Default
    if (firstLetter >= 'A' && firstLetter <= 'G') prefix = 'UA';
    else if (firstLetter >= 'H' && firstLetter <= 'N') prefix = 'UB';
    else if (firstLetter >= 'O' && firstLetter <= 'T') prefix = 'UC';
    
    return {
      epic: `${prefix}.D.${normalizedInstrument}.CASH.IP`,
      symbol: normalizedInstrument,
      expiry: '-',
      disabled: true // DISABLED due to high commissions
    };
  }

  return mapping[normalizedInstrument] || {
    epic: null,
    symbol: instrument,
    expiry: '-'
  };
}

/**
 * Get the appropriate instrument mapping with automatic weekend detection
 * @param {string} instrument - Instrument name
 * @returns {Object} - IG Market data with epic, symbol, expiry
 */
function getInstrumentMapping(instrument) {
  const baseMapping = mapInstrumentToIG(instrument);
  
  // If it's weekend and instrument has a weekend fallback, use it
  // BUT only if the fallback is explicitly a "Weekend" market (like Indices)
  // We don't want to force fallback for Crypto (Bitcoin -> Bitcoin Cash) just because it's weekend
  const isWeekendFallback = baseMapping.fallback && baseMapping.fallback.symbol.includes('Weekend');
  
  if (isWeekend() && isWeekendFallback) {
    console.log(`🗓️  Weekend detected - using ${baseMapping.fallback.symbol} instead of ${baseMapping.symbol}`);
    return {
      ...baseMapping.fallback,
      marginPercent: baseMapping.marginPercent, // Keep original margin
      minDealSize: baseMapping.minDealSize,
      isWeekendContract: true
    };
  }
  
  return baseMapping;
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

// Export the mapping functions
export { mapInstrumentToIG, getInstrumentMapping };

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
