import * as Selectors from './selectors.js';
import * as State from './state.js';
import * as Utils from './utils.js';

// Track stats for the current session
let sessionStats = {
  joined: 0,
  failed: 0,
  skipped: 0,
  pointsSpent: 0,
  costs: []
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
    const response = await fetch("/ajax.php", { 
      method: "POST", 
      headers: { 
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8", 
        "X-Requested-With": "XMLHttpRequest" 
      }, 
      body: formData 
    });
    
    const result = await response.json();
    console.log("  -> AJAX Response:", result);

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
      const pointsDisplay = document.querySelector(Selectors.pointsSelector);
      if (pointsDisplay && State.getPointsAtStart() !== null && State.getPointsAtStart() !== -1) {
        Utils.updateWithFadeAnimation(pointsDisplay, `${State.getPointsAtStart()}P`);
      }
      
      // Show toast notification
      const gameTitle = giveawayElement.querySelector(Selectors.listView_giveawayLinkSelector)?.textContent?.trim() || 'Giveaway';
      Utils.showToast(`Successfully joined: ${gameTitle} (${cost}P)`, "success");
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
        const gameTitle = giveawayElement.querySelector(Selectors.listView_giveawayLinkSelector)?.textContent?.trim() || 'Giveaway';
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
      giveawayElement.classList.add(Selectors.listView_alreadyJoinedClass);
      giveawayElement.parentElement?.classList.add(Selectors.listView_alreadyJoinedClass);
      
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
      const pointsDisplay = document.querySelector(Selectors.pointsSelector);
      if (pointsDisplay) {
        Utils.updateWithFadeAnimation(pointsDisplay, `${result.points}P`);
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
    joined: 0,
    failed: 0,
    skipped: 0,
    pointsSpent: 0,
    costs: []
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
  
  // Create message
  const message = `
    <div class="sg-toast-title">Auto-Join Session Stats</div>
    <div class="sg-toast-message">
      <div>Joined: ${sessionStats.joined} giveaways (${sessionStats.pointsSpent}P)</div>
      <div>Failed: ${sessionStats.failed}, Skipped: ${sessionStats.skipped}</div>
      <div>Avg Cost: ${avgCost}P</div>
    </div>
  `;
  
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