/**
 * Message Processor Module
 * Add your custom message processing logic here
 */

/**
 * Example: Extract trading signals from messages
 * @param {string} messageText - The message text to analyze
 * @returns {Object|null} - Parsed trading signal or null
 */
export function extractTradingSignal(messageText) {
  // Extended pattern matching for trading signals
  // Supports English and German formats
  
  // German "ICH KAUFE BROADCOM (EK: 360.24)" pattern
  const germanBuyPattern = /ICH\s+KAUFE\s+([A-Z][A-Z\s&]+?)(?:\s+CALL\s+(\d+))?\s*\((?:EK|Einstiegskurs):?\s*(\d+\.?\d*)\)/i;
  
  // English patterns
  const buyPattern = /BUY|LONG|KAUFE/i;
  const sellPattern = /SELL|SHORT|VERKAUFE/i;
  const symbolPattern = /([A-Z]{3,}\/[A-Z]{3,})|([A-Z]{2,}USD[T]?)/i;
  const pricePattern = /(?:@|at|price|EK|Einstiegskurs):?\s*(\d+\.?\d*)/i;
  
  // Check for German format first
  const germanMatch = messageText.match(germanBuyPattern);
  if (germanMatch) {
    const symbol = germanMatch[1].trim();
    const strikePrice = germanMatch[2]; // For options like "TESLA CALL 410"
    const entryPrice = parseFloat(germanMatch[3]);
    
    return {
      action: 'BUY',
      symbol: strikePrice ? `${symbol} CALL ${strikePrice}` : symbol,
      price: entryPrice,
      timestamp: new Date().toISOString(),
      originalMessage: messageText,
      isOption: !!strikePrice,
      strikePrice: strikePrice ? parseFloat(strikePrice) : null
    };
  }
  
  // Fallback to English patterns
  const isBuy = buyPattern.test(messageText);
  const isSell = sellPattern.test(messageText);
  const symbolMatch = messageText.match(symbolPattern);
  const priceMatch = messageText.match(pricePattern);
  
  if ((isBuy || isSell) && symbolMatch) {
    return {
      action: isBuy ? 'BUY' : 'SELL',
      symbol: symbolMatch[0],
      price: priceMatch ? parseFloat(priceMatch[1]) : null,
      timestamp: new Date().toISOString(),
      originalMessage: messageText
    };
  }
  
  return null;
}

/**
 * Example: Filter messages by keywords
 * @param {string} messageText - The message text
 * @param {Array<string>} keywords - Keywords to search for
 * @returns {boolean} - True if any keyword is found
 */
export function containsKeywords(messageText, keywords) {
  const lowerText = messageText.toLowerCase();
  return keywords.some(keyword => lowerText.includes(keyword.toLowerCase()));
}

/**
 * Example: Store message to a simple in-memory cache
 */
class MessageCache {
  constructor(maxSize = 1000) {
    this.messages = [];
    this.maxSize = maxSize;
  }
  
  add(message) {
    this.messages.push({
      ...message,
      cachedAt: new Date().toISOString()
    });
    
    // Keep only the most recent messages
    if (this.messages.length > this.maxSize) {
      this.messages.shift();
    }
  }
  
  getRecent(count = 10) {
    return this.messages.slice(-count);
  }
  
  getAll() {
    return this.messages;
  }
  
  clear() {
    this.messages = [];
  }
}

export const messageCache = new MessageCache();

/**
 * Example: Log message statistics
 */
class MessageStats {
  constructor() {
    this.stats = {
      totalMessages: 0,
      messagesByChat: {},
      messagesBySender: {},
      startTime: new Date().toISOString()
    };
  }
  
  record(chatId, senderId) {
    this.stats.totalMessages++;
    
    this.stats.messagesByChat[chatId] = (this.stats.messagesByChat[chatId] || 0) + 1;
    this.stats.messagesBySender[senderId] = (this.stats.messagesBySender[senderId] || 0) + 1;
  }
  
  getStats() {
    return {
      ...this.stats,
      uptime: Date.now() - new Date(this.stats.startTime).getTime(),
      topChats: Object.entries(this.stats.messagesByChat)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5)
    };
  }
}

export const messageStats = new MessageStats();
