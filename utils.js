/**
 * SteamGifts AutoJoin Modern - Global Utilities
 */

// Toast notification system
const toastContainer = document.createElement('div');
toastContainer.className = 'sg-toast-container';
let toastCount = 0;
const MAX_TOASTS = 5;

// Initialize the toast container when the DOM is loaded
function initToastContainer() {
  if (!document.body.contains(toastContainer)) {
    document.body.appendChild(toastContainer);
  }
}

// Check if document is already loaded, otherwise wait for it
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initToastContainer);
} else {
  initToastContainer();
}

/**
 * Show a toast notification
 * @param {string} message - The message to display
 * @param {string} type - The type of toast: 'success', 'error', 'warning', 'info'
 * @param {object} options - Additional options
 * @param {string} options.title - Optional title for the toast
 * @param {number} options.duration - Duration in ms (default: 5000)
 * @param {boolean} options.dismissible - Whether the toast can be dismissed (default: true)
 */
export function showToast(message, type = 'info', options = {}) {
  const { title, duration = 5000, dismissible = true } = options;

  // Limit the number of toasts
  if (toastCount >= MAX_TOASTS) {
    const oldestToast = toastContainer.firstChild;
    if (oldestToast) {
      toastContainer.removeChild(oldestToast);
      toastCount--;
    }
  }

  // Create the toast element
  const toast = document.createElement('div');
  toast.className = `sg-toast sg-toast-${type}`;
  toast.setAttribute('role', 'alert');

  // Set up the toast icon based on type
  let iconClass = 'fa-info-circle';
  if (type === 'success') iconClass = 'fa-check-circle';
  if (type === 'error') iconClass = 'fa-exclamation-circle';
  if (type === 'warning') iconClass = 'fa-exclamation-triangle';

  // Build the toast content
  toast.innerHTML = `
    <div class="sg-toast-icon">
      <i class="fa ${iconClass}"></i>
    </div>
    <div class="sg-toast-content">
      ${title ? `<div class="sg-toast-title">${title}</div>` : ''}
      <div class="sg-toast-message">${message}</div>
    </div>
    ${dismissible ? '<button class="sg-toast-close" aria-label="Close">&times;</button>' : ''}
    <div class="sg-toast-progress">
      <div class="sg-toast-progress-bar"></div>
    </div>
  `;

  // Add dismiss functionality
  if (dismissible) {
    const closeBtn = toast.querySelector('.sg-toast-close');
    closeBtn.addEventListener('click', () => {
      removeToast(toast);
    });
  }

  // Add to the container
  toastContainer.appendChild(toast);
  toastCount++;

  // Set up auto-dismiss
  const progressBar = toast.querySelector('.sg-toast-progress-bar');
  progressBar.style.animationDuration = `${duration}ms`;

  // Schedule removal
  setTimeout(() => {
    removeToast(toast);
  }, duration);

  return toast;
}

function removeToast(toast) {
  if (toastContainer.contains(toast)) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    toast.style.transition = 'opacity 300ms, transform 300ms';

    setTimeout(() => {
      if (toastContainer.contains(toast)) {
        toastContainer.removeChild(toast);
        toastCount--;
      }
    }, 300);
  }
}

/**
 * Create a visual progress indicator for operations
 * @param {string} elementId - ID of the element to create or update
 * @param {number} value - Current progress value (0-100)
 * @param {string} text - Text to display
 * @param {string} type - Type of progress: 'primary', 'success', 'danger', etc.
 */
export function updateProgressIndicator(elementId, value, text, type = 'primary') {
  let progressElement = document.getElementById(elementId);

  if (!progressElement) {
    progressElement = document.createElement('div');
    progressElement.id = elementId;
    progressElement.className = 'sg-progress';
    progressElement.innerHTML = `
      <div class="sg-progress-bar sg-progress-bar-${type}" role="progressbar" 
           style="width: ${value}%" aria-valuenow="${value}" aria-valuemin="0" aria-valuemax="100">
        <span class="sg-progress-text">${text}</span>
      </div>
    `;

    // Find a suitable container, or append to body
    const container = document.querySelector('.sg-progress-container') || document.body;
    container.appendChild(progressElement);
  } else {
    const progressBar = progressElement.querySelector('.sg-progress-bar');
    progressBar.style.width = `${value}%`;
    progressBar.setAttribute('aria-valuenow', value);
    progressElement.querySelector('.sg-progress-text').textContent = text;

    // Update the type if it's changed
    progressBar.className = `sg-progress-bar sg-progress-bar-${type}`;
  }

  return progressElement;
}

/**
 * Format a number with appropriate suffix (K, M)
 * @param {number} num - The number to format
 * @returns {string} The formatted number
 */
export function formatNumber(num) {
  if (num >= 1000000) {
    return `${(num / 1000000).toFixed(1)}M`;
  }
  if (num >= 1000) {
    return `${(num / 1000).toFixed(1)}K`;
  }
  return num.toString();
}

/**
 * Create a badge element
 * @param {string} text - Text for the badge
 * @param {string} type - Badge type: 'primary', 'success', etc.
 * @param {object} options - Additional options
 * @returns {HTMLElement} The badge element
 */
export function createBadge(text, type = 'primary', options = {}) {
  const { tooltip, pulse } = options;

  const badge = document.createElement('span');
  badge.className = `sg-badge sg-badge-${type}`;
  badge.textContent = text;

  if (pulse) {
    badge.classList.add('sg-pulse');
  }

  if (tooltip) {
    const tooltipWrapper = document.createElement('div');
    tooltipWrapper.className = 'sg-tooltip';
    tooltipWrapper.appendChild(badge);

    const tooltipText = document.createElement('span');
    tooltipText.className = 'sg-tooltip-text';
    tooltipText.textContent = tooltip;
    tooltipWrapper.appendChild(tooltipText);

    return tooltipWrapper;
  }

  return badge;
}

/**
 * Apply high contrast mode
 * @param {boolean} enabled - Whether high contrast should be enabled
 */
export function setHighContrastMode(enabled) {
  if (enabled) {
    document.body.classList.add('sg-high-contrast');
  } else {
    document.body.classList.remove('sg-high-contrast');
  }

  // Save preference
  chrome.storage.sync.set({ accessibilityHighContrast: enabled });
}

/**
 * Apply large font mode
 * @param {boolean} enabled - Whether large font should be enabled
 */
export function setLargeFontMode(enabled) {
  if (enabled) {
    document.body.classList.add('sg-font-large');
  } else {
    document.body.classList.remove('sg-font-large');
  }

  // Save preference
  chrome.storage.sync.set({ accessibilityLargeFont: enabled });
}

/**
 * Enable keyboard focus visibility
 * @param {boolean} enabled - Whether keyboard focus should be visible
 */
export function setKeyboardFocusVisible(enabled) {
  if (enabled) {
    document.body.classList.add('sg-keyboard-focus-visible');
  } else {
    document.body.classList.remove('sg-keyboard-focus-visible');
  }

  // Save preference
  chrome.storage.sync.set({ accessibilityKeyboardFocus: enabled });
}

/**
 * Load accessibility settings
 */
export function loadAccessibilitySettings() {
  chrome.storage.sync.get(
    {
      accessibilityHighContrast: false,
      accessibilityLargeFont: false,
      accessibilityKeyboardFocus: false,
    },
    (items) => {
      if (items.accessibilityHighContrast) {
        document.body.classList.add('sg-high-contrast');
      }
      if (items.accessibilityLargeFont) {
        document.body.classList.add('sg-font-large');
      }
      if (items.accessibilityKeyboardFocus) {
        document.body.classList.add('sg-keyboard-focus-visible');
      }
    },
  );
}

// Load accessibility settings when the document is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', loadAccessibilitySettings);
} else {
  loadAccessibilitySettings();
}

/**
 * Debounce function to limit the rate at which a function can fire
 * @param {Function} func - The function to debounce
 * @param {number} wait - The debounce wait time in milliseconds
 * @returns {Function} - The debounced function
 */
export function debounce(func, wait) {
  let timeout;
  return function (...args) {
    const context = this;
    clearTimeout(timeout);
    timeout = setTimeout(() => func.apply(context, args), wait);
  };
}

/**
 * Save settings profile
 * @param {string} profileName - Name of the profile
 * @param {object} settings - Settings to save
 */
export function saveSettingsProfile(profileName, settings) {
  chrome.storage.sync.get({ settingsProfiles: {} }, (data) => {
    const profiles = data.settingsProfiles || {};
    profiles[profileName] = {
      ...settings,
      timestamp: Date.now(),
    };

    chrome.storage.sync.set({ settingsProfiles: profiles }, () => {
      if (chrome.runtime.lastError) {
        showToast('Error saving profile', 'error', {
          title: 'Profile Error',
        });
      } else {
        showToast(`Profile "${profileName}" saved`, 'success');
      }
    });
  });
}

/**
 * Load settings profile
 * @param {string} profileName - Name of the profile to load
 * @returns {Promise<object>} - The loaded settings
 */
export function loadSettingsProfile(profileName) {
  return new Promise((resolve, reject) => {
    chrome.storage.sync.get({ settingsProfiles: {} }, (data) => {
      const profiles = data.settingsProfiles || {};
      const profile = profiles[profileName];

      if (!profile) {
        reject(new Error(`Profile "${profileName}" not found`));
        return;
      }

      resolve(profile);
    });
  });
}

/**
 * Get all saved profiles
 * @returns {Promise<object>} - Object with profile names as keys and settings as values
 */
export function getSettingsProfiles() {
  return new Promise((resolve) => {
    chrome.storage.sync.get({ settingsProfiles: {} }, (data) => {
      resolve(data.settingsProfiles || {});
    });
  });
}
