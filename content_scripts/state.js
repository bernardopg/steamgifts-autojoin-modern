let _isProcessing = false;
let _pointsAtStart = null;
let _autoJoinEnabled = false;
let _currentPointBuffer = 0;
let _currentMaxCost = 100;
let _currentMinCost = 0;
let _currentMaxLevel = 10;
let _currentWishlistOnly = false;
let _currentSkipGroups = false;
let _currentSkipOwned = true;
let _currentBlacklistKeywords = [];
let _currentWhitelistKeywords = [];
let _currentAutoModeEnabled = false;
let _currentXsrfToken = null;
let _sessionJoinCount = 0;

export function isProcessing() {
  return _isProcessing;
}
export function setIsProcessing(value) {
  _isProcessing = value;
}

export function getPointsAtStart() {
  return _pointsAtStart;
}
export function setPointsAtStart(value) {
  _pointsAtStart = value;
}

export function isAutoJoinEnabled() {
  return _autoJoinEnabled;
}
export function setAutoJoinEnabled(value) {
  _autoJoinEnabled = value;
}

export function isAutoModeEnabled() {
  return _currentAutoModeEnabled;
}
export function setAutoModeEnabled(value) {
  _currentAutoModeEnabled = value;
}

export function getPointBuffer() {
  return _currentPointBuffer;
}
export function setPointBuffer(value) {
  _currentPointBuffer = value;
}

export function getMaxCost() {
  return _currentMaxCost;
}
export function setMaxCost(value) {
  _currentMaxCost = value;
}

export function getMinCost() {
  return _currentMinCost;
}
export function setMinCost(value) {
  _currentMinCost = value;
}

export function getMaxLevel() {
  return _currentMaxLevel;
}
export function setMaxLevel(value) {
  _currentMaxLevel = value;
}

export function isWishlistOnly() {
  return _currentWishlistOnly;
}
export function setWishlistOnly(value) {
  _currentWishlistOnly = value;
}

export function shouldSkipGroups() {
  return _currentSkipGroups;
}
export function setSkipGroups(value) {
  _currentSkipGroups = value;
}

export function shouldSkipOwned() {
  return _currentSkipOwned;
}
export function setSkipOwned(value) {
  _currentSkipOwned = value;
}

export function getBlacklistKeywords() {
  return _currentBlacklistKeywords;
}
export function setBlacklistKeywords(keywordsString) {
  _currentBlacklistKeywords = keywordsString
    .split("\n")
    .map((kw) => kw.trim().toLowerCase())
    .filter((kw) => kw.length > 0);
}

export function getWhitelistKeywords() {
  return _currentWhitelistKeywords;
}
export function setWhitelistKeywords(keywordsString) {
  _currentWhitelistKeywords = keywordsString
    .split("\n")
    .map((kw) => kw.trim().toLowerCase())
    .filter((kw) => kw.length > 0);
}

export function getXsrfToken() {
  return _currentXsrfToken;
}
export function setXsrfToken(value) {
  _currentXsrfToken = value;
}

export function getSessionJoinCount() {
  return _sessionJoinCount;
}
export function incrementSessionJoinCount() {
  _sessionJoinCount++;
  chrome.storage.session.set({ sessionJoinCount: _sessionJoinCount }); // Also update session storage
}
export function setSessionJoinCount(value) {
  _sessionJoinCount = value;
}
