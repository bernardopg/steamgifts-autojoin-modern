import * as State from "./state.js";
import * as Utils from "./utils.js";
import { initializeIndicator, updateIndicatorUI } from "./ui.js";
import { processListViewToAddButtons } from "./buttonHandler.js";
import { attemptAjaxJoin } from "./ajax.js";
import { initializeTimer, clearTimers } from "./timer.js";
import * as Selectors from "./selectors.js";

console.log("[SG AutoJoin] Main script loaded.");

async function processListViewForAutoJoin() {
  if (State.isProcessing()) {
    console.log(
      "[SG AutoJoin] Auto-join cycle skipped: previous cycle still processing."
    );
    return;
  }
  console.log("[SG AutoJoin] Processing list view (AUTO Mode)...");
  State.setIsProcessing(true);

  State.setXsrfToken(Utils.getXsrfTokenFromPage());
  if (!State.getXsrfToken()) {
    console.error(
      "[SG AutoJoin] Auto-join cannot proceed: XSRF Token not found."
    );
    State.setIsProcessing(false);
    return;
  }

  const initialPointsCheck = Utils.getCurrentPoints();
  if (initialPointsCheck === null) {
    console.log("[SG AutoJoin] Auto-join cannot proceed: Points not found.");
    State.setIsProcessing(false);
    return;
  }

  const giveawayElements = document.querySelectorAll(
    Selectors.listView_giveawaySelector
  );
  if (giveawayElements.length === 0) {
    console.log("[SG AutoJoin] Auto-join: No giveaways found on list view.");
    State.setIsProcessing(false);
    return;
  }

  console.log(
    `[SG AutoJoin] Auto-scan: ${giveawayElements.length} GAs. Points: ${initialPointsCheck}, Filters active.`
  );
  let joinAttemptedThisCycle = false;

  for (const giveawayElement of giveawayElements) {
    if (joinAttemptedThisCycle) break;

    const isAlreadyJoined =
      giveawayElement.classList.contains(
        Selectors.listView_alreadyJoinedClass
      ) ||
      giveawayElement.parentElement?.classList.contains(
        Selectors.listView_alreadyJoinedClass
      );
    if (isAlreadyJoined) continue;

    if (Utils.isBlacklisted(giveawayElement)) continue;
    if (Utils.isOwned(giveawayElement)) continue;

    const requiredLevel = Utils.extractRequiredLevel(giveawayElement);
    if (requiredLevel > State.getMaxLevel()) continue;

    const cost = Utils.extractCost(giveawayElement);
    if (cost === null) continue;

    const isWhitelisted = Utils.isWhitelisted(giveawayElement);

    if (!isWhitelisted) {
      const isGroup = !!giveawayElement.querySelector(
        Selectors.listView_groupIndicatorSelector
      );
      if (State.shouldSkipGroups() && isGroup) continue;
      const isWishlistedOnPage = !!giveawayElement.querySelector(
        Selectors.listView_wishlistIndicatorSelector
      );
      if (State.isWishlistOnly() && !isWishlistedOnPage) continue;
      if (cost > State.getMaxCost()) continue;
      if (cost < State.getMinCost()) continue;
    } else {
      console.log(`  -> Giveaway is whitelisted, bypassing some filters.`);
    }

    if (initialPointsCheck < cost + State.getPointBuffer()) continue;

    const linkElement = giveawayElement.querySelector(
      Selectors.listView_giveawayLinkSelector
    );
    const giveawayUrl = linkElement?.href;
    const giveawayCode = giveawayUrl
      ? Utils.extractGiveawayCodeFromUrl(giveawayUrl)
      : null;

    if (giveawayCode) {
      console.log(
        `  -> Auto-joining eligible giveaway (Code: ${giveawayCode}, Cost: ${cost}P)`
      );
      joinAttemptedThisCycle = true;
      const success = await attemptAjaxJoin(
        giveawayCode,
        cost,
        giveawayElement,
        null
      );

      if (success) {
        console.log("  -> Auto-join successful.");
      } else {
        console.log(
          "  -> Auto-join attempt failed or resulted in non-success."
        );
      }

      console.log(
        `  -> Delaying ${DELAY_BETWEEN_JOINS_MS / 1000}s after auto-attempt...`
      );
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_JOINS_MS)
      );
    }
  }

  if (!joinAttemptedThisCycle) {
    console.log(
      "[SG AutoJoin] Auto-join: No eligible giveaways found this cycle."
    );
  }

  State.setIsProcessing(false);
}

async function joinAllVisibleGiveaways() {
  if (State.isProcessing()) {
    alert("Already processing, please wait.");
    return;
  }
  console.log("[SG AutoJoin] Join All Visible requested...");
  State.setIsProcessing(true);
  State.setXsrfToken(Utils.getXsrfTokenFromPage());
  if (!State.getXsrfToken()) {
    alert("Could not find security token (XSRF). Please refresh.");
    State.setIsProcessing(false);
    return;
  }
  const giveawayElements = document.querySelectorAll(
    Selectors.listView_giveawaySelector
  );
  let joinedCount = 0,
    skippedCount = 0,
    failedCount = 0;
  for (const giveawayElement of giveawayElements) {
    const isAlreadyJoined =
      giveawayElement.classList.contains(
        Selectors.listView_alreadyJoinedClass
      ) ||
      giveawayElement.parentElement?.classList.contains(
        Selectors.listView_alreadyJoinedClass
      );
    if (isAlreadyJoined) continue;
    if (Utils.isBlacklisted(giveawayElement)) {
      skippedCount++;
      continue;
    }
    if (Utils.isOwned(giveawayElement)) {
      skippedCount++;
      continue;
    }
    const requiredLevel = Utils.extractRequiredLevel(giveawayElement);
    if (requiredLevel > State.getMaxLevel()) {
      skippedCount++;
      continue;
    }
    const cost = Utils.extractCost(giveawayElement);
    if (cost === null) {
      skippedCount++;
      continue;
    }
    const isWhitelisted = Utils.isWhitelisted(giveawayElement);
    if (!isWhitelisted) {
      const isGroup = !!giveawayElement.querySelector(
        Selectors.listView_groupIndicatorSelector
      );
      if (State.shouldSkipGroups() && isGroup) {
        skippedCount++;
        continue;
      }
      const isWishlistedOnPage = !!giveawayElement.querySelector(
        Selectors.listView_wishlistIndicatorSelector
      );
      if (State.isWishlistOnly() && !isWishlistedOnPage) {
        skippedCount++;
        continue;
      }
      if (cost > State.getMaxCost()) {
        skippedCount++;
        continue;
      }
      if (cost < State.getMinCost()) {
        skippedCount++;
        continue;
      }
    }
    const currentPoints = Utils.getCurrentPoints();
    if (
      currentPoints === null ||
      currentPoints < cost + State.getPointBuffer()
    ) {
      skippedCount++;
      continue;
    }
    const linkElement = giveawayElement.querySelector(
      Selectors.listView_giveawayLinkSelector
    );
    const giveawayUrl = linkElement?.href;
    const giveawayCode = giveawayUrl
      ? Utils.extractGiveawayCodeFromUrl(giveawayUrl)
      : null;
    if (giveawayCode) {
      console.log(`  -> Join All: Attempting ${giveawayCode} (Cost: ${cost}P)`);
      const button = giveawayElement.querySelector(
        `.${Selectors.manualJoinButtonClass}`
      );
      const success = await attemptAjaxJoin(
        giveawayCode,
        cost,
        giveawayElement,
        button
      );
      if (success) {
        joinedCount++;
      } else {
        failedCount++;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, DELAY_BETWEEN_JOINS_MS)
      );
    }
  }
  State.setIsProcessing(false);
  console.log(
    `[SG AutoJoin] Join All Visible finished. Joined: ${joinedCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`
  );
  alert(
    `Join All Visible finished.\nJoined: ${joinedCount}\nFailed: ${failedCount}\nSkipped (Filtered/No Points): ${skippedCount}`
  );
}

export function runCheck() {
  chrome.storage.sync.get(
    {
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
    },
    (items) => {
      if (chrome.runtime.lastError) {
        console.error("Error fetching settings:", chrome.runtime.lastError);
        clearTimers();
        return;
      }

      State.setAutoJoinEnabled(items.autoJoinEnabled);
      State.setAutoModeEnabled(items.autoModeEnabled);
      State.setPointBuffer(items.pointBuffer);
      State.setMaxCost(items.maxCost);
      State.setMinCost(items.minCost);
      State.setMaxLevel(items.maxLevel);
      State.setWishlistOnly(items.wishlistOnly);
      State.setSkipGroups(items.skipGroups);
      State.setSkipOwned(items.skipOwned);
      State.setBlacklistKeywords(items.blacklistKeywords);
      State.setWhitelistKeywords(items.whitelistKeywords);

      if (State.isAutoJoinEnabled()) {
        processListViewToAddButtons();
      }

      if (State.isAutoModeEnabled()) {
        processListViewForAutoJoin();
      }
    }
  );
}

function initialize() {
  console.log("[SG AutoJoin] Initializing main...");
  chrome.storage.session.get({ sessionJoinCount: 0 }, (data) => {
    State.setSessionJoinCount(data.sessionJoinCount);
    console.log(
      "[SG AutoJoin] Initial session join count:",
      State.getSessionJoinCount()
    );
  });

  initializeIndicator();

  chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === "sync") {
      if (changes.autoJoinEnabled) {
        State.setAutoJoinEnabled(!!changes.autoJoinEnabled.newValue);
        updateIndicatorUI(State.isAutoJoinEnabled());
      }
      if (changes.autoModeEnabled)
        State.setAutoModeEnabled(!!changes.autoModeEnabled.newValue);
      if (changes.pointBuffer)
        State.setPointBuffer(changes.pointBuffer.newValue);
      if (changes.maxCost) State.setMaxCost(changes.maxCost.newValue);
      if (changes.minCost) State.setMinCost(changes.minCost.newValue);
      if (changes.maxLevel) State.setMaxLevel(changes.maxLevel.newValue);
      if (changes.wishlistOnly)
        State.setWishlistOnly(changes.wishlistOnly.newValue);
      if (changes.skipGroups) State.setSkipGroups(changes.skipGroups.newValue);
      if (changes.skipOwned) State.setSkipOwned(changes.skipOwned.newValue);
      if (changes.blacklistKeywords)
        State.setBlacklistKeywords(changes.blacklistKeywords.newValue);
      if (changes.whitelistKeywords)
        State.setWhitelistKeywords(changes.whitelistKeywords.newValue);
      console.log("[SG AutoJoin] Settings updated via storage:", changes);
    }
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "getPopupState") {
      const points = State.getPointsAtStart();
      chrome.runtime.sendMessage({ action: "getJoinCount" }, (swResponse) => {
        if (chrome.runtime.lastError) {
          console.error(
            "Error getting join count from SW:",
            chrome.runtime.lastError.message
          );
          sendResponse({ points: points, joinCount: "Error" });
        } else if (swResponse?.error) {
          console.error(
            "SW reported error getting join count:",
            swResponse.error
          );
          sendResponse({ points: points, joinCount: "Error" });
        } else {
          State.setSessionJoinCount(swResponse?.count ?? 0); // Update local state too
          sendResponse({
            points: points,
            joinCount: State.getSessionJoinCount(),
          });
        }
      });
      return true;
    } else if (message.action === "joinAllVisible") {
      joinAllVisibleGiveaways()
        .then(() => {
          sendResponse({ status: "completed" });
        })
        .catch((err) => {
          console.error("Error during joinAllVisible:", err);
          sendResponse({ status: "error", message: err.message });
        });
      return true;
    }
    return false;
  });

  initializeTimer();
}

initialize();
