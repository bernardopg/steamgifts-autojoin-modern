/**
 * Core Utilities Module
 * 
 * Basic utility functions used throughout the extension, including:
 * - Points management
 * - XSRF token handling
 * - URL and code extraction
 * - Random delay generation
 * - Logging
 */

import { SELECTORS } from '../selectors.js';
import * as State from '../state.js';

// Constants
const LOG_PREFIX = '[SG AutoJoin]';
const DEFAULT_DELAY_MIN = 1000; // 1 second
const DEFAULT_DELAY_MAX = 3000; // 3 seconds

/**
 * Enhanced logging function with prefix and optional level
 * @param {string} level - Log level (log, info, warn, error)
 * @param {...any} args - Arguments to log
 */
function log(level, ...args) {
  const method = console[level] || console.log;
  method(LOG_PREFIX, ...args);
}

/**
 * Log at info level
 * @param {...any} args - Arguments to log
 */
export function info(...args) {
  log('log', ...args);
}

/**
 * Log at warning level
 * @param {...any} args - Arguments to log
 */
export function warn(...args) {
  log('warn', ...args);
}

/**
 * Log at error level
 * @param {...any} args - Arguments to log
 */
export function error(...args) {
  log('error', ...args);
}

/**
 * Get current user points from page or state
 * @returns {number|null} Current points or null if not found
 */
export function getCurrentPoints() {
  // First check if we have cached points
  const localPoints = State.getPointsAtStart();
  if (localPoints !== null && localPoints !== -1) { 
    return localPoints; 
  }
  
  // Try to read from the page
  try {
    const pointsElement = document.querySelector(SELECTORS.NAV.POINTS);
    if (pointsElement?.textContent) {
      const pointsText = pointsElement.textContent.trim().replace(/[^0-9]/g, "");
      const points = parseInt(pointsText, 10);
      
      if (!isNaN(points)) { 
        info('Read current points from page:', points); 
        State.setPointsAtStart(points); 
        return points; 
      }
    }
  } catch (e) {
    error('Error reading points:', e);
  }
  
  // If we get here, we couldn't find points
  if (State.getPointsAtStart() === null) { 
    warn('Could not find or parse points element using selector:', SELECTORS.NAV.POINTS); 
    State.setPointsAtStart(-1); 
  }
  
  return null;
}

/**
 * Get XSRF token from page
 * @returns {string|null} XSRF token or null if not found
 */
export function getXsrfTokenFromPage() {
  try {
    // Try to find the token in the main form
    const tokenInput = document.querySelector(SELECTORS.FORM.XSRF_TOKEN);
    if (tokenInput?.value) { 
      info('Found XSRF token in form');
      return tokenInput.value; 
    }
    
    // Fallback: try to extract from script tags (sometimes tokens are set in JavaScript)
    const scripts = document.querySelectorAll('script');
    for (const script of scripts) {
      if (script.textContent?.includes('xsrf_token')) {
        const match = script.textContent.match(/xsrf_token\s*=\s*['"]([a-zA-Z0-9]+)['"]/);
        if (match && match[1]) {
          info('Found XSRF token in script tag');
          return match[1];
        }
      }
    }
    
    // Fallback: try to extract from meta tags
    const metaToken = document.querySelector('meta[name="csrf-token"]');
    if (metaToken?.getAttribute('content')) {
      info('Found XSRF token in meta tag');
      return metaToken.getAttribute('content');
    }
  } catch (e) {
    error('Error retrieving XSRF token:', e);
  }
  
  error('XSRF Token not found on page. This could indicate you are logged out or the page structure has changed.');
  return null;
}

/**
 * Check if the user is logged in based on page elements
 * @returns {boolean} True if user appears to be logged in
 */
export function isUserLoggedIn() {
  try {
    // Check for presence of points display (only visible when logged in)
    const pointsElement = document.querySelector(SELECTORS.NAV.POINTS);
    if (pointsElement) return true;
    
    // Check for avatar/username (only visible when logged in)
    const avatarElement = document.querySelector(SELECTORS.NAV.USERNAME);
    if (avatarElement) return true;
    
    // Check for login elements (only visible when NOT logged in)
    const loginButton = document.querySelector('.nav__sits');
    if (loginButton) return false;
    
    // Default to false if we can't be sure
    return false;
  } catch (e) {
    error('Error checking login status:', e);
    return false;
  }
}

/**
 * Extract giveaway code from URL
 * @param {string} url - The URL to extract from
 * @returns {string|null} Giveaway code or null if not found
 */
export function extractGiveawayCodeFromUrl(url) {
  if (!url) return null;
  
  try {
    const match = url.match(/\/giveaway\/([a-zA-Z0-9]{5})\//);
    return match ? match[1] : null;
  } catch (e) {
    error('Error extracting giveaway code from URL:', e);
    return null;
  }
}

/**
 * Generate a random delay between min and max
 * @param {number} [min=1000] - Minimum delay in ms
 * @param {number} [max=3000] - Maximum delay in ms
 * @returns {number} Random delay in ms
 */
export function getRandomDelay(min = DEFAULT_DELAY_MIN, max = DEFAULT_DELAY_MAX) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

/**
 * Create a promise that resolves after a delay
 * @param {number} ms - Milliseconds to delay
 * @returns {Promise} Promise that resolves after delay
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Try to execute a function several times until it succeeds or max retries is reached
 * @param {Function} fn - The function to execute
 * @param {number} maxRetries - Maximum number of retry attempts
 * @param {number} delayMs - Delay between retries in ms
 * @returns {Promise<any>} The result of the function
 */
export async function retry(fn, maxRetries = 3, delayMs = 1000) {
  let lastError;
  
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      warn(`Attempt ${i + 1}/${maxRetries} failed:`, error);
      
      if (i < maxRetries - 1) {
        await delay(delayMs);
      }
    }
  }
  
  throw lastError;
}

/**
 * Format points with P suffix
 * @param {number} points - The number of points
 * @returns {string} Formatted points string
 */
export function formatPoints(points) {
  if (points === null || points === undefined) return '-';
  return `${points.toString()}P`;
}