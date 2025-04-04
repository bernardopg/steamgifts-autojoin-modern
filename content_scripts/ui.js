import * as Selectors from './selectors.js';
import * as State from './state.js';

function createIndicatorElement() {
  if (document.getElementById(Selectors.statusIndicatorId)) { return; }
  const pointsElement = document.querySelector(Selectors.pointsSelector);
  const targetLocation = pointsElement?.parentElement;
  if (targetLocation) {
    const indicator = document.createElement("span");
    indicator.id = Selectors.statusIndicatorId;
    indicator.style.marginLeft = "10px";
    indicator.style.padding = "2px 6px";
    indicator.style.borderRadius = "3px";
    indicator.style.fontSize = "0.9em";
    indicator.style.fontWeight = "bold";
    indicator.style.color = "white";
    indicator.textContent = "AutoJoin: Loading...";
    indicator.style.backgroundColor = "#888";
    targetLocation.appendChild(indicator);
    console.log("[SG AutoJoin] Status indicator created.");
  } else {
    console.warn("[SG AutoJoin] Could not find target location for status indicator (near points).");
  }
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
