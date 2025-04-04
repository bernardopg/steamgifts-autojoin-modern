import * as Selectors from "./selectors.js";
import * as State from "./state.js";

export function getCurrentPoints() {
  const localPoints = State.getPointsAtStart();
  if (localPoints !== null && localPoints !== -1) {
    return localPoints;
  }
  const pointsElement = document.querySelector(Selectors.pointsSelector);
  if (pointsElement?.textContent) {
    const pointsText = pointsElement.textContent.replace(/[^0-9]/g, "");
    const points = parseInt(pointsText, 10);
    if (!isNaN(points)) {
      console.log("[SG AutoJoin] Read current points from page:", points);
      State.setPointsAtStart(points);
      return points;
    }
  }
  if (State.getPointsAtStart() === null) {
    console.log(
      "[SG AutoJoin] Could not find or parse points element using selector:",
      Selectors.pointsSelector
    );
    State.setPointsAtStart(-1);
  }
  return null;
}

export function getXsrfTokenFromPage() {
  const tokenInput = document.querySelector(Selectors.xsrfTokenSelector);
  if (tokenInput?.value) {
    return tokenInput.value;
  }
  console.error(
    "[SG AutoJoin] XSRF Token input not found with selector:",
    Selectors.xsrfTokenSelector
  );
  return null;
}

export function extractGiveawayCodeFromUrl(url) {
  const match = url?.match(/\/giveaway\/([a-zA-Z0-9]{5})\//);
  return match ? match[1] : null;
}

export function extractCost(giveawayElement) {
  const potentialCostElements = giveawayElement.querySelectorAll(
    Selectors.listView_costSelector
  );
  for (const el of potentialCostElements) {
    if (el.textContent?.includes("P")) {
      const costString = el.textContent.replace(/[^0-9]/g, "");
      const cost = parseInt(costString, 10);
      return isNaN(cost) ? null : cost;
    }
  }
  return null;
}

export function extractRequiredLevel(giveawayElement) {
  let requiredLevel = 0;
  const levelElement = giveawayElement.querySelector(
    Selectors.listView_levelIndicatorSelector
  );
  if (levelElement?.textContent) {
    const levelMatch = levelElement.textContent.match(/\d+/);
    if (levelMatch) {
      requiredLevel = parseInt(levelMatch[0], 10);
    }
  }
  return requiredLevel;
}

function getGiveawayTitle(giveawayElement) {
  const titleElement = giveawayElement.querySelector(
    Selectors.listView_giveawayLinkSelector
  );
  return titleElement?.textContent?.trim().toLowerCase() || null;
}

export function isBlacklisted(giveawayElement) {
  const keywords = State.getBlacklistKeywords();
  if (keywords.length === 0) return false;
  const title = getGiveawayTitle(giveawayElement);
  if (!title) return false;
  return keywords.some((keyword) => title.includes(keyword));
}

export function isWhitelisted(giveawayElement) {
  const keywords = State.getWhitelistKeywords();
  if (keywords.length === 0) return false;
  const title = getGiveawayTitle(giveawayElement);
  if (!title) return false;
  return keywords.some((keyword) => title.includes(keyword));
}

export function isOwned(giveawayElement) {
  if (!State.shouldSkipOwned()) return false;
  return (
    !!giveawayElement.matches(Selectors.listView_ownedIndicatorSelector) ||
    !!giveawayElement.parentElement?.matches(
      Selectors.listView_ownedIndicatorSelector
    )
  );
}
