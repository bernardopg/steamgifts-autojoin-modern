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

export function initializeIndicator() {
    console.log("[SG AutoJoin] Initializing Indicator UI...");
    createIndicatorElement();
    chrome.storage.sync.get("autoJoinEnabled", (data) => {
        const initialEnabledState = !!data.autoJoinEnabled;
        State.setAutoJoinEnabled(initialEnabledState);
        updateIndicatorUI(initialEnabledState);
        console.log("[SG AutoJoin] Initial indicator state:", initialEnabledState);
    });
}
