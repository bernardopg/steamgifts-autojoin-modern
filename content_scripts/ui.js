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
    indicator.style.padding = "4px 10px";
    indicator.style.borderRadius = "20px";
    indicator.style.fontSize = "0.9em";
    indicator.style.fontWeight = "bold";
    indicator.style.color = "white";
    indicator.style.cursor = "pointer";
    indicator.textContent = "AutoJoin: Loading...";
    indicator.style.backgroundColor = "#888";
    indicator.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    indicator.style.transition = "all 0.2s ease";
    indicator.style.border = "1px solid rgba(255,255,255,0.1)";
    indicator.style.textShadow = "0 1px 1px rgba(0,0,0,0.2)";
    
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
    autoModeToggle.style.padding = "4px 10px";
    autoModeToggle.style.borderRadius = "20px";
    autoModeToggle.style.fontSize = "0.9em";
    autoModeToggle.style.fontWeight = "bold";
    autoModeToggle.style.color = "white";
    autoModeToggle.style.cursor = "pointer";
    autoModeToggle.style.marginLeft = "5px";
    autoModeToggle.textContent = "Auto: OFF";
    autoModeToggle.style.backgroundColor = "#d9534f";
    autoModeToggle.style.boxShadow = "0 2px 6px rgba(0,0,0,0.2)";
    autoModeToggle.style.transition = "all 0.2s ease";
    autoModeToggle.style.border = "1px solid rgba(255,255,255,0.1)";
    autoModeToggle.style.textShadow = "0 1px 1px rgba(0,0,0,0.2)";
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
    sessionPoints: 0,
    yesterdayJoins: 0,
    theme: 'default'
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
    
    // Yesterday's joins for trend comparison
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayDate = yesterday.setHours(0,0,0,0);
    const yesterdayJoins = stats.joinHistory.filter(join => 
      new Date(join.date).setHours(0,0,0,0) === yesterdayDate
    ).length;
    
    // Calculate trends
    const joinTrend = calculateTrend(todayJoins, stats.yesterdayJoins || yesterdayJoins);
    const pointTrend = { direction: 'neutral', percent: 0 }; // Placeholder for future implementation
    
    // Apply current theme
    applyTheme(stats.theme || 'default');
    
    // Build panel content
    statsPanel.innerHTML = `
      <div class="sg-stats-header">
        <i class="fa fa-chart-bar"></i> SteamGifts AutoJoin Stats
        <div class="sg-stats-header-actions">
          <button class="sg-theme-button" title="Change theme">
            <i class="fa fa-palette"></i>
          </button>
          <button class="sg-stats-toggle" title="Toggle stats panel">
            <i class="fa fa-chevron-up"></i>
          </button>
        </div>
      </div>
      <div class="sg-stats-content">
        <div class="stats-dashboard">
          <div class="stat-dashboard-card">
            <div class="stat-dashboard-icon">
              <i class="fa fa-gift"></i>
            </div>
            <div class="stat-dashboard-value">${todayJoins}</div>
            <div class="stat-dashboard-label">Today's Joins</div>
            <div class="stat-dashboard-trend ${joinTrend.direction === 'up' ? 'stat-trend-up' : joinTrend.direction === 'down' ? 'stat-trend-down' : 'stat-trend-neutral'}">
              <i class="fa fa-${joinTrend.direction === 'up' ? 'arrow-up' : joinTrend.direction === 'down' ? 'arrow-down' : 'minus'}"></i>
              ${joinTrend.percent}% vs yesterday
            </div>
          </div>
          
          <div class="stat-dashboard-card">
            <div class="stat-dashboard-icon">
              <i class="fa fa-coins"></i>
            </div>
            <div class="stat-dashboard-value">${stats.pointsSpent.toString()}P</div>
            <div class="stat-dashboard-label">Points Spent</div>
          </div>
          
          <div class="stat-dashboard-card">
            <div class="stat-dashboard-icon">
              <i class="fa fa-chart-pie"></i>
            </div>
            <div class="stat-dashboard-value">${successRate}%</div>
            <div class="stat-dashboard-label">Success Rate</div>
          </div>
          
          <div class="stat-dashboard-card">
            <div class="stat-dashboard-icon">
              <i class="fa fa-trophy"></i>
            </div>
            <div class="stat-dashboard-value">${additionalStats.totalWins || 0}</div>
            <div class="stat-dashboard-label">Total Wins</div>
          </div>
        </div>
        
        <div class="sg-stats-grid">
          <div class="sg-stat-item">
            <div class="sg-stat-value">${stats.totalJoins}</div>
            <div class="sg-stat-label">Total Joins</div>
          </div>
          <div class="sg-stat-item">
            <div class="sg-stat-value">${averageCost.toString()}P</div>
            <div class="sg-stat-label">Avg Cost</div>
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
        
        <!-- Theme selector (hidden by default) -->
        <div class="theme-selector" style="display: none;">
          <div class="theme-option theme-default ${stats.theme === 'default' ? 'active' : ''}" data-theme="default" title="Default Theme"></div>
          <div class="theme-option theme-dark ${stats.theme === 'dark' ? 'active' : ''}" data-theme="dark" title="Dark Theme"></div>
          <div class="theme-option theme-steam ${stats.theme === 'steam' ? 'active' : ''}" data-theme="steam" title="Steam Theme"></div>
          <div class="theme-option theme-mint ${stats.theme === 'mint' ? 'active' : ''}" data-theme="mint" title="Mint Theme"></div>
          <div class="theme-option theme-contrast ${stats.theme === 'contrast' ? 'active' : ''}" data-theme="contrast" title="High Contrast"></div>
        </div>
      </div>
    `;
    
    // Insert at the beginning of the body
    const bodyElement = document.body;
    bodyElement.insertBefore(statsPanel, bodyElement.firstChild);
    
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
    
    // Add theme selector functionality
    const themeBtn = statsPanel.querySelector('.sg-theme-button');
    const themeSelector = statsPanel.querySelector('.theme-selector');
    
    if (themeBtn && themeSelector) {
      themeBtn.addEventListener('click', () => {
        const isVisible = themeSelector.style.display !== 'none';
        themeSelector.style.display = isVisible ? 'none' : 'flex';
      });
      
      // Theme option click handler
      const themeOptions = statsPanel.querySelectorAll('.theme-option');
      themeOptions.forEach(option => {
        option.addEventListener('click', () => {
          const theme = option.dataset.theme;
          
          // Update active class
          themeOptions.forEach(opt => opt.classList.remove('active'));
          option.classList.add('active');
          
          // Apply theme
          applyTheme(theme);
          
          // Save theme preference
          chrome.storage.sync.set({ theme });
          
          // Hide theme selector
          themeSelector.style.display = 'none';
        });
      });
    }
    
    // Store yesterday's join count for future trend comparison
    chrome.storage.sync.set({ yesterdayJoins: yesterdayJoins });
  });
}

/**
 * Apply a theme to the document
 * @param {string} theme - Theme name to apply
 */
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

/**
 * Calculate trend between current and previous values
 * @param {number} current - Current value
 * @param {number} previous - Previous value to compare against
 * @returns {Object} Trend information with direction and percentage
 */
function calculateTrend(current, previous) {
  if (previous === 0) {
    return current === 0 
      ? { direction: 'neutral', percent: 0 }
      : { direction: 'up', percent: 100 };
  }
  
  const percentChange = Math.round(((current - previous) / previous) * 100);
  
  if (percentChange > 0) {
    return { direction: 'up', percent: percentChange };
  } else if (percentChange < 0) {
    return { direction: 'down', percent: Math.abs(percentChange) };
  } else {
    return { direction: 'neutral', percent: 0 };
  }
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
    updateStatValue(statsPanel, 'Points Spent', `${stats.pointsSpent.toString()}P`);
    updateStatValue(statsPanel, 'Avg Cost', `${averageCost.toString()}P`);
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

/**
 * Create and inject the floating action button
 */
export function createFloatingActionButton() {
  // Check if FAB already exists
  if (document.getElementById('sg-floating-action-button')) return;
  
  // Create the FAB container
  const fab = document.createElement('div');
  fab.id = 'sg-floating-action-button';
  fab.className = 'sg-fab-container';
  
  // Create main button
  const mainButton = document.createElement('button');
  mainButton.className = 'sg-fab-main-button';
  mainButton.innerHTML = '<i class="fa fa-plus"></i>';
  mainButton.setAttribute('aria-label', 'Quick Actions');
  
  // Create action buttons container
  const actionsContainer = document.createElement('div');
  actionsContainer.className = 'sg-fab-actions';
  
  // Create action buttons
  const actions = [
    { icon: 'gift', label: 'Join All', action: () => joinAllVisible() },
    { icon: 'sync', label: 'Refresh', action: () => refreshGiveaways() },
    { icon: 'filter', label: 'Quick Filters', action: () => toggleQuickFilters() },
    { icon: 'chart-bar', label: 'Stats', action: () => toggleStatsPanel() },
    { icon: 'cog', label: 'Settings', action: () => openSettings() }
  ];
  
  actions.forEach(action => {
    const button = document.createElement('button');
    button.className = 'sg-fab-action-button';
    button.innerHTML = `<i class="fa fa-${action.icon}"></i>`;
    button.setAttribute('aria-label', action.label);
    button.setAttribute('data-tooltip', action.label);
    
    button.addEventListener('click', (e) => {
      e.stopPropagation();
      action.action();
      toggleFab(false); // Close the FAB after action
    });
    
    actionsContainer.appendChild(button);
  });
  
  // Toggle FAB open/closed
  let isOpen = false;
  
  function toggleFab(forceState) {
    isOpen = forceState !== undefined ? forceState : !isOpen;
    mainButton.innerHTML = isOpen ? '<i class="fa fa-times"></i>' : '<i class="fa fa-plus"></i>';
    fab.classList.toggle('sg-fab-active', isOpen);
  }
  
  mainButton.addEventListener('click', () => {
    toggleFab();
  });
  
  // Close FAB when clicking outside
  document.addEventListener('click', (e) => {
    if (isOpen && !fab.contains(e.target)) {
      toggleFab(false);
    }
  });
  
  // Add elements to DOM
  fab.appendChild(actionsContainer);
  fab.appendChild(mainButton);
  document.body.appendChild(fab);
  
  console.log("[SG AutoJoin] Floating action button created.");
}

/**
 * Join all visible giveaways via the FAB
 */
function joinAllVisible() {
  chrome.runtime.sendMessage({ action: "joinAllVisible" });
  Utils.showToast("Joining all visible giveaways...", "info");
}

/**
 * Refresh the current page of giveaways
 */
function refreshGiveaways() {
  Utils.showToast("Refreshing giveaways...", "info");
  location.reload();
}

/**
 * Toggle quick filters panel
 */
function toggleQuickFilters() {
  const quickFilterBar = document.querySelector('.sg-quick-filter-bar');
  if (quickFilterBar) {
    quickFilterBar.classList.toggle('sg-filter-bar-expanded');
    Utils.showToast(quickFilterBar.classList.contains('sg-filter-bar-expanded') ? 
      "Quick filters expanded" : "Quick filters collapsed", "info");
  } else {
    Utils.showToast("Quick filters not available on this page", "warning");
  }
}

/**
 * Toggle stats panel visibility
 */
function toggleStatsPanel() {
  const statsPanel = document.getElementById('sg-autojoin-stats-panel');
  if (statsPanel) {
    const content = statsPanel.querySelector('.sg-stats-content');
    const isVisible = content.style.display !== 'none';
    content.style.display = isVisible ? 'none' : 'block';
    
    // Update toggle button icon
    const toggleBtn = statsPanel.querySelector('.sg-stats-toggle');
    if (toggleBtn) {
      toggleBtn.innerHTML = isVisible ? '<i class="fa fa-chevron-down"></i>' : '<i class="fa fa-chevron-up"></i>';
    }
    
    // Save state
    chrome.storage.sync.set({ statsPanelOpen: !isVisible });
  }
}

/**
 * Open extension settings
 */
function openSettings() {
  chrome.runtime.sendMessage({ action: "openOptionsPage" });
}

/**
 * Initialize custom tooltip system
 */
function initializeTooltipSystem() {
  // Create tooltip container if it doesn't exist
  let tooltipContainer = document.getElementById('sg-tooltip-container');
  if (!tooltipContainer) {
    tooltipContainer = document.createElement('div');
    tooltipContainer.id = 'sg-tooltip-container';
    document.body.appendChild(tooltipContainer);
  }
  
  // Add event listeners for elements with data-tooltip attribute
  document.addEventListener('mouseover', (e) => {
    const tooltip = e.target.closest('[data-tooltip]');
    if (tooltip) {
      showTooltip(tooltip, tooltip.getAttribute('data-tooltip'));
    }
  });
  
  document.addEventListener('mouseout', (e) => {
    const tooltip = e.target.closest('[data-tooltip]');
    if (tooltip) {
      hideTooltip();
    }
  });
  
  /**
   * Show tooltip near an element
   */
  function showTooltip(element, text) {
    const rect = element.getBoundingClientRect();
    tooltipContainer.textContent = text;
    tooltipContainer.style.display = 'block';
    
    // Position tooltip
    const tooltipWidth = tooltipContainer.offsetWidth;
    const tooltipHeight = tooltipContainer.offsetHeight;
    
    let left = rect.left + (rect.width - tooltipWidth) / 2;
    let top = rect.top - tooltipHeight - 8;
    
    // Keep tooltip within viewport
    if (left < 10) left = 10;
    if (left + tooltipWidth > window.innerWidth - 10) {
      left = window.innerWidth - tooltipWidth - 10;
    }
    
    // If tooltip would go above viewport, show below element instead
    if (top < 10) {
      top = rect.bottom + 8;
      tooltipContainer.classList.add('sg-tooltip-bottom');
    } else {
      tooltipContainer.classList.remove('sg-tooltip-bottom');
    }
    
    tooltipContainer.style.left = `${left}px`;
    tooltipContainer.style.top = `${top}px`;
  }
  
  /**
   * Hide the tooltip
   */
  function hideTooltip() {
    tooltipContainer.style.display = 'none';
  }
}

/**
 * Create or update the progress tracker UI
 * @param {string} title - Title for the tracker
 * @returns {Object} Interface for updating the tracker
 */
export function createProgressTracker(title) {
  // Check if tracker already exists
  let tracker = document.getElementById('sg-progress-tracker');
  let isNew = false;
  
  if (!tracker) {
    isNew = true;
    tracker = document.createElement('div');
    tracker.id = 'sg-progress-tracker';
    tracker.className = 'sg-progress-tracker sg-slide-up';
    
    // Create progress tracker structure
    tracker.innerHTML = `
      <div class="sg-progress-header">
        <span class="sg-progress-title">${title || 'Progress'}</span>
        <button class="sg-progress-close"><i class="fa fa-times"></i></button>
      </div>
      <div class="sg-progress-content">
        <div class="sg-progress-bar-container">
          <div class="sg-progress-bar" style="width: 0%"></div>
        </div>
        <div class="sg-progress-details">
          <div class="sg-progress-status">Initializing...</div>
          <div class="sg-progress-counter">0%</div>
        </div>
        <div class="sg-progress-log">
          <div class="sg-progress-log-entry">Started task: ${title || 'Progress tracking'}</div>
        </div>
      </div>
    `;
    
    // Add to body
    document.body.appendChild(tracker);
    
    // Setup close button
    const closeBtn = tracker.querySelector('.sg-progress-close');
    closeBtn.addEventListener('click', () => {
      tracker.classList.add('sg-slide-down');
      setTimeout(() => {
        if (tracker.parentNode) {
          tracker.parentNode.removeChild(tracker);
        }
      }, 300);
    });
  } else {
    // Update existing tracker title
    const titleElement = tracker.querySelector('.sg-progress-title');
    if (titleElement) titleElement.textContent = title || 'Progress';
    
    // Reset progress if reusing tracker
    const progressBar = tracker.querySelector('.sg-progress-bar');
    if (progressBar) progressBar.style.width = '0%';
    
    const statusElement = tracker.querySelector('.sg-progress-status');
    if (statusElement) statusElement.textContent = 'Initializing...';
    
    const counterElement = tracker.querySelector('.sg-progress-counter');
    if (counterElement) counterElement.textContent = '0%';
  }
  
  // Add initial log entry if new tracker
  if (isNew) {
    addLogEntry(`Started task: ${title || 'Progress tracking'}`);
  }
  
  /**
   * Add entry to progress log
   */
  function addLogEntry(message) {
    const logContainer = tracker.querySelector('.sg-progress-log');
    if (!logContainer) return;
    
    const entry = document.createElement('div');
    entry.className = 'sg-progress-log-entry';
    entry.textContent = message;
    
    // Add timestamp
    const timestamp = document.createElement('span');
    timestamp.className = 'sg-progress-timestamp';
    const time = new Date();
    timestamp.textContent = `${time.getHours().toString().padStart(2, '0')}:${time.getMinutes().toString().padStart(2, '0')}:${time.getSeconds().toString().padStart(2, '0')}`;
    
    entry.prepend(timestamp);
    logContainer.appendChild(entry);
    
    // Scroll to bottom
    logContainer.scrollTop = logContainer.scrollHeight;
    
    // Limit log entries
    const entries = logContainer.querySelectorAll('.sg-progress-log-entry');
    if (entries.length > 50) {
      logContainer.removeChild(entries[0]);
    }
  }
  
  /**
   * Update progress tracker UI
   */
  function updateProgress(percent, status) {
    const progressBar = tracker.querySelector('.sg-progress-bar');
    const statusElement = tracker.querySelector('.sg-progress-status');
    const counterElement = tracker.querySelector('.sg-progress-counter');
    
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (statusElement && status) {
      statusElement.textContent = status;
      addLogEntry(status);
    }
    if (counterElement) counterElement.textContent = `${Math.round(percent)}%`;
    
    return api;
  }
  
  /**
   * Complete the progress tracker
   */
  function complete(finalMessage, success = true) {
    updateProgress(100, finalMessage || 'Completed');
    
    // Add success/failure class
    tracker.classList.toggle('sg-progress-success', success);
    tracker.classList.toggle('sg-progress-failure', !success);
    
    // Add completion message
    addLogEntry(`${success ? '✓ Success' : '❌ Failed'}: ${finalMessage || 'Task completed'}`);
    
    // Auto-hide after 5 seconds if success
    if (success) {
      setTimeout(() => {
        tracker.classList.add('sg-slide-down');
        setTimeout(() => {
          if (tracker && tracker.parentNode) {
            tracker.parentNode.removeChild(tracker);
          }
        }, 300);
      }, 5000);
    }
    
    return api;
  }
  
  const api = {
    updateProgress,
    complete,
    addLogEntry
  };
  
  return api;
}

export function initializeIndicator() {
    console.log("[SG AutoJoin] Initializing Indicator UI...");
    createIndicatorElement();
    createStatsPanel();
    
    // Initialize new UI components
    initializeTooltipSystem();
    createFloatingActionButton();
    
    chrome.storage.sync.get("autoJoinEnabled", (data) => {
        const initialEnabledState = !!data.autoJoinEnabled;
        State.setAutoJoinEnabled(initialEnabledState);
        updateIndicatorUI(initialEnabledState);
        console.log("[SG AutoJoin] Initial indicator state:", initialEnabledState);
    });
}
