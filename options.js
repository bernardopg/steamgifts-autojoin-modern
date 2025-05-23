// Main options settings handling
document.addEventListener('DOMContentLoaded', initializeOptions);

// DOM Elements - Tab navigation
const tabButtons = document.querySelectorAll('.tab-btn');
const tabContents = document.querySelectorAll('.tab-content');

// DOM Elements - Form inputs (General)
const autoModeEnabledInput = document.getElementById('autoModeEnabled');
const joinOnPageLoadInput = document.getElementById('joinOnPageLoad');
const joinIntervalInput = document.getElementById('joinInterval');
const joinIntervalValueEl = document.getElementById('joinIntervalValue');
const maxJoinsPerCycleInput = document.getElementById('maxJoinsPerCycle');
const maxJoinsPerCycleValueEl = document.getElementById('maxJoinsPerCycleValue');
const showJoinNotificationsInput = document.getElementById('showJoinNotifications');
const showErrorNotificationsInput = document.getElementById('showErrorNotifications');
const notificationDurationInput = document.getElementById('notificationDuration');
const notificationDurationValueEl = document.getElementById('notificationDurationValue');
const enableKeyboardShortcutsInput = document.getElementById('enableKeyboardShortcuts');

// DOM Elements - Form inputs (Filters)
const pointBufferInput = document.getElementById('pointBuffer');
const pointBufferValueEl = document.getElementById('pointBufferValue');
const minCostInput = document.getElementById('minCost');
const minCostValueEl = document.getElementById('minCostValue');
const maxCostInput = document.getElementById('maxCost');
const maxCostValueEl = document.getElementById('maxCostValue');
const maxLevelInput = document.getElementById('maxLevel');
const maxLevelValueEl = document.getElementById('maxLevelValue');
const wishlistOnlyInput = document.getElementById('wishlistOnly');
const skipGroupsInput = document.getElementById('skipGroups');
const skipOwnedInput = document.getElementById('skipOwned');
const blacklistKeywordsInput = document.getElementById('blacklistKeywords');
const whitelistKeywordsInput = document.getElementById('whitelistKeywords');

// DOM Elements - Form inputs (Accessibility)
const highContrastModeInput = document.getElementById('highContrastMode');
const largeFontModeInput = document.getElementById('largeFontMode');
const keyboardFocusModeInput = document.getElementById('keyboardFocusMode');
const animationSpeedInput = document.getElementById('animationSpeed');
const animationSpeedValueEl = document.getElementById('animationSpeedValue');
const persistentNotificationsInput = document.getElementById('persistentNotifications');
const audioFeedbackInput = document.getElementById('audioFeedback');
const audioVolumeInput = document.getElementById('audioVolume');
const audioVolumeValueEl = document.getElementById('audioVolumeValue');

// DOM Elements - Buttons
const saveBtn = document.getElementById('saveBtn');
const cancelBtn = document.getElementById('cancelBtn');
const resetBtn = document.getElementById('resetBtn');
const resetStatsBtn = document.getElementById('resetStatsBtn');
const saveProfileBtn = document.getElementById('saveProfileBtn');

// DOM Elements - Filter presets
const presetButtons = document.querySelectorAll('.preset-btn');
const profileOptions = document.querySelectorAll('.profile-option');

// DOM Elements - Status message
const statusMessage = document.getElementById('statusMessage');

// Default settings
const defaultSettings = {
  // General
  autoModeEnabled: false,
  joinOnPageLoad: true,
  joinInterval: 10,
  maxJoinsPerCycle: 3,
  joinDelayMin: 2000, // 2 seconds minimum delay between join attempts
  joinDelayMax: 3000, // 3 seconds maximum delay between join attempts
  showJoinNotifications: true,
  showErrorNotifications: true,
  notificationDuration: 5,
  enableKeyboardShortcuts: true,

  // Filters
  pointBuffer: 50, // More conservative default
  maxCost: 100,
  minCost: 0,
  maxLevel: 10,
  minLevel: 0,
  wishlistOnly: true, // More conservative default
  skipGroups: true,  // More conservative default
  skipOwned: true,
  skipEntryLimited: true, // More conservative default
  entryLimitThreshold: 5000, // More conservative default
  sortByEndingSoon: false,
  endingSoonThreshold: 60, // minutes
  blacklistKeywords: '',
  whitelistKeywords: '',
  blacklistPublishers: '',
  whitelistPublishers: '',
  useRegexFilters: false,
  
  // Dynamic point buffers
  dynamicPointBuffer: false,
  pointsToPreserve: {
    morning: 50,   // 6am - 12pm
    afternoon: 50, // 12pm - 6pm
    evening: 50,   // 6pm - 12am
    night: 50      // 12am - 6am
  },
  pointSpendingStrategy: 'balanced', // 'conservative', 'balanced', 'aggressive'

  // Accessibility
  highContrastMode: false,
  largeFontMode: false,
  keyboardFocusMode: false,
  animationSpeed: 1,
  persistentNotifications: false,
  audioFeedback: false,
  audioVolume: 70,

  // Statistics
  totalJoins: 0,
  successfulJoins: 0,
  failedJoins: 0, 
  skippedGiveaways: 0,
  pointsSpent: 0,
  joinHistory: [],
  
  // Wishlist caching
  wishlistCacheTime: 6, // hours before refreshing wishlist cache
  forceRefreshWishlist: false, // Flag to force refresh on next load
  
  // Last update timestamp
  lastUpdated: Date.now()
};

// Initialize everything
function initializeOptions() {
  // Setup tab navigation
  setupTabs();

  // Load settings
  loadSettings();

  // Setup UI interactions
  setupRangeInputs();
  setupPresetButtons();
  setupProfileOptions();
  setupAccessibilityToggles();

  // Setup button handlers
  setupButtonHandlers();
}

// Setup tab navigation
function setupTabs() {
  tabButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const tabName = button.getAttribute('data-tab');

      // Remove active class from all tabs
      tabButtons.forEach((btn) => btn.classList.remove('active'));
      tabContents.forEach((content) => content.classList.remove('active'));

      // Add active class to selected tab
      button.classList.add('active');
      document.getElementById(`${tabName}-tab`).classList.add('active');

      // Save last active tab
      localStorage.setItem('sgAutojoin_lastActiveTab', tabName);
    });
  });

  // Restore last active tab
  const lastActiveTab = localStorage.getItem('sgAutojoin_lastActiveTab');
  if (lastActiveTab) {
    const tabBtn = document.querySelector(`.tab-btn[data-tab="${lastActiveTab}"]`);
    if (tabBtn) tabBtn.click();
  }
}

// Load settings from storage
function loadSettings() {
  chrome.storage.sync.get(defaultSettings, (items) => {
    if (chrome.runtime.lastError) {
      showStatusMessage(`Error loading settings: ${chrome.runtime.lastError.message}`, true);
      return;
    }

    // Populate form inputs with stored values
    populateFormInputs(items);

    // Load statistics
    updateStatisticsDisplay(items);

    // Load profiles list
    loadSavedProfiles();

    // Apply accessibility settings
    applyAccessibilitySettings(items);
  });
}

// Populate form inputs with values
function populateFormInputs(settings) {
  // General
  autoModeEnabledInput.checked = settings.autoModeEnabled;
  joinOnPageLoadInput.checked = settings.joinOnPageLoad;
  joinIntervalInput.value = settings.joinInterval;
  joinIntervalValueEl.textContent = `${settings.joinInterval}s`;
  maxJoinsPerCycleInput.value = settings.maxJoinsPerCycle;
  maxJoinsPerCycleValueEl.textContent = settings.maxJoinsPerCycle;
  showJoinNotificationsInput.checked = settings.showJoinNotifications;
  showErrorNotificationsInput.checked = settings.showErrorNotifications;
  notificationDurationInput.value = settings.notificationDuration;
  notificationDurationValueEl.textContent = `${settings.notificationDuration}s`;
  enableKeyboardShortcutsInput.checked = settings.enableKeyboardShortcuts;

  // Filters
  pointBufferInput.value = settings.pointBuffer;
  pointBufferValueEl.textContent = `${settings.pointBuffer}P`;
  minCostInput.value = settings.minCost;
  minCostValueEl.textContent = `${settings.minCost}P`;
  maxCostInput.value = settings.maxCost;
  maxCostValueEl.textContent = `${settings.maxCost}P`;
  maxLevelInput.value = settings.maxLevel;
  maxLevelValueEl.textContent = settings.maxLevel;
  wishlistOnlyInput.checked = settings.wishlistOnly;
  skipGroupsInput.checked = settings.skipGroups;
  skipOwnedInput.checked = settings.skipOwned;
  blacklistKeywordsInput.value = settings.blacklistKeywords;
  whitelistKeywordsInput.value = settings.whitelistKeywords;

  // Accessibility
  highContrastModeInput.checked = settings.highContrastMode;
  largeFontModeInput.checked = settings.largeFontMode;
  keyboardFocusModeInput.checked = settings.keyboardFocusMode;
  animationSpeedInput.value = settings.animationSpeed;
  updateAnimationSpeedLabel(settings.animationSpeed);
  persistentNotificationsInput.checked = settings.persistentNotifications;
  audioFeedbackInput.checked = settings.audioFeedback;
  audioVolumeInput.value = settings.audioVolume;
  audioVolumeValueEl.textContent = `${settings.audioVolume}%`;
}

// Setup range input interactions
function setupRangeInputs() {
  // Join interval
  joinIntervalInput.addEventListener('input', () => {
    joinIntervalValueEl.textContent = `${joinIntervalInput.value}s`;
  });

  // Max joins per cycle
  maxJoinsPerCycleInput.addEventListener('input', () => {
    maxJoinsPerCycleValueEl.textContent = maxJoinsPerCycleInput.value;
  });

  // Notification duration
  notificationDurationInput.addEventListener('input', () => {
    notificationDurationValueEl.textContent = `${notificationDurationInput.value}s`;
  });

  // Point buffer
  pointBufferInput.addEventListener('input', () => {
    pointBufferValueEl.textContent = `${pointBufferInput.value}P`;
  });

  // Min cost
  minCostInput.addEventListener('input', () => {
    minCostValueEl.textContent = `${minCostInput.value}P`;

    // Ensure min cost doesn't exceed max cost
    if (parseInt(minCostInput.value) > parseInt(maxCostInput.value)) {
      maxCostInput.value = minCostInput.value;
      maxCostValueEl.textContent = `${maxCostInput.value}P`;
    }
  });

  // Max cost
  maxCostInput.addEventListener('input', () => {
    maxCostValueEl.textContent = `${maxCostInput.value}P`;

    // Ensure max cost isn't less than min cost
    if (parseInt(maxCostInput.value) < parseInt(minCostInput.value)) {
      minCostInput.value = maxCostInput.value;
      minCostValueEl.textContent = `${minCostInput.value}P`;
    }
  });

  // Max level
  maxLevelInput.addEventListener('input', () => {
    maxLevelValueEl.textContent = maxLevelInput.value;
  });

  // Animation speed
  animationSpeedInput.addEventListener('input', () => {
    updateAnimationSpeedLabel(animationSpeedInput.value);
  });

  // Audio volume
  audioVolumeInput.addEventListener('input', () => {
    audioVolumeValueEl.textContent = `${audioVolumeInput.value}%`;
  });
}

function updateAnimationSpeedLabel(value) {
  const speedLabels = ['None', 'Normal', 'Fast'];
  animationSpeedValueEl.textContent = speedLabels[value];
}

// Setup preset buttons for filters
function setupPresetButtons() {
  presetButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const preset = button.getAttribute('data-preset');

      switch (preset) {
        case 'low-value':
          minCostInput.value = '0';
          maxCostInput.value = '15';
          break;
        case 'mid-value':
          minCostInput.value = '15';
          maxCostInput.value = '50';
          break;
        case 'high-value':
          minCostInput.value = '50';
          maxCostInput.value = '300';
          break;
        case 'all':
          minCostInput.value = '0';
          maxCostInput.value = '300';
          break;
      }

      // Update displayed values
      minCostValueEl.textContent = `${minCostInput.value}P`;
      maxCostValueEl.textContent = `${maxCostInput.value}P`;
    });
  });
}

// Setup profile options
function setupProfileOptions() {
  profileOptions.forEach((option) => {
    option.addEventListener('click', () => {
      // Remove active class from all options
      profileOptions.forEach((opt) => opt.classList.remove('active'));

      // Add active class to selected option
      option.classList.add('active');

      const preset = option.getAttribute('data-preset');

      // Apply preset settings
      switch (preset) {
        case 'all-games':
          wishlistOnlyInput.checked = false;
          skipGroupsInput.checked = false;
          pointBufferInput.value = '0';
          minCostInput.value = '0';
          maxCostInput.value = '300';
          break;
        case 'wishlist-only':
          wishlistOnlyInput.checked = true;
          skipGroupsInput.checked = false;
          pointBufferInput.value = '0';
          break;
        case 'high-value':
          wishlistOnlyInput.checked = false;
          skipGroupsInput.checked = false;
          minCostInput.value = '50';
          maxCostInput.value = '300';
          break;
        case 'conservative':
          pointBufferInput.value = '200';
          maxJoinsPerCycleInput.value = '1';
          break;
      }

      // Update displayed values
      pointBufferValueEl.textContent = `${pointBufferInput.value}P`;
      minCostValueEl.textContent = `${minCostInput.value}P`;
      maxCostValueEl.textContent = `${maxCostInput.value}P`;
      maxJoinsPerCycleValueEl.textContent = maxJoinsPerCycleInput.value;
    });
  });
}

// Setup accessibility toggles
function setupAccessibilityToggles() {
  highContrastModeInput.addEventListener('change', () => {
    document.body.classList.toggle('sg-high-contrast', highContrastModeInput.checked);
  });

  largeFontModeInput.addEventListener('change', () => {
    document.body.classList.toggle('sg-font-large', largeFontModeInput.checked);
  });

  keyboardFocusModeInput.addEventListener('change', () => {
    document.body.classList.toggle('sg-keyboard-focus-visible', keyboardFocusModeInput.checked);
  });
}

// Apply accessibility settings
function applyAccessibilitySettings(settings) {
  document.body.classList.toggle('sg-high-contrast', settings.highContrastMode);
  document.body.classList.toggle('sg-font-large', settings.largeFontMode);
  document.body.classList.toggle('sg-keyboard-focus-visible', settings.keyboardFocusMode);

  // Also update the storage for the popup
  chrome.storage.sync.set({
    accessibilityHighContrast: settings.highContrastMode,
    accessibilityLargeFont: settings.largeFontMode,
    accessibilityKeyboardFocus: settings.keyboardFocusMode,
  });
}

// Load saved profiles
function loadSavedProfiles() {
  chrome.storage.sync.get('savedProfiles', (result) => {
    const profilesList = document.getElementById('profilesList');
    const profiles = result.savedProfiles || [];

    // Clear existing profiles except for the default one
    while (profilesList.children.length > 1) {
      profilesList.removeChild(profilesList.lastChild);
    }

    // Add saved profiles
    profiles.forEach((profile) => {
      const profileCard = createProfileCard(profile);
      profilesList.appendChild(profileCard);
    });
  });
}

// Create a profile card element
function createProfileCard(profile) {
  const div = document.createElement('div');
  div.className = 'profile-card';

  const infoDiv = document.createElement('div');

  const nameEl = document.createElement('strong');
  nameEl.textContent = profile.name;

  const dateEl = document.createElement('div');
  dateEl.className = 'form-help';
  dateEl.textContent = `Last modified: ${new Date(profile.lastModified).toLocaleDateString()}`;

  infoDiv.appendChild(nameEl);
  infoDiv.appendChild(dateEl);

  const actionsDiv = document.createElement('div');
  actionsDiv.className = 'profile-actions';

  const loadBtn = document.createElement('button');
  loadBtn.className = 'sg-btn sg-btn-sm sg-btn-primary';
  loadBtn.textContent = 'Load';
  loadBtn.addEventListener('click', () => loadProfile(profile));

  const deleteBtn = document.createElement('button');
  deleteBtn.className = 'sg-btn sg-btn-sm sg-btn-outline';
  deleteBtn.textContent = 'Delete';
  deleteBtn.addEventListener('click', () => deleteProfile(profile));

  actionsDiv.appendChild(loadBtn);
  actionsDiv.appendChild(deleteBtn);

  div.appendChild(infoDiv);
  div.appendChild(actionsDiv);

  return div;
}

// Load a profile
function loadProfile(profile) {
  populateFormInputs(profile.settings);
  showStatusMessage(`Profile "${profile.name}" loaded successfully!`);
}

// Delete a profile
function deleteProfile(profile) {
  if (confirm(`Are you sure you want to delete the profile "${profile.name}"?`)) {
    chrome.storage.sync.get('savedProfiles', (result) => {
      let profiles = result.savedProfiles || [];

      // Remove the profile
      profiles = profiles.filter((p) => p.name !== profile.name);

      // Save updated profiles
      chrome.storage.sync.set({ savedProfiles: profiles }, () => {
        if (chrome.runtime.lastError) {
          showStatusMessage(`Error deleting profile: ${chrome.runtime.lastError.message}`, true);
        } else {
          showStatusMessage(`Profile "${profile.name}" deleted successfully!`);
          loadSavedProfiles();
        }
      });
    });
  }
}

// Save a new profile
function saveProfile() {
  const nameInput = document.getElementById('newProfileName');
  const name = nameInput.value.trim();

  if (!name) {
    showStatusMessage('Please enter a profile name', true);
    return;
  }

  // Get current settings
  const settings = getCurrentSettings();

  // Create profile object
  const profile = {
    name,
    lastModified: Date.now(),
    settings,
  };

  // Save to storage
  chrome.storage.sync.get('savedProfiles', (result) => {
    const profiles = result.savedProfiles || [];

    // Check if profile with same name exists
    const existingIndex = profiles.findIndex((p) => p.name === name);

    if (existingIndex !== -1) {
      if (confirm(`A profile named "${name}" already exists. Do you want to overwrite it?`)) {
        profiles[existingIndex] = profile;
      } else {
        return;
      }
    } else {
      profiles.push(profile);
    }

    // Save updated profiles
    chrome.storage.sync.set({ savedProfiles: profiles }, () => {
      if (chrome.runtime.lastError) {
        showStatusMessage(`Error saving profile: ${chrome.runtime.lastError.message}`, true);
      } else {
        showStatusMessage(`Profile "${name}" saved successfully!`);
        nameInput.value = '';
        loadSavedProfiles();
      }
    });
  });
}

// Update statistics display
function updateStatisticsDisplay(settings) {
  const totalJoins = document.getElementById('statTotalJoins');
  const successRate = document.getElementById('statSuccessRate');
  const pointsSpent = document.getElementById('statPointsSpent');
  const avgCost = document.getElementById('statAvgCost');

  totalJoins.textContent = settings.totalJoins || 0;

  const successRateValue = settings.totalJoins
    ? Math.round((settings.successfulJoins / settings.totalJoins) * 100) : 0;
  successRate.textContent = `${successRateValue}%`;

  pointsSpent.textContent = `${settings.pointsSpent || 0}P`;

  const avgCostValue = settings.successfulJoins
    ? Math.round((settings.pointsSpent / settings.successfulJoins) * 10) / 10 : 0;
  avgCost.textContent = `${avgCostValue}P`;

  // Update join history
  updateJoinHistory(settings.joinHistory || []);
}

/**
 * Clear the wishlist cache and force a refresh on next load
 */
async function clearWishlistCache() {
  try {
    // First, import clearWishlistCache from the wishlist-utils module
    const { clearWishlistCache: clearCache } = await import('./content_scripts/utils/wishlist-utils.js');
    
    // Clear the cache
    await clearCache();
    
    // Set the force refresh flag
    chrome.storage.sync.set({ forceRefreshWishlist: true }, () => {
      if (chrome.runtime.lastError) {
        showStatusMessage(`Error setting refresh flag: ${chrome.runtime.lastError.message}`, true);
      } else {
        showStatusMessage('Wishlist cache cleared successfully! The wishlist will be refreshed on next page load.', false);
      }
    });
  } catch (e) {
    showStatusMessage(`Error clearing wishlist cache: ${e.message}`, true);
    console.error('[SG AutoJoin] Error clearing wishlist cache:', e);
  }
}

// Update join history list
function updateJoinHistory(history) {
  const historyList = document.getElementById('joinHistoryList');

  // Clear existing history
  historyList.innerHTML = '';

  if (history.length === 0) {
    const emptyMessage = document.createElement('p');
    emptyMessage.className = 'sg-text-center sg-text-muted';
    emptyMessage.textContent = 'No join history available';
    historyList.appendChild(emptyMessage);
    return;
  }

  // Create history items
  history.slice(0, 10).forEach((item) => {
    const historyItem = document.createElement('div');
    historyItem.className = 'sg-card sg-mb-2';

    const cardBody = document.createElement('div');
    cardBody.className = 'sg-card-body';

    const title = document.createElement('div');
    title.className = 'sg-font-weight-bold';
    title.textContent = item.title;

    const details = document.createElement('div');
    details.className = 'sg-d-flex sg-justify-content-between sg-mt-1';

    const cost = document.createElement('span');
    cost.className = 'sg-badge sg-badge-primary';
    cost.textContent = `${item.cost}P`;

    const date = document.createElement('span');
    date.className = 'sg-text-muted';
    date.textContent = new Date(item.date).toLocaleString();

    details.appendChild(cost);
    details.appendChild(date);

    cardBody.appendChild(title);
    cardBody.appendChild(details);
    historyItem.appendChild(cardBody);

    historyList.appendChild(historyItem);
  });
}

// Reset statistics
function resetStats() {
  if (confirm('Are you sure you want to reset all statistics? This cannot be undone.')) {
    chrome.storage.sync.set({
      totalJoins: 0,
      successfulJoins: 0,
      pointsSpent: 0,
      joinHistory: [],
    }, () => {
      if (chrome.runtime.lastError) {
        showStatusMessage(`Error resetting statistics: ${chrome.runtime.lastError.message}`, true);
      } else {
        showStatusMessage('Statistics reset successfully!');
        updateStatisticsDisplay({
          totalJoins: 0,
          successfulJoins: 0,
          pointsSpent: 0,
          joinHistory: [],
        });
      }
    });
  }
}

// Setup button handlers
function setupButtonHandlers() {
  // Save button
  saveBtn.addEventListener('click', saveSettings);

  // Cancel button
  cancelBtn.addEventListener('click', () => {
    if (confirm('Discard changes and reload settings?')) {
      loadSettings();
      showStatusMessage('Changes discarded.');
    }
  });

  // Reset button
  resetBtn.addEventListener('click', () => {
    if (confirm('Reset all settings to default values?')) {
      populateFormInputs(defaultSettings);
      showStatusMessage('Settings reset to defaults. Click Save to apply changes.');
    }
  });

  // Reset stats button
  resetStatsBtn.addEventListener('click', resetStats);

  // Save profile button
  saveProfileBtn.addEventListener('click', saveProfile);
  
  // Clear wishlist cache button
  const clearWishlistCacheBtn = document.getElementById('clearWishlistCacheBtn');
  if (clearWishlistCacheBtn) {
    clearWishlistCacheBtn.addEventListener('click', clearWishlistCache);
  }
}

/**
 * Get all current settings from form inputs
 * @returns {Object} Settings object with all current values
 */
function getCurrentSettings() {
  // Get existing statistics that we want to preserve
  let existingStats = {};
  
  chrome.storage.sync.get([
    'totalJoins', 
    'successfulJoins',
    'failedJoins',
    'skippedGiveaways',
    'pointsSpent',
    'joinHistory'
  ], (items) => {
    if (!chrome.runtime.lastError) {
      existingStats = {
        totalJoins: items.totalJoins || 0,
        successfulJoins: items.successfulJoins || 0,
        failedJoins: items.failedJoins || 0,
        skippedGiveaways: items.skippedGiveaways || 0,
        pointsSpent: items.pointsSpent || 0,
        joinHistory: items.joinHistory || []
      };
    }
  });
  
  // Get form values safely
  const getNumericValue = (input, defaultValue = 0) => {
    if (!input) return defaultValue;
    const value = parseInt(input.value, 10);
    return isNaN(value) ? defaultValue : value;
  };
  
  const getBooleanValue = (input, defaultValue = false) => {
    if (!input) return defaultValue;
    return !!input.checked;
  };

  // Get dynamic point buffer settings
  const dynamicPointBuffer = getBooleanValue(document.getElementById('dynamicPointBuffer'), false);
  
  // Get point buffer values for different times of day
  const morningBuffer = getNumericValue(document.getElementById('morningPointBuffer'), 50);
  const afternoonBuffer = getNumericValue(document.getElementById('afternoonPointBuffer'), 50);
  const eveningBuffer = getNumericValue(document.getElementById('eveningPointBuffer'), 50);
  const nightBuffer = getNumericValue(document.getElementById('nightPointBuffer'), 50);
  
  // Get point spending strategy
  const strategySelect = document.getElementById('pointSpendingStrategy');
  const pointSpendingStrategy = strategySelect ? strategySelect.value : 'balanced';
  
  // Get wishlist and publisher lists
  const blacklistPublishersInput = document.getElementById('blacklistPublishers');
  const whitelistPublishersInput = document.getElementById('whitelistPublishers');
  
  // Advanced filter options
  const skipEntryLimited = getBooleanValue(document.getElementById('skipEntryLimited'), true);
  const entryLimitThreshold = getNumericValue(document.getElementById('entryLimitThreshold'), 5000);
  const sortByEndingSoon = getBooleanValue(document.getElementById('sortByEndingSoon'), false);
  const endingSoonThreshold = getNumericValue(document.getElementById('endingSoonThreshold'), 60);
  const minLevel = getNumericValue(document.getElementById('minLevel'), 0);
  const useRegexFilters = getBooleanValue(document.getElementById('useRegexFilters'), false);

  // Join timing options (added for enhanced delay control)
  const joinDelayMin = 2000; // Default to 2 seconds
  const joinDelayMax = 3000; // Default to 3 seconds
  
  // Get wishlist cache settings
  const wishlistCacheTime = getNumericValue(document.getElementById('wishlistCacheTime'), 6);
  
  // Assemble complete settings object
  const settings = {
    // General
    autoModeEnabled: getBooleanValue(autoModeEnabledInput, false),
    joinOnPageLoad: getBooleanValue(joinOnPageLoadInput, true),
    joinInterval: getNumericValue(joinIntervalInput, 10),
    maxJoinsPerCycle: getNumericValue(maxJoinsPerCycleInput, 3),
    joinDelayMin,
    joinDelayMax,
    showJoinNotifications: getBooleanValue(showJoinNotificationsInput, true),
    showErrorNotifications: getBooleanValue(showErrorNotificationsInput, true),
    notificationDuration: getNumericValue(notificationDurationInput, 5),
    enableKeyboardShortcuts: getBooleanValue(enableKeyboardShortcutsInput, true),

    // Filters
    pointBuffer: getNumericValue(pointBufferInput, 50),
    maxCost: getNumericValue(maxCostInput, 100),
    minCost: getNumericValue(minCostInput, 0),
    maxLevel: getNumericValue(maxLevelInput, 10),
    minLevel,
    wishlistOnly: getBooleanValue(wishlistOnlyInput, true),
    skipGroups: getBooleanValue(skipGroupsInput, true),
    skipOwned: getBooleanValue(skipOwnedInput, true),
    skipEntryLimited,
    entryLimitThreshold,
    sortByEndingSoon,
    endingSoonThreshold,
    blacklistKeywords: formatKeywordsList(blacklistKeywordsInput?.value || ''),
    whitelistKeywords: formatKeywordsList(whitelistKeywordsInput?.value || ''),
    blacklistPublishers: formatKeywordsList(blacklistPublishersInput?.value || ''),
    whitelistPublishers: formatKeywordsList(whitelistPublishersInput?.value || ''),
    useRegexFilters,
    
    // Dynamic Point Buffer settings
    dynamicPointBuffer,
    pointsToPreserve: {
      morning: morningBuffer,
      afternoon: afternoonBuffer,
      evening: eveningBuffer,
      night: nightBuffer
    },
    pointSpendingStrategy,

    // Accessibility
    highContrastMode: getBooleanValue(highContrastModeInput, false),
    largeFontMode: getBooleanValue(largeFontModeInput, false),
    keyboardFocusMode: getBooleanValue(keyboardFocusModeInput, false),
    animationSpeed: getNumericValue(animationSpeedInput, 1),
    persistentNotifications: getBooleanValue(persistentNotificationsInput, false),
    audioFeedback: getBooleanValue(audioFeedbackInput, false),
    audioVolume: getNumericValue(audioVolumeInput, 70),
    
    // Preserve statistics
    ...existingStats,
    
    // Wishlist caching
    wishlistCacheTime: wishlistCacheTime, 
    forceRefreshWishlist: false, // Reset this flag when saving settings
    
    // Update timestamp
    lastUpdated: Date.now()
  };

  return settings;
}

// Format keywords list (trim lines and remove empty ones)
function formatKeywordsList(keywords) {
  return keywords
    .split('\n')
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join('\n');
}

// Save settings to storage
function saveSettings() {
  // Validate inputs
  if (!validateInputs()) {
    return;
  }

  // Get settings from form
  const settings = getCurrentSettings();

  // Save to storage
  chrome.storage.sync.set(settings, () => {
    if (chrome.runtime.lastError) {
      showStatusMessage(`Error saving settings: ${chrome.runtime.lastError.message}`, true);
    } else {
      showStatusMessage('Settings saved successfully!');

      // Also format the textarea values
      blacklistKeywordsInput.value = settings.blacklistKeywords;
      whitelistKeywordsInput.value = settings.whitelistKeywords;
    }
  });
}

/**
 * Validate all form inputs to ensure they have valid values
 * @returns {boolean} True if all inputs are valid
 */
function validateInputs() {
  // Create validation queue for all numeric inputs
  const validations = [
    {
      name: 'Point Buffer',
      value: parseInt(pointBufferInput.value, 10),
      min: 0,
      max: 10000,
      required: true
    },
    {
      name: 'Min Cost',
      value: parseInt(minCostInput.value, 10),
      min: 0,
      max: 300,
      required: true
    },
    {
      name: 'Max Cost',
      value: parseInt(maxCostInput.value, 10),
      min: 0,
      max: 300,
      required: true
    },
    {
      name: 'Min Level',
      value: parseInt(document.getElementById('minLevel')?.value || '0', 10),
      min: 0,
      max: 10,
      required: true
    },
    {
      name: 'Max Level',
      value: parseInt(maxLevelInput.value, 10),
      min: 0,
      max: 10,
      required: true
    },
    {
      name: 'Join Interval',
      value: parseInt(joinIntervalInput.value, 10),
      min: 5,
      max: 60,
      required: true
    },
    {
      name: 'Max Joins Per Cycle',
      value: parseInt(maxJoinsPerCycleInput.value, 10),
      min: 1,
      max: 10,
      required: true
    },
    {
      name: 'Notification Duration',
      value: parseInt(notificationDurationInput.value, 10),
      min: 1,
      max: 30,
      required: true
    },
    {
      name: 'Entry Limit Threshold',
      value: parseInt(document.getElementById('entryLimitThreshold')?.value || '0', 10),
      min: 10,
      max: 100000,
      required: false
    },
    {
      name: 'Ending Soon Threshold',
      value: parseInt(document.getElementById('endingSoonThreshold')?.value || '0', 10),
      min: 10,
      max: 1440, // 24 hours in minutes
      required: false
    }
  ];

  // Check each validation
  for (const validation of validations) {
    // Skip optional fields that aren't present in the form
    if (!validation.required && validation.value === 0) continue;
    
    // Check if value is a number
    if (isNaN(validation.value)) {
      showStatusMessage(`${validation.name} must be a number.`, true);
      return false;
    }
    
    // Check min/max bounds
    if (validation.value < validation.min) {
      showStatusMessage(`${validation.name} must be at least ${validation.min}.`, true);
      return false;
    }
    
    if (validation.value > validation.max) {
      showStatusMessage(`${validation.name} must be no more than ${validation.max}.`, true);
      return false;
    }
  }
  
  // Special validations for related fields
  const minCost = parseInt(minCostInput.value, 10);
  const maxCost = parseInt(maxCostInput.value, 10);
  
  if (minCost > maxCost) {
    showStatusMessage('Min Cost cannot be greater than Max Cost.', true);
    return false;
  }
  
  const minLevel = parseInt(document.getElementById('minLevel')?.value || '0', 10);
  const maxLevel = parseInt(maxLevelInput.value, 10);
  
  if (minLevel > maxLevel) {
    showStatusMessage('Min Level cannot be greater than Max Level.', true);
    return false;
  }
  
  // Validate point buffer compared to min/max cost to avoid unintended blocking
  const pointBuffer = parseInt(pointBufferInput.value, 10);
  if (pointBuffer > 0 && maxCost > 0 && pointBuffer >= maxCost) {
    showStatusMessage('Warning: Your Point Buffer is greater than or equal to your Max Cost. This may prevent joining giveaways.', true);
    // Allow this configuration but warn the user
  }
  
  // If we got here, everything is valid
  return true;
}

// Show status message
function showStatusMessage(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.add('show');
  statusMessage.classList.toggle('error', isError);
  statusMessage.classList.toggle('success', !isError);

  setTimeout(() => {
    statusMessage.classList.remove('show');
  }, 3500);
}
