/**
 * DOM Utilities Module
 *
 * Utility functions for DOM manipulation, including:
 * - Creating and managing UI elements
 * - Finding and manipulating DOM elements
 * - Adding event listeners
 * - Managing CSS styles and animations
 */

import { SELECTORS } from '../selectors.js';
import { error, info } from './core-utils.js';

// Constants for UI elements
const TOAST_DISPLAY_TIME = 5000; // 5 seconds
const PROGRESS_INDICATOR_Z_INDEX = 9900;

/**
 * Inject custom stylesheet into the page
 * @param {string} cssText - The CSS text to inject
 * @returns {HTMLStyleElement} The created style element
 */
export function injectStyles(cssText) {
  try {
    // Check if the style element already exists
    const existingStyle = document.getElementById('sg-autojoin-styles');
    if (existingStyle) {
      return existingStyle;
    }

    // Create and inject the style element
    const styleEl = document.createElement('style');
    styleEl.id = 'sg-autojoin-styles';
    styleEl.textContent = cssText || getDefaultStyles();
    document.head.appendChild(styleEl);
    return styleEl;
  } catch (e) {
    error('Error injecting styles:', e);
    return null;
  }
}

/**
 * Get the default styles for the extension UI
 * @returns {string} CSS text for default styles
 */
function getDefaultStyles() {
  return `
    /* General UI improvements */
    .sg-toast-container {
      position: fixed;
      bottom: 20px;
      right: 20px;
      z-index: 9999;
    }
    
    .sg-toast {
      background-color: #1b2838;
      color: white;
      padding: 12px 16px;
      border-radius: 4px;
      margin-bottom: 8px;
      max-width: 350px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      animation: sg-slide-in-right 0.3s ease-out forwards;
      position: relative;
      overflow: hidden;
    }
    
    .sg-toast.sg-toast-success { background-color: #5c9e47; }
    .sg-toast.sg-toast-warning { background-color: #e67e22; }
    .sg-toast.sg-toast-error { background-color: #e74c3c; }
    
    .sg-toast-title {
      font-weight: 600;
      margin-bottom: 4px;
    }
    
    .sg-toast-message {
      font-size: 14px;
      opacity: 0.9;
    }
    
    .sg-toast-progress {
      height: 4px;
      background-color: rgba(255, 255, 255, 0.2);
      position: absolute;
      bottom: 0;
      left: 0;
      width: 100%;
    }
    
    .sg-toast-progress-bar {
      height: 100%;
      background-color: rgba(255, 255, 255, 0.7);
      width: 100%;
      animation: sg-toast-progress 5s cubic-bezier(0.1, 0.5, 0.9, 0.5) forwards;
    }
    
    /* Progress indicator */
    .sg-progress-indicator {
      position: fixed;
      bottom: 30px;
      left: 30px;
      width: 350px;
      background-color: white;
      border-radius: 4px;
      box-shadow: 0 2px 15px rgba(0, 0, 0, 0.3);
      z-index: ${PROGRESS_INDICATOR_Z_INDEX};
      overflow: hidden;
      animation: sg-slide-up 0.3s forwards;
    }
    
    .sg-progress-header {
      padding: 12px 16px;
      background-color: #145a8f;
      color: white;
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-weight: 600;
    }
    
    .sg-progress-content {
      padding: 16px;
    }
    
    .sg-progress-bar-container {
      height: 8px;
      background-color: #eee;
      border-radius: 4px;
      overflow: hidden;
      margin-bottom: 12px;
    }
    
    .sg-progress-bar {
      height: 100%;
      background-color: #145a8f;
      transition: width 0.3s ease;
    }
    
    .sg-progress-success .sg-progress-bar { background-color: #5c9e47; }
    .sg-progress-failure .sg-progress-bar { background-color: #e74c3c; }
    
    .sg-progress-details {
      display: flex;
      justify-content: space-between;
      margin-bottom: 16px;
      font-size: 14px;
    }
    
    /* Manual join button */
    .sgaj-manual-join-btn {
      background-color: #5a8e10;
      color: white;
      border: none;
      border-radius: 4px;
      padding: 6px 12px;
      font-size: 12px;
      cursor: pointer;
      transition: background-color 0.2s;
      margin-right: 5px;
      display: inline-flex;
      align-items: center;
    }
    
    .sgaj-manual-join-btn:hover {
      background-color: #497611;
    }
    
    /* Animations */
    @keyframes sg-slide-in-right {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    
    @keyframes sg-slide-out-right {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
    
    @keyframes sg-toast-progress {
      from { width: 100%; }
      to { width: 0; }
    }
    
    @keyframes sg-slide-up {
      from { transform: translateY(100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
    
    @keyframes sg-slide-down {
      from { transform: translateY(0); opacity: 1; }
      to { transform: translateY(100px); opacity: 0; }
    }
  `;
}

/**
 * Create a toast notification
 * @param {string} message - The notification message
 * @param {string} [type='info'] - Notification type (info, success, warning, error)
 * @param {number} [duration=5000] - Duration in ms before auto-closing
 * @returns {HTMLElement} The created toast element
 */
export function showToast(message, type = 'info', duration = TOAST_DISPLAY_TIME) {
  try {
    // Create toast container if it doesn't exist
    let toastContainer = document.getElementById(SELECTORS.EXTENSION_UI.TOAST_CONTAINER_ID);
    if (!toastContainer) {
      toastContainer = document.createElement('div');
      toastContainer.id = SELECTORS.EXTENSION_UI.TOAST_CONTAINER_ID;
      toastContainer.className = 'sg-toast-container';
      document.body.appendChild(toastContainer);
    }

    // Parse message into title and body if it contains a pipe
    let title = '';
    let body = message;

    if (typeof message === 'string' && message.includes('|')) {
      const parts = message.split('|');
      title = parts[0].trim();
      body = parts[1].trim();
    }

    // Create the toast
    const toast = document.createElement('div');
    toast.className = `sg-toast sg-toast-${type}`;

    // Create content
    let toastContent = '';

    if (title) {
      toastContent += `<div class="sg-toast-title">${title}</div>`;
    }

    toastContent += `<div class="sg-toast-message">${body}</div>`;
    toastContent += `
      <div class="sg-toast-progress">
        <div class="sg-toast-progress-bar"></div>
      </div>
    `;

    toast.innerHTML = toastContent;

    // Add to container
    toastContainer.appendChild(toast);

    // Set up auto-removal
    setTimeout(() => {
      toast.style.animation = 'sg-slide-out-right 0.3s forwards';
      setTimeout(() => {
        toastContainer.removeChild(toast);

        // Remove container if empty
        if (toastContainer.children.length === 0) {
          document.body.removeChild(toastContainer);
        }
      }, 300);
    }, duration);

    return toast;
  } catch (e) {
    error('Error showing toast:', e);
    return null;
  }
}

/**
 * Create a progress indicator
 * @param {string} initialMessage - Initial status message
 * @returns {Object} Progress indicator controller
 */
export function createProgressIndicator(initialMessage) {
  try {
    // Create container
    const container = document.createElement('div');
    container.className = 'sg-progress-indicator';

    // Create header
    const header = document.createElement('div');
    header.className = 'sg-progress-header';
    header.innerHTML = `
      <span>SteamGifts AutoJoin</span>
      <button class="sg-progress-close">&times;</button>
    `;

    // Create content
    const content = document.createElement('div');
    content.className = 'sg-progress-content';
    content.innerHTML = `
      <div class="sg-progress-bar-container">
        <div class="sg-progress-bar" style="width: 0%"></div>
      </div>
      <div class="sg-progress-details">
        <div class="sg-progress-status">${initialMessage || 'Processing...'}</div>
        <div class="sg-progress-percent">0%</div>
      </div>
    `;

    // Assemble and add to page
    container.appendChild(header);
    container.appendChild(content);
    document.body.appendChild(container);

    // Get references to elements
    const progressBar = content.querySelector('.sg-progress-bar');
    const progressStatus = content.querySelector('.sg-progress-status');
    const progressPercent = content.querySelector('.sg-progress-percent');
    const closeButton = header.querySelector('.sg-progress-close');

    // Add close button handler
    closeButton.addEventListener('click', () => {
      container.style.animation = 'sg-slide-down 0.3s forwards';
      setTimeout(() => {
        if (document.body.contains(container)) {
          document.body.removeChild(container);
        }
      }, 300);
    });

    // Return controller object
    return {
      /**
       * Update progress
       * @param {number} percent - Progress percentage (0-100)
       * @param {string} [message] - Optional status message
       */
      updateProgress: (percent, message) => {
        if (progressBar) {
          progressBar.style.width = `${percent}%`;
        }

        if (progressPercent) {
          progressPercent.textContent = `${Math.round(percent)}%`;
        }

        if (message && progressStatus) {
          progressStatus.textContent = message;
        }
      },

      /**
       * Complete the progress
       * @param {string} message - Completion message
       * @param {boolean} success - Whether operation was successful
       * @param {boolean} [autoClose=false] - Whether to auto-close after completion
       */
      complete: (message, success, autoClose = false) => {
        container.className = success
          ? 'sg-progress-indicator sg-progress-success'
          : 'sg-progress-indicator sg-progress-failure';

        if (progressBar) {
          progressBar.style.width = '100%';
        }

        if (progressPercent) {
          progressPercent.textContent = '100%';
        }

        if (progressStatus) {
          progressStatus.textContent = message || (success ? 'Completed successfully' : 'Failed');
        }

        if (autoClose) {
          setTimeout(() => {
            container.style.animation = 'sg-slide-down 0.3s forwards';
            setTimeout(() => {
              if (document.body.contains(container)) {
                document.body.removeChild(container);
              }
            }, 300);
          }, 3000);
        }
      },
    };
  } catch (e) {
    error('Error creating progress indicator:', e);
    return {
      updateProgress: () => {},
      complete: () => {},
    };
  }
}
