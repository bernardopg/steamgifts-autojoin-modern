import { SELECTORS } from './selectors.js';
import * as State from './state.js';
import * as Utils from './utils.js';
import { updateStatsPanel } from './ui.js';

// Constants for HTTP request handling
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY = 3000; // 3 seconds
const TRANSIENT_ERROR_CODES = [408, 429, 500, 502, 503, 504]; // Status codes to retry

// Track stats for the current session
let sessionStats = {
  // Join statistics
  joined: 0,
  failed: 0,
  skipped: 0,
  
  // Point statistics
  pointsSpent: 0,
  pointsSaved: 0, // Points preserved due to settings
  costs: [],
  
  // Filtering statistics
  wishlistJoined: 0,
  skipReasons: {
    notEnoughPoints: 0,
    levelTooHigh: 0,
    levelTooLow: 0,
    entryLimited: 0,
    groupGiveaway: 0,
    blacklisted: 0,
    owned: 0,
    alreadyEntered: 0
  },
  
  // Time data
  startTime: Date.now(),
  lastJoinTime: null
};

/**
 * Attempt to join a giveaway via AJAX
 * @param {string} code - Giveaway code
 * @param {number} cost - Giveaway point cost
 * @param {HTMLElement} giveawayElement - The giveaway DOM element
 * @param {HTMLElement} buttonElement - Optional button element (for manual joins)
 * @returns {Promise<boolean>} - Success status
 */
export async function attemptAjaxJoin(code, cost, giveawayElement, buttonElement = null) {
  // Ensure styles are injected
  Utils.injectStyles();
  
  const currentToken = State.getXsrfToken();
  if (!currentToken) { 
    console.error("  -> Cannot attempt join: XSRF token missing in state."); 
    showJoinFeedback(giveawayElement, false, "Missing security token");
    
    // Show toast notification
    Utils.showToast("Missing security token for join request", "error");
    return false; 
  }

  const joinType = buttonElement ? "MANUAL" : "AUTO";
  console.log(`  -> ${joinType} Attempting AJAX join for code: ${code} (Cost: ${cost}P)`);

  // Update button UI for manual joins
  if (buttonElement) {
    buttonElement.disabled = true;
    buttonElement.classList.add("disabled");
    buttonElement.classList.add("sg-btn-loading");
    buttonElement.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Joining...';
  }

  // Add loading feedback to the giveaway
  const loadingFeedback = Utils.addVisualFeedbackToGiveaway(giveawayElement, 'loading');

  // Prepare form data
  const formData = new URLSearchParams();
  formData.append("xsrf_token", currentToken);
  formData.append("do", "entry_insert");
  formData.append("code", code);

  let success = false;
  let errorMessage = "Unknown Error";
  let alreadyEntered = false;

  try {
    let response, result;
    let retryCount = 0;
    let shouldRetry = false;
    
    // Retry loop for transient errors
    do {
      if (retryCount > 0) {
        const waitTime = RETRY_DELAY * retryCount;
        console.log(`  -> Retry attempt ${retryCount}/${MAX_RETRY_ATTEMPTS} after ${waitTime/1000}s delay...`);
        
        // Show retry feedback
        if (buttonElement) {
          buttonElement.innerHTML = `<i class="fas fa-sync fa-spin"></i> Retry ${retryCount}/${MAX_RETRY_ATTEMPTS}...`;
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, waitTime));
      }
      
      try {
        response = await fetch("/ajax.php", { 
          method: "POST", 
          headers: { 
            "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", 
            "X-Requested-With": "XMLHttpRequest" 
          }, 
          body: formData,
          // Add timeout to prevent hanging requests
          signal: AbortSignal.timeout(10000) // 10 second timeout
        });
        
        result = await response.json();
        console.log("  -> AJAX Response:", result);
        
        // Determine if we should retry based on status code
        shouldRetry = TRANSIENT_ERROR_CODES.includes(response.status);
        
        // If we got a valid response, don't retry
        if (response.ok) {
          shouldRetry = false;
        }
      } catch (fetchError) {
        console.error(`  -> Fetch error (attempt ${retryCount + 1}/${MAX_RETRY_ATTEMPTS + 1}):`, fetchError);
        
        // Determine if error is retryable (network errors usually are)
        shouldRetry = fetchError.name !== 'AbortError' && // Don't retry timeouts
                      (fetchError instanceof TypeError || // Network errors are usually TypeError
                       fetchError.message.includes('network') ||
                       fetchError.message.includes('connection'));
        
        // Create a placeholder result
        result = { type: "error", msg: fetchError.message };
      }
      
      retryCount++;
    } while (shouldRetry && retryCount <= MAX_RETRY_ATTEMPTS);
    
    // Log if we exhausted retries
    if (shouldRetry && retryCount > MAX_RETRY_ATTEMPTS) {
      console.error(`  -> Exhausted ${MAX_RETRY_ATTEMPTS} retry attempts`);
    }

    // Handle response status
    if (!response.ok) {
      console.error(`  -> AJAX Error: ${response.status} ${response.statusText}`);
      errorMessage = result?.msg || `HTTP Error ${response.status}`;
      success = false;
    } else if (result.type === "success") {
      console.log("  -> AJAX Success!");
      success = true;
      
      // Update session stats
      sessionStats.joined++;
      sessionStats.pointsSpent += cost;
      sessionStats.costs.push(cost);
      
      // Track statistics for this join
      Utils.trackJoinedGiveaway(giveawayElement, cost, true);
      
      // Send message to service worker
      try {
        chrome.runtime.sendMessage({ action: "incrementJoinCount" });
      } catch (e) {
        console.warn("Could not send increment message to SW", e);
      }

      // Update local points counter
      const currentPoints = State.getPointsAtStart();
      if (currentPoints !== null && currentPoints !== -1 && cost !== null) {
        State.setPointsAtStart(currentPoints - cost);
        console.log(`  -> Locally updated points estimate: ${State.getPointsAtStart()}P`);
      }
      
      // Update points display on page
      const pointsDisplay = document.querySelector(SELECTORS.NAV.POINTS);
      if (pointsDisplay && State.getPointsAtStart() !== null && State.getPointsAtStart() !== -1) {
        Utils.updateWithFadeAnimation(pointsDisplay, `${State.getPointsAtStart()}P`);
      }
      
      // Show toast notification
      const gameTitle = giveawayElement.querySelector(SELECTORS.LIST_VIEW.GIVEAWAY_LINK)?.textContent?.trim() || 'Giveaway';
      Utils.showToast(`Successfully joined: ${gameTitle} (${cost}P)`, "success");
      
      // Update the stats panel with new join information
      updateStatsPanel();
    } else {
      console.warn(`  -> AJAX Non-Success. Type: ${result.type}. Msg: ${result.msg || 'N/A'}`);
      errorMessage = result?.msg || `Unknown non-success (${result.type})`;
      success = false;
      
      // Check if already entered
      if (result?.msg?.toLowerCase().includes("already entered")) {
        alreadyEntered = true;
      } else {
        sessionStats.failed++;
        
        // Show toast for errors
        const gameTitle = giveawayElement.querySelector(SELECTORS.LIST_VIEW.GIVEAWAY_LINK)?.textContent?.trim() || 'Giveaway';
        Utils.showToast(`Failed to join ${gameTitle}: ${errorMessage}`, "error");
      }
    }

    // Update UI based on result
    if (success || alreadyEntered) {
      // Remove loading feedback
      if (loadingFeedback && loadingFeedback.parentNode) {
        loadingFeedback.parentNode.removeChild(loadingFeedback);
      }
      
      // Mark giveaway as joined
      giveawayElement.classList.add(SELECTORS.LIST_VIEW.ALREADY_JOINED_CLASS);
      giveawayElement.parentElement?.classList.add(SELECTORS.LIST_VIEW.ALREADY_JOINED_CLASS);
      
      // Add success feedback
      Utils.addVisualFeedbackToGiveaway(giveawayElement, 'success');
      
      // Update button if present
      if (buttonElement) {
        buttonElement.classList.remove("sg-btn-loading");
        buttonElement.classList.remove("sg-btn-primary", "sg-btn-success", "sg-btn-danger");
        buttonElement.classList.add("sg-btn-secondary");
        
        // Different icon/text for success vs already joined
        if (success) {
          buttonElement.innerHTML = '<i class="fas fa-check"></i> Joined';
          buttonElement.classList.add("sg-btn-success");
        } else {
          buttonElement.innerHTML = '<i class="fas fa-ban"></i> Entered';
        }
        
        // Fade out button
        setTimeout(() => {
          buttonElement.style.opacity = '0.7';
          buttonElement.style.transition = 'opacity 0.5s ease';
          setTimeout(() => { 
            buttonElement.style.display = 'none';
          }, 1500);
        }, 1000);
      }
    } else {
      // Remove loading feedback
      if (loadingFeedback && loadingFeedback.parentNode) {
        loadingFeedback.parentNode.removeChild(loadingFeedback);
      }
      
      // Add error feedback
      Utils.addVisualFeedbackToGiveaway(giveawayElement, 'error');
      
      if (buttonElement) {
        buttonElement.disabled = false;
        buttonElement.classList.remove("disabled", "sg-btn-loading");
        
        // Customize error message based on error type
        let btnErrorText = '<i class="fas fa-exclamation-triangle"></i> Error';
        let btnClass = "sg-btn-danger";
        
        if (errorMessage.toLowerCase().includes('insufficient points')) { 
          btnErrorText = '<i class="fas fa-coins"></i> Not enough points'; 
          btnClass = "sg-btn-warning";
        }
        else if (errorMessage.toLowerCase().includes('ended') || errorMessage.toLowerCase().includes('exist')) { 
          btnErrorText = '<i class="fas fa-times-circle"></i> Ended'; 
        }
        
        // Update button style
        buttonElement.classList.remove("sg-btn-primary", "sg-btn-success", "sg-btn-secondary", "sg-btn-warning", "sg-btn-danger");
        buttonElement.classList.add(btnClass);
        buttonElement.innerHTML = btnErrorText;
        buttonElement.title = errorMessage;
        
        // Reset button after delay
        setTimeout(() => {
          buttonElement.classList.remove("sg-btn-danger", "sg-btn-warning");
          buttonElement.classList.add("sg-btn-primary");
          buttonElement.innerHTML = `<i class="fas fa-plus-circle"></i> Join (${cost}P)`;
          buttonElement.title = `Manually join this ${cost}P giveaway`;
        }, 3000);
      }
    }

    // Update points from response if available
    if (typeof result?.points === 'number') {
      console.log("  -> Points updated from AJAX response:", result.points);
      State.setPointsAtStart(result.points);
      const pointsDisplay = document.querySelector(SELECTORS.NAV.POINTS);
      if (pointsDisplay) {
        Utils.updateWithFadeAnimation(pointsDisplay, `${result.points}P`);
      }
    }
    
    // Check for possible CAPTCHA requirement
    if (result?.msg?.toLowerCase().includes('captcha') || result?.msg?.toLowerCase().includes('verify')) {
      console.warn("  -> CAPTCHA or verification may be required!");
      Utils.showToast(
        "Action Required|CAPTCHA or verification may be needed. Please check SteamGifts manually.", 
        "warning", 
        10000
      );
      
      // Pause auto-joining if active
      if (State.isAutoModeEnabled()) {
        console.warn("  -> Pausing auto-join due to potential CAPTCHA requirement");
        State.setAutoModeEnabled(false);
        
        // Show prominent notification
        Utils.showToast(
          "Auto-Join Paused|Auto-joining has been paused because a CAPTCHA check may be required. Please visit SteamGifts manually to continue.", 
          "error", 
          0 // No auto-close
        );
      }
    }

  } catch (error) {
    console.error("  -> Error during fetch request:", error);
    errorMessage = "Network/Fetch Error";
    sessionStats.failed++;
    
    // Remove loading feedback
    if (loadingFeedback && loadingFeedback.parentNode) {
      loadingFeedback.parentNode.removeChild(loadingFeedback);
    }
    
    // Add error feedback
    Utils.addVisualFeedbackToGiveaway(giveawayElement, 'error');
    
    // Show toast for network errors
    Utils.showToast("Network error while joining giveaway", "error");
    
    if (buttonElement) {
      buttonElement.disabled = false;
      buttonElement.classList.remove("disabled", "sg-btn-loading");
      buttonElement.classList.remove("sg-btn-primary", "sg-btn-success", "sg-btn-secondary");
      buttonElement.classList.add("sg-btn-danger");
      buttonElement.innerHTML = '<i class="fas fa-exclamation-triangle"></i> Error';
      buttonElement.title = errorMessage;
      
      // Reset button after delay
      setTimeout(() => {
        buttonElement.classList.remove("sg-btn-danger");
        buttonElement.classList.add("sg-btn-primary");
        buttonElement.innerHTML = `<i class="fas fa-plus-circle"></i> Join (${cost}P)`;
        buttonElement.title = `Manually join this ${cost}P giveaway`;
      }, 3000);
    }
    
    success = false;
  } finally {
    // Ensure button is properly reset if needed
    if (buttonElement && !success && !alreadyEntered && buttonElement.style.display !== 'none') {
      buttonElement.disabled = false;
      buttonElement.classList.remove("disabled", "sg-btn-loading");
      
      if (!buttonElement.innerHTML.includes('Error') && 
          !buttonElement.innerHTML.includes('Not enough points') && 
          !buttonElement.innerHTML.includes('Ended')) {
        buttonElement.classList.remove("sg-btn-danger", "sg-btn-warning", "sg-btn-secondary");
        buttonElement.classList.add("sg-btn-primary");
        buttonElement.innerHTML = `<i class="fas fa-plus-circle"></i> Join (${cost}P)`;
        buttonElement.title = `Manually join this ${cost}P giveaway`;
      }
    }
  }
  
  return success;
}

/**
 * Get join statistics for the current session
 * @returns {Object} Stats object
 */
export function getSessionStats() {
  return { ...sessionStats };
}

/**
 * Reset session statistics
 */
export function resetSessionStats() {
  sessionStats = {
    // Join statistics
    joined: 0,
    failed: 0,
    skipped: 0,
    
    // Point statistics
    pointsSpent: 0,
    pointsSaved: 0,
    costs: [],
    
    // Filtering statistics
    wishlistJoined: 0,
    skipReasons: {
      notEnoughPoints: 0,
      levelTooHigh: 0,
      levelTooLow: 0,
      entryLimited: 0,
      groupGiveaway: 0,
      blacklisted: 0,
      owned: 0,
      alreadyEntered: 0
    },
    
    // Time data
    startTime: Date.now(),
    lastJoinTime: null
  };
}

/**
 * Show session statistics in a toast notification
 */
export function showSessionStats() {
  // Calculate average cost if any giveaways were joined
  const avgCost = sessionStats.joined > 0 
    ? Math.round((sessionStats.pointsSpent / sessionStats.joined) * 10) / 10 
    : 0;
  
  // Calculate session duration
  const sessionDuration = Math.round((Date.now() - sessionStats.startTime) / 1000);
  const minutes = Math.floor(sessionDuration / 60);
  const seconds = sessionDuration % 60;
  const durationText = `${minutes}m ${seconds}s`;
  
  // Calculate points per minute
  const pointsPerMinute = sessionDuration > 0 
    ? Math.round((sessionStats.pointsSpent / (sessionDuration / 60)) * 10) / 10 
    : 0;
  
  // Get the most common skip reason
  let topSkipReason = 'None';
  let topSkipCount = 0;
  
  Object.entries(sessionStats.skipReasons).forEach(([reason, count]) => {
    if (count > topSkipCount) {
      topSkipCount = count;
      topSkipReason = reason.replace(/([A-Z])/g, ' $1').toLowerCase();
      topSkipReason = topSkipReason.charAt(0).toUpperCase() + topSkipReason.slice(1); // Capitalize first letter
    }
  });
  
  // Create message
  const message = `
    <div class="sg-toast-title">Auto-Join Session Stats</div>
    <div class="sg-toast-message">
      <div class="sg-stats-row">
        <span class="sg-stats-label">Session Time:</span>
        <span class="sg-stats-value">${durationText}</span>
      </div>
      <div class="sg-stats-row">
        <span class="sg-stats-label">Joined:</span>
        <span class="sg-stats-value">${sessionStats.joined} giveaways (${sessionStats.pointsSpent}P)</span>
      </div>
      <div class="sg-stats-row">
        <span class="sg-stats-label">Failed/Skipped:</span>
        <span class="sg-stats-value">${sessionStats.failed} / ${sessionStats.skipped}</span>
      </div>
      <div class="sg-stats-row">
        <span class="sg-stats-label">Avg Cost:</span>
        <span class="sg-stats-value">${avgCost}P (${pointsPerMinute}P/min)</span>
      </div>
      ${sessionStats.wishlistJoined > 0 ? `
      <div class="sg-stats-row">
        <span class="sg-stats-label">Wishlist joined:</span>
        <span class="sg-stats-value">${sessionStats.wishlistJoined}</span>
      </div>` : ''}
      ${topSkipCount > 0 ? `
      <div class="sg-stats-row">
        <span class="sg-stats-label">Top skip reason:</span>
        <span class="sg-stats-value">${topSkipReason} (${topSkipCount})</span>
      </div>` : ''}
    </div>
  `;
  
  // Add CSS for stat rows
  const style = document.createElement('style');
  style.textContent = `
    .sg-stats-row {
      display: flex;
      justify-content: space-between;
      margin-bottom: 4px;
    }
    .sg-stats-label {
      font-weight: 500;
      color: rgba(255, 255, 255, 0.9);
    }
    .sg-stats-value {
      font-weight: 600;
    }
  `;
  
  if (!document.getElementById('sg-stats-style')) {
    style.id = 'sg-stats-style';
    document.head.appendChild(style);
  }
  
  // Show toast with HTML content
  const container = document.getElementById('sg-toast-container') || document.createElement('div');
  if (!container.id) {
    container.id = 'sg-toast-container';
    container.className = 'sg-toast-container';
    document.body.appendChild(container);
  }
  
  const toast = document.createElement('div');
  toast.className = 'sg-toast sg-toast-info';
  toast.innerHTML = `
    <div class="sg-toast-icon">
      <i class="fas fa-chart-bar"></i>
    </div>
    <div class="sg-toast-content">
      ${message}
    </div>
    <div class="sg-toast-progress">
      <div class="sg-toast-progress-bar"></div>
    </div>
  `;
  
  container.appendChild(toast);
  
  // Add close button
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
  
  // Remove after longer delay (10s)
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 300);
  }, 10000);
}