const enableSwitch = document.getElementById("enableSwitch");
const statusIndicator = document.getElementById("statusIndicator");
const currentPointsSpan = document.getElementById("currentPoints");
const joinCountSpan = document.getElementById("joinCount");
const autoModeStatusSpan = document.getElementById("autoModeStatus");
const joinAllVisibleBtn = document.getElementById("joinAllVisibleBtn");

function updateStatusIndicator(enabled) {
  statusIndicator.textContent = enabled ? "Features ENABLED" : "Features DISABLED";
  statusIndicator.classList.remove("alert-success", "alert-danger", "alert-secondary");
  statusIndicator.classList.add(enabled ? "alert-success" : "alert-danger");
}

function updateAutoModeStatus(enabled) {
    autoModeStatusSpan.textContent = enabled ? "ON" : "OFF";
    autoModeStatusSpan.style.color = enabled ? "#198754" : "#dc3545";
}

function updatePopupState(state) {
    if (state) {
        currentPointsSpan.textContent = (typeof state.points === 'number' && state.points !== -1) ? `${state.points}P` : "N/A";
        joinCountSpan.textContent = (typeof state.joinCount === 'number') ? state.joinCount : "N/A";
    } else {
        currentPointsSpan.textContent = "N/A";
        joinCountSpan.textContent = "N/A";
    }
}

function fetchPopupState() {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id && tabs[0].url?.includes("steamgifts.com")) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "getPopupState" }, (response) => {
                if (chrome.runtime.lastError) {
                    console.warn("Popup: Could not message content script for state.", chrome.runtime.lastError.message);
                    updatePopupState(null);
                } else {
                    updatePopupState(response);
                }
            });
        } else {
             updatePopupState(null);
        }
    });
}

document.addEventListener("DOMContentLoaded", () => {
  chrome.storage.sync.get(["autoJoinEnabled", "autoModeEnabled"], (data) => {
    if (chrome.runtime.lastError) {
        console.error("Error loading settings:", chrome.runtime.lastError.message);
        statusIndicator.textContent = "Error loading";
        autoModeStatusSpan.textContent = "Error";
        statusIndicator.classList.add("alert-warning");
        return;
    }
    const isEnabled = !!data.autoJoinEnabled;
    const isAutoMode = !!data.autoModeEnabled;

    enableSwitch.checked = isEnabled;
    updateStatusIndicator(isEnabled);
    updateAutoModeStatus(isAutoMode);
    fetchPopupState();
  });
});

enableSwitch.addEventListener("change", () => {
  const isEnabled = enableSwitch.checked;
  chrome.storage.sync.set({ autoJoinEnabled: isEnabled }, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving setting:", chrome.runtime.lastError.message);
      statusIndicator.textContent = "Error saving!";
      statusIndicator.classList.add("alert-warning");
    } else {
      updateStatusIndicator(isEnabled);
    }
  });
});

joinAllVisibleBtn.addEventListener("click", () => {
    joinAllVisibleBtn.disabled = true;
    joinAllVisibleBtn.innerHTML = '<i class="fa fa-spinner fa-spin"></i> Joining...';

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        if (tabs[0]?.id && tabs[0].url?.includes("steamgifts.com")) {
            chrome.tabs.sendMessage(tabs[0].id, { action: "joinAllVisible" }, (response) => {
                 if (chrome.runtime.lastError) {
                    console.error("Error sending joinAllVisible:", chrome.runtime.lastError.message);
                    alert("Could not send command to page. Is it a SteamGifts page?");
                 } else {
                    console.log("Join All response:", response);
                 }
                 setTimeout(() => {
                     joinAllVisibleBtn.disabled = false;
                     joinAllVisibleBtn.innerHTML = '<i class="fa fa-bolt"></i> Join All Visible & Eligible';
                     fetchPopupState();
                 }, 1500);
            });
        } else {
             alert("Not on a SteamGifts page.");
             joinAllVisibleBtn.disabled = false;
             joinAllVisibleBtn.innerHTML = '<i class="fa fa-bolt"></i> Join All Visible & Eligible';
        }
    });
});

chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'sync') {
        if (changes.autoModeEnabled) updateAutoModeStatus(!!changes.autoModeEnabled.newValue);
        if (changes.autoJoinEnabled) {
            updateStatusIndicator(!!changes.autoJoinEnabled.newValue);
            enableSwitch.checked = !!changes.autoJoinEnabled.newValue;
        }
    }
});
