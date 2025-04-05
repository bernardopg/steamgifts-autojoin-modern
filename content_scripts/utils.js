import * as Selectors from './selectors.js';
import * as State from './state.js';

export function getCurrentPoints() {
  const localPoints = State.getPointsAtStart();
  if (localPoints !== null && localPoints !== -1) { return localPoints; }
  const pointsElement = document.querySelector(Selectors.pointsSelector);
  if (pointsElement?.textContent) {
    const pointsText = pointsElement.textContent.replace(/[^0-9]/g, "");
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
  return {
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
    },
    remove: () => {
      if (progressContainer.parentNode) {
        progressContainer.parentNode.removeChild(progressContainer);
      }
    }
  };
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

// Inject required CSS styles for visual elements
export function injectStyles() {
  // Check if styles are already injected
  if (document.getElementById('sg-autojoin-styles')) return;
  
  const styleEl = document.createElement('style');
  styleEl.id = 'sg-autojoin-styles';
  styleEl.textContent = `
    /* Quick filter bar */
    .sg-quick-filter-bar {
      display: flex;
      align-items: center;
      justify-content: space-between;
      background-color: #f0f2f5;
      padding: 10px 15px;
      margin-bottom: 15px;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
    }
    
    .sg-quick-filter-section {
      display: flex;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    
    .sg-quick-filter-label {
      font-weight: 600;
      color: #707475;
      margin-right: 5px;
    }
    
    .sg-quick-filter {
      background-color: white;
      border: 1px solid #E5E5E5;
      border-radius: 4px;
      padding: 5px 10px;
      font-size: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
      color: #707475;
    }
    
    .sg-quick-filter:hover {
      border-color: #1C769E;
      color: #1C769E;
    }
    
    .sg-quick-filter.active {
      background-color: #1C769E;
      color: white;
      border-color: #1C769E;
    }
    
    .sg-quick-filter.sg-accent {
      background-color: #5AB55A;
      color: white;
      border-color: #5AB55A;
    }
    
    .sg-quick-filter.sg-accent:hover {
      background-color: #4ca04c;
      border-color: #4ca04c;
    }
    
    .sg-quick-filter.sg-accent.active {
      background-color: #E25353;
      border-color: #E25353;
    }
    
    /* Theme variables */
    :root {
      --sg-primary: #1C769E;
      --sg-primary-light: rgba(28, 118, 158, 0.1);
      --sg-secondary: #707475;
      --sg-success: #5AB55A;
      --sg-success-light: rgba(90, 181, 90, 0.1);
      --sg-danger: #E25353;
      --sg-danger-light: rgba(226, 83, 83, 0.1);
      --sg-warning: #F5A623;
      --sg-warning-light: rgba(245, 166, 35, 0.1);
      --sg-info: #3498DB;
      --sg-info-light: rgba(52, 152, 219, 0.1);
      --sg-dark: #333333;
      --sg-light-gray: #E5E5E5;
      --sg-medium-gray: #A4A6A8;
      --sg-gray: #707475;
      --sg-white: #FFFFFF;
      --sg-background: #F4F4F4;
      --sg-font-family: 'Open Sans', Arial, sans-serif;
      --sg-radius: 4px;
      --sg-radius-sm: 2px;
      --sg-radius-lg: 8px;
      --sg-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
      --sg-shadow-md: 0 4px 8px rgba(0, 0, 0, 0.1);
      --sg-shadow-lg: 0 8px 16px rgba(0, 0, 0, 0.1);
      --sg-transition: 0.2s ease;
    }
    
    /* Toast container */
    .sg-toast-container {
      position: fixed;
      top: 1rem;
      right: 1rem;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 0.5rem;
    }
    
    /* Entry stats styling */
    .sg-entry-stats {
      margin-top: 0.5rem;
      display: flex;
      align-items: center;
      font-size: 0.85rem;
    }
    
    .sg-entry-ratio {
      padding: 2px 6px;
      border-radius: 3px;
      display: inline-flex;
      align-items: center;
      margin-right: 0.75rem;
      color: var(--sg-dark);
      background: var(--sg-light-gray);
    }
    
    .sg-entry-ratio i {
      margin-right: 0.25rem;
    }
    
    .sg-chance-indicator {
      margin-left: 0.5rem;
      font-size: 0.75rem;
      padding: 0 0.35rem;
      border-radius: 2px;
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
      color: var(--sg-dark);
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
      margin-left: 0.75rem;
      padding: 2px 6px;
      border-radius: 3px;
      font-size: 0.8rem;
      background-color: var(--sg-info-light);
      color: var(--sg-info);
    }
    
    .sg-ending-soon-highlight i {
      margin-right: 0.35rem;
    }
    
    .sg-ending-soon-highlight.sg-soon {
      background-color: var(--sg-warning-light);
      color: var(--sg-warning);
    }
    
    .sg-ending-soon-highlight.sg-urgent {
      background-color: var(--sg-danger-light);
      color: var(--sg-danger);
      animation: sg-pulse 1s infinite;
    }
    
    /* Stats Panel Styles */
    .sg-stats-panel {
      width: 100%;
      background-color: #f8f9fa;
      border-bottom: 1px solid #e5e5e5;
      margin-bottom: 15px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    
    .sg-stats-header {
      padding: 10px 15px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
      color: #1C769E;
      background-color: #edf4f7;
      border-bottom: 1px solid #dce7ec;
    }
    
    .sg-stats-toggle {
      background: none;
      border: none;
      color: #1C769E;
      cursor: pointer;
      padding: 5px;
    }
    
    .sg-stats-toggle:hover {
      color: #0f5a7a;
    }
    
    .sg-stats-content {
      padding: 15px;
    }
    
    .sg-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
      gap: 15px;
    }
    
    .sg-stat-item {
      text-align: center;
      padding: 10px;
      background-color: white;
      border-radius: 4px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      transition: all 0.2s ease;
    }
    
    .sg-stat-item:hover {
      transform: translateY(-2px);
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
    }
    
    .sg-stat-value {
      font-size: 1.5rem;
      font-weight: 600;
      color: #1C769E;
      margin-bottom: 5px;
    }
    
    .sg-stat-label {
      font-size: 0.8rem;
      color: #707475;
    }
    
    /* Toast notification */
    .sg-toast {
      min-width: 250px;
      padding: 1rem;
      color: #fff;
      background-color: #333;
      border-radius: 4px;
      box-shadow: 0 2px 10px rgba(0,0,0,0.2);
      display: flex;
      align-items: flex-start;
      animation: sg-slide-in-right 0.3s forwards;
      position: relative;
    }
    
    .sg-toast-success { background-color: #5AB55A; }
    .sg-toast-error { background-color: #E25353; }
    .sg-toast-warning { background-color: #F5A623; color: #333; }
    .sg-toast-info { background-color: #3498DB; }
    
    .sg-toast-icon {
      margin-right: 0.75rem;
      font-size: 1.25rem;
    }
    
    .sg-toast-content {
      flex: 1;
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
    }
    
    .sg-toast-close:hover {
      opacity: 1;
    }
    
    .sg-toast-progress {
      height: 4px;
      background-color: rgba(255, 255, 255, 0.3);
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
      border-radius: 0 0 4px 4px;
    }
    
    .sg-toast-progress-bar {
      height: 100%;
      background-color: rgba(255, 255, 255, 0.7);
      width: 100%;
      animation: sg-toast-progress 5s linear forwards;
    }
    
    /* Giveaway visual feedback */
    .sg-giveaway-success {
      box-shadow: 0 0 0 2px rgba(90, 181, 90, 0.5) !important;
    }
    
    .sg-giveaway-error {
      box-shadow: 0 0 0 2px rgba(226, 83, 83, 0.5) !important;
    }
    
    .sg-giveaway-loading {
      box-shadow: 0 0 0 2px rgba(52, 152, 219, 0.5) !important;
      opacity: 0.8;
    }
    
    .sg-giveaway-feedback {
      position: absolute;
      top: 0.5rem;
      right: 0.5rem;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
      color: white;
      font-size: 12px;
      z-index: 10;
    }
    
    .sg-giveaway-feedback-success {
      background-color: #5AB55A;
    }
    
    .sg-giveaway-feedback-error {
      background-color: #E25353;
    }
    
    .sg-giveaway-feedback-loading {
      background-color: #3498DB;
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
      background-color: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      opacity: 1;
      transition: opacity 0.3s ease;
    }
    
    .sg-progress-content {
      background-color: white;
      border-radius: 8px;
      padding: 1.5rem;
      width: 80%;
      max-width: 400px;
      text-align: center;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    }
    
    .sg-progress-spinner {
      font-size: 2rem;
      color: #1C769E;
      margin-bottom: 1rem;
    }
    
    .sg-progress-message {
      margin-bottom: 1rem;
      font-weight: 500;
    }
    
    .sg-progress-bar {
      height: 8px;
      background-color: #E5E5E5;
      border-radius: 4px;
      overflow: hidden;
    }
    
    .sg-progress-bar-inner {
      height: 100%;
      background-color: #1C769E;
      width: 0%;
      transition: width 0.3s ease;
    }
    
    /* Animations */
    @keyframes sg-slide-in-right {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes sg-toast-progress {
      from { width: 100%; }
      to { width: 0%; }
    }
    
    @keyframes sg-pulse {
      0% { transform: scale(1); }
      50% { transform: scale(1.02); }
      100% { transform: scale(1); }
    }
  `;
  
  document.head.appendChild(styleEl);
}