/**
 * Extraction Utilities Module
 * 
 * Functions for extracting information from DOM elements,
 * including costs, levels, end times, and other giveaway details.
 */

import { SELECTORS } from '../selectors.js';
import { error } from './core-utils.js';

/**
 * Extract cost from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {number|null} Cost in points or null if not found
 */
export function extractCost(giveawayElement) {
  if (!giveawayElement) return null;
  
  try {
    const potentialCostElements = giveawayElement.querySelectorAll(SELECTORS.LIST_VIEW.COST_INDICATOR);
    
    for (const element of potentialCostElements) {
      const text = element.textContent.trim();
      // Look for patterns like "(100P)" or "(100 P)"
      const match = text.match(/\((\d+)\s*P\)/i);
      
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    
    return null;
  } catch (e) {
    error('Error extracting cost:', e);
    return null;
  }
}

/**
 * Extract required level from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {number} Required level or 0 if no restriction
 */
export function extractRequiredLevel(giveawayElement) {
  if (!giveawayElement) return 0;
  
  try {
    const levelElement = giveawayElement.querySelector(SELECTORS.LIST_VIEW.LEVEL_INDICATOR);
    
    if (levelElement) {
      // Level indicator has text like "Level 5+" or just "5+"
      const text = levelElement.textContent.trim();
      const match = text.match(/(\d+)\+/);
      
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    
    return 0; // No level restriction
  } catch (e) {
    error('Error extracting required level:', e);
    return 0;
  }
}

/**
 * Extract end time in minutes from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {number|null} Minutes remaining or null if not found
 */
export function extractEndTime(giveawayElement) {
  if (!giveawayElement) return null;
  
  try {
    const timeElements = Array.from(giveawayElement.querySelectorAll('.giveaway__columns span'));
    
    for (const element of timeElements) {
      const text = element.textContent.trim().toLowerCase();
      
      // Check for minutes pattern (e.g., "10 minutes")
      const minutesMatch = text.match(/(\d+)\s*minutes?/);
      if (minutesMatch && minutesMatch[1]) {
        return parseInt(minutesMatch[1], 10);
      }
      
      // Check for hours pattern (e.g., "2 hours")
      const hoursMatch = text.match(/(\d+)\s*hours?/);
      if (hoursMatch && hoursMatch[1]) {
        return parseInt(hoursMatch[1], 10) * 60;
      }
      
      // Check for days pattern (e.g., "3 days")
      const daysMatch = text.match(/(\d+)\s*days?/);
      if (daysMatch && daysMatch[1]) {
        return parseInt(daysMatch[1], 10) * 24 * 60;
      }
      
      // If it says "Ended", return 0
      if (text.includes('ended')) {
        return 0;
      }
    }
    
    return null;
  } catch (e) {
    error('Error extracting end time:', e);
    return null;
  }
}

/**
 * Extract publisher name from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {string|null} - Publisher name or null if not found
 */
export function extractPublisher(giveawayElement) {
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
 * Extract entry count from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {number|null} - Number of entries or null if not found
 */
export function extractEntryCount(giveawayElement) {
  if (!giveawayElement) return null;
  
  try {
    const entriesElement = giveawayElement.querySelector(SELECTORS.LIST_VIEW.ENTRIES_COUNT);
    
    if (entriesElement) {
      const text = entriesElement.textContent.trim();
      const match = text.match(/(\d+,?\d*)/);
      
      if (match && match[1]) {
        return parseInt(match[1].replace(',', ''), 10);
      }
    }
    
    return null;
  } catch (e) {
    error('Error extracting entry count:', e);
    return null;
  }
}

/**
 * Extract number of copies from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {number} - Number of copies (defaults to 1)
 */
export function extractCopies(giveawayElement) {
  if (!giveawayElement) return 1;
  
  try {
    const copiesElements = giveawayElement.querySelectorAll(SELECTORS.LIST_VIEW.COPIES_INDICATOR);
    
    for (const element of copiesElements) {
      const text = element.textContent.trim();
      const match = text.match(/(\d+)\s*Copies/i);
      
      if (match && match[1]) {
        return parseInt(match[1], 10);
      }
    }
    
    return 1; // Default to 1 copy
  } catch (e) {
    error('Error extracting copies count:', e);
    return 1;
  }
}