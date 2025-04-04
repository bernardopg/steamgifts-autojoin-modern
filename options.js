const pointBufferInput = document.getElementById("pointBuffer");
const maxCostInput = document.getElementById("maxCost");
const minCostInput = document.getElementById("minCost");
const maxLevelInput = document.getElementById("maxLevel");
const wishlistOnlyCheckbox = document.getElementById("wishlistOnly");
const skipGroupsCheckbox = document.getElementById("skipGroups");
const skipOwnedCheckbox = document.getElementById("skipOwned");
const blacklistKeywordsTextarea = document.getElementById("blacklistKeywords");
const whitelistKeywordsTextarea = document.getElementById("whitelistKeywords");
const autoModeEnabledCheckbox = document.getElementById("autoModeEnabled");
const saveButton = document.getElementById("saveButton");
const statusMessage = document.getElementById("statusMessage");

function showStatus(message, isError = false) {
  statusMessage.textContent = message;
  statusMessage.classList.remove("alert", "alert-success", "alert-danger", "alert-warning");
  statusMessage.classList.add("alert");
  statusMessage.classList.add(isError ? "alert-danger" : "alert-success");
  setTimeout(() => {
    statusMessage.textContent = "";
    statusMessage.classList.remove("alert", "alert-success", "alert-danger");
  }, 3500);
}

function loadSettings() {
  chrome.storage.sync.get(
    {
      pointBuffer: 0,
      maxCost: 100,
      minCost: 0,
      maxLevel: 10,
      wishlistOnly: false,
      skipGroups: false,
      skipOwned: true,
      blacklistKeywords: "",
      whitelistKeywords: "",
      autoModeEnabled: false,
    },
    (items) => {
      if (chrome.runtime.lastError) {
        console.error("Error loading settings:", chrome.runtime.lastError);
        showStatus("Error loading settings! " + chrome.runtime.lastError.message, true);
      } else {
        pointBufferInput.value = items.pointBuffer;
        maxCostInput.value = items.maxCost;
        minCostInput.value = items.minCost;
        maxLevelInput.value = items.maxLevel;
        wishlistOnlyCheckbox.checked = items.wishlistOnly;
        skipGroupsCheckbox.checked = items.skipGroups;
        skipOwnedCheckbox.checked = items.skipOwned;
        blacklistKeywordsTextarea.value = items.blacklistKeywords;
        whitelistKeywordsTextarea.value = items.whitelistKeywords;
        autoModeEnabledCheckbox.checked = items.autoModeEnabled;
      }
    }
  );
}

function saveSettings() {
  const pointBufferValue = parseInt(pointBufferInput.value, 10);
  const maxCostValue = parseInt(maxCostInput.value, 10);
  const minCostValue = parseInt(minCostInput.value, 10);
  const maxLevelValue = parseInt(maxLevelInput.value, 10);
  const wishlistOnlyValue = wishlistOnlyCheckbox.checked;
  const skipGroupsValue = skipGroupsCheckbox.checked;
  const skipOwnedValue = skipOwnedCheckbox.checked;
  const blacklistKeywordsValue = blacklistKeywordsTextarea.value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
  const whitelistKeywordsValue = whitelistKeywordsTextarea.value
        .split('\n')
        .map(line => line.trim())
        .filter(line => line.length > 0)
        .join('\n');
  const autoModeEnabledValue = autoModeEnabledCheckbox.checked;

  if (isNaN(pointBufferValue) || pointBufferValue < 0) { showStatus("Point Buffer must be non-negative.", true); return; }
  if (isNaN(maxCostValue) || maxCostValue < 0) { showStatus("Max Cost must be non-negative.", true); return; }
  if (isNaN(minCostValue) || minCostValue < 0) { showStatus("Min Cost must be non-negative.", true); return; }
  if (minCostValue > maxCostValue && maxCostValue > 0) { showStatus("Min Cost cannot be > Max Cost.", true); return; }
  if (isNaN(maxLevelValue) || maxLevelValue < 0 || maxLevelValue > 10) { showStatus("Max Level must be 0-10.", true); return; }

  blacklistKeywordsTextarea.value = blacklistKeywordsValue;
  whitelistKeywordsTextarea.value = whitelistKeywordsValue;

  const settingsToSave = {
    pointBuffer: pointBufferValue,
    maxCost: maxCostValue,
    minCost: minCostValue,
    maxLevel: maxLevelValue,
    wishlistOnly: wishlistOnlyValue,
    skipGroups: skipGroupsValue,
    skipOwned: skipOwnedValue,
    blacklistKeywords: blacklistKeywordsValue,
    whitelistKeywords: whitelistKeywordsValue,
    autoModeEnabled: autoModeEnabledValue,
  };

  chrome.storage.sync.set(settingsToSave, () => {
    if (chrome.runtime.lastError) {
      console.error("Error saving settings:", chrome.runtime.lastError);
      showStatus("Error saving settings! " + chrome.runtime.lastError.message, true);
    } else {
      console.log("Settings saved:", settingsToSave);
      showStatus("Settings saved successfully!");
    }
  });
}

document.addEventListener("DOMContentLoaded", loadSettings);
saveButton.addEventListener("click", saveSettings);
