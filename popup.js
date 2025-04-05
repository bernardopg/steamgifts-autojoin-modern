import { showToast, setHighContrastMode, setLargeFontMode, setKeyboardFocusVisible } from './utils.js';

// Function to apply theme to document
function applyTheme(theme) {
  // Remove any existing theme
  document.body.removeAttribute('data-theme');
  document.body.classList.remove('sg-high-contrast');
  
  // Apply selected theme
  if (theme === 'contrast') {
    document.body.classList.add('sg-high-contrast');
  } else if (theme !== 'default') {
    document.body.setAttribute('data-theme', theme);
  }
}

// Elements
const enableSwitch = document.getElementById("enableSwitch");
const autoModeSwitch = document.getElementById("autoModeSwitch");
const statusIndicator = document.getElementById("statusIndicator");
const currentPointsSpan = document.getElementById("currentPoints");
const joinCountSpan = document.getElementById("joinCount");
const successRateValueSpan = document.getElementById("successRateValue");
const autoModeStatusSpan = document.getElementById("autoModeStatus");
const joinAllVisibleBtn = document.getElementById("joinAllVisibleBtn");
const refreshPageBtn = document.getElementById("refreshPageBtn");
const quickConfigBtn = document.getElementById("quickConfigBtn");
const statsBtn = document.getElementById("statsBtn");
const accessibilityBtn = document.getElementById("accessibilityBtn");
const helpBtn = document.getElementById("helpBtn");

// Panels
const quickSettingsPanel = document.getElementById("quickSettingsPanel");
const statsPanel = document.getElementById("statsPanel");
const accessibilityPanel = document.getElementById("accessibilityPanel");
const themePanel = document.createElement("div");
themePanel.id = "themePanel";
themePanel.className = "sg-card";
themePanel.style.display = "none";
themePanel.innerHTML = `
  <div class="sg-card-header">Theme Settings</div>
  <div class="sg-card-body">
    <div class="theme-selector">
      <div class="theme-option theme-default" data-theme="default" title="Default Theme"></div>
      <div class="theme-option theme-dark" data-theme="dark" title="Dark Theme"></div>
      <div class="theme-option theme-steam" data-theme="steam" title="Steam Theme"></div>
      <div class="theme-option theme-mint" data-theme="mint" title="Mint Theme"></div>
      <div class="theme-option theme-contrast" data-theme="contrast" title="High Contrast"></div>
    </div>
    <p class="sg-form-text sg-mt-2 sg-text-center">Select a theme to customize the appearance.</p>
  </div>
`;
document.body.appendChild(themePanel);

// Quick settings elements
const quickMaxCost = document.getElementById("quickMaxCost");
const quickMaxCostValue = document.getElementById("quickMaxCostValue");
const quickWishlistOnly = document.getElementById("quickWishlistOnly");
const quickSkipGroups = document.getElementById("quickSkipGroups");

// Statistics elements
const statTotalAttempts = document.getElementById("statTotalAttempts");
const statSuccessCount = document.getElementById("statSuccessCount");
const statPointsSpent = document.getElementById("statPointsSpent");
const statAvgCost = document.getElementById("statAvgCost");

// Accessibility elements
const highContrastMode = document.getElementById("highContrastMode");
const largeFontMode = document.getElementById("largeFontMode");
const keyboardFocusMode = document.getElementById("keyboardFocusMode");

// Theme button and theme options
const themeBtn = document.createElement("button");
themeBtn.id = "themeBtn";
themeBtn.className = "sg-btn sg-btn-sm sg-btn-outline";
themeBtn.title = "Theme settings";
themeBtn.innerHTML = '<i class="fa fa-palette"></i>';
document.querySelector('.footer-actions').appendChild(themeBtn);

// Add some spacing between buttons
document.querySelector('.footer-actions').style.gap = "10px";

const themeOptions = themePanel.querySelectorAll('.theme-option');

// Statistics tracking
let statistics = {
  totalAttempts: 0,
  successCount: 0,
  pointsSpent: 0,
  costHistory: []
};

// Update UI function
function updateStatusIndicator(enabled) {
  statusIndicator.textContent = enabled ? "Features ENABLED. Click 'Join All Visible' to start." : "Features DISABLED. Enable the switch to get started.";
  statusIndicator.classList.remove("sg-alert-success", "sg-alert-danger", "sg-alert-info", "sg-alert-warning");
  statusIndicator.classList.add(enabled ? "sg-alert-success" : "sg-alert-danger");
}

function updateAutoModeStatus(enabled) {
  autoModeSwitch.checked = enabled;
  autoModeStatusSpan.textContent = enabled ? "Active" : "Inactive";
  autoModeStatusSpan.className = enabled ? "sg-badge sg-badge-success sg-ml-1" : "sg-badge sg-badge-secondary sg-ml-1";
  
  if (enabled) {
    joinAllVisibleBtn.classList.add("pulse-animation");
  } else {
    joinAllVisibleBtn.classList.remove("pulse-animation");
  }
}

function updatePopupState(state) {
  if (state) {
    const pointsValue = (typeof state.points === 'number' && state.points !== -1) ? state.points : null;
    const joinValue = (typeof state.joinCount === 'number') ? state.joinCount : 0;
    
    currentPointsSpan.textContent = pointsValue !== null ? pointsValue.toString() : "-";
    joinCountSpan.textContent = joinValue;
    
    // Update success rate
    const successRate = (statistics.totalAttempts > 0) 
      ? Math.round((statistics.successCount / statistics.totalAttempts) * 100) 
      : 0;
    successRateValueSpan.textContent = `${successRate}%`;
    
    // Update status badge
    updateStatusBadge(state.status || "idle");
    
    // Update stats panel if visible
    if (statsPanel.style.display !== 'none') {
      updateStatsPanel();
    }
  } else {
    currentPointsSpan.textContent = "-";
    joinCountSpan.textContent = "-";
    successRateValueSpan.textContent = "-";
    updateStatusBadge("unknown");
  }
}

function updateStatsPanel() {
  statTotalAttempts.textContent = statistics.totalAttempts;
  statSuccessCount.textContent = `${statistics.successCount} (${statistics.totalAttempts > 0 ? Math.round((statistics.successCount / statistics.totalAttempts) * 100) : 0}%)`;
  statPointsSpent.textContent = `${statistics.pointsSpent.toString()}P`;
  
  const avgCost = statistics.costHistory.length > 0 
    ? Math.round(statistics.costHistory.reduce((a, b) => a + b, 0) / statistics.costHistory.length) 
    : 0;
  statAvgCost.textContent = `${avgCost.toString()}P`;
}

function fetchPopupState() {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id && tabs[0].url?.includes("steamgifts.com")) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "getPopupState" }, (response) => {
        if (chrome.runtime.lastError) {
          console.warn("Popup: Could not message content script for state.", chrome.runtime.lastError.message);
          updatePopupState(null);
          showToast("Could not connect to page", "error", { 
            title: "Connection Error" 
          });
        } else {
          updatePopupState(response);
        }
      });
    } else {
      updatePopupState(null);
      statusIndicator.textContent = "Not on SteamGifts.com. Please navigate there to use this extension.";
      statusIndicator.classList.remove("sg-alert-success", "sg-alert-danger", "sg-alert-info");
      statusIndicator.classList.add("sg-alert-warning");
      
      // Disable some buttons
      joinAllVisibleBtn.disabled = true;
      refreshPageBtn.disabled = true;
    }
  });
}

// Load settings and statistics
function loadSettings() {
  // Add status badge update
  function updateStatusBadge(status) {
    const statusBadge = document.getElementById("currentStatusBadge");
    if (!statusBadge) return;
    
    statusBadge.className = "sg-badge sg-ml-1";
    
    switch(status) {
      case "active":
        statusBadge.textContent = "Active";
        statusBadge.classList.add("sg-badge-success");
        break;
      case "idle":
        statusBadge.textContent = "Idle";
        statusBadge.classList.add("sg-badge-info");
        break;
      case "error":
        statusBadge.textContent = "Error";
        statusBadge.classList.add("sg-badge-danger");
        break;
      case "joining":
        statusBadge.textContent = "Joining";
        statusBadge.classList.add("sg-badge-warning");
        break;
      default:
        statusBadge.textContent = "Unknown";
        statusBadge.classList.add("sg-badge-secondary");
    }
  }

  chrome.storage.sync.get({
    "autoJoinEnabled": false,
    "autoModeEnabled": false,
    "maxCost": 100,
    "wishlistOnly": false,
    "skipGroups": false,
    "statistics": null,
    "accessibilityHighContrast": false,
    "accessibilityLargeFont": false,
    "accessibilityKeyboardFocus": false,
    "theme": "default"
  }, (data) => {
    if (chrome.runtime.lastError) {
      console.error("Error loading settings:", chrome.runtime.lastError.message);
      statusIndicator.textContent = "Error loading settings";
      statusIndicator.classList.add("sg-alert-warning");
      return;
    }
    
    // Apply main settings
    enableSwitch.checked = !!data.autoJoinEnabled;
    updateStatusIndicator(!!data.autoJoinEnabled);
    updateAutoModeStatus(!!data.autoModeEnabled);
    
    // Apply quick settings
    quickMaxCost.value = data.maxCost;
    quickMaxCostValue.textContent = `${data.maxCost}P`;
    quickWishlistOnly.checked = !!data.wishlistOnly;
    quickSkipGroups.checked = !!data.skipGroups;
    
    // Apply accessibility settings
    highContrastMode.checked = !!data.accessibilityHighContrast;
    largeFontMode.checked = !!data.accessibilityLargeFont;
    keyboardFocusMode.checked = !!data.accessibilityKeyboardFocus;
    
    // Apply theme
    applyTheme(data.theme || 'default');
    
    // Update active theme in theme selector
    themeOptions.forEach(option => {
      option.classList.remove('active');
      if (option.dataset.theme === data.theme) {
        option.classList.add('active');
      }
    });
    
    // Load statistics if available
    if (data.statistics) {
      statistics = data.statistics;
      updateStatsPanel();
    }
    
    fetchPopupState();
  });
}

// Toggle panel visibility
function togglePanel(panel) {
  const allPanels = [quickSettingsPanel, statsPanel, accessibilityPanel, themePanel];
  const isCurrentlyVisible = panel.style.display !== 'none';
  
  // Hide all panels
  allPanels.forEach(p => {
    p.style.display = 'none';
  });
  
  // If the clicked panel wasn't visible, show it
  if (!isCurrentlyVisible) {
    panel.style.display = 'block';
    
    // Update stats if that's the panel we're showing
    if (panel === statsPanel) {
      updateStatsPanel();
    }
  }
}

// Event listeners
document.addEventListener("DOMContentLoaded", loadSettings);

enableSwitch.addEventListener("change", () => {
  const isEnabled = enableSwitch.checked;
  chrome.storage.sync.set({ autoJoinEnabled: isEnabled }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving setting:", chrome.runtime.lastError.message);
      showToast("Error saving settings", "error");
    } else {
      updateStatusIndicator(isEnabled);
      showToast(isEnabled ? "Features enabled" : "Features disabled", isEnabled ? "success" : "info");
    }
  });
});

autoModeSwitch.addEventListener("change", () => {
  const isEnabled = autoModeSwitch.checked;
  chrome.storage.sync.set({ autoModeEnabled: isEnabled }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving auto mode setting:", chrome.runtime.lastError.message);
      showToast("Error saving auto mode", "error");
    } else {
      updateAutoModeStatus(isEnabled);
      showToast(
        isEnabled 
          ? "Auto-join mode activated. The extension will automatically join giveaways." 
          : "Auto-join mode deactivated", 
        isEnabled ? "success" : "info"
      );
    }
  });
});

joinAllVisibleBtn.addEventListener("click", () => {
  joinAllVisibleBtn.disabled = true;
  joinAllVisibleBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Joining...';
  
  // Update status badge
  updateStatusBadge("joining");
  
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id && tabs[0].url?.includes("steamgifts.com")) {
      chrome.tabs.sendMessage(tabs[0].id, { action: "joinAllVisible" }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending joinAllVisible:", chrome.runtime.lastError.message);
          showToast("Could not send command to page", "error", {
            title: "Connection Error"
          });
          updateStatusBadge("error");
        } else {
          console.log("Join All response:", response);
          
          // Update statistics if we received meaningful data
          if (response && response.status === "completed" && response.results) {
            const { joined, failed, skipped } = response.results;
            
            statistics.totalAttempts += (joined + failed);
            statistics.successCount += joined;
            statistics.pointsSpent += response.results.pointsSpent || 0;
            
            if (response.results.costs && response.results.costs.length > 0) {
              statistics.costHistory = [...statistics.costHistory, ...response.results.costs];
            }
            
            // Save updated statistics
            chrome.storage.sync.set({ statistics: statistics });
            
            // Show success toast
            showToast(
              `Joined: ${joined} | Failed: ${failed} | Skipped: ${skipped}`,
              joined > 0 ? "success" : "info",
              { title: "Join All Complete" }
            );
            
            // Reset status badge to previous state
            updateStatusBadge(State.isAutoModeEnabled() ? "active" : "idle");
          } else {
            updateStatusBadge("error");
          }
        }
        
        setTimeout(() => {
          joinAllVisibleBtn.disabled = false;
          joinAllVisibleBtn.innerHTML = '<i class="fa fa-bolt"></i> Join All Visible';
          fetchPopupState();
        }, 1000);
      });
    } else {
      showToast("Not on a SteamGifts page", "warning");
      joinAllVisibleBtn.disabled = false;
      joinAllVisibleBtn.innerHTML = '<i class="fa fa-bolt"></i> Join All Visible';
      updateStatusBadge("unknown");
    }
  });
});

refreshPageBtn.addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    if (tabs[0]?.id && tabs[0].url?.includes("steamgifts.com")) {
      chrome.tabs.reload(tabs[0].id);
    } else {
      showToast("Not on a SteamGifts page", "warning");
    }
  });
});

quickConfigBtn.addEventListener("click", () => {
  togglePanel(quickSettingsPanel);
});

statsBtn.addEventListener("click", () => {
  togglePanel(statsPanel);
});

accessibilityBtn.addEventListener("click", () => {
  togglePanel(accessibilityPanel);
});

themeBtn.addEventListener("click", () => {
  togglePanel(themePanel);
});

// Add theme option click handlers
themeOptions.forEach(option => {
  option.addEventListener('click', () => {
    const theme = option.dataset.theme;
    
    // Update active class
    themeOptions.forEach(opt => opt.classList.remove('active'));
    option.classList.add('active');
    
    // Apply and save theme
    applyTheme(theme);
    chrome.storage.sync.set({ theme });
    
    showToast(`${theme.charAt(0).toUpperCase() + theme.slice(1)} theme applied`, "success");
  });
});

helpBtn.addEventListener("click", () => {
  // Show help information
  chrome.tabs.create({
    url: "https://github.com/your-username/steamgifts-autojoin-modern/wiki"
  });
});

// Quick settings event listeners
quickMaxCost.addEventListener("input", () => {
  quickMaxCostValue.textContent = `${quickMaxCost.value}P`;
});

quickMaxCost.addEventListener("change", () => {
  const maxCostValue = parseInt(quickMaxCost.value, 10);
  chrome.storage.sync.set({ maxCost: maxCostValue }, () => {
    showToast(`Max cost set to ${maxCostValue}P`, "success");
  });
});

quickWishlistOnly.addEventListener("change", () => {
  const isEnabled = quickWishlistOnly.checked;
  chrome.storage.sync.set({ wishlistOnly: isEnabled }, () => {
    showToast(
      `Wishlist only mode ${isEnabled ? "enabled" : "disabled"}`,
      "info"
    );
  });
});

quickSkipGroups.addEventListener("change", () => {
  const isEnabled = quickSkipGroups.checked;
  chrome.storage.sync.set({ skipGroups: isEnabled }, () => {
    showToast(
      `Skip group giveaways ${isEnabled ? "enabled" : "disabled"}`,
      "info"
    );
  });
});

// Accessibility settings event listeners
highContrastMode.addEventListener("change", () => {
  setHighContrastMode(highContrastMode.checked);
});

largeFontMode.addEventListener("change", () => {
  setLargeFontMode(largeFontMode.checked);
});

keyboardFocusMode.addEventListener("change", () => {
  setKeyboardFocusVisible(keyboardFocusMode.checked);
});

// Keyboard shortcuts
document.addEventListener("keydown", (event) => {
  // 'S' key opens settings
  if (event.key === 's' || event.key === 'S') {
    window.open("options.html", "_blank");
  }
  
  // '?' opens help
  if (event.key === '?') {
    helpBtn.click();
  }
  
  // 'T' key opens theme panel
  if (event.key === 't' || event.key === 'T') {
    togglePanel(themePanel);
  }
  
  // Escape key closes all panels
  if (event.key === 'Escape') {
    const allPanels = [quickSettingsPanel, statsPanel, accessibilityPanel, themePanel];
    allPanels.forEach(p => {
      p.style.display = 'none';
    });
  }
});

// Listen for storage changes
chrome.storage.onChanged.addListener((changes, areaName) => {
  if (areaName === 'sync') {
    if (changes.autoModeEnabled) {
      updateAutoModeStatus(!!changes.autoModeEnabled.newValue);
    }
    if (changes.autoJoinEnabled) {
      updateStatusIndicator(!!changes.autoJoinEnabled.newValue);
      enableSwitch.checked = !!changes.autoJoinEnabled.newValue;
    }
    if (changes.theme) {
      applyTheme(changes.theme.newValue);
      
      // Update active state in theme selector
      themeOptions.forEach(option => {
        option.classList.remove('active');
        if (option.dataset.theme === changes.theme.newValue) {
          option.classList.add('active');
        }
      });
    }
  }
});
