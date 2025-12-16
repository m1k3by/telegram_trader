/**
 * Resilient Trade Execution with Intelligent Retry
 * Handles market closures, fallbacks, and alternative instruments
 */

import { igApi } from './igApi.js';
import { saveTrade } from './tradeStorage.js';

/**
 * Try to find alternative tradeable instruments via API search
 * @param {string} instrumentName - Original instrument name (e.g., "Netflix", "NASDAQ")
 * @returns {Array} - Array of alternative EPICs with market details
 */
export async function findAlternatives(instrumentName) {
  console.log(`🔍 Searching for alternatives to ${instrumentName}...`);
  
  try {
    const searchResults = await igApi.searchMarkets(instrumentName);
    
    if (!searchResults || searchResults.length === 0) {
      return [];
    }
    
    const alternatives = [];
    
    for (const market of searchResults) {
      // Filter out dangerous or irrelevant instruments
      const name = market.instrumentName.toLowerCase();
      const type = market.instrumentType || '';
      
      // 1. Avoid "Short" instruments if we are just searching (unless explicitly asked)
      //    We don't know the direction here, but usually "Short ETP" is not what we want for a generic search
      if (name.includes('short') && !instrumentName.toLowerCase().includes('short')) {
        console.log(`   ⚠️ Skipping Short ETP: ${market.instrumentName}`);
        continue;
      }
      
      // 2. Avoid "Leverage Shares" or "ETP" if possible, unless it's the only option
      //    We'll prioritize them lower later
      
      try {
        const details = await igApi.getMarketDetails(market.epic);
        
        if (details && details.marketStatus === 'TRADEABLE' && details.bid && details.offer) {
          alternatives.push({
            epic: market.epic,
            name: market.instrumentName,
            type: market.instrumentType,
            expiry: market.expiry || '-',
            minSize: details.minDealSize,
            increment: details.dealSizeIncrement,
            status: details.marketStatus,
            bid: details.bid,
            offer: details.offer,
            marginFactor: details.marginFactor,
            currencyCode: details.currencyCode,
            // Add score for sorting
            score: calculateRelevanceScore(market, instrumentName)
          });
          
          console.log(`   ✅ Found alternative: ${market.instrumentName} (${market.epic})`);
        }
      } catch (e) {
        // Skip markets that can't be fetched
      }
    }
    
    // Sort alternatives by score (descending)
    alternatives.sort((a, b) => b.score - a.score);
    
    return alternatives;
  } catch (error) {
    console.error(`   ❌ Search failed:`, error.message);
    return [];
  }
}

/**
 * Calculate relevance score for an instrument
 */
function calculateRelevanceScore(market, searchTerm) {
  let score = 0;
  const name = market.instrumentName.toLowerCase();
  const search = searchTerm.toLowerCase();
  
  // 1. Exact match gets highest score
  if (name === search) score += 100;
  
  // 2. "All Sessions" is usually good
  if (name.includes('all sessions')) score += 50;
  
  // 3. Prefer "Cash" (Spot) over Futures
  if (market.epic.includes('CASH')) score += 20;
  
  // 4. Prefer standard types
  if (market.instrumentType === 'SHARES' || market.instrumentType === 'INDICES' || market.instrumentType === 'CURRENCIES') {
    score += 30;
  }
  
  // 5. Penalize "Leverage Shares" / ETPs if we are looking for the stock
  if (name.includes('leverage shares') || name.includes('etp') || name.includes('factor')) {
    score -= 50;
  }
  
  // 6. Prefer "Mini" for Forex/Indices to allow better risk management
  if (name.includes('mini') || market.epic.includes('MINI') || market.epic.includes('CEAM')) {
    score += 40;
  }
  
  return score;
}

/**
 * Execute trade with intelligent retry and fallback logic
 * @param {Object} igMapping - Primary instrument mapping
 * @param {Object} tradeParams - Trade parameters (direction, size, etc.)
 * @param {string} originalInstrument - Original instrument name for search
 * @returns {Object} - Trade result with status and details
 */
export async function executeTradeWithRetry(igMapping, tradeParams, originalInstrument) {
  const attempts = [];
  
  // ATTEMPT 1: Try primary EPIC
  console.log(`\n📡 ATTEMPT 1: Primary instrument ${igMapping.symbol} (${igMapping.epic})`);
  
  try {
    const primaryDetails = await igApi.getMarketDetails(igMapping.epic);
    
    if (primaryDetails && primaryDetails.marketStatus === 'TRADEABLE' && primaryDetails.bid && primaryDetails.offer) {
      console.log(`   ✅ Market is TRADEABLE - executing...`);
      const result = await igApi.createPosition(igMapping.epic, tradeParams);
      
      if (result.status === 'success') {
        // Save trade details to local storage
        // Use Deal ID as key if available, otherwise Deal Reference
        const storageKey = result.dealId || result.dealReference;
        
        saveTrade(storageKey, {
          dealId: result.dealId,
          dealReference: result.dealReference,
          epic: igMapping.epic,
          symbol: igMapping.symbol,
          direction: tradeParams.direction,
          size: tradeParams.size,
          stopLevel: tradeParams.stopLevel,
          limitLevel: tradeParams.limitLevel,
          currencyCode: tradeParams.currencyCode,
          originalInstrument: originalInstrument
        });

        return {
          success: true,
          epic: igMapping.epic,
          symbol: igMapping.symbol,
          result: result,
          attempt: 1,
          method: 'primary'
        };
      } else {
        attempts.push({ epic: igMapping.epic, symbol: igMapping.symbol, reason: result.message });
      }
    } else {
      const status = primaryDetails?.marketStatus || 'UNKNOWN';
      console.log(`   ⚠️ Market is ${status} - cannot trade primary`);
      attempts.push({ epic: igMapping.epic, symbol: igMapping.symbol, reason: `Market ${status}` });
    }
  } catch (error) {
    console.log(`   ❌ Primary failed:`, error.message);
    attempts.push({ epic: igMapping.epic, symbol: igMapping.symbol, reason: error.message });
  }
  
  // ATTEMPT 2: Try fallback if exists
  if (igMapping.fallback) {
    console.log(`\n📡 ATTEMPT 2: Fallback instrument ${igMapping.fallback.symbol} (${igMapping.fallback.epic})`);
    
    try {
      const fallbackDetails = await igApi.getMarketDetails(igMapping.fallback.epic);
      
      if (fallbackDetails && fallbackDetails.marketStatus === 'TRADEABLE' && fallbackDetails.bid && fallbackDetails.offer) {
        console.log(`   ✅ Fallback market is TRADEABLE - executing...`);
        const result = await igApi.createPosition(igMapping.fallback.epic, tradeParams);
        
        if (result.status === 'success') {
          // Save trade details to local storage
          const storageKey = result.dealId || result.dealReference;
          
          saveTrade(storageKey, {
            dealId: result.dealId,
            dealReference: result.dealReference,
            epic: igMapping.fallback.epic,
            symbol: igMapping.fallback.symbol,
            direction: tradeParams.direction,
            size: tradeParams.size,
            stopLevel: tradeParams.stopLevel,
            limitLevel: tradeParams.limitLevel,
            currencyCode: tradeParams.currencyCode,
            originalInstrument: originalInstrument
          });

          return {
            success: true,
            epic: igMapping.fallback.epic,
            symbol: igMapping.fallback.symbol,
            result: result,
            attempt: 2,
            method: 'fallback'
          };
        } else {
          attempts.push({ epic: igMapping.fallback.epic, symbol: igMapping.fallback.symbol, reason: result.message });
        }
      } else {
        const status = fallbackDetails?.marketStatus || 'UNKNOWN';
        console.log(`   ⚠️ Fallback market is ${status} - cannot trade`);
        attempts.push({ epic: igMapping.fallback.epic, symbol: igMapping.fallback.symbol, reason: `Market ${status}` });
      }
    } catch (error) {
      console.log(`   ❌ Fallback failed:`, error.message);
      attempts.push({ epic: igMapping.fallback.epic, symbol: igMapping.fallback.symbol, reason: error.message });
    }
  }
  
  // ATTEMPT 3: Search for alternatives via API
  console.log(`\n📡 ATTEMPT 3: Searching for tradeable alternatives...`);
  const alternatives = await findAlternatives(originalInstrument);
  
  if (alternatives.length > 0) {
    console.log(`   Found ${alternatives.length} alternatives, trying each...`);
    
    for (let i = 0; i < alternatives.length && i < 5; i++) { // Try max 5 alternatives
      const alt = alternatives[i];
      console.log(`\n   🔄 Trying alternative ${i + 1}: ${alt.name} (${alt.epic})`);
      
      try {
        const result = await igApi.createPosition(alt.epic, tradeParams);
        
        if (result.status === 'success') {
          // Save trade details to local storage
          const storageKey = result.dealId || result.dealReference;
          
          saveTrade(storageKey, {
            dealId: result.dealId,
            dealReference: result.dealReference,
            epic: alt.epic,
            symbol: alt.name,
            direction: tradeParams.direction,
            size: tradeParams.size,
            stopLevel: tradeParams.stopLevel,
            limitLevel: tradeParams.limitLevel,
            currencyCode: tradeParams.currencyCode,
            originalInstrument: originalInstrument
          });

          return {
            success: true,
            epic: alt.epic,
            symbol: alt.name,
            result: result,
            attempt: 3 + i,
            method: 'alternative',
            alternativeDetails: alt
          };
        } else {
          console.log(`      ❌ Failed: ${result.message}`);
          attempts.push({ epic: alt.epic, symbol: alt.name, reason: result.message });
        }
      } catch (error) {
        console.log(`      ❌ Error: ${error.message}`);
        attempts.push({ epic: alt.epic, symbol: alt.name, reason: error.message });
      }
    }
  } else {
    console.log(`   ⚠️ No alternatives found`);
  }
  
  // ALL ATTEMPTS FAILED
  console.log(`\n❌ ALL RETRY ATTEMPTS EXHAUSTED`);
  console.log(`   Tried ${attempts.length} different instruments:`);
  attempts.forEach((att, i) => {
    console.log(`   ${i + 1}. ${att.symbol} (${att.epic}): ${att.reason}`);
  });
  
  return {
    success: false,
    attempts: attempts,
    finalMessage: `Trade failed after ${attempts.length} attempts. All markets closed or unavailable.`
  };
}

/**
 * Find position with intelligent search (handles aliases and fallbacks)
 * @param {string} instrumentName - Instrument name from signal
 * @param {Object} igMapping - Primary IG mapping
 * @returns {Object|null} - Position or null
 */
export async function findPositionWithRetry(instrumentName, igMapping) {
  console.log(`🔍 Searching for open position: ${instrumentName}`);
  
  try {
    const positions = await igApi.getOpenPositions();
    
    // Try primary EPIC
    let matches = positions.filter(p => p.market.epic === igMapping.epic);
    if (matches.length > 0) {
      console.log(`   ✅ Found position via primary EPIC: ${igMapping.epic}`);
      return matches[0];
    }
    
    // Try fallback EPIC
    if (igMapping.fallback) {
      matches = positions.filter(p => p.market.epic === igMapping.fallback.epic);
      if (matches.length > 0) {
        console.log(`   ✅ Found position via fallback EPIC: ${igMapping.fallback.epic}`);
        return matches[0];
      }
    }
    
    // Try searching by instrument name (fuzzy match)
    matches = positions.filter(p => 
      p.market.instrumentName.toLowerCase().includes(instrumentName.toLowerCase()) ||
      instrumentName.toLowerCase().includes(p.market.instrumentName.toLowerCase())
    );
    
    if (matches.length > 0) {
      console.log(`   ✅ Found position via fuzzy name match: ${matches[0].market.instrumentName}`);
      return matches[0];
    }
    
    console.log(`   ⚠️ No position found for ${instrumentName}`);
    console.log(`   Open positions:`, positions.map(p => p.market.instrumentName).join(', '));
    
    return null;
  } catch (error) {
    console.error(`   ❌ Error searching positions:`, error.message);
    return null;
  }
}
