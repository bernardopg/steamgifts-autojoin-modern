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
  showJoinNotifications: true,
  showErrorNotifications: true,
  notificationDuration: 5,
  enableKeyboardShortcuts: true,

  // Filters
  pointBuffer: 0,
  maxCost: 100,
  minCost: 0,
  maxLevel: 10,
  wishlistOnly: false,
  skipGroups: false,
  skipOwned: true,
  blacklistKeywords: '',
  whitelistKeywords: '',

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
  pointsSpent: 0,
  joinHistory: [],
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
}

// Get current settings from form
function getCurrentSettings() {
  const settings = {
    // General
    autoModeEnabled: autoModeEnabledInput.checked,
    joinOnPageLoad: joinOnPageLoadInput.checked,
    joinInterval: parseInt(joinIntervalInput.value, 10),
    maxJoinsPerCycle: parseInt(maxJoinsPerCycleInput.value, 10),
    showJoinNotifications: showJoinNotificationsInput.checked,
    showErrorNotifications: showErrorNotificationsInput.checked,
    notificationDuration: parseInt(notificationDurationInput.value, 10),
    enableKeyboardShortcuts: enableKeyboardShortcutsInput.checked,

    // Filters
    pointBuffer: parseInt(pointBufferInput.value, 10),
    maxCost: parseInt(maxCostInput.value, 10),
    minCost: parseInt(minCostInput.value, 10),
    maxLevel: parseInt(maxLevelInput.value, 10),
    wishlistOnly: wishlistOnlyInput.checked,
    skipGroups: skipGroupsInput.checked,
    skipOwned: skipOwnedInput.checked,
    blacklistKeywords: formatKeywordsList(blacklistKeywordsInput.value),
    whitelistKeywords: formatKeywordsList(whitelistKeywordsInput.value),

    // Accessibility
    highContrastMode: highContrastModeInput.checked,
    largeFontMode: largeFontModeInput.checked,
    keyboardFocusMode: keyboardFocusModeInput.checked,
    animationSpeed: parseInt(animationSpeedInput.value, 10),
    persistentNotifications: persistentNotificationsInput.checked,
    audioFeedback: audioFeedbackInput.checked,
    audioVolume: parseInt(audioVolumeInput.value, 10),
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

// Validate form inputs
function validateInputs() {
  // Get numeric values
  const pointBuffer = parseInt(pointBufferInput.value, 10);
  const maxCost = parseInt(maxCostInput.value, 10);
  const minCost = parseInt(minCostInput.value, 10);
  const maxLevel = parseInt(maxLevelInput.value, 10);
  const joinInterval = parseInt(joinIntervalInput.value, 10);
  const maxJoinsPerCycle = parseInt(maxJoinsPerCycleInput.value, 10);

  // Validate point buffer
  if (isNaN(pointBuffer) || pointBuffer < 0) {
    showStatusMessage('Point Buffer must be a non-negative number.', true);
    return false;
  }

  // Validate costs
  if (isNaN(minCost) || minCost < 0) {
    showStatusMessage('Min Cost must be a non-negative number.', true);
    return false;
  }

  if (isNaN(maxCost) || maxCost < 0) {
    showStatusMessage('Max Cost must be a non-negative number.', true);
    return false;
  }

  if (minCost > maxCost && maxCost > 0) {
    showStatusMessage('Min Cost cannot be greater than Max Cost.', true);
    return false;
  }

  // Validate level
  if (isNaN(maxLevel) || maxLevel < 0 || maxLevel > 10) {
    showStatusMessage('Max Level must be a number between 0 and 10.', true);
    return false;
  }

  // Validate join interval
  if (isNaN(joinInterval) || joinInterval < 5 || joinInterval > 60) {
    showStatusMessage('Join Interval must be a number between 5 and 60.', true);
    return false;
  }

  // Validate max joins per cycle
  if (isNaN(maxJoinsPerCycle) || maxJoinsPerCycle < 1 || maxJoinsPerCycle > 10) {
    showStatusMessage('Max Joins Per Cycle must be a number between 1 and 10.', true);
    return false;
  }

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
