/**
 * UI Enhancement Utilities Module
 * 
 * Functions for enhancing the SteamGifts UI with additional features:
 * - Cleaning up ads
 * - Adding join buttons
 * - Highlighting giveaways
 * - Adding status indicators
 */

import { SELECTORS } from '../selectors.js';
import { error, info } from './core-utils.js';
import { isEndingSoon } from './filter-utils.js';

/**
 * Hide ads and clean up the SteamGifts UI
 */
export function cleanupSteamGiftsUI() {
  try {
    // Add ad cleanup observer
    observeForAds();
    
    // Do initial ad cleanup
    hideAds();
  } catch (e) {
    error('Error cleaning up UI:', e);
  }
}

/**
 * Hide ads and unwanted elements
 */
function hideAds() {
  // Hide sidebar and featured ads
  const adSelectors = [
    // Sidebar ads
    '#sidebar__mpu-container',
    '#mys-wrapper',
    '.sidebar__mpu',
    
    // Featured content - remove completely
    SELECTORS.FEATURED_CONTAINER,
    // Featured content ads (fallback for partial removal)
    `${SELECTORS.FEATURED_CONTAINER} .featured__inner-wrap a[href*="redirect"]`,
    `${SELECTORS.FEATURED_CONTAINER} .featured__inner-wrap a[href*="humble"]`,
    
    // Banner ads
    '.leaderboard__container',
    '.fwbrg', // Fanatical wrapper
    
    // Grid table sponsored content
    'div[style*="height:250px"]',
    'div[style*="height: 250px"]',
    'div[style*="width:300px"]',
    'div[style*="width: 300px"]',
    
    // General ad containers
    'div[id*="amazon-native"]',
    'ins.adsbygoogle',
    'div[class*="adsbygoogle"]'
  ];
  
  adSelectors.forEach(selector => {
    document.querySelectorAll(selector).forEach(ad => {
      if (ad) {
        ad.style.display = 'none';
        ad.style.visibility = 'hidden';
        ad.style.height = '0';
        ad.style.overflow = 'hidden';
        ad.style.opacity = '0';
        ad.classList.add('sg-removed-ad');
      }
    });
  });
}

/**
 * Create MutationObserver to hide new ads when they appear
 */
function observeForAds() {
  const adObserver = new MutationObserver(mutations => {
    for (const mutation of mutations) {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        // Check if any added nodes are ads
        mutation.addedNodes.forEach(node => {
          // Only process element nodes
          if (node.nodeType !== Node.ELEMENT_NODE) return;
          
          // Check if the node matches any ad selector
          if (
            node.id === 'sidebar__mpu-container' ||
            node.id === 'mys-wrapper' ||
            node.classList?.contains('sidebar__mpu') ||
            node.classList?.contains('featured__container') ||
            node.classList?.contains('leaderboard__container') ||
            node.classList?.contains('fwbrg') ||
            node.style?.height === '250px' ||
            node.style?.width === '300px' ||
            node.id?.includes('amazon-native') ||
            node.classList?.contains('adsbygoogle')
          ) {
            // Hide this ad
            node.style.display = 'none';
            node.style.visibility = 'hidden';
            node.style.height = '0';
            node.style.overflow = 'hidden';
            node.style.opacity = '0';
            node.classList.add('sg-removed-ad');
          }
          
          // Also look for ads inside this node
          hideAds();
        });
      }
    }
  });
  
  // Start observing the document body
  adObserver.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Highlight giveaways that are ending soon
 */
export function highlightEndingSoonGiveaways() {
  try {
    // Get all giveaway elements
    const giveaways = document.querySelectorAll(SELECTORS.LIST_VIEW.GIVEAWAY_CONTAINER);
    
    // Add appropriate highlighting class based on end time
    giveaways.forEach(giveaway => {
      if (isEndingSoon(giveaway)) {
        giveaway.classList.add('sg-ending-soon');
        giveaway.style.backgroundColor = 'rgba(255, 204, 0, 0.1)';
        giveaway.style.borderLeft = '3px solid #ffcc00';
      }
    });
    
    // Add the highlighting style if not already present
    if (!document.getElementById('sg-ending-soon-style')) {
      const style = document.createElement('style');
      style.id = 'sg-ending-soon-style';
      style.textContent = `
        .sg-ending-soon {
          background-color: rgba(255, 204, 0, 0.1) !important;
          border-left: 3px solid #ffcc00 !important;
          transition: background-color 0.3s ease;
        }
        
        .sg-ending-soon:hover {
          background-color: rgba(255, 204, 0, 0.15) !important;
        }
      `;
      document.head.appendChild(style);
    }
  } catch (e) {
    error('Error highlighting ending soon giveaways:', e);
  }
}

/**
 * Show entry stats on giveaways
 */
export function showEntryStats() {
  try {
    // Get all giveaway elements
    const giveaways = document.querySelectorAll(SELECTORS.LIST_VIEW.GIVEAWAY_CONTAINER);
    
    // Process each giveaway
    giveaways.forEach(giveaway => {
      // Check if stats already added
      if (giveaway.querySelector('.sg-entry-stats')) return;
      
      // Get the links element to add stats after
      const links = giveaway.querySelector('.giveaway__links');
      if (!links) return;
      
      // Create stats element
      const statsEl = document.createElement('div');
      statsEl.className = 'sg-entry-stats';
      statsEl.style.fontSize = '12px';
      statsEl.style.color = '#6b6b6b';
      statsEl.style.marginTop = '2px';
      
      // Get entry count
      const entriesLink = giveaway.querySelector('a[href*="entries"]');
      const entriesMatch = entriesLink?.textContent.match(/(\d+,?\d*)/);
      const entriesCount = entriesMatch ? parseInt(entriesMatch[1].replace(',', ''), 10) : null;
      
      // Get point cost
      const costElements = giveaway.querySelectorAll(SELECTORS.LIST_VIEW.COST_INDICATOR);
      let cost = null;
      
      for (const element of costElements) {
        const match = element.textContent.match(/\((\d+)\s*P\)/i);
        if (match && match[1]) {
          cost = parseInt(match[1], 10);
          break;
        }
      }
      
      // Calculate odds and value
      if (entriesCount && cost) {
        const odds = ((1 / entriesCount) * 100).toFixed(2);
        const value = (cost / entriesCount).toFixed(2);
        
        statsEl.innerHTML = `
          <span title="Your estimated odds of winning">Odds: ${odds}%</span> | 
          <span title="Points per entry ratio (lower is better)">Value: ${value}P/entry</span>
        `;
        
        // Add stats element after links
        links.parentNode.insertBefore(statsEl, links.nextSibling);
      }
    });
  } catch (e) {
    error('Error showing entry stats:', e);
  }
}