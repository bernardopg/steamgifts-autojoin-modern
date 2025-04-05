/**
 * Filter Utilities Module
 * 
 * Functions for filtering giveaways based on various criteria:
 * - Blacklist/whitelist matching
 * - Entry limits
 * - Owned games
 * - Level checks
 * - Time remaining
 */

import { SELECTORS } from '../selectors.js';
import * as State from '../state.js';
import { error } from './core-utils.js';
import { extractEndTime, extractEntryCount } from './extraction-utils.js';

/**
 * Check if a giveaway is blacklisted
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {boolean} True if blacklisted, false otherwise
 */
export function isBlacklisted(giveawayElement) {
  if (!giveawayElement) return false;
  
  try {
    // Get the giveaway title
    const linkElement = giveawayElement.querySelector(SELECTORS.LIST_VIEW.GIVEAWAY_LINK);
    if (!linkElement) return false;
    
    const title = linkElement.textContent.trim().toLowerCase();
    if (!title) return false;
    
    // Check publisher blacklist
    const publisher = extractPublisher(giveawayElement);
    if (publisher && State.isPublisherBlacklisted(publisher)) {
      return true;
    }
    
    // Check regex blacklist if enabled
    if (State.isRegexFilterEnabled() && State.isBlacklistedWithRegex(title)) {
      return true;
    }
    
    // Check manual blacklist
    const blacklistKeywords = State.getBlacklistKeywords();
    return blacklistKeywords.some(keyword => 
      title.includes(keyword.toLowerCase())
    );
  } catch (e) {
    error('Error checking blacklist:', e);
    return false;
  }
}

/**
 * Check if a giveaway is whitelisted
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {boolean} True if whitelisted, false otherwise
 */
export function isWhitelisted(giveawayElement) {
  if (!giveawayElement) return false;
  
  try {
    // Get the giveaway title
    const linkElement = giveawayElement.querySelector(SELECTORS.LIST_VIEW.GIVEAWAY_LINK);
    if (!linkElement) return false;
    
    const title = linkElement.textContent.trim().toLowerCase();
    if (!title) return false;
    
    // Check publisher whitelist
    const publisher = extractPublisher(giveawayElement);
    if (publisher && State.isPublisherWhitelisted(publisher)) {
      return true;
    }
    
    // Check regex whitelist if enabled
    if (State.isRegexFilterEnabled() && State.isWhitelistedWithRegex(title)) {
      return true;
    }
    
    // Check manual whitelist
    const whitelistKeywords = State.getWhitelistKeywords();
    return whitelistKeywords.some(keyword => 
      title.includes(keyword.toLowerCase())
    );
  } catch (e) {
    error('Error checking whitelist:', e);
    return false;
  }
}

/**
 * Extract publisher from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {string|null} Publisher name or null if not found
 */
function extractPublisher(giveawayElement) {
  if (!giveawayElement) return null;
  
  try {
    const publisherElement = giveawayElement.querySelector('.giveaway__column--contributor-user');
    return publisherElement?.textContent?.trim() || null;
  } catch (e) {
    error('Error extracting publisher:', e);
    return null;
  }
}

/**
 * Check if a giveaway is entry limited (above threshold)
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {boolean} True if entry limited, false otherwise
 */
export function isEntryLimited(giveawayElement) {
  if (!State.shouldSkipEntryLimited() || !giveawayElement) return false;
  
  try {
    const entryCount = extractEntryCount(giveawayElement);
    if (entryCount === null) return false;
    
    return entryCount > State.getEntryLimitThreshold();
  } catch (e) {
    error('Error checking entry limit:', e);
    return false;
  }
}

/**
 * Check if a game is owned
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {boolean} True if owned, false otherwise
 */
export function isOwned(giveawayElement) {
  if (!State.shouldSkipOwned() || !giveawayElement) return false;
  
  try {
    return giveawayElement.classList.contains('is-owned') || 
           giveawayElement.matches(SELECTORS.LIST_VIEW.OWNED_INDICATOR);
  } catch (e) {
    error('Error checking if game is owned:', e);
    return false;
  }
}

/**
 * Check if a giveaway is ending soon
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {boolean} True if ending soon according to threshold
 */
export function isEndingSoon(giveawayElement) {
  if (!State.shouldSortByEndingSoon() || !giveawayElement) return false;
  
  try {
    const minutesRemaining = extractEndTime(giveawayElement);
    if (minutesRemaining === null) return false;
    
    return minutesRemaining <= State.getEndingSoonThreshold();
  } catch (e) {
    error('Error checking if ending soon:', e);
    return false;
  }
}