/**
 * Currency Exchange Rate Service
 * Fetches real-time exchange rates for accurate margin calculations
 */

import fetch from 'node-fetch';

/**
 * Get live exchange rate from currency to EUR
 * @param {string} fromCurrency - Source currency (USD, JPY, GBP, etc.)
 * @returns {Promise<number>} - Exchange rate to EUR
 */
export async function getExchangeRateToEUR(fromCurrency) {
  // EUR to EUR is always 1.0
  if (fromCurrency === 'EUR') {
    return 1.0;
  }
  
  try {
    // Use exchangerate-api.com (free tier: 1500 requests/month)
    // Alternative: frankfurter.app (free, no key needed, ECB data)
    const response = await fetch(`https://api.frankfurter.app/latest?from=${fromCurrency}&to=EUR`);
    
    if (!response.ok) {
      throw new Error(`Exchange rate API returned ${response.status}`);
    }
    
    const data = await response.json();
    const rate = data.rates?.EUR;
    
    if (!rate) {
      throw new Error(`No rate found for ${fromCurrency} → EUR`);
    }
    
    console.log(`   💱 Live Exchange Rate: 1 ${fromCurrency} = ${rate.toFixed(6)} EUR`);
    return rate;
    
  } catch (error) {
    console.error(`   ⚠️ Exchange rate API failed: ${error.message}`);
    console.log(`   → Using fallback static rates`);
    
    // Fallback to static rates if API fails
    const fallbackRates = {
      'USD': 0.92,    // Updated Dec 2024
      'GBP': 1.17,    // Updated Dec 2024
      'JPY': 0.0062,  // Updated Dec 2024 (~161 JPY per EUR)
      'CHF': 1.05,    // Updated Dec 2024
      'AUD': 0.61,    // Updated Dec 2024
      'CAD': 0.68,    // Updated Dec 2024
      'CNY': 0.13,    // Updated Dec 2024
      'HKD': 0.12,    // Updated Dec 2024
      'NZD': 0.56,    // Updated Dec 2024
      'SEK': 0.089,   // Updated Dec 2024
      'NOK': 0.087,   // Updated Dec 2024
      'DKK': 0.13,    // Updated Dec 2024
    };
    
    const fallbackRate = fallbackRates[fromCurrency] || 1.0;
    console.log(`   💱 Fallback Rate: 1 ${fromCurrency} = ${fallbackRate} EUR`);
    return fallbackRate;
  }
}

/**
 * Get exchange rate with caching (optional, for performance)
 * Caches rates for 5 minutes to avoid excessive API calls
 */
const rateCache = new Map();
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

export async function getExchangeRateToEURCached(fromCurrency) {
  const now = Date.now();
  const cached = rateCache.get(fromCurrency);
  
  // Return cached rate if still valid
  if (cached && (now - cached.timestamp) < CACHE_DURATION) {
    // console.log(`   💱 Cached Exchange Rate: 1 ${fromCurrency} = ${cached.rate.toFixed(6)} EUR (age: ${Math.floor((now - cached.timestamp) / 1000)}s)`);
    return cached.rate;
  }
  
  // Fetch new rate
  const rate = await getExchangeRateToEUR(fromCurrency);
  
  // Cache it
  rateCache.set(fromCurrency, {
    rate,
    timestamp: now
  });
  
  return rate;
}
