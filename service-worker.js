console.log('SG AutoJoin Service Worker Loaded.');

const SESSION_COUNT_KEY = 'sessionJoinCount';

function initializeSessionCount() {
  chrome.storage.session.set({ [SESSION_COUNT_KEY]: 0 }, () => {
    if (chrome.runtime.lastError) {
      console.error('Error initializing session count:', chrome.runtime.lastError.message);
    } else {
      console.log('Session join count initialized/reset to 0.');
    }
  });
}

chrome.runtime.onInstalled.addListener((details) => {
  console.log(`SG AutoJoin Extension ${details.reason}. Setting defaults.`);
  chrome.storage.sync.set({
    // General
    autoJoinEnabled: false,
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
  });
  initializeSessionCount();
  console.log('SG AutoJoin Default settings applied.');
});

chrome.runtime.onStartup.addListener(() => {
  initializeSessionCount();
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === 'incrementJoinCount') {
    chrome.storage.session.get([SESSION_COUNT_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting session count to increment:', chrome.runtime.lastError.message);
        return;
      }
      let currentCount = result[SESSION_COUNT_KEY] || 0;
      currentCount++;
      chrome.storage.session.set({ [SESSION_COUNT_KEY]: currentCount }, () => {
        if (chrome.runtime.lastError) {
          console.error('Error setting incremented session count:', chrome.runtime.lastError.message);
        }
      });
    });
  } else if (message.action === 'getJoinCount') {
    chrome.storage.session.get([SESSION_COUNT_KEY], (result) => {
      if (chrome.runtime.lastError) {
        console.error('Error getting session count:', chrome.runtime.lastError.message);
        sendResponse({ error: chrome.runtime.lastError.message });
      } else {
        sendResponse({ count: result[SESSION_COUNT_KEY] || 0 });
      }
    });
    return true;
  } else if (message.action === 'openOptionsPage') {
    // Open the options page
    chrome.runtime.openOptionsPage();
  }
});
