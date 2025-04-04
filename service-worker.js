console.log("Service Worker Loaded.");

const SESSION_COUNT_KEY = "sessionJoinCount";

function initializeSessionCount() {
  chrome.storage.session.set({ [SESSION_COUNT_KEY]: 0 }, () => {
    if (chrome.runtime.lastError) {
      console.error(
        "Error initializing session count:",
        chrome.runtime.lastError.message
      );
    } else {
      console.log("Session join count initialized/reset to 0.");
    }
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`Extension ${details.reason}. Setting defaults.`);
  chrome.storage.sync.set({
    autoJoinEnabled: false,
    autoModeEnabled: false,
    pointBuffer: 0,
    maxCost: 100,
    minCost: 0,
    maxLevel: 10,
    wishlistOnly: false,
    skipGroups: false,
    skipOwned: true,
    blacklistKeywords: "",
    whitelistKeywords: "",
  });
  initializeSessionCount();
  console.log("Default settings applied.");
});

chrome.runtime.onStartup.addListener(() => {
  initializeSessionCount();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "incrementJoinCount") {
    chrome.storage.session.get([SESSION_COUNT_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error getting session count to increment:",
          chrome.runtime.lastError.message
        );
        return;
      }
      let currentCount = result[SESSION_COUNT_KEY] || 0;
      currentCount++;
      chrome.storage.session.set({ [SESSION_COUNT_KEY]: currentCount }, () => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error setting incremented session count:",
            chrome.runtime.lastError.message
          );
        } else {
          console.log("SW incremented join count to:", currentCount);
        }
      });
    });
  } else if (message.action === "getJoinCount") {
    chrome.storage.session.get([SESSION_COUNT_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error(
          "Error getting session count:",
          chrome.runtime.lastError.message
        );
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ count: result[SESSION_COUNT_KEY] || 0 });
      }
    });
    return true;
  }
});
