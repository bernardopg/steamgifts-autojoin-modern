import * as Selectors from './selectors.js';
import * as State from './state.js';

function createIndicatorElement() {
  if (document.getElementById(Selectors.statusIndicatorId)) { return; }
  const pointsElement = document.querySelector(Selectors.pointsSelector);
  const targetLocation = pointsElement?.parentElement;
  if (targetLocation) {
    // Create container for all UI elements
    const container = document.createElement("div");
    container.style.display = "inline-flex";
    container.style.alignItems = "center";
    container.style.marginLeft = "10px";
    
    // Create main indicator
    const indicator = document.createElement("span");
    indicator.id = Selectors.statusIndicatorId;
    indicator.style.padding = "3px 8px";
    indicator.style.borderRadius = "4px";
    indicator.style.fontSize = "0.9em";
    indicator.style.fontWeight = "bold";
    indicator.style.color = "white";
    indicator.style.cursor = "pointer";
    indicator.textContent = "AutoJoin: Loading...";
    indicator.style.backgroundColor = "#888";
    indicator.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)";
    indicator.style.transition = "all 0.2s ease";
    
    // Toggle functionality
    indicator.addEventListener('click', () => {
      const newState = !State.isAutoJoinEnabled();
      chrome.storage.sync.set({ autoJoinEnabled: newState });
    });
    
    // Add hover effect
    indicator.addEventListener('mouseenter', () => {
      indicator.style.opacity = "0.9";
    });
    indicator.addEventListener('mouseleave', () => {
      indicator.style.opacity = "1";
    });
    
    // Create auto mode toggle
    const autoModeToggle = document.createElement("span");
    autoModeToggle.id = "sg-autojoin-auto-mode";
    autoModeToggle.style.padding = "3px 8px";
    autoModeToggle.style.borderRadius = "4px";
    autoModeToggle.style.fontSize = "0.9em";
    autoModeToggle.style.fontWeight = "bold";
    autoModeToggle.style.color = "white";
    autoModeToggle.style.cursor = "pointer";
    autoModeToggle.style.marginLeft = "5px";
    autoModeToggle.textContent = "Auto: OFF";
    autoModeToggle.style.backgroundColor = "#d9534f";
    autoModeToggle.style.boxShadow = "0 1px 3px rgba(0,0,0,0.2)";
    autoModeToggle.style.transition = "all 0.2s ease";
    autoModeToggle.title = "Toggle automatic joining mode";
    
    // Toggle auto mode functionality
    autoModeToggle.addEventListener('click', () => {
      const newState = !State.isAutoModeEnabled();
      chrome.storage.sync.set({ autoModeEnabled: newState });
    });
    
    // Add hover effect
    autoModeToggle.addEventListener('mouseenter', () => {
      autoModeToggle.style.opacity = "0.9";
    });
    autoModeToggle.addEventListener('mouseleave', () => {
      autoModeToggle.style.opacity = "1";
    });
    
    // Create settings button
    const settingsBtn = document.createElement("span");
    settingsBtn.style.marginLeft = "5px";
    settingsBtn.style.cursor = "pointer";
    settingsBtn.style.fontSize = "1em";
    settingsBtn.style.color = "#777";
    settingsBtn.innerHTML = '<i class="fa fa-cog"></i>';
    settingsBtn.title = "Open AutoJoin Settings";
    settingsBtn.style.transition = "all 0.2s ease";
    
    settingsBtn.addEventListener('click', () => {
      chrome.runtime.sendMessage({ action: "openOptionsPage" });
    });
    
    settingsBtn.addEventListener('mouseenter', () => {
      settingsBtn.style.color = "#5cb85c";
    });
    settingsBtn.addEventListener('mouseleave', () => {
      settingsBtn.style.color = "#777";
    });
    
    // Add elements to container
    container.appendChild(indicator);
    container.appendChild(autoModeToggle);
    container.appendChild(settingsBtn);
    
    targetLocation.appendChild(container);
    console.log("[SG AutoJoin] Status indicator created.");
    
    // Initialize auto mode toggle state
    chrome.storage.sync.get({ autoModeEnabled: false }, (data) => {
      updateAutoModeToggle(autoModeToggle, data.autoModeEnabled);
    });
  } else {
    console.warn("[SG AutoJoin] Could not find target location for status indicator (near points).");
  }
}

function updateAutoModeToggle(element, isEnabled) {
  if (!element) return;
  element.textContent = isEnabled ? "Auto: ON" : "Auto: OFF";
  element.style.backgroundColor = isEnabled ? "#5cb85c" : "#d9534f";
}

function setIndicatorState(element, isEnabled) {
  element.textContent = isEnabled ? "AutoJoin: ON" : "AutoJoin: OFF";
  element.style.backgroundColor = isEnabled ? "#5cb85c" : "#d9534f";
  element.title = isEnabled
    ? "SteamGifts AutoJoin features enabled."
    : "SteamGifts AutoJoin features disabled.";
}

export function updateIndicatorUI(isEnabled) {
  const indicator = document.getElementById(Selectors.statusIndicatorId);
  if (!indicator) {
    createIndicatorElement();
    const newIndicator = document.getElementById(Selectors.statusIndicatorId);
    if (!newIndicator) return;
    setIndicatorState(newIndicator, isEnabled);
  } else {
    setIndicatorState(indicator, isEnabled);
  }
  
  // Also update auto mode toggle if it exists
  const autoModeToggle = document.getElementById("sg-autojoin-auto-mode");
  if (autoModeToggle) {
    updateAutoModeToggle(autoModeToggle, State.isAutoModeEnabled());
  }
}

/**
 * Creates and injects a stats panel below the navbar
 */
export function createStatsPanel() {
  // Check if panel already exists
  if (document.getElementById('sg-autojoin-stats-panel')) return;
  
  // Find navbar to insert after
  const navbar = document.querySelector('.nav__button-container');
  if (!navbar) {
    console.warn("[SG AutoJoin] Could not find navbar to insert stats panel");
    return;
  }
  
  // Create stats panel container
  const statsPanel = document.createElement('div');
  statsPanel.id = 'sg-autojoin-stats-panel';
  statsPanel.className = 'sg-stats-panel';
  
  // Load stats data from storage
  chrome.storage.sync.get({
    totalJoins: 0,
    successfulJoins: 0,
    pointsSpent: 0,
    joinHistory: [],
    totalWins: 0,
    lastWin: null,
    todayJoins: 0,
    sessionPoints: 0
  }, (stats) => {
    // Parse data from user profile page if available
    const additionalStats = parseUserStats();
    
    // Calculate derived stats
    const successRate = stats.totalJoins > 0 
      ? Math.round((stats.successfulJoins / stats.totalJoins) * 100) 
      : 0;
    
    const averageCost = stats.successfulJoins > 0 
      ? Math.round(stats.pointsSpent / stats.successfulJoins) 
      : 0;
    
    // Today's joins count
    const today = new Date().setHours(0,0,0,0);
    const todayJoins = stats.joinHistory.filter(join => 
      new Date(join.date).setHours(0,0,0,0) === today
    ).length;
    
    // Build panel content
    statsPanel.innerHTML = `
      <div class="sg-stats-header">
        <i class="fa fa-chart-bar"></i> SteamGifts AutoJoin Stats
        <button class="sg-stats-toggle" title="Toggle stats panel">
          <i class="fa fa-chevron-up"></i>
        </button>
      </div>
      <div class="sg-stats-content">
        <div class="sg-stats-grid">
          <div class="sg-stat-item">
            <div class="sg-stat-value">${stats.totalJoins}</div>
            <div class="sg-stat-label">Total Joins</div>
          </div>
          <div class="sg-stat-item">
            <div class="sg-stat-value">${todayJoins}</div>
            <div class="sg-stat-label">Today's Joins</div>
          </div>
          <div class="sg-stat-item">
            <div class="sg-stat-value">${successRate}%</div>
            <div class="sg-stat-label">Success Rate</div>
          </div>
          <div class="sg-stat-item">
            <div class="sg-stat-value">${stats.pointsSpent}P</div>
            <div class="sg-stat-label">Points Spent</div>
          </div>
          <div class="sg-stat-item">
            <div class="sg-stat-value">${averageCost}P</div>
            <div class="sg-stat-label">Avg Cost</div>
          </div>
          <div class="sg-stat-item">
            <div class="sg-stat-value">${additionalStats.totalWins || 0}</div>
            <div class="sg-stat-label">Total Wins</div>
          </div>
          <div class="sg-stat-item">
            <div class="sg-stat-value">${additionalStats.contributorLevel || '-'}</div>
            <div class="sg-stat-label">Level</div>
          </div>
          <div class="sg-stat-item">
            <div class="sg-stat-value">${additionalStats.contributorValue || '-'}</div>
            <div class="sg-stat-label">CV</div>
          </div>
        </div>
      </div>
    `;
    
    // Insert after navbar
    navbar.parentNode.insertBefore(statsPanel, navbar.nextSibling);
    
    // Add toggle functionality
    const toggleBtn = statsPanel.querySelector('.sg-stats-toggle');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        const content = statsPanel.querySelector('.sg-stats-content');
        const isOpen = content.style.display !== 'none';
        
        // Toggle content
        content.style.display = isOpen ? 'none' : 'block';
        
        // Toggle icon
        toggleBtn.innerHTML = isOpen 
          ? '<i class="fa fa-chevron-down"></i>' 
          : '<i class="fa fa-chevron-up"></i>';
        
        // Save state
        chrome.storage.sync.set({ statsPanelOpen: !isOpen });
      });
      
      // Set initial state
      chrome.storage.sync.get({ statsPanelOpen: true }, (data) => {
        if (!data.statsPanelOpen) {
          toggleBtn.click();
        }
      });
    }
  });
}

/**
 * Parse user stats from profile page
 * @returns {Object} Stats extracted from user profile
 */
function parseUserStats() {
  const stats = {
    totalWins: 0,
    contributorLevel: null,
    contributorValue: null
  };
  
  // Extract total wins if on profile page
  const winsElement = document.querySelector('.featured__table__row__right');
  if (winsElement && winsElement.textContent) {
    const winsText = winsElement.textContent.trim();
    const winsMatch = winsText.match(/(\d+)/);
    if (winsMatch && winsMatch[1]) {
      stats.totalWins = parseInt(winsMatch[1], 10);
    }
  }
  
  // Extract contributor level and value
  const levelElement = document.querySelector('.featured__contributor-level');
  if (levelElement && levelElement.textContent) {
    const levelText = levelElement.textContent.trim();
    const levelMatch = levelText.match(/Level\s*(\d+)/i);
    if (levelMatch && levelMatch[1]) {
      stats.contributorLevel = parseInt(levelMatch[1], 10);
    }
  }
  
  const cvElement = document.querySelector('.featured__contributor-value');
  if (cvElement && cvElement.textContent) {
    const cvText = cvElement.textContent.trim();
    const cvMatch = cvText.match(/\$(\d+\.\d+)/);
    if (cvMatch && cvMatch[1]) {
      stats.contributorValue = cvMatch[1];
    }
  }
  
  return stats;
}

/**
 * Update the stats panel with new information
 */
export function updateStatsPanel() {
  const statsPanel = document.getElementById('sg-autojoin-stats-panel');
  if (!statsPanel) {
    createStatsPanel();
    return;
  }
  
  // Update the values in the existing panel
  chrome.storage.sync.get({
    totalJoins: 0,
    successfulJoins: 0,
    pointsSpent: 0,
    joinHistory: [],
    totalWins: 0
  }, (stats) => {
    // Today's joins
    const today = new Date().setHours(0,0,0,0);
    const todayJoins = stats.joinHistory.filter(join => 
      new Date(join.date).setHours(0,0,0,0) === today
    ).length;
    
    // Success rate
    const successRate = stats.totalJoins > 0 
      ? Math.round((stats.successfulJoins / stats.totalJoins) * 100) 
      : 0;
    
    // Average cost
    const averageCost = stats.successfulJoins > 0 
      ? Math.round(stats.pointsSpent / stats.successfulJoins) 
      : 0;
    
    // Update displayed values
    updateStatValue(statsPanel, 'Total Joins', stats.totalJoins);
    updateStatValue(statsPanel, "Today's Joins", todayJoins);
    updateStatValue(statsPanel, 'Success Rate', `${successRate}%`);
    updateStatValue(statsPanel, 'Points Spent', `${stats.pointsSpent}P`);
    updateStatValue(statsPanel, 'Avg Cost', `${averageCost}P`);
  });
}

/**
 * Helper to update specific stat value in panel
 */
function updateStatValue(panel, label, value) {
  const items = panel.querySelectorAll('.sg-stat-item');
  for (const item of items) {
    const labelEl = item.querySelector('.sg-stat-label');
    if (labelEl && labelEl.textContent === label) {
      const valueEl = item.querySelector('.sg-stat-value');
      if (valueEl) {
        valueEl.textContent = value;
      }
      break;
    }
  }
}

export function initializeIndicator() {
    console.log("[SG AutoJoin] Initializing Indicator UI...");
    createIndicatorElement();
    createStatsPanel();
    chrome.storage.sync.get("autoJoinEnabled", (data) => {
        const initialEnabledState = !!data.autoJoinEnabled;
        State.setAutoJoinEnabled(initialEnabledState);
        updateIndicatorUI(initialEnabledState);
        console.log("[SG AutoJoin] Initial indicator state:", initialEnabledState);
    });
}
