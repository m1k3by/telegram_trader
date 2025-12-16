
/**
 * Calculate the true contract size (multiplier) from market details.
 * Uses valueOfOnePip and onePipMeans if available, as they are more reliable than contractSize field.
 * @param {Object} marketDetails - The market details object from IG API
 * @returns {number|null} - The calculated contract size (multiplier) or null if not found
 */
export function calculateContractSize(marketDetails) {
  const instrument = marketDetails?.rawData?.instrument;
  const epic = instrument?.epic || '';
  
  // LOGGING for debugging
  if (epic.includes('GOLD') || epic.includes('SILVER')) {
    //console.log(`   🔍 Analyzing Contract Size for ${epic}:`);
    //console.log(`      valueOfOnePip: ${instrument?.valueOfOnePip}`);
    //console.log(`      onePipMeans: ${instrument?.onePipMeans}`);
    //console.log(`      contractSize: ${instrument?.contractSize}`);
    //console.log(`      lotSize: ${instrument?.lotSize}`);
  }

  // 1. Try to calculate from pip values (Most accurate)
  if (instrument?.valueOfOnePip && instrument?.onePipMeans) {
    const valueOfOnePip = parseFloat(instrument.valueOfOnePip);
    const onePipMeans = instrument.onePipMeans;
    
    // Extract the numeric part of the pip definition
    const match = onePipMeans.match(/([\d\.]+)/);
    if (match) {
      let pipValue = parseFloat(match[1]);
      
      // Adjust for "Cents"
      if (onePipMeans.includes('Cents')) {
        pipValue = pipValue * 0.01;
      }
      
      if (pipValue > 0 && !isNaN(valueOfOnePip)) {
        const calculatedSize = valueOfOnePip / pipValue;
        // console.log(`   📏 Calculated Contract Size: ${calculatedSize} (from ${valueOfOnePip} / ${pipValue})`);
        return calculatedSize;
      }
    }
  }
  
  // 2. Fallback to contractSize field
  if (instrument?.contractSize) {
    return parseFloat(instrument.contractSize);
  }
  
  // 3. Return null if no data found (Caller must handle default/error)
  return null;
}
