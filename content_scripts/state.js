/**
 * State Management Module
 *
 * Centralized state management for the SteamGifts AutoJoin extension.
 * Manages all configurable settings, current state, and provides helper
 * functions for state-dependent decisions.
 */

// Time of day constants for dynamic point buffers
const TIME_PERIODS = {
  MORNING: { start: 6, end: 12, name: 'morning' },
  AFTERNOON: { start: 12, end: 18, name: 'afternoon' },
  EVENING: { start: 18, end: 24, name: 'evening' },
  NIGHT: { start: 0, end: 6, name: 'night' },
};

// Point spending strategies and their multipliers
const SPENDING_STRATEGIES = {
  CONSERVATIVE: { id: 'conservative', multiplier: 1.2 }, // Increase buffer by 20%
  BALANCED: { id: 'balanced', multiplier: 1.0 }, // No change
  AGGRESSIVE: { id: 'aggressive', multiplier: 0.8 }, // Decrease buffer by 20%
};

// State object to store all configurable settings and runtime state
const state = {
  // Operation state
  isProcessing: false,
  pointsAtStart: null,
  autoJoinEnabled: false,
  autoModeEnabled: false,
  sessionJoinCount: 0,
  xsrfToken: null,

  // Points and cost settings
  pointBuffer: 0,
  maxCost: 100,
  minCost: 0,
  dynamicPointBuffer: false,
  pointsToPreserve: {
    morning: 0, // 6am - 12pm
    afternoon: 0, // 12pm - 6pm
    evening: 0, // 6pm - 12am
    night: 0, // 12am - 6am
  },
  pointSpendingStrategy: SPENDING_STRATEGIES.BALANCED.id,

  // Level requirements
  maxLevel: 10,
  minLevel: 0,

  // Filter settings
  wishlistOnly: false,
  skipGroups: false,
  skipOwned: true,
  skipEntryLimited: false,
  entryLimitThreshold: 100,
  sortByEndingSoon: false,
  endingSoonThreshold: 60, // minutes

  // Keyword/Publisher filtering
  blacklistKeywords: [],
  blacklistPublishers: [],
  whitelistKeywords: [],
  whitelistPublishers: [],
  useRegexFilters: false,

  // Cached compiled regex patterns
  _compiledBlacklistRegex: null,
  _compiledWhitelistRegex: null,
};

/**
 * Gets the current time period based on hour of day
 * @returns {Object} The current time period object
 */
function getCurrentTimePeriod() {
  const hour = new Date().getHours();

  if (hour >= TIME_PERIODS.MORNING.start && hour < TIME_PERIODS.MORNING.end) {
    return TIME_PERIODS.MORNING;
  }
  if (hour >= TIME_PERIODS.AFTERNOON.start && hour < TIME_PERIODS.AFTERNOON.end) {
    return TIME_PERIODS.AFTERNOON;
  }
  if (hour >= TIME_PERIODS.EVENING.start && hour < TIME_PERIODS.EVENING.end) {
    return TIME_PERIODS.EVENING;
  }
  return TIME_PERIODS.NIGHT;
}

/**
 * Get the strategy multiplier for point buffer calculations
 * @returns {number} The multiplier for the current strategy
 */
function getStrategyMultiplier() {
  switch (state.pointSpendingStrategy) {
    case SPENDING_STRATEGIES.CONSERVATIVE.id:
      return SPENDING_STRATEGIES.CONSERVATIVE.multiplier;
    case SPENDING_STRATEGIES.AGGRESSIVE.id:
      return SPENDING_STRATEGIES.AGGRESSIVE.multiplier;
    case SPENDING_STRATEGIES.BALANCED.id:
    default:
      return SPENDING_STRATEGIES.BALANCED.multiplier;
  }
}

/**
 * Compile regex patterns from string patterns
 * @param {Array<string>} patterns - Array of string patterns
 * @returns {RegExp|null} - Compiled regex or null if no patterns
 */
function compileRegexPatterns(patterns) {
  if (!patterns || patterns.length === 0) return null;

  try {
    // Escape special regex characters in patterns and join with OR
    const regexString = patterns
      .map((pattern) => {
        // If it looks like a regex (starts and ends with /), use it directly
        if (pattern.startsWith('/') && pattern.lastIndexOf('/') > 0) {
          const lastSlashIndex = pattern.lastIndexOf('/');
          const regexPattern = pattern.substring(1, lastSlashIndex);
          return regexPattern;
        }
        // Otherwise escape it
        return pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      })
      .join('|');

    return new RegExp(regexString, 'i');
  } catch (e) {
    console.error('[SG AutoJoin] Error compiling regex patterns:', e);
    return null;
  }
}

/**
 * Parse a list of keywords or publishers from a string
 * @param {string} inputString - Newline-separated list of items
 * @returns {Array<string>} Array of normalized items
 */
function parseListFromString(inputString) {
  if (typeof inputString !== 'string') return [];

  return inputString
    .split('\n')
    .map((item) => item.trim().toLowerCase())
    .filter((item) => item.length > 0);
}

// State getter functions
export function isProcessing() { return state.isProcessing; }
export function getPointsAtStart() { return state.pointsAtStart; }
export function isAutoJoinEnabled() { return state.autoJoinEnabled; }
export function isAutoModeEnabled() { return state.autoModeEnabled; }
export function getSessionJoinCount() { return state.sessionJoinCount; }
export function getXsrfToken() { return state.xsrfToken; }

export function getPointBuffer() {
  if (state.dynamicPointBuffer) {
    const timePeriod = getCurrentTimePeriod();
    return state.pointsToPreserve[timePeriod.name];
  }
  return state.pointBuffer;
}

export function getMaxCost() { return state.maxCost; }
export function getMinCost() { return state.minCost; }
export function getMaxLevel() { return state.maxLevel; }
export function getMinLevel() { return state.minLevel; }
export function isWishlistOnly() { return state.wishlistOnly; }
export function shouldSkipGroups() { return state.skipGroups; }
export function shouldSkipOwned() { return state.skipOwned; }
export function shouldSkipEntryLimited() { return state.skipEntryLimited; }
export function getEntryLimitThreshold() { return state.entryLimitThreshold; }
export function isSortByEndingSoonEnabled() { return state.sortByEndingSoon; }
export function shouldSortByEndingSoon() { return state.sortByEndingSoon; }
export function getEndingSoonThreshold() { return state.endingSoonThreshold; }
export function getPointSpendingStrategy() { return state.pointSpendingStrategy; }
export function isDynamicPointBufferEnabled() { return state.dynamicPointBuffer; }
export function getPointsToPreserve() { return { ...state.pointsToPreserve }; }
export function isRegexFilterEnabled() { return state.useRegexFilters; }
export function getBlacklistKeywords() { return [...state.blacklistKeywords]; }
export function getBlacklistPublishers() { return [...state.blacklistPublishers]; }
export function getWhitelistKeywords() { return [...state.whitelistKeywords]; }
export function getWhitelistPublishers() { return [...state.whitelistPublishers]; }

// State setter functions
export function setIsProcessing(value) { state.isProcessing = !!value; }
export function setPointsAtStart(value) { state.pointsAtStart = value; }
export function setAutoJoinEnabled(value) { state.autoJoinEnabled = !!value; }
export function setAutoModeEnabled(value) { state.autoModeEnabled = !!value; }
export function setSessionJoinCount(value) { state.sessionJoinCount = value; }
export function incrementSessionJoinCount() { state.sessionJoinCount++; }
export function setXsrfToken(value) { state.xsrfToken = value; }

export function setPointBuffer(value) {
  state.pointBuffer = typeof value === 'number' ? value : parseInt(value, 10) || 0;
}

export function setMaxCost(value) {
  state.maxCost = typeof value === 'number' ? value : parseInt(value, 10) || 0;
}

export function setMinCost(value) {
  state.minCost = typeof value === 'number' ? value : parseInt(value, 10) || 0;
}

export function setMaxLevel(value) {
  state.maxLevel = typeof value === 'number' ? value : parseInt(value, 10) || 0;
}

export function setMinLevel(value) {
  state.minLevel = typeof value === 'number' ? value : parseInt(value, 10) || 0;
}

export function setWishlistOnly(value) { state.wishlistOnly = !!value; }
export function setSkipGroups(value) { state.skipGroups = !!value; }
export function setSkipOwned(value) { state.skipOwned = !!value; }
export function setSkipEntryLimited(value) { state.skipEntryLimited = !!value; }

export function setEntryLimitThreshold(value) {
  state.entryLimitThreshold = typeof value === 'number' ? value : parseInt(value, 10) || 0;
}

export function setSortByEndingSoon(value) { state.sortByEndingSoon = !!value; }

export function setEndingSoonThreshold(value) {
  state.endingSoonThreshold = typeof value === 'number' ? value : parseInt(value, 10) || 60;
}

export function setPointSpendingStrategy(value) {
  if (['conservative', 'balanced', 'aggressive'].includes(value)) {
    state.pointSpendingStrategy = value;
  }
}

export function setDynamicPointBuffer(value) { state.dynamicPointBuffer = !!value; }

export function setPointsToPreserve(values) {
  if (values && typeof values === 'object') {
    state.pointsToPreserve = {
      ...state.pointsToPreserve,
      ...values,
    };
  }
}

export function setUseRegexFilters(value) {
  state.useRegexFilters = !!value;
  // Clear compiled regex when toggling the setting
  if (!value) {
    state._compiledBlacklistRegex = null;
    state._compiledWhitelistRegex = null;
  }
}

export function setBlacklistKeywords(keywordsString) {
  state.blacklistKeywords = parseListFromString(keywordsString);
  state._compiledBlacklistRegex = null; // Reset compiled regex
}

export function setBlacklistPublishers(publishersString) {
  state.blacklistPublishers = parseListFromString(publishersString);
}

export function setWhitelistKeywords(keywordsString) {
  state.whitelistKeywords = parseListFromString(keywordsString);
  state._compiledWhitelistRegex = null; // Reset compiled regex
}

export function setWhitelistPublishers(publishersString) {
  state.whitelistPublishers = parseListFromString(publishersString);
}

/**
 * Calculate the dynamic point buffer based on time of day and strategy
 * @returns {number} The calculated point buffer
 */
export function calculateDynamicPointBuffer() {
  if (!state.dynamicPointBuffer) {
    return state.pointBuffer;
  }

  const timePeriod = getCurrentTimePeriod();
  const baseBuffer = state.pointsToPreserve[timePeriod.name];
  const multiplier = getStrategyMultiplier();

  return Math.round(baseBuffer * multiplier);
}

/**
 * Check if a title matches blacklist using regex if enabled
 * @param {string} title - The title to check
 * @returns {boolean} - True if blacklisted
 */
export function isBlacklistedWithRegex(title) {
  if (!state.useRegexFilters || !title) return false;

  if (!state._compiledBlacklistRegex) {
    state._compiledBlacklistRegex = compileRegexPatterns(state.blacklistKeywords);
  }

  return state._compiledBlacklistRegex && state._compiledBlacklistRegex.test(title);
}

/**
 * Check if a title matches whitelist using regex if enabled
 * @param {string} title - The title to check
 * @returns {boolean} - True if whitelisted
 */
export function isWhitelistedWithRegex(title) {
  if (!state.useRegexFilters || !title) return false;

  if (!state._compiledWhitelistRegex) {
    state._compiledWhitelistRegex = compileRegexPatterns(state.whitelistKeywords);
  }

  return state._compiledWhitelistRegex && state._compiledWhitelistRegex.test(title);
}

/**
 * Check if a publisher is blacklisted
 * @param {string} publisher - The publisher to check
 * @returns {boolean} - True if blacklisted
 */
export function isPublisherBlacklisted(publisher) {
  if (!publisher) return false;
  const normalizedPublisher = publisher.trim().toLowerCase();
  return state.blacklistPublishers.some((p) => normalizedPublisher.includes(p));
}

/**
 * Check if a publisher is whitelisted
 * @param {string} publisher - The publisher to check
 * @returns {boolean} - True if whitelisted
 */
export function isPublisherWhitelisted(publisher) {
  if (!publisher) return false;
  const normalizedPublisher = publisher.trim().toLowerCase();
  return state.whitelistPublishers.some((p) => normalizedPublisher.includes(p));
}
