/**
 * Wishlist Utilities Module
 * 
 * Functions for managing and caching user's wishlist data
 */

import { SELECTORS } from '../selectors.js';
import { error, info, warn } from './core-utils.js';
import { delay, retry } from './core-utils.js';

// Constants
const WISHLIST_CACHE_KEY = 'sg_autojoin_wishlist_cache';
const WISHLIST_TIMESTAMP_KEY = 'sg_autojoin_wishlist_timestamp';
const DEFAULT_CACHE_EXPIRATION = 1000 * 60 * 60 * 6; // 6 hours

/**
 * Get the user's wishlist
 * @param {boolean} [forceRefresh=false] - Whether to force a refresh of cached data
 * @param {number} [cacheExpiration=DEFAULT_CACHE_EXPIRATION] - Cache expiration time in ms
 * @returns {Promise<Set<string>>} Set of app IDs on the wishlist
 */
export async function getWishlist(forceRefresh = false, cacheExpiration = DEFAULT_CACHE_EXPIRATION) {
  try {
    // Check cache first unless force refresh is requested
    if (!forceRefresh) {
      const cachedData = await getCachedWishlist(cacheExpiration);
      if (cachedData) {
        return cachedData;
      }
    }
    
    // Fetch wishlist data from SteamGifts
    const wishlistSet = await fetchWishlistFromSteamGifts();
    
    // Cache the results
    await cacheWishlist(wishlistSet);
    
    return wishlistSet;
  } catch (e) {
    error('Error getting wishlist:', e);
    
    // Fallback to cache even if it's expired
    const cachedData = await getCachedWishlist(Infinity);
    if (cachedData) {
      warn('Using expired wishlist cache due to fetch error');
      return cachedData;
    }
    
    return new Set(); // Empty set as last resort
  }
}

/**
 * Fetch wishlist data from SteamGifts
 * @returns {Promise<Set<string>>} Set of app IDs
 */
async function fetchWishlistFromSteamGifts() {
  info('Fetching wishlist from SteamGifts...');
  
  try {
    // First fetch the wishlist page
    let response = await retry(
      async () => {
        const res = await fetch('https://www.steamgifts.com/account/steam/wishlist');
        if (!res.ok) throw new Error(`Failed to fetch wishlist: ${res.status} ${res.statusText}`);
        return res;
      },
      3, // max retries
      2000 // delay between retries
    );
    
    const text = await response.text();
    const parser = new DOMParser();
    const doc = parser.parseFromString(text, 'text/html');
    
    // Check if there's pagination
    const pageLinks = doc.querySelectorAll('.pagination__navigation a');
    const lastPageLink = Array.from(pageLinks).pop();
    let totalPages = 1;
    
    if (lastPageLink && lastPageLink.textContent.includes('Last')) {
      const href = lastPageLink.getAttribute('href');
      const match = href.match(/page=(\d+)/);
      if (match && match[1]) {
        totalPages = parseInt(match[1], 10);
      }
    }
    
    info(`Found ${totalPages} pages of wishlist items`);
    
    // Process first page
    const gameSet = new Set();
    extractGamesFromWishlistPage(doc, gameSet);
    
    // Process additional pages if needed
    for (let page = 2; page <= totalPages; page++) {
      info(`Fetching wishlist page ${page}/${totalPages}...`);
      
      // Add delay to avoid rate limiting
      await delay(1000);
      
      const pageResponse = await retry(
        async () => {
          const res = await fetch(`https://www.steamgifts.com/account/steam/wishlist/search?page=${page}`);
          if (!res.ok) throw new Error(`Failed to fetch wishlist page ${page}: ${res.status} ${res.statusText}`);
          return res;
        },
        3,
        2000
      );
      
      const pageText = await pageResponse.text();
      const pageDoc = parser.parseFromString(pageText, 'text/html');
      extractGamesFromWishlistPage(pageDoc, gameSet);
    }
    
    info(`Wishlist fetched successfully with ${gameSet.size} games`);
    return gameSet;
    
  } catch (e) {
    error('Error fetching wishlist from SteamGifts:', e);
    throw e;
  }
}

/**
 * Extract game IDs from a wishlist page
 * @param {Document} doc - The parsed HTML document
 * @param {Set<string>} gameSet - The set to add games to
 */
function extractGamesFromWishlistPage(doc, gameSet) {
  const gameElements = doc.querySelectorAll('.table__row-outer-wrap');
  
  gameElements.forEach(element => {
    try {
      // Extract app ID from the link
      const link = element.querySelector('a.table__column__heading');
      if (link) {
        const href = link.getAttribute('href');
        const appMatch = href.match(/\/app\/(\d+)\//);
        const subMatch = href.match(/\/sub\/(\d+)\//);
        
        if (appMatch && appMatch[1]) {
          gameSet.add(`app/${appMatch[1]}`);
        } else if (subMatch && subMatch[1]) {
          gameSet.add(`sub/${subMatch[1]}`);
        }
      }
    } catch (e) {
      warn('Error extracting game from wishlist element:', e);
    }
  });
}

/**
 * Get cached wishlist data if it's not expired
 * @param {number} expirationTime - Cache expiration time in ms
 * @returns {Promise<Set<string>|null>} Wishlist data or null if expired/not found
 */
async function getCachedWishlist(expirationTime) {
  try {
    const [cachedJson, timestampStr] = await Promise.all([
      new Promise(resolve => {
        chrome.storage.local.get(WISHLIST_CACHE_KEY, result => {
          resolve(result[WISHLIST_CACHE_KEY] || null);
        });
      }),
      new Promise(resolve => {
        chrome.storage.local.get(WISHLIST_TIMESTAMP_KEY, result => {
          resolve(result[WISHLIST_TIMESTAMP_KEY] || null);
        });
      })
    ]);
    
    // Check if cache exists
    if (!cachedJson || !timestampStr) {
      return null;
    }
    
    // Check if cache is expired
    const timestamp = parseInt(timestampStr, 10);
    const now = Date.now();
    
    if (now - timestamp > expirationTime) {
      info('Wishlist cache expired');
      return null;
    }
    
    // Parse cache and convert to Set
    const cachedData = JSON.parse(cachedJson);
    const wishlistSet = new Set(cachedData);
    
    info(`Using cached wishlist with ${wishlistSet.size} games, cached ${Math.round((now - timestamp) / 1000 / 60)} minutes ago`);
    return wishlistSet;
    
  } catch (e) {
    error('Error getting cached wishlist:', e);
    return null;
  }
}

/**
 * Cache wishlist data
 * @param {Set<string>} wishlistSet - Set of app IDs to cache
 * @returns {Promise<void>}
 */
async function cacheWishlist(wishlistSet) {
  try {
    const wishlistArray = Array.from(wishlistSet);
    const wishlistJson = JSON.stringify(wishlistArray);
    const timestamp = Date.now();
    
    await Promise.all([
      new Promise(resolve => {
        chrome.storage.local.set({ [WISHLIST_CACHE_KEY]: wishlistJson }, resolve);
      }),
      new Promise(resolve => {
        chrome.storage.local.set({ [WISHLIST_TIMESTAMP_KEY]: timestamp.toString() }, resolve);
      })
    ]);
    
    info(`Cached wishlist with ${wishlistSet.size} games`);
  } catch (e) {
    error('Error caching wishlist:', e);
  }
}

/**
 * Clear wishlist cache
 * @returns {Promise<void>}
 */
export async function clearWishlistCache() {
  try {
    await Promise.all([
      new Promise(resolve => {
        chrome.storage.local.remove(WISHLIST_CACHE_KEY, resolve);
      }),
      new Promise(resolve => {
        chrome.storage.local.remove(WISHLIST_TIMESTAMP_KEY, resolve);
      })
    ]);
    
    info('Wishlist cache cleared');
  } catch (e) {
    error('Error clearing wishlist cache:', e);
  }
}

/**
 * Check if a game is on the wishlist
 * @param {string} appId - App ID to check
 * @param {Set<string>} wishlistSet - Wishlist set to check against
 * @returns {boolean} True if on wishlist
 */
export function isGameOnWishlist(appId, wishlistSet) {
  if (!appId || !wishlistSet) return false;
  return wishlistSet.has(appId);
}

/**
 * Extract app ID from a giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {string|null} App ID or null if not found
 */
export function extractAppId(giveawayElement) {
  if (!giveawayElement) return null;
  
  try {
    const link = giveawayElement.querySelector(SELECTORS.LIST_VIEW.GIVEAWAY_LINK);
    if (!link) return null;
    
    const href = link.getAttribute('href');
    if (!href) return null;
    
    const appMatch = href.match(/\/app\/(\d+)\//);
    const subMatch = href.match(/\/sub\/(\d+)\//);
    
    if (appMatch && appMatch[1]) {
      return `app/${appMatch[1]}`;
    }
    
    if (subMatch && subMatch[1]) {
      return `sub/${subMatch[1]}`;
    }
    
    return null;
  } catch (e) {
    error('Error extracting app ID:', e);
    return null;
  }
}