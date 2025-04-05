let _isProcessing = false;
let _pointsAtStart = null;
let _autoJoinEnabled = false;
let _currentPointBuffer = 0;
let _currentMaxCost = 100;
let _currentMinCost = 0;
let _currentMaxLevel = 10;
let _currentMinLevel = 0;
let _currentWishlistOnly = false;
let _currentSkipGroups = false;
let _currentSkipOwned = true;
let _currentSkipEntryLimited = false;
let _currentEntryLimitThreshold = 100;
let _currentBlacklistKeywords = [];
let _currentBlacklistPublishers = [];
let _currentWhitelistKeywords = [];
let _currentWhitelistPublishers = [];
let _currentAutoModeEnabled = false;
let _currentXsrfToken = null;
let _sessionJoinCount = 0;
let _currentSortByEndingSoon = false;
let _currentEndingSoonThreshold = 60; // minutes
let _currentPointSpendingStrategy = 'balanced'; // 'conservative', 'balanced', 'aggressive'
let _currentDynamicPointBuffer = false;
let _currentPointsToPreserve = {
  morning: 0,   // 6am - 12pm
  afternoon: 0, // 12pm - 6pm
  evening: 0,   // 6pm - 12am
  night: 0      // 12am - 6am
};
let _currentUseRegexFilters = false;

// Regular expressions storage for blacklist/whitelist (only compiled when needed)
let _compiledBlacklistRegex = null;
let _compiledWhitelistRegex = null;

export function isProcessing() { return _isProcessing; }
export function setIsProcessing(value) { _isProcessing = value; }

export function getPointsAtStart() { return _pointsAtStart; }
export function setPointsAtStart(value) { _pointsAtStart = value; }

export function isAutoJoinEnabled() { return _autoJoinEnabled; }
export function setAutoJoinEnabled(value) { _autoJoinEnabled = value; }

export function isAutoModeEnabled() { return _currentAutoModeEnabled; }
export function setAutoModeEnabled(value) { _currentAutoModeEnabled = value; }

export function getPointBuffer() { 
  if (_currentDynamicPointBuffer) {
    // Get current time to determine which point buffer to use
    const hour = new Date().getHours();
    if (hour >= 6 && hour < 12) {
      return _currentPointsToPreserve.morning;
    } else if (hour >= 12 && hour < 18) {
      return _currentPointsToPreserve.afternoon;
    } else if (hour >= 18 && hour < 24) {
      return _currentPointsToPreserve.evening;
    } else {
      return _currentPointsToPreserve.night;
    }
  }
  return _currentPointBuffer; 
}
export function setPointBuffer(value) { _currentPointBuffer = value; }

export function getMaxCost() { return _currentMaxCost; }
export function setMaxCost(value) { _currentMaxCost = value; }

export function getMinCost() { return _currentMinCost; }
export function setMinCost(value) { _currentMinCost = value; }

export function getMaxLevel() { return _currentMaxLevel; }
export function setMaxLevel(value) { _currentMaxLevel = value; }

export function getMinLevel() { return _currentMinLevel; }
export function setMinLevel(value) { _currentMinLevel = value; }

export function isWishlistOnly() { return _currentWishlistOnly; }
export function setWishlistOnly(value) { _currentWishlistOnly = value; }

export function shouldSkipGroups() { return _currentSkipGroups; }
export function setSkipGroups(value) { _currentSkipGroups = value; }

export function shouldSkipOwned() { return _currentSkipOwned; }
export function setSkipOwned(value) { _currentSkipOwned = value; }

export function shouldSkipEntryLimited() { return _currentSkipEntryLimited; }
export function setSkipEntryLimited(value) { _currentSkipEntryLimited = value; }

export function getEntryLimitThreshold() { return _currentEntryLimitThreshold; }
export function setEntryLimitThreshold(value) { _currentEntryLimitThreshold = value; }

export function isSortByEndingSoonEnabled() { return _currentSortByEndingSoon; }
export function setSortByEndingSoon(value) { _currentSortByEndingSoon = value; }

export function getEndingSoonThreshold() { return _currentEndingSoonThreshold; }
export function setEndingSoonThreshold(value) { _currentEndingSoonThreshold = value; }

export function getPointSpendingStrategy() { return _currentPointSpendingStrategy; }
export function setPointSpendingStrategy(value) { _currentPointSpendingStrategy = value; }

export function isDynamicPointBufferEnabled() { return _currentDynamicPointBuffer; }
export function setDynamicPointBuffer(value) { _currentDynamicPointBuffer = value; }

export function getPointsToPreserve() { return _currentPointsToPreserve; }
export function setPointsToPreserve(values) { 
  if (values && typeof values === 'object') {
    _currentPointsToPreserve = {
      ..._currentPointsToPreserve,
      ...values
    };
  }
}

/**
 * Calculate the dynamic point buffer based on time of day and strategy
 * @returns {number} The calculated point buffer
 */
export function calculateDynamicPointBuffer() {
  if (!_currentDynamicPointBuffer) {
    return _currentPointBuffer;
  }
  
  // Get the current hour to determine time of day
  const hour = new Date().getHours();
  
  // Determine which time period we're in
  let baseBuffer = 0;
  if (hour >= 6 && hour < 12) {
    baseBuffer = _currentPointsToPreserve.morning;
  } else if (hour >= 12 && hour < 18) {
    baseBuffer = _currentPointsToPreserve.afternoon;
  } else if (hour >= 18 && hour < 24) {
    baseBuffer = _currentPointsToPreserve.evening;
  } else {
    baseBuffer = _currentPointsToPreserve.night;
  }
  
  // Apply strategy-based modifier
  switch (_currentPointSpendingStrategy) {
    case 'conservative':
      return Math.round(baseBuffer * 1.2); // Increase buffer by 20%
    case 'aggressive':
      return Math.round(baseBuffer * 0.8); // Decrease buffer by 20%
    case 'balanced':
    default:
      return baseBuffer;
  }
}

export function isRegexFilterEnabled() { return _currentUseRegexFilters; }
export function setUseRegexFilters(value) { 
  _currentUseRegexFilters = value;
  // Clear compiled regex when toggling the setting
  if (!value) {
    _compiledBlacklistRegex = null;
    _compiledWhitelistRegex = null;
  }
}

export function getBlacklistKeywords() { return _currentBlacklistKeywords; }
export function setBlacklistKeywords(keywordsString) {
    if (typeof keywordsString === 'string') {
        _currentBlacklistKeywords = keywordsString
            .split('\n')
            .map(kw => kw.trim().toLowerCase())
            .filter(kw => kw.length > 0);
    } else {
        _currentBlacklistKeywords = [];
    }
    
    // Reset compiled regex
    _compiledBlacklistRegex = null;
}

export function getBlacklistPublishers() { return _currentBlacklistPublishers; }
export function setBlacklistPublishers(publishersString) {
    if (typeof publishersString === 'string') {
        _currentBlacklistPublishers = publishersString
            .split('\n')
            .map(pub => pub.trim().toLowerCase())
            .filter(pub => pub.length > 0);
    } else {
        _currentBlacklistPublishers = [];
    }
}

export function getWhitelistKeywords() { return _currentWhitelistKeywords; }
export function setWhitelistKeywords(keywordsString) {
    if (typeof keywordsString === 'string') {
        _currentWhitelistKeywords = keywordsString
            .split('\n')
            .map(kw => kw.trim().toLowerCase())
            .filter(kw => kw.length > 0);
    } else {
        _currentWhitelistKeywords = [];
    }
    
    // Reset compiled regex
    _compiledWhitelistRegex = null;
}

export function getWhitelistPublishers() { return _currentWhitelistPublishers; }
export function setWhitelistPublishers(publishersString) {
    if (typeof publishersString === 'string') {
        _currentWhitelistPublishers = publishersString
            .split('\n')
            .map(pub => pub.trim().toLowerCase())
            .filter(pub => pub.length > 0);
    } else {
        _currentWhitelistPublishers = [];
    }
}

export function getXsrfToken() { return _currentXsrfToken; }
export function setXsrfToken(value) { _currentXsrfToken = value; }

export function getSessionJoinCount() { return _sessionJoinCount; }
export function incrementSessionJoinCount() {
    _sessionJoinCount++;
}
export function setSessionJoinCount(value) { _sessionJoinCount = value; }

/**
 * Compile regex patterns from string patterns
 * @param {Array<string>} patterns - Array of string patterns
 * @returns {RegExp|null} - Compiled regex or null if no patterns
 */
function compileRegexPatterns(patterns) {
  if (!patterns || patterns.length === 0) return null;
  
  try {
    // Escape any special regex characters in the patterns and join with OR
    const regexString = patterns
      .map(pattern => {
        // If it looks like a regex (starts and ends with /), use it directly
        if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
          const lastSlashIndex = pattern.lastIndexOf('/');
          const regexPattern = pattern.substring(1, lastSlashIndex);
          const flags = pattern.substring(lastSlashIndex + 1);
          return regexPattern;
        }
        // Otherwise escape it
        return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('|');
    
    return new RegExp(regexString, 'i');
  } catch (e) {
    console.error('Error compiling regex patterns:', e);
    return null;
  }
}

/**
 * Check if a title matches blacklist using regex if enabled
 * @param {string} title - The title to check
 * @returns {boolean} - True if blacklisted
 */
export function isBlacklistedWithRegex(title) {
  if (!_currentUseRegexFilters || !title) return false;
  
  if (!_compiledBlacklistRegex) {
    _compiledBlacklistRegex = compileRegexPatterns(_currentBlacklistKeywords);
  }
  
  if (!_compiledBlacklistRegex) return false;
  
  return _compiledBlacklistRegex.test(title);
}

/**
 * Check if a title matches whitelist using regex if enabled
 * @param {string} title - The title to check
 * @returns {boolean} - True if whitelisted
 */
export function isWhitelistedWithRegex(title) {
  if (!_currentUseRegexFilters || !title) return false;
  
  if (!_compiledWhitelistRegex) {
    _compiledWhitelistRegex = compileRegexPatterns(_currentWhitelistKeywords);
  }
  
  if (!_compiledWhitelistRegex) return false;
  
  return _compiledWhitelistRegex.test(title);
}

/**
 * Check if a publisher is blacklisted
 * @param {string} publisher - The publisher to check
 * @returns {boolean} - True if blacklisted
 */
export function isPublisherBlacklisted(publisher) {
  if (!publisher) return false;
  const normalizedPublisher = publisher.trim().toLowerCase();
  return _currentBlacklistPublishers.some(p => normalizedPublisher.includes(p));
}

/**
 * Check if a publisher is whitelisted
 * @param {string} publisher - The publisher to check
 * @returns {boolean} - True if whitelisted
 */
export function isPublisherWhitelisted(publisher) {
  if (!publisher) return false;
  const normalizedPublisher = publisher.trim().toLowerCase();
  return _currentWhitelistPublishers.some(p => normalizedPublisher.includes(p));
}