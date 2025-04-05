import * as Selectors from './selectors.js';
import * as State from './state.js';

export function getCurrentPoints() {
  const localPoints = State.getPointsAtStart();
  if (localPoints !== null && localPoints !== -1) { return localPoints; }
  const pointsElement = document.querySelector(Selectors.pointsSelector);
  if (pointsElement?.textContent) {
    const pointsText = pointsElement.textContent.trim().replace(/[^0-9]/g, "");
    const points = parseInt(pointsText, 10);
    if (!isNaN(points)) { console.log("[SG AutoJoin] Read current points from page:", points); State.setPointsAtStart(points); return points; }
  }
  if (State.getPointsAtStart() === null) { console.log("[SG AutoJoin] Could not find or parse points element using selector:", Selectors.pointsSelector); State.setPointsAtStart(-1); }
  return null;
}

export function getXsrfTokenFromPage() {
  const tokenInput = document.querySelector(Selectors.xsrfTokenSelector);
  if (tokenInput?.value) { return tokenInput.value; }
  console.error("[SG AutoJoin] XSRF Token input not found with selector:", Selectors.xsrfTokenSelector);
  return null;
}

export function extractGiveawayCodeFromUrl(url) {
  const match = url?.match(/\/giveaway\/([a-zA-Z0-9]{5})\//);
  return match ? match[1] : null;
}

export function extractCost(giveawayElement) {
    const potentialCostElements = giveawayElement.querySelectorAll(Selectors.listView_costSelector);
    for (const el of potentialCostElements) {
        if (el.textContent?.includes('P')) {
            const costString = el.textContent.replace(/[^0-9]/g, "");
            const cost = parseInt(costString, 10);
            return isNaN(cost) ? null : cost;
        }
    }
    return null;
}

export function extractRequiredLevel(giveawayElement) {
    let requiredLevel = 0;
    const levelElement = giveawayElement.querySelector(Selectors.listView_levelIndicatorSelector);
    if (levelElement?.textContent) {
        const levelMatch = levelElement.textContent.match(/\d+/);
        if (levelMatch) { requiredLevel = parseInt(levelMatch[0], 10); }
    }
    return requiredLevel;
}

/**
 * Extract entry count from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {number|null} - Entry count or null if not found
 */
export function extractEntryCount(giveawayElement) {
  const entriesText = giveawayElement.querySelector('.giveaway__links > a:first-child');
  if (!entriesText || !entriesText.textContent) return null;
  
  const entryMatch = entriesText.textContent.match(/(\d+)/);
  if (entryMatch && entryMatch[1]) {
    return parseInt(entryMatch[1], 10);
  }
  
  return null;
}

/**
 * Check if giveaway has entry limit
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {boolean} - True if entry limited
 */
export function isEntryLimited(giveawayElement) {
  if (!State.shouldSkipEntryLimited()) return false;
  
  // Look for entry limit indicator
  const entryCount = extractEntryCount(giveawayElement);
  if (entryCount === null) return false;
  
  return entryCount >= State.getEntryLimitThreshold();
}

/**
 * Extract end time from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {number|null} - Minutes until end or null if not found
 */
export function extractEndTime(giveawayElement) {
  const endTimeElement = giveawayElement.querySelector('.giveaway__column--end > span');
  if (!endTimeElement || !endTimeElement.dataset || !endTimeElement.dataset.timestamp) return null;
  
  try {
    const endTimestamp = parseInt(endTimeElement.dataset.timestamp, 10) * 1000; // Convert to ms
    const currentTime = Date.now();
    const timeRemaining = endTimestamp - currentTime;
    
    // Convert ms to minutes
    return Math.floor(timeRemaining / (1000 * 60));
  } catch (e) {
    console.error('[SG AutoJoin] Error extracting end time:', e);
    return null;
  }
}

/**
 * Check if giveaway is ending soon
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {boolean} - True if ending soon according to threshold
 */
export function isEndingSoon(giveawayElement) {
  if (!State.shouldSortByEndingSoon()) return false;
  
  const minutesRemaining = extractEndTime(giveawayElement);
  if (minutesRemaining === null) return false;
  
  return minutesRemaining <= State.getEndingSoonThreshold();
}

/**
 * Extract publisher name from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {string|null} - Publisher name or null if not found
 */
export function extractPublisher(giveawayElement) {
  // Publisher info is usually in the tooltip or in a data attribute
  // This might need adjustment based on SteamGifts' actual structure
  const publisherElement = giveawayElement.querySelector('.giveaway__column--contributor-user');
  return publisherElement?.textContent?.trim() || null;
}

function getGiveawayTitle(giveawayElement) {
     const titleElement = giveawayElement.querySelector(Selectors.listView_giveawayLinkSelector);
     return titleElement?.textContent?.trim().toLowerCase() || null;
}

export function isBlacklisted(giveawayElement) {
    // Check if regex mode is enabled
    if (State.isRegexFilterEnabled()) {
      const title = getGiveawayTitle(giveawayElement);
      return State.isBlacklistedWithRegex(title);
    }
    
    // Standard keyword matching
    const keywords = State.getBlacklistKeywords();
    if (keywords.length === 0) return false;
    const title = getGiveawayTitle(giveawayElement);
    if (!title) return false;
    
    // Check title against keywords
    if (keywords.some(keyword => title.includes(keyword))) return true;
    
    // Check publisher against blacklist
    const publisher = extractPublisher(giveawayElement);
    if (publisher && State.isPublisherBlacklisted(publisher)) return true;
    
    return false;
}

export function isWhitelisted(giveawayElement) {
    // Check if regex mode is enabled
    if (State.isRegexFilterEnabled()) {
      const title = getGiveawayTitle(giveawayElement);
      return State.isWhitelistedWithRegex(title);
    }
    
    // Standard keyword matching
    const keywords = State.getWhitelistKeywords();
    if (keywords.length === 0) return false;
    const title = getGiveawayTitle(giveawayElement);
    if (!title) return false;
    
    // Check title against keywords
    if (keywords.some(keyword => title.includes(keyword))) return true;
    
    // Check publisher against whitelist
    const publisher = extractPublisher(giveawayElement);
    if (publisher && State.isPublisherWhitelisted(publisher)) return true;
    
    return false;
}

export function isOwned(giveawayElement) {
    if (!State.shouldSkipOwned()) return false;
    return !!giveawayElement.matches(Selectors.listView_ownedIndicatorSelector) ||
           !!giveawayElement.parentElement?.matches(Selectors.listView_ownedIndicatorSelector);
}

// Enhanced UI utilities

// Create a toast notification container if it doesn't exist
function ensureToastContainer() {
  let container = document.getElementById('sg-toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'sg-toast-container';
    container.className = 'sg-toast-container';
    document.body.appendChild(container);
  }
  return container;
}

// Show a toast notification
export function showToast(message, type = 'info', duration = 5000) {
  // Check if notifications are enabled
  chrome.storage.sync.get({
    showJoinNotifications: true,
    showErrorNotifications: true,
    notificationDuration: 5,
    persistentNotifications: false,
    audioFeedback: false,
    audioVolume: 70
  }, (settings) => {
    // Skip if appropriate notification type is disabled
    if (type === 'error' && !settings.showErrorNotifications) return;
    if (type !== 'error' && !settings.showJoinNotifications) return;

    // Convert duration from settings if not explicitly provided
    const actualDuration = duration || settings.notificationDuration * 1000;
    
    // Create toast container
    const container = ensureToastContainer();
    
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `sg-toast sg-toast-${type}`;
    
    // Add icon based on type
    let iconClass = 'info-circle';
    if (type === 'success') iconClass = 'check-circle';
    if (type === 'error') iconClass = 'exclamation-circle';
    if (type === 'warning') iconClass = 'exclamation-triangle';
    
    // Build toast content
    toast.innerHTML = `
      <div class="sg-toast-icon">
        <i class="fas fa-${iconClass}"></i>
      </div>
      <div class="sg-toast-content">
        <div class="sg-toast-message">${message}</div>
      </div>
      ${!settings.persistentNotifications ? `
      <div class="sg-toast-progress">
        <div class="sg-toast-progress-bar"></div>
      </div>` : ''}
    `;
    
    // Add toast to container
    container.appendChild(toast);
    
    // Play sound if enabled
    if (settings.audioFeedback) {
      playNotificationSound(type, settings.audioVolume / 100);
    }
    
    // Remove toast after duration (if not persistent)
    if (!settings.persistentNotifications) {
      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, actualDuration);
    } else {
      // Add a close button for persistent notifications
      const closeBtn = document.createElement('button');
      closeBtn.className = 'sg-toast-close';
      closeBtn.innerHTML = '<i class="fas fa-times"></i>';
      closeBtn.addEventListener('click', () => {
        toast.style.opacity = '0';
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      });
      toast.appendChild(closeBtn);
    }
  });
}

// Play notification sound
function playNotificationSound(type, volume = 0.7) {
  const sounds = {
    success: 'data:audio/mp3;base64,SUQzAwAAAAAAIlRQRTEAAAAcAAAAU291bmRKYXkuY29tIFNvdW5kIEVmZmVjdHMATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=',
    error: 'data:audio/mp3;base64,SUQzAwAAAAAAIlRQRTEAAAAcAAAAU291bmRKYXkuY29tIFNvdW5kIEVmZmVjdHMATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=',
    info: 'data:audio/mp3;base64,SUQzAwAAAAAAIlRQRTEAAAAcAAAAU291bmRKYXkuY29tIFNvdW5kIEVmZmVjdHMATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU='
  };
  
  // Create an audio element
  const audio = new Audio(sounds[type] || sounds.info);
  audio.volume = volume;
  audio.play();
}

// Update element content with animation
export function updateWithFadeAnimation(element, content) {
  if (!element) return;
  
  // Animate out
  element.style.transition = 'opacity 0.2s ease-out';
  element.style.opacity = '0';
  
  // Update content after fade out
  setTimeout(() => {
    if (typeof content === 'string') {
      element.textContent = content;
    } else if (typeof content === 'function') {
      content(element);
    }
    
    // Animate back in
    element.style.opacity = '1';
  }, 200);
}

// Track statistics for joined giveaways
export function trackJoinedGiveaway(giveawayElement, cost, success = true) {
  if (!giveawayElement) return;
  
  // Get giveaway details
  const titleElement = giveawayElement.querySelector(Selectors.listView_giveawayLinkSelector);
  const title = titleElement?.textContent?.trim() || 'Unknown Game';
  const url = titleElement?.href || '';
  const code = extractGiveawayCodeFromUrl(url);
  
  // Create entry
  const entry = {
    title,
    code,
    cost: cost || 0,
    date: Date.now(),
    success
  };
  
  // Update statistics in storage
  chrome.storage.sync.get({
    totalJoins: 0,
    successfulJoins: 0,
    pointsSpent: 0,
    joinHistory: []
  }, (stats) => {
    // Update stats
    stats.totalJoins++;
    if (success) {
      stats.successfulJoins++;
      stats.pointsSpent += (cost || 0);
    }
    
    // Add to history (keep most recent 50)
    stats.joinHistory.unshift(entry);
    if (stats.joinHistory.length > 50) {
      stats.joinHistory = stats.joinHistory.slice(0, 50);
    }
    
    // Save updated stats
    chrome.storage.sync.set(stats);
  });
}

// Add visual feedback to giveaway element
export function addVisualFeedbackToGiveaway(giveawayElement, status = 'success') {
  if (!giveawayElement) return;
  
  // Add status class
  giveawayElement.classList.add(`sg-giveaway-${status}`);
  
  // Add animation
  giveawayElement.style.transition = 'all 0.3s ease-out';
  giveawayElement.style.animation = 'sg-pulse 0.5s';
  
  // Add icon
  const feedbackIcon = document.createElement('div');
  feedbackIcon.className = `sg-giveaway-feedback sg-giveaway-feedback-${status}`;
  
  let iconClass = 'check-circle';
  if (status === 'error') iconClass = 'times-circle';
  if (status === 'loading') iconClass = 'spinner fa-spin';
  
  feedbackIcon.innerHTML = `<i class="fas fa-${iconClass}"></i>`;
  giveawayElement.appendChild(feedbackIcon);
  
  // Remove feedback after delay (except for loading state)
  if (status !== 'loading') {
    setTimeout(() => {
      if (feedbackIcon.parentNode) {
        feedbackIcon.parentNode.removeChild(feedbackIcon);
      }
    }, 3000);
  } else {
    return feedbackIcon; // Return the loading icon so it can be removed later
  }
}

// Create and show a progress indicator
export function createProgressIndicator(message, parent = document.body) {
  // Use the new progress tracker from UI module if available
  if (typeof createProgressTracker === 'function') {
    try {
      return createProgressTracker(message);
    } catch (e) {
      console.warn("[SG AutoJoin] Error using createProgressTracker, falling back to basic implementation");
    }
  }
  
  // Fallback to basic implementation
  const progressContainer = document.createElement('div');
  progressContainer.className = 'sg-progress-container';
  
  progressContainer.innerHTML = `
    <div class="sg-progress-content">
      <div class="sg-progress-spinner">
        <i class="fas fa-spinner fa-spin"></i>
      </div>
      <div class="sg-progress-message">${message}</div>
      <div class="sg-progress-bar">
        <div class="sg-progress-bar-inner" style="width: 0%"></div>
      </div>
    </div>
  `;
  
  parent.appendChild(progressContainer);
  
  // Return methods to update the progress
  const api = {
    updateProgress: (percent, newMessage = null) => {
      const progressBar = progressContainer.querySelector('.sg-progress-bar-inner');
      if (progressBar) {
        progressBar.style.width = `${percent}%`;
      }
      
      if (newMessage) {
        const messageEl = progressContainer.querySelector('.sg-progress-message');
        if (messageEl) {
          messageEl.textContent = newMessage;
        }
      }
      
      return api; // Allow chaining
    },
    complete: (completionMessage = 'Completed!', success = true) => {
      const spinnerIcon = progressContainer.querySelector('.sg-progress-spinner i');
      if (spinnerIcon) {
        spinnerIcon.className = success ? 'fas fa-check-circle' : 'fas fa-times-circle';
      }
      
      const messageEl = progressContainer.querySelector('.sg-progress-message');
      if (messageEl) {
        messageEl.textContent = completionMessage;
      }
      
      const progressBar = progressContainer.querySelector('.sg-progress-bar-inner');
      if (progressBar) {
        progressBar.style.width = '100%';
        progressBar.style.backgroundColor = success ? 'var(--sg-success)' : 'var(--sg-danger)';
      }
      
      // Remove after delay
      setTimeout(() => {
        if (progressContainer.parentNode) {
          progressContainer.style.opacity = '0';
          setTimeout(() => {
            if (progressContainer.parentNode) {
              progressContainer.parentNode.removeChild(progressContainer);
            }
          }, 300);
        }
      }, 2000);
      
      return api; // Allow chaining
    },
    remove: () => {
      if (progressContainer.parentNode) {
        progressContainer.parentNode.removeChild(progressContainer);
      }
      return api; // Allow chaining
    },
    addLogEntry: (message) => {
      // Simple implementation - just log to console
      console.log("[SG AutoJoin]", message);
      return api; // Allow chaining
    }
  };
  
  return api;
}

// Add highlighting for giveaways ending soon
export function highlightEndingSoonGiveaways() {
  if (!State.isSortByEndingSoonEnabled()) return;
  
  const giveaways = document.querySelectorAll('.giveaway__row-outer-wrap');
  giveaways.forEach(giveaway => {
    const minutesRemaining = extractEndTime(giveaway);
    if (minutesRemaining !== null && minutesRemaining <= State.getEndingSoonThreshold()) {
      // Add ending soon highlight
      const highlight = document.createElement('div');
      highlight.className = 'sg-ending-soon-highlight';
      
      const timeLeft = formatRemainingTime(minutesRemaining);
      highlight.innerHTML = `<i class="fas fa-clock"></i> Ends in ${timeLeft}`;
      
      // Add color based on urgency
      if (minutesRemaining <= 10) {
        highlight.classList.add('sg-urgent');
      } else if (minutesRemaining <= 30) {
        highlight.classList.add('sg-soon');
      }
      
      // Find a good place to insert it
      const heading = giveaway.querySelector('.giveaway__heading');
      if (heading) {
        heading.appendChild(highlight);
      }
    }
  });
}

// Format remaining time in a human-readable way
function formatRemainingTime(minutes) {
  if (minutes < 60) {
    return `${minutes} min`;
  } else {
    const hours = Math.floor(minutes / 60);
    const remainingMins = minutes % 60;
    return `${hours}h ${remainingMins}m`;
  }
}

// Show entry statistics for giveaways
export function showEntryStats() {
  const giveaways = document.querySelectorAll('.giveaway__row-outer-wrap');
  giveaways.forEach(giveaway => {
    const entryCount = extractEntryCount(giveaway);
    const cost = extractCost(giveaway);
    
    if (entryCount !== null && cost !== null && cost > 0) {
      // Calculate entries per point (lower is better odds)
      const ratio = entryCount / cost;
      
      // Create stats element
      const statsEl = document.createElement('div');
      statsEl.className = 'sg-entry-stats';
      
      // Determine chance rating (lower ratio = better chance)
      let chanceClass = 'sg-chance-good';
      let chanceText = 'Good odds';
      
      if (ratio > 20) {
        chanceClass = 'sg-chance-poor';
        chanceText = 'Poor odds';
      } else if (ratio > 10) {
        chanceClass = 'sg-chance-fair';
        chanceText = 'Fair odds';
      }
      
      statsEl.innerHTML = `
        <div class="sg-entry-ratio ${chanceClass}" title="${entryCount} entries for ${cost}P">
          <i class="fas fa-users"></i> ${Math.round(ratio * 10) / 10}/P
          <span class="sg-chance-indicator">${chanceText}</span>
        </div>
      `;
      
      // Find location to insert stats
      const links = giveaway.querySelector('.giveaway__links');
      if (links) {
        links.parentNode.insertBefore(statsEl, links.nextSibling);
      }
    }
  });
}

/**
 * Hide ads and clean up the SteamGifts UI
 */
export function cleanupSteamGiftsUI() {
  // Create a function to handle DOM mutations and hide new ads
  function hideAds() {
    // Hide sidebar and featured ads
    const adSelectors = [
      // Sidebar ads
      '#sidebar__mpu-container',
      '#mys-wrapper',
      '.sidebar__mpu',
      // Featured content - remove completely
      '.featured__container',
      // Featured content ads (fallback for partial removal)
      '.featured__container .featured__inner-wrap a[href*="redirect"]',
      '.featured__container .featured__inner-wrap a[href*="humble"]',
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
    
    // Remove redirect links
    document.querySelectorAll('a[href*="steamgifts.com/redirect"]').forEach(link => {
      // Try to extract the actual destination URL
      const href = link.getAttribute('href');
      if (href) {
        const match = href.match(/url=([^&]+)/);
        if (match && match[1]) {
          try {
            // Decode the URL and set it directly
            const actualUrl = decodeURIComponent(match[1]);
            link.setAttribute('href', actualUrl);
            link.setAttribute('target', '_blank');
            link.setAttribute('rel', 'noopener');
            link.classList.add('sg-direct-link');
          } catch (e) {
            console.warn('[SG AutoJoin] Error decoding redirect URL:', e);
          }
        }
      }
    });
  }
  
  // Hide ads immediately
  hideAds();
  
  // Set up a MutationObserver to watch for new ads
  if (!window.sgAdObserver) {
    window.sgAdObserver = new MutationObserver((mutations) => {
      hideAds();
    });
    
    // Start observing the entire document
    window.sgAdObserver.observe(document.body, {
      childList: true,
      subtree: true
    });
    
    console.log('[SG AutoJoin] Ad blocker initialized and watching for new ads');
  }
  
  // Add styles to clean up the UI
  const cleanupStyles = document.createElement('style');
  cleanupStyles.id = 'sg-cleanup-styles';
  cleanupStyles.textContent = `
    /* Hide ad containers */
    .sg-removed-ad,
    #sidebar__mpu-container,
    #mys-wrapper,
    .sidebar__mpu,
    .leaderboard__container,
    .fwbrg,
    div[id*="amazon-native"],
    ins.adsbygoogle,
    div[class*="adsbygoogle"],
    div[style*="height:250px"],
    div[style*="height: 250px"],
    div[style*="width:300px"],
    div[style*="width: 300px"] {
      display: none !important;
      visibility: hidden !important;
      height: 0 !important;
      width: 0 !important;
      opacity: 0 !important;
      overflow: hidden !important;
      position: absolute !important;
      z-index: -999 !important;
      pointer-events: none !important;
    }
    
    /* Clean up layout after removing ads */
    .page__outer-wrap {
      display: flex;
      flex-direction: column;
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 20px;
    }
    
    .page__inner-wrap {
      width: 100% !important;
      display: flex;
      flex-direction: row;
      gap: 20px;
    }
    
    .page__heading {
      margin-bottom: 20px !important;
      border-bottom: 1px solid var(--sg-light-gray) !important;
      padding-bottom: 10px !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
    }
    
    /* Enhanced giveaway styling */
    .giveaway__row-outer-wrap {
      transition: transform 0.2s ease, box-shadow 0.2s ease !important;
      margin-bottom: 15px !important;
      border-radius: var(--sg-radius) !important;
      overflow: hidden !important;
      box-shadow: var(--sg-shadow) !important;
    }
    
    .giveaway__row-outer-wrap:hover {
      transform: translateY(-3px) !important;
      box-shadow: var(--sg-shadow-md) !important;
    }
    
    .giveaway__row-inner-wrap {
      padding: 16px !important;
      display: flex !important;
      flex-direction: row !important;
      align-items: center !important;
      gap: 15px !important;
    }
    
    .giveaway__heading__name {
      text-decoration: none !important;
      color: var(--sg-primary) !important;
      font-weight: 600 !important;
      font-size: 16px !important;
      line-height: 1.3 !important;
      transition: color 0.15s ease !important;
    }
    
    .giveaway__heading__name:hover {
      color: var(--sg-primary-dark) !important;
      text-decoration: underline !important;
    }
    
    .giveaway_image_avatar,
    .giveaway_image_thumbnail {
      border-radius: var(--sg-radius) !important;
      transition: all 0.2s ease !important;
      box-shadow: var(--sg-shadow-sm) !important;
    }
    
    .giveaway_image_avatar:hover,
    .giveaway_image_thumbnail:hover {
      transform: scale(1.05) !important;
      box-shadow: var(--sg-shadow) !important;
    }
    
    /* Improve the comment sections */
    .comment__parent {
      border-radius: var(--sg-radius) !important;
      box-shadow: var(--sg-shadow) !important;
      margin-bottom: 15px !important;
      padding: 15px !important;
      border: 1px solid var(--sg-light-gray) !important;
    }
    
    .comment__child {
      margin-left: 25px !important;
      border-left: 3px solid var(--sg-light-gray) !important;
      padding-left: 15px !important;
      margin-top: 10px !important;
    }
    
    .comment__username {
      font-weight: 600 !important;
      color: var(--sg-primary) !important;
      text-decoration: none !important;
    }
    
    .comment__username:hover {
      text-decoration: underline !important;
    }
    
    .comment__description {
      margin-top: 8px !important;
      line-height: 1.5 !important;
    }
    
    /* Improve navigation */
    .nav__button-container {
      padding: 10px 0 !important;
    }
    
    .nav__button {
      padding: 8px 12px !important;
      border-radius: var(--sg-radius) !important;
      transition: all 0.2s ease !important;
      font-weight: 500 !important;
    }
    
    .nav__button:hover {
      background-color: rgba(0, 0, 0, 0.05) !important;
    }
    
    .nav__button-container.is-selected .nav__button {
      background-color: var(--sg-primary) !important;
      color: white !important;
    }
    
    .nav__button-container.is-selected .nav__button:hover {
      background-color: var(--sg-primary-dark) !important;
    }
    
    /* Make direct links stand out */
    .sg-direct-link {
      text-decoration: none !important;
      color: var(--sg-primary) !important;
      transition: color 0.2s ease !important;
    }
    
    .sg-direct-link:hover {
      color: var(--sg-primary-dark) !important;
      text-decoration: underline !important;
    }
    
    /* Clean up sidebar */
    .sidebar {
      flex: 0 0 260px !important;
      margin-left: 20px !important;
    }
    
    .sidebar__heading {
      font-size: 16px !important;
      font-weight: 600 !important;
      padding: 12px !important;
      border-bottom: 1px solid var(--sg-light-gray) !important;
      background-color: var(--sg-primary) !important;
      color: white !important;
      border-radius: var(--sg-radius) var(--sg-radius) 0 0 !important;
    }
    
    .sidebar__navigation {
      border-radius: var(--sg-radius) !important;
      overflow: hidden !important;
      box-shadow: var(--sg-shadow) !important;
      margin-bottom: 20px !important;
      border: 1px solid var(--sg-light-gray) !important;
    }
    
    .sidebar__navigation__item {
      padding: 10px 15px !important;
      border-bottom: 1px solid var(--sg-light-gray) !important;
      transition: background-color 0.15s ease !important;
    }
    
    .sidebar__navigation__item:hover {
      background-color: rgba(0, 0, 0, 0.03) !important;
    }
    
    .sidebar__navigation__item__name {
      font-weight: 500 !important;
    }
    
    .sidebar__navigation__item__count {
      padding: 2px 8px !important;
      border-radius: 12px !important;
      background-color: var(--sg-primary-light) !important;
      color: var(--sg-primary) !important;
      font-weight: 600 !important;
      font-size: 12px !important;
    }
    
    /* Improve pagination */
    .pagination {
      display: flex !important;
      justify-content: center !important;
      margin: 25px 0 !important;
      gap: 5px !important;
    }
    
    .pagination__navigation {
      border-radius: var(--sg-radius) !important;
      padding: 8px 12px !important;
      transition: all 0.2s ease !important;
      border: 1px solid var(--sg-light-gray) !important;
      background-color: var(--sg-white) !important;
      box-shadow: var(--sg-shadow-sm) !important;
    }
    
    .pagination__navigation:hover {
      background-color: var(--sg-light-gray) !important;
      transform: translateY(-2px) !important;
      box-shadow: var(--sg-shadow) !important;
    }
    
    .pagination__navigation--selected {
      background-color: var(--sg-primary) !important;
      color: white !important;
      border-color: var(--sg-primary) !important;
    }
    
    /* Improve buttons and form elements */
    .form__submit-button {
      padding: 8px 16px !important;
      border-radius: var(--sg-radius) !important;
      transition: all 0.2s ease !important;
      border: none !important;
      background-color: var(--sg-primary) !important;
      color: white !important;
      font-weight: 600 !important;
      cursor: pointer !important;
      box-shadow: var(--sg-shadow-sm) !important;
    }
    
    .form__submit-button:hover {
      background-color: var(--sg-primary-dark) !important;
      transform: translateY(-2px) !important;
      box-shadow: var(--sg-shadow) !important;
    }
    
    .form__input-small, 
    .form__input-medium, 
    .form__input-large {
      border-radius: var(--sg-radius) !important;
      border: 1px solid var(--sg-light-gray) !important;
      padding: 8px 12px !important;
      transition: all 0.2s ease !important;
    }
    
    .form__input-small:focus, 
    .form__input-medium:focus, 
    .form__input-large:focus {
      border-color: var(--sg-primary) !important;
      box-shadow: 0 0 0 3px var(--sg-primary-light) !important;
      outline: none !important;
    }
    
    /* Add more space to main content */
    .widget-container > .page__heading + .page__heading {
      margin-top: 25px !important;
    }
    
    /* Enhanced featured section */
    .featured__container {
      margin-bottom: 25px !important;
      border-radius: var(--sg-radius) !important;
      overflow: hidden !important;
      box-shadow: var(--sg-shadow) !important;
    }
    
    .featured__heading {
      background-color: var(--sg-primary) !important;
      color: white !important;
      padding: 12px 15px !important;
      font-weight: 600 !important;
      font-size: 16px !important;
    }
    
    .featured__outer-wrap {
      border: 1px solid var(--sg-light-gray) !important;
      border-top: none !important;
    }
    
    /* Improve tables */
    .table {
      border-radius: var(--sg-radius) !important;
      overflow: hidden !important;
      box-shadow: var(--sg-shadow) !important;
      border: 1px solid var(--sg-light-gray) !important;
      margin-bottom: 25px !important;
    }
    
    .table__column--width-small,
    .table__column--width-medium,
    .table__column--width-fill {
      padding: 12px 15px !important;
    }
    
    .table__heading {
      background-color: var(--sg-primary) !important;
      color: white !important;
      font-weight: 600 !important;
    }
    
    .table__rows .table__row-outer-wrap:nth-child(odd) {
      background-color: rgba(0, 0, 0, 0.02) !important;
    }
    
    .table__row-outer-wrap:hover {
      background-color: rgba(0, 0, 0, 0.05) !important;
    }
  `;
  
  // Add cleanup styles to the document
  if (!document.getElementById('sg-cleanup-styles')) {
    document.head.appendChild(cleanupStyles);
  }
}

// Inject required CSS styles for visual elements
export function injectStyles() {
  // Check if styles are already injected
  if (document.getElementById('sg-autojoin-styles')) return;
  
  // First, clean up SteamGifts UI by removing ads
  cleanupSteamGiftsUI();
  
  const styleEl = document.createElement('style');
  styleEl.id = 'sg-autojoin-styles';
  styleEl.textContent = `
    /* SteamGifts AutoJoin Modern UI */
    
    /* Make theme transition smooth */
    body {
      transition: background-color var(--theme-transition, 0.5s ease),
                  color var(--theme-transition, 0.5s ease);
    }
    
    * {
      transition: background-color var(--theme-transition, 0.5s ease),
                  color var(--theme-transition, 0.5s ease),
                  border-color var(--theme-transition, 0.5s ease);
    }
    
    /* Theme variables */
    :root {
      --sg-primary: #145d7e;
      --sg-primary-light: rgba(20, 93, 126, 0.1);
      --sg-primary-transparent: rgba(20, 93, 126, 0.85);
      --sg-secondary: #546e7a;
      --sg-success: #43a047;
      --sg-success-light: rgba(67, 160, 71, 0.1);
      --sg-danger: #e53935;
      --sg-danger-light: rgba(229, 57, 53, 0.1);
      --sg-warning: #fb8c00;
      --sg-warning-light: rgba(251, 140, 0, 0.1);
      --sg-info: #039be5;
      --sg-info-light: rgba(3, 155, 229, 0.1);
      --sg-dark: #263238;
      --sg-light-gray: #eceff1;
      --sg-medium-gray: #b0bec5;
      --sg-gray: #546e7a;
      --sg-white: #ffffff;
      --sg-background: #f5f7f9;
      --sg-font-family: 'Open Sans', -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      --sg-radius: 6px;
      --sg-radius-sm: 4px;
      --sg-radius-lg: 10px;
      --sg-radius-pill: 50px;
      --sg-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
      --sg-shadow-md: 0 4px 12px rgba(0, 0, 0, 0.12);
      --sg-shadow-lg: 0 8px 24px rgba(0, 0, 0, 0.15);
      --sg-transition: 0.25s cubic-bezier(0.4, 0, 0.2, 1);
    }

    /* Global styles to improve SteamGifts integration */
    .giveaway__row-outer-wrap {
      margin-bottom: 12px !important;
      border-radius: var(--sg-radius) !important;
      overflow: hidden !important;
      transition: transform var(--sg-transition), box-shadow var(--sg-transition) !important;
      box-shadow: var(--sg-shadow) !important;
      border: none !important;
    }
    
    .giveaway__row-outer-wrap:hover {
      transform: translateY(-2px) !important;
      box-shadow: var(--sg-shadow-md) !important;
    }
    
    .giveaway__row-inner-wrap {
      padding: 16px !important;
      border: none !important;
      border-radius: var(--sg-radius) !important;
      position: relative !important;
    }
    
    .giveaway__heading {
      display: flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      margin-bottom: 8px !important;
    }
    
    .giveaway__heading__name {
      font-size: 16px !important;
      font-weight: 600 !important;
      line-height: 1.3 !important;
      color: var(--sg-primary) !important;
      text-decoration: none !important;
      transition: color 0.2s ease !important;
    }
    
    .giveaway__heading__name:hover {
      color: #0d3e54 !important;
      text-decoration: underline !important;
    }
    
    .giveaway__heading__thin {
      font-size: 12px !important;
      background-color: var(--sg-light-gray) !important;
      color: var(--sg-gray) !important;
      border-radius: var(--sg-radius-pill) !important;
      padding: 2px 8px !important;
      margin-left: 8px !important;
      font-weight: 600 !important;
    }
    
    .giveaway__columns {
      display: flex !important;
      align-items: center !important;
      flex-wrap: wrap !important;
      font-size: 13px !important;
      gap: 12px !important;
      margin-bottom: 8px !important;
      color: var(--sg-gray) !important;
    }
    
    .giveaway__column--contributor-level {
      background-color: var(--sg-success-light) !important;
      color: var(--sg-success) !important;
      padding: 1px 8px !important;
      border-radius: var(--sg-radius-pill) !important;
      font-size: 12px !important;
      font-weight: 600 !important;
    }
    
    .giveaway__icon {
      color: var(--sg-gray) !important;
      transition: color 0.2s ease !important;
      margin: 0 5px !important;
    }
    
    .giveaway__icon:hover {
      color: var(--sg-primary) !important;
    }
    
    .giveaway__links {
      display: flex !important;
      gap: 10px !important;
      font-size: 12px !important;
    }
    
    .giveaway__links a {
      color: var(--sg-gray) !important;
      transition: color 0.2s ease !important;
    }
    
    .giveaway__links a:hover {
      color: var(--sg-primary) !important;
      text-decoration: underline !important;
    }
    
    .giveaway_image_thumbnail {
      border-radius: var(--sg-radius-sm) !important;
      box-shadow: var(--sg-shadow) !important;
      transition: opacity 0.2s ease !important;
    }
    
    .giveaway_image_thumbnail:hover {
      opacity: 0.9 !important;
    }
    
    .giveaway_image_avatar {
      border-radius: 50% !important;
      box-shadow: var(--sg-shadow) !important;
      transition: transform 0.2s ease !important;
    }
    
    .giveaway_image_avatar:hover {
      transform: scale(1.05) !important;
    }
    
    /* Quick filter bar */
    .sg-quick-filter-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: var(--sg-white);
      padding: 12px 18px;
      margin-bottom: 20px;
      border-radius: var(--sg-radius);
      box-shadow: var(--sg-shadow);
      border: 1px solid var(--sg-light-gray);
      position: sticky;
      top: 0;
      z-index: 100;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
    }
    
    .sg-quick-filter-section {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    
    .sg-quick-filter-label {
      font-weight: 600;
      color: var(--sg-dark);
      margin-right: 5px;
      font-size: 13px;
    }
    
    .sg-quick-filter {
      background-color: var(--sg-white);
      border: 1px solid var(--sg-light-gray);
      border-radius: var(--sg-radius-pill);
      padding: 6px 12px;
      font-size: 13px;
      font-weight: 500;
      cursor: pointer;
      transition: all var(--sg-transition);
      color: var(--sg-gray);
      box-shadow: 0 1px 2px rgba(0,0,0,0.05);
    }
    
    .sg-quick-filter:hover {
      border-color: var(--sg-primary);
      color: var(--sg-primary);
      box-shadow: 0 2px 5px rgba(0,0,0,0.08);
    }
    
    .sg-quick-filter.active {
      background-color: var(--sg-primary);
      color: var(--sg-white);
      border-color: var(--sg-primary);
      box-shadow: 0 2px 5px rgba(20,93,126,0.3);
    }
    
    .sg-quick-filter.sg-accent {
      background-color: var(--sg-success);
      color: var(--sg-white);
      border-color: var(--sg-success);
      box-shadow: 0 2px 5px rgba(67,160,71,0.3);
      font-weight: 600;
    }
    
    .sg-quick-filter.sg-accent:hover {
      background-color: #37833a;
      border-color: #37833a;
      box-shadow: 0 3px 8px rgba(67,160,71,0.4);
      transform: translateY(-1px);
    }
    
    .sg-quick-filter.sg-accent.active {
      background-color: var(--sg-danger);
      border-color: var(--sg-danger);
      box-shadow: 0 2px 5px rgba(229,57,53,0.3);
    }
    
    /* Toast container */
    .sg-toast-container {
      position: fixed;
      bottom: 1.5rem;
      right: 1.5rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.75rem;
      max-width: 350px;
    }
    
    /* Toast notification */
    .sg-toast {
      min-width: 280px;
      padding: 14px 16px;
      color: var(--sg-white);
      background-color: var(--sg-primary-transparent);
      border-radius: var(--sg-radius);
      box-shadow: var(--sg-shadow-md);
      display: flex;
      align-items: flex-start;
      animation: sg-slide-in-right 0.3s cubic-bezier(0.21, 1.02, 0.73, 1) forwards;
      position: relative;
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border-left: 4px solid var(--sg-primary);
    }
    
    .sg-toast-success { 
      background-color: rgba(67, 160, 71, 0.85); 
      border-left-color: var(--sg-success);
    }
    
    .sg-toast-error { 
      background-color: rgba(229, 57, 53, 0.85); 
      border-left-color: var(--sg-danger);
    }
    
    .sg-toast-warning { 
      background-color: rgba(251, 140, 0, 0.85); 
      color: var(--sg-white); 
      border-left-color: var(--sg-warning);
    }
    
    .sg-toast-info { 
      background-color: rgba(3, 155, 229, 0.85); 
      border-left-color: var(--sg-info);
    }
    
    .sg-toast-icon {
      margin-right: 0.75rem;
      font-size: 1.25rem;
    }
    
    .sg-toast-content {
      flex: 1;
    }

    .sg-toast-title {
      font-weight: 600;
      margin-bottom: 4px;
      font-size: 14px;
    }
    
    .sg-toast-message {
      font-size: 13px;
      opacity: 0.9;
    }
    
    .sg-toast-close {
      background: transparent;
      border: none;
      color: inherit;
      opacity: 0.7;
      cursor: pointer;
      padding: 0;
      font-size: 1rem;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-left: 0.75rem;
      transition: opacity 0.2s ease;
    }
    
    .sg-toast-close:hover {
      opacity: 1;
    }
    
    .sg-toast-progress {
      height: 3px;
      background-color: rgba(255, 255, 255, 0.2);
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      border-radius: 0 0 var(--sg-radius) var(--sg-radius);
      overflow: hidden;
    }
    
    .sg-toast-progress-bar {
      height: 100%;
      background-color: rgba(255, 255, 255, 0.4);
      width: 100%;
      animation: sg-toast-progress 5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
      border-radius: inherit;
    }
    
    /* Entry stats styling */
    .sg-entry-stats {
      margin-top: 8px;
      display: flex;
      align-items: center;
      font-size: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .sg-entry-ratio {
      padding: 3px 8px;
      border-radius: var(--sg-radius-pill);
      display: inline-flex;
      align-items: center;
      font-weight: 500;
      letter-spacing: 0.3px;
    }
    
    .sg-entry-ratio i {
      margin-right: 5px;
    }
    
    .sg-chance-indicator {
      margin-left: 6px;
      font-size: 11px;
      padding: 2px 6px;
      border-radius: var(--sg-radius-pill);
      font-weight: 600;
    }
    
    .sg-chance-good {
      background-color: var(--sg-success-light);
      color: var(--sg-success);
    }
    
    .sg-chance-good .sg-chance-indicator {
      background-color: var(--sg-success);
      color: white;
    }
    
    .sg-chance-fair {
      background-color: var(--sg-warning-light);
      color: var(--sg-warning);
    }
    
    .sg-chance-fair .sg-chance-indicator {
      background-color: var(--sg-warning);
      color: white;
    }
    
    .sg-chance-poor {
      background-color: var(--sg-danger-light);
      color: var(--sg-danger);
    }
    
    .sg-chance-poor .sg-chance-indicator {
      background-color: var(--sg-danger);
      color: white;
    }
    
    /* Ending soon highlight */
    .sg-ending-soon-highlight {
      display: inline-flex;
      align-items: center;
      margin-left: 8px;
      padding: 3px 8px;
      border-radius: var(--sg-radius-pill);
      font-size: 12px;
      font-weight: 500;
      background-color: var(--sg-info-light);
      color: var(--sg-info);
    }
    
    .sg-ending-soon-highlight i {
      margin-right: 5px;
    }
    
    .sg-ending-soon-highlight.sg-soon {
      background-color: var(--sg-warning-light);
      color: var(--sg-warning);
    }
    
    .sg-ending-soon-highlight.sg-urgent {
      background-color: var(--sg-danger-light);
      color: var(--sg-danger);
      animation: sg-pulse 1.5s infinite;
    }
    
    /* Stats Panel Styles */
    .sg-stats-panel {
      width: 100%;
      background-color: var(--sg-white);
      border-radius: var(--sg-radius);
      margin-bottom: 0;
      margin-top: 0;
      box-shadow: var(--sg-shadow);
      border: 1px solid var(--sg-light-gray);
      overflow: hidden;
      position: relative;
      z-index: 95;
    }
    
    .sg-stats-header {
      padding: 14px 18px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      color: var(--sg-white);
      background-color: var(--sg-primary);
      border-bottom: 1px solid rgba(0, 0, 0, 0.1);
      font-size: 14px;
    }
    
    .sg-stats-header-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    
    .sg-theme-button,
    .sg-stats-toggle {
      background: none;
      border: none;
      color: var(--sg-white);
      cursor: pointer;
      padding: 6px;
      border-radius: var(--sg-radius-sm);
      transition: all 0.2s ease;
    }
    
    .sg-theme-button:hover,
    .sg-stats-toggle:hover {
      background-color: rgba(255, 255, 255, 0.15);
      color: var(--sg-white);
    }
    
    .sg-stats-content {
      padding: 16px;
      background-color: var(--sg-white);
    }
    
    /* Enhanced stats dashboard */
    .stats-dashboard {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    
    .stat-dashboard-card {
      background-color: var(--sg-white);
      border-radius: var(--sg-radius-md);
      box-shadow: var(--sg-shadow);
      padding: 20px;
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
      border: 1px solid rgba(0,0,0,0.05);
      overflow: hidden;
      position: relative;
    }
    
    .stat-dashboard-card:hover {
      transform: translateY(-5px);
      box-shadow: var(--sg-shadow-md);
    }
    
    .stat-dashboard-icon {
      font-size: 22px;
      margin-bottom: 10px;
      color: var(--sg-primary);
      background-color: var(--sg-primary-light);
      width: 50px;
      height: 50px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      opacity: 0.9;
    }
    
    .stat-dashboard-value {
      font-size: 28px;
      font-weight: 700;
      color: var(--sg-primary);
      margin: 5px 0;
      line-height: 1.2;
    }
    
    .stat-dashboard-label {
      color: var(--sg-gray);
      font-size: 14px;
      font-weight: 500;
      margin-top: 5px;
    }
    
    .stat-dashboard-trend {
      display: flex;
      align-items: center;
      font-size: 12px;
      margin-top: 12px;
      padding: 4px 8px;
      border-radius: var(--sg-radius-pill);
      font-weight: 500;
    }
    
    .stat-trend-up {
      color: var(--sg-success);
      background-color: var(--sg-success-light);
    }
    
    .stat-trend-down {
      color: var(--sg-danger);
      background-color: var(--sg-danger-light);
    }
    
    .stat-trend-neutral {
      color: var(--sg-gray);
      background-color: var(--sg-light-gray);
    }
    
    .stat-dashboard-trend i {
      margin-right: 3px;
    }
    
    /* Theme selector */
    .theme-selector {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      margin-top: 16px;
      padding: 16px;
      background-color: var(--sg-light-gray);
      border-radius: var(--sg-radius);
      justify-content: center;
    }
    
    .theme-option {
      width: 36px;
      height: 36px;
      border-radius: 50%;
      cursor: pointer;
      position: relative;
      box-shadow: var(--sg-shadow-sm);
      transition: transform 0.2s ease, box-shadow 0.2s ease;
      border: 2px solid transparent;
    }
    
    .theme-option:hover {
      transform: scale(1.1);
      box-shadow: var(--sg-shadow-md);
    }
    
    .theme-option.active {
      border-color: var(--sg-white);
      box-shadow: 0 0 0 2px var(--sg-primary);
    }
    
    .theme-default {
      background: linear-gradient(135deg, #1C769E 0%, #348FBD 100%);
    }
    
    .theme-dark {
      background: linear-gradient(135deg, #121212 0%, #3498DB 100%);
    }
    
    .theme-steam {
      background: linear-gradient(135deg, #1b2838 0%, #66C0F4 100%);
    }
    
    .theme-mint {
      background: linear-gradient(135deg, #00BFA5 0%, #64FFDA 100%);
    }
    
    .theme-contrast {
      background: linear-gradient(135deg, #000000 0%, #0066CC 100%);
    }
    
    /* Original stats grid (now below the dashboard) */
    .sg-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 16px;
    }
    
    .sg-stat-item {
      text-align: center;
      padding: 14px;
      background-color: var(--sg-white);
      border-radius: var(--sg-radius);
      box-shadow: var(--sg-shadow);
      transition: all var(--sg-transition);
      border: 1px solid var(--sg-light-gray);
    }
    
    .sg-stat-item:hover {
      transform: translateY(-3px);
      box-shadow: var(--sg-shadow-md);
      border-color: var(--sg-primary-light);
    }
    
    .sg-stat-value {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--sg-primary);
      margin-bottom: 8px;
      line-height: 1;
    }
    
    .sg-stat-label {
      font-size: 13px;
      color: var(--sg-gray);
      font-weight: 500;
    }

    /* Join button styling */
    .${Selectors.manualJoinButtonClass} {
      position: absolute !important;
      right: 12px !important;
      top: 12px !important;
      z-index: 5 !important;
      font-size: 13px !important;
      font-weight: 600 !important;
      padding: 6px 12px !important;
      border-radius: var(--sg-radius-pill) !important;
      transition: all var(--sg-transition) !important;
      border: none !important;
      letter-spacing: 0.3px !important;
      box-shadow: var(--sg-shadow) !important;
      display: flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-width: 110px !important;
      font-family: var(--sg-font-family) !important;
    }

    .${Selectors.manualJoinButtonClass} i {
      margin-right: 5px !important;
    }

    .${Selectors.manualJoinButtonClass}.sg-btn-primary {
      background-color: var(--sg-primary) !important;
      color: var(--sg-white) !important;
    }

    .${Selectors.manualJoinButtonClass}.sg-btn-primary:hover {
      background-color: #0d4d68 !important;
      box-shadow: 0 3px 8px rgba(20,93,126,0.3) !important;
      transform: translateY(-1px) !important;
    }

    .${Selectors.manualJoinButtonClass}.sg-btn-success {
      background-color: var(--sg-success) !important;
      color: var(--sg-white) !important;
    }

    .${Selectors.manualJoinButtonClass}.sg-btn-danger {
      background-color: var(--sg-danger) !important;
      color: var(--sg-white) !important;
    }

    .${Selectors.manualJoinButtonClass}.sg-btn-warning {
      background-color: var(--sg-warning) !important;
      color: var(--sg-white) !important;
    }

    .${Selectors.manualJoinButtonClass}.sg-btn-secondary {
      background-color: var(--sg-light-gray) !important;
      color: var(--sg-gray) !important;
    }

    .${Selectors.manualJoinButtonClass}.disabled,
    .${Selectors.manualJoinButtonClass}:disabled {
      opacity: 0.6 !important;
      cursor: not-allowed !important;
      transform: none !important;
      box-shadow: none !important;
    }

    .${Selectors.manualJoinButtonClass}.sg-btn-loading {
      opacity: 0.8 !important;
    }
    
    /* Giveaway visual feedback */
    .sg-giveaway-success {
      box-shadow: 0 0 0 2px var(--sg-success) !important;
    }
    
    .sg-giveaway-error {
      box-shadow: 0 0 0 2px var(--sg-danger) !important;
    }
    
    .sg-giveaway-loading {
      box-shadow: 0 0 0 2px var(--sg-info) !important;
      opacity: 0.9 !important;
    }
    
    .sg-giveaway-feedback {
      position: absolute;
      top: 8px;
      right: 130px;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: var(--sg-white);
      font-size: 14px;
      z-index: 10;
      box-shadow: var(--sg-shadow-md);
    }
    
    .sg-giveaway-feedback-success {
      background-color: var(--sg-success);
    }
    
    .sg-giveaway-feedback-error {
      background-color: var(--sg-danger);
    }
    
    .sg-giveaway-feedback-loading {
      background-color: var(--sg-info);
    }
    
    /* Progress indicator */
    .sg-progress-container {
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      display: flex;
      align-items: center;
      justify-content: center;
      background-color: rgba(38, 50, 56, 0.7);
      z-index: 10000;
      opacity: 1;
      transition: opacity 0.3s cubic-bezier(0.4, 0, 0.2, 1);
      backdrop-filter: blur(3px);
      -webkit-backdrop-filter: blur(3px);
    }
    
    .sg-progress-content {
      background-color: var(--sg-white);
      border-radius: var(--sg-radius-lg);
      padding: 24px;
      width: 90%;
      max-width: 440px;
      text-align: center;
      box-shadow: var(--sg-shadow-lg);
      animation: sg-scale-in 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
    
    .sg-progress-spinner {
      font-size: 2.5rem;
      color: var(--sg-primary);
      margin-bottom: 1.25rem;
    }
    
    .sg-progress-message {
      margin-bottom: 1.25rem;
      font-weight: 500;
      font-size: 16px;
      color: var(--sg-dark);
    }
    
    .sg-progress-bar {
      height: 8px;
      background-color: var(--sg-light-gray);
      border-radius: var(--sg-radius-pill);
      overflow: hidden;
    }
    
    .sg-progress-bar-inner {
      height: 100%;
      background-color: var(--sg-primary);
      width: 0%;
      transition: width 0.5s cubic-bezier(0.16, 1, 0.3, 1);
      border-radius: inherit;
    }
    
    /* Status indicator */
    #${Selectors.statusIndicatorId} {
      position: fixed;
      bottom: 1.5rem;
      left: 1.5rem;
      z-index: 9998;
      background-color: var(--sg-white);
      border-radius: var(--sg-radius);
      box-shadow: var(--sg-shadow-md);
      padding: 10px 14px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 13px;
      font-weight: 500;
      color: var(--sg-dark);
      border: 1px solid var(--sg-light-gray);
      transition: all var(--sg-transition);
      cursor: pointer;
    }

    #${Selectors.statusIndicatorId}:hover {
      transform: translateY(-3px);
      box-shadow: var(--sg-shadow-lg);
    }

    #${Selectors.statusIndicatorId} .status-badge {
      width: 10px;
      height: 10px;
      border-radius: 50%;
      background-color: var(--sg-medium-gray);
    }

    #${Selectors.statusIndicatorId} .status-badge.active {
      background-color: var(--sg-success);
    }

    #${Selectors.statusIndicatorId} .status-badge.auto {
      background-color: var(--sg-primary);
    }
    
    /* Additional animations */
    @keyframes sg-slide-in-right {
      from { transform: translateX(25px); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes sg-scale-in {
      from { transform: scale(0.9); opacity: 0; }
      to { transform: scale(1); opacity: 1; }
    }
    
    @keyframes sg-toast-progress {
      from { width: 100%; }
      to { width: 0%; }
    }
    
    @keyframes sg-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.05); }
      100% { transform: scale(1); }
    }

    @keyframes sg-fade-in {
      from { opacity: 0; }
      to { opacity: 1; }
    }

    .sg-fade-in {
      animation: sg-fade-in 0.3s ease forwards;
    }
    
    /* Responsive adjustments */
    @media (max-width: 768px) {
      .sg-quick-filter-bar {
        flex-direction: column;
        gap: 10px;
        align-items: stretch;
      }
      
      .sg-quick-filter-section {
        justify-content: center;
      }
      
      .${Selectors.manualJoinButtonClass} {
        position: relative !important;
        right: auto !important;
        top: auto !important;
        margin-top: 8px !important;
        width: 100% !important;
      }
      
      .sg-giveaway-feedback {
        top: 8px;
        right: 8px;
      }
      
      .sg-toast-container {
        left: 1rem;
        right: 1rem;
        max-width: none;
      }
      
      /* Enhanced mobile responsiveness */
      .stats-dashboard {
        grid-template-columns: 1fr;
      }
      
      .sg-stats-grid {
        grid-template-columns: 1fr 1fr;
      }
      
      .theme-selector {
        justify-content: space-around;
        padding: 10px;
      }
      
      .theme-option {
        width: 32px;
        height: 32px;
      }
      
      .stat-dashboard-icon {
        width: 45px;
        height: 45px;
        font-size: 18px;
      }
      
      .stat-dashboard-value {
        font-size: 24px;
      }
      
      .giveaway__row-inner-wrap {
        padding: 12px !important;
      }
      
      .giveaway__heading {
        flex-direction: column;
        align-items: flex-start !important;
      }
      
      .giveaway__heading__thin {
        margin-left: 0 !important;
        margin-top: 5px !important;
      }
    }
  `;
  
  document.head.appendChild(styleEl);

  // Load Font Awesome if not already loaded
  if (!document.querySelector('link[href*="fontawesome"]')) {
    const fontAwesome = document.createElement('link');
    fontAwesome.rel = 'stylesheet';
    fontAwesome.href = 'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/5.15.4/css/all.min.css';
    document.head.appendChild(fontAwesome);
  }
}