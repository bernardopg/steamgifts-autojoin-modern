import * as State from './state.js';
import * as Utils from './utils.js';
import { initializeIndicator, updateIndicatorUI } from './ui.js';
import { processListViewToAddButtons } from './buttonHandler.js';
import { attemptAjaxJoin, getSessionStats, showSessionStats } from './ajax.js';
import { initializeTimer, clearTimers } from './timer.js';
import * as Selectors from './selectors.js';

// Constants
const DELAY_BETWEEN_JOINS_MS = 1500;
const AUTO_JOIN_INTERVAL_MS = 10000; // 10 seconds between auto-join attempts
let MAX_JOIN_ATTEMPTS_PER_CYCLE = 3; // Maximum number of join attempts per auto cycle

console.log("[SG AutoJoin] Main script loaded with advanced features.");

/**
 * Process the list view for auto-join functionality
 * Automatically joins eligible giveaways based on filters
 */
async function processListViewForAutoJoin() {
    if (State.isProcessing()) {
        console.log("[SG AutoJoin] Auto-join cycle skipped: previous cycle still processing.");
        return;
    }

    console.log("[SG AutoJoin] Processing list view (AUTO Mode)...");
    State.setIsProcessing(true);

    // Ensure styles are injected
    Utils.injectStyles();

    // Apply visual enhancements
    chrome.storage.sync.get({
        showEntryStats: true,
        highlightEndingSoon: true
    }, (settings) => {
        if (settings.showEntryStats) {
            Utils.showEntryStats();
        }

        if (settings.highlightEndingSoon) {
            Utils.highlightEndingSoonGiveaways();
        }
    });

    // Create progress indicator
    const progressIndicator = Utils.createProgressIndicator("Starting auto-join cycle...");

    try {
        // Verify XSRF token
        State.setXsrfToken(Utils.getXsrfTokenFromPage());
        if (!State.getXsrfToken()) {
            console.error("[SG AutoJoin] Auto-join cannot proceed: XSRF Token not found.");
            Utils.showToast("Auto-join failed: XSRF Token not found", "error");
            progressIndicator.complete("Failed - Token not found", false);
            State.setIsProcessing(false);
            return;
        }

        // Check points
        const initialPointsCheck = Utils.getCurrentPoints();
        if (initialPointsCheck === null) {
            console.log("[SG AutoJoin] Auto-join cannot proceed: Points not found.");
            Utils.showToast("Auto-join failed: Points not found", "error");
            progressIndicator.complete("Failed - Points not found", false);
            State.setIsProcessing(false);
            return;
        }

        // Get all giveaway elements
        const giveawayElements = document.querySelectorAll(Selectors.listView_giveawaySelector);
        if (giveawayElements.length === 0) {
            console.log("[SG AutoJoin] Auto-join: No giveaways found on list view.");
            Utils.showToast("No giveaways found on this page", "info");
            progressIndicator.complete("No giveaways found", true);
            State.setIsProcessing(false);
            return;
        }

        console.log(`[SG AutoJoin] Auto-scan: ${giveawayElements.length} GAs. Points: ${initialPointsCheck}, Filters active.`);

        // Show initial progress
        progressIndicator.updateProgress(10, `Scanning ${giveawayElements.length} giveaways...`);

        let joinAttemptedThisCycle = 0;
        let eligibleGiveaways = [];

        // First scan all giveaways to find eligible ones
        for (const giveawayElement of giveawayElements) {
            const isAlreadyJoined =
                giveawayElement.classList.contains(Selectors.listView_alreadyJoinedClass) ||
                giveawayElement.parentElement?.classList.contains(Selectors.listView_alreadyJoinedClass);

            if (isAlreadyJoined) continue;
            if (Utils.isBlacklisted(giveawayElement)) continue;
            if (Utils.isOwned(giveawayElement)) continue;

            const requiredLevel = Utils.extractRequiredLevel(giveawayElement);
            if (requiredLevel > State.getMaxLevel()) continue;
            if (requiredLevel < State.getMinLevel()) continue;

            const cost = Utils.extractCost(giveawayElement);
            if (cost === null) continue;

            // Skip entry-limited giveaways if that option is enabled
            if (Utils.isEntryLimited(giveawayElement)) continue;

            const isWhitelisted = Utils.isWhitelisted(giveawayElement);

            if (!isWhitelisted) {
                const isGroup = !!giveawayElement.querySelector(Selectors.listView_groupIndicatorSelector);
                if (State.shouldSkipGroups() && isGroup) continue;

                const isWishlistedOnPage = !!giveawayElement.querySelector(Selectors.listView_wishlistIndicatorSelector);
                if (State.isWishlistOnly() && !isWishlistedOnPage) continue;

                if (cost > State.getMaxCost()) continue;
                if (cost < State.getMinCost()) continue;
            }

            // Calculate point buffer based on time of day if dynamic buffer is enabled
            const pointBuffer = State.isDynamicPointBufferEnabled()
                ? State.calculateDynamicPointBuffer()
                : State.getPointBuffer();

            const currentPoints = Utils.getCurrentPoints() || initialPointsCheck;
            if (currentPoints < cost + pointBuffer) continue;

            const linkElement = giveawayElement.querySelector(Selectors.listView_giveawayLinkSelector);
            const giveawayUrl = linkElement?.href;
            const giveawayCode = giveawayUrl ? Utils.extractGiveawayCodeFromUrl(giveawayUrl) : null;
            const giveawayTitle = linkElement?.textContent?.trim() || 'Unknown Game';

            // Extract end time for sorting by ending soon
            const endTimeMinutes = Utils.extractEndTime(giveawayElement);

            // Extract publisher for display
            const publisher = Utils.extractPublisher(giveawayElement);

            if (giveawayCode) {
                eligibleGiveaways.push({
                    element: giveawayElement,
                    code: giveawayCode,
                    cost: cost,
                    title: giveawayTitle,
                    isWhitelisted: isWhitelisted,
                    endTimeMinutes: endTimeMinutes,
                    publisher: publisher
                });
            }
        }

        // Sort eligible giveaways based on preferences
        eligibleGiveaways.sort((a, b) => {
            // Whitelist has highest priority
            if (a.isWhitelisted !== b.isWhitelisted) {
                return a.isWhitelisted ? -1 : 1;
            }

            // If sort by ending soon is enabled and both have valid end times
            if (State.isSortByEndingSoonEnabled() &&
                a.endTimeMinutes !== null &&
                b.endTimeMinutes !== null) {
                // Check if either is below the threshold
                const threshold = State.getEndingSoonThreshold();
                const aIsEndingSoon = a.endTimeMinutes <= threshold;
                const bIsEndingSoon = b.endTimeMinutes <= threshold;

                // If one is ending soon and the other isn't
                if (aIsEndingSoon !== bIsEndingSoon) {
                    return aIsEndingSoon ? -1 : 1; // Prioritize the one ending soon
                }

                // If both are ending soon (or both aren't), sort by time remaining
                if (aIsEndingSoon && bIsEndingSoon) {
                    return a.endTimeMinutes - b.endTimeMinutes; // Less time remaining first
                }
            }

            // Fall back to cost sorting
            return b.cost - a.cost; // Higher cost first
        });

        // Update progress
        progressIndicator.updateProgress(
            30,
            `Found ${eligibleGiveaways.length} eligible giveaways`
        );

        // Join giveaways up to the maximum allowed per cycle
        const maxJoins = Math.min(eligibleGiveaways.length, MAX_JOIN_ATTEMPTS_PER_CYCLE);

        if (maxJoins > 0) {
            Utils.showToast(
                `Found ${eligibleGiveaways.length} eligible giveaways. Joining up to ${maxJoins}.`,
                'info'
            );
        } else {
            Utils.showToast('No eligible giveaways found this cycle', 'info');
        }

        for (let i = 0; i < maxJoins; i++) {
            const giveaway = eligibleGiveaways[i];

            // Update progress
            progressIndicator.updateProgress(
                30 + (60 * (i + 1) / maxJoins),
                `Joining ${i + 1}/${maxJoins}: ${giveaway.title.substring(0, 25)}...`
            );

            console.log(`  -> Auto-joining eligible giveaway (Code: ${giveaway.code}, Cost: ${giveaway.cost}P): ${giveaway.title}`);
            joinAttemptedThisCycle++;

            // Scroll the giveaway into view
            giveaway.element.scrollIntoView({ behavior: 'smooth', block: 'center' });

            // Attempt to join
            await attemptAjaxJoin(giveaway.code, giveaway.cost, giveaway.element, null);

            console.log(`  -> Delaying ${DELAY_BETWEEN_JOINS_MS / 1000}s after auto-attempt...`);
            await new Promise((resolve) => setTimeout(resolve, DELAY_BETWEEN_JOINS_MS));
        }

        // Show session stats
        if (joinAttemptedThisCycle > 0) {
            showSessionStats();
        }

        // Complete progress
        progressIndicator.complete(
            joinAttemptedThisCycle > 0
                ? `Joined ${getSessionStats().joined} giveaways`
                : "No eligible giveaways found",
            true
        );
        
        if (!joinAttemptedThisCycle) {
            console.log("[SG AutoJoin] Auto-join: No eligible giveaways found this cycle.");
        }

    } catch (error) {
        console.error("[SG AutoJoin] Error during auto-join cycle:", error);
        progressIndicator.complete("Error during auto-join", false);
        Utils.showToast("Error during auto-join cycle", "error");
    } finally {
        State.setIsProcessing(false);
    }
}

/**
 * Join all visible and eligible giveaways on the page
 * @returns {Promise<Object>} Results of the operation
 */
async function joinAllVisibleGiveaways() {
    if (State.isProcessing()) {
        Utils.showToast("Already processing, please wait", "warning");
        return { status: "error", message: "Already processing" };
    }

    console.log("[SG AutoJoin] Join All Visible requested...");
    State.setIsProcessing(true);

    // Ensure styles are injected
    Utils.injectStyles();

    // Create progress indicator
    const progressIndicator = Utils.createProgressIndicator("Starting Join All operation...");

    try {
        // Get XSRF token
        State.setXsrfToken(Utils.getXsrfTokenFromPage());
        if (!State.getXsrfToken()) {
            Utils.showToast("Could not find security token (XSRF)", "error");
            progressIndicator.complete("Failed - Token not found", false);
            State.setIsProcessing(false);
            return { status: "error", message: "XSRF token not found" };
        }

        // Get all giveaway elements
        const giveawayElements = document.querySelectorAll(Selectors.listView_giveawaySelector);
        progressIndicator.updateProgress(10, `Scanning ${giveawayElements.length} giveaways...`);

        let joinedCount = 0, skippedCount = 0, failedCount = 0;
        let pointsSpent = 0;
        let costs = [];

        // Process each giveaway
        for (let i = 0; i < giveawayElements.length; i++) {
            const giveawayElement = giveawayElements[i];

            // Update progress
            progressIndicator.updateProgress(
                10 + (85 * (i + 1) / giveawayElements.length),
                `Processing ${i + 1}/${giveawayElements.length}...`
            );

            // Check if already joined
            const isAlreadyJoined =
                giveawayElement.classList.contains(Selectors.listView_alreadyJoinedClass) ||
                giveawayElement.parentElement?.classList.contains(Selectors.listView_alreadyJoinedClass);

            if (isAlreadyJoined) {
                skippedCount++;
                continue;
            }

            // Apply filters
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

            if (requiredLevel < State.getMinLevel()) {
                skippedCount++;
                continue;
            }

            const cost = Utils.extractCost(giveawayElement);
            if (cost === null) {
                skippedCount++;
                continue;
            }

            // Skip entry-limited giveaways if that option is enabled
            if (Utils.isEntryLimited(giveawayElement)) {
                skippedCount++;
                continue;
            }

            const isWhitelisted = Utils.isWhitelisted(giveawayElement);
            if (!isWhitelisted) {
                const isGroup = !!giveawayElement.querySelector(Selectors.listView_groupIndicatorSelector);
                if (State.shouldSkipGroups() && isGroup) {
                    skippedCount++;
                    continue;
                }

                const isWishlistedOnPage = !!giveawayElement.querySelector(Selectors.listView_wishlistIndicatorSelector);
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

            // Check if enough points
            // Calculate point buffer based on time of day if dynamic buffer is enabled
            const pointBuffer = State.isDynamicPointBufferEnabled()
                ? State.calculateDynamicPointBuffer()
                : State.getPointBuffer();

            const currentPoints = Utils.getCurrentPoints();
            if (currentPoints === null || currentPoints < cost + pointBuffer) {
                skippedCount++;
                continue;
            }

            // Get giveaway details
            const linkElement = giveawayElement.querySelector(Selectors.listView_giveawayLinkSelector);
            const giveawayUrl = linkElement?.href;
            const giveawayCode = giveawayUrl ? Utils.extractGiveawayCodeFromUrl(giveawayUrl) : null;
            const giveawayTitle = linkElement?.textContent?.trim() || 'Unknown Game';

            if (giveawayCode) {
                console.log(`  -> Join All: Attempting ${giveawayCode} (Cost: ${cost}P) - ${giveawayTitle}`);

                // Scroll to the giveaway
                giveawayElement.scrollIntoView({ behavior: 'smooth', block: 'center' });

                // Get button if it exists
                const button = giveawayElement.querySelector(`.${Selectors.manualJoinButtonClass}`);

                // Join the giveaway
                const success = await attemptAjaxJoin(giveawayCode, cost, giveawayElement, button);

                if (success) {
                    joinedCount++;
                    pointsSpent += cost;
                    costs.push(cost);
                } else {
                    failedCount++;
                }

                // Delay between joins
                await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_JOINS_MS));
            }
        }

        // Complete progress
        progressIndicator.complete(
            `Joined ${joinedCount}/${joinedCount + failedCount + skippedCount}`,
            true
        );

        // Log results
        console.log(`[SG AutoJoin] Join All Visible finished. Joined: ${joinedCount}, Failed: ${failedCount}, Skipped: ${skippedCount}`);

        // Show session stats
        if (joinedCount > 0) {
            showSessionStats();
        } else {
            Utils.showToast(
                `Joined: ${joinedCount} | Failed: ${failedCount} | Skipped: ${skippedCount}`,
                "info"
            );
        }

        // Return results object
        return {
            status: "completed",
            results: {
                joined: joinedCount,
                failed: failedCount,
                skipped: skippedCount,
                pointsSpent: pointsSpent,
                costs: costs
            }
        };

    } catch (error) {
        console.error("[SG AutoJoin] Error during join all:", error);
        progressIndicator.complete("Error during join all", false);
        Utils.showToast("Error during Join All operation", "error");
        return { status: "error", message: error.message };
    } finally {
        State.setIsProcessing(false);
    }
}

/**
 * Run a settings check and update settings from storage
 */
export function runCheck() {
  chrome.storage.sync.get(
    {
      autoJoinEnabled: true,
      autoModeEnabled: false,
      pointBuffer: 30,
      maxCost: 100,
      minCost: 0,
      maxLevel: 10,
      minLevel: 0,
      wishlistOnly: false,
      skipGroups: true,
      skipOwned: true,
      blacklistKeywords: "",
      whitelistKeywords: "",
      blacklistPublishers: "",
      whitelistPublishers: "",
      joinInterval: 10,
      maxJoinsPerCycle: 3,
      joinOnPageLoad: true,
      skipEntryLimited: true,
      entryLimitThreshold: 500,
      sortByEndingSoon: true,
      endingSoonThreshold: 60,
      dynamicPointBuffer: true,
      pointSpendingStrategy: "balanced",
      morningPointBuffer: 30,
      afternoonPointBuffer: 20,
      eveningPointBuffer: 40,
      nightPointBuffer: 50,
      useRegexFilters: false,
      notificationDuration: 5,
      showJoinNotifications: true,
      showErrorNotifications: true,
      enableKeyboardShortcuts: true,
      highContrastMode: false,
      largeFontMode: false,
      animationSpeed: 1,
      showEntryStats: true,
      highlightEndingSoon: true,
      showOddsInfo: true,
      enableQuickFilters: true
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
      State.setMinLevel(items.minLevel);
      State.setWishlistOnly(items.wishlistOnly);
      State.setSkipGroups(items.skipGroups);
      State.setSkipOwned(items.skipOwned);
      State.setBlacklistKeywords(items.blacklistKeywords);
      State.setWhitelistKeywords(items.whitelistKeywords);

      // Advanced settings
      State.setBlacklistPublishers(items.blacklistPublishers);
      State.setWhitelistPublishers(items.whitelistPublishers);
      State.setSkipEntryLimited(items.skipEntryLimited);
      State.setEntryLimitThreshold(items.entryLimitThreshold);
      State.setSortByEndingSoon(items.sortByEndingSoon);
      State.setEndingSoonThreshold(items.endingSoonThreshold);
      State.setDynamicPointBuffer(items.dynamicPointBuffer);
      State.setPointSpendingStrategy(items.pointSpendingStrategy);
      State.setPointsToPreserve({
        morning: items.morningPointBuffer,
        afternoon: items.afternoonPointBuffer,
        evening: items.eveningPointBuffer,
        night: items.nightPointBuffer
      });
      State.setUseRegexFilters(items.useRegexFilters);

      // Timer settings
      if (typeof items.joinInterval === 'number' && items.joinInterval >= 5) {
        initializeTimer(items.joinInterval * 1000);
      }

      if (typeof items.maxJoinsPerCycle === 'number' && items.maxJoinsPerCycle > 0) {
        MAX_JOIN_ATTEMPTS_PER_CYCLE = items.maxJoinsPerCycle;
      }

      if (State.isAutoJoinEnabled()) {
          processListViewToAddButtons();
      }

      if (State.isAutoModeEnabled()) {
          processListViewForAutoJoin();
      } else if (items.joinOnPageLoad && State.isAutoJoinEnabled()) {
          // If auto-mode is off but joinOnPageLoad is on
          processListViewToAddButtons();
      }
    }
  );
}

/**
 * Add quick filter bar to the page
 */
function addQuickFilterBar() {
    chrome.storage.sync.get({ enableQuickFilters: true }, (settings) => {
        if (!settings.enableQuickFilters) return;

        // Find heading
        const pageHeading = document.querySelector('.page__heading');
        if (!pageHeading) return;

        // Create filter bar
        const filterBar = document.createElement('div');
        filterBar.className = 'sg-quick-filter-bar';
        filterBar.innerHTML = `
            <div class="sg-quick-filter-section">
                <span class="sg-quick-filter-label">Quick Filters:</span>
                <button class="sg-quick-filter" data-filter="wishlist">Wishlist</button>
                <button class="sg-quick-filter" data-filter="level0">Level 0</button>
                <button class="sg-quick-filter" data-filter="high-value">High Value</button>
                <button class="sg-quick-filter" data-filter="ending-soon">Ending Soon</button>
                <button class="sg-quick-filter" data-filter="good-odds">Good Odds</button>
            </div>
            <div class="sg-quick-filter-section">
                <button class="sg-quick-filter sg-accent" data-filter="join-all">Join All Visible</button>
            </div>
        `;

        // Insert after heading
        pageHeading.parentNode.insertBefore(filterBar, pageHeading.nextSibling);

        // Add event listeners
        const filterButtons = filterBar.querySelectorAll('.sg-quick-filter');
        filterButtons.forEach(button => {
            button.addEventListener('click', () => {
                const filter = button.dataset.filter;

                // Toggle active state
                button.classList.toggle('active');

                // Apply filter
                applyQuickFilter(filter, button.classList.contains('active'));

                // Join all visible if that button was clicked
                if (filter === 'join-all') {
                    joinAllVisibleGiveaways();
                }
            });
        });
    });
}

/**
 * Apply a quick filter to the giveaways on the page
 */
function applyQuickFilter(filter, isActive) {
    const giveaways = document.querySelectorAll('.giveaway__row-outer-wrap');

    giveaways.forEach(giveaway => {
        // Get original display state or default to 'block'
        const originalDisplay = giveaway.dataset.originalDisplay || 'block';

        // Store original display if not already stored
        if (!giveaway.dataset.originalDisplay) {
            giveaway.dataset.originalDisplay = getComputedStyle(giveaway).display;
        }

        // If filter is being deactivated, restore original visibility
        if (!isActive) {
            giveaway.style.display = originalDisplay;
            return;
        }

        // Apply specific filter logic
        switch (filter) {
            case 'wishlist':
                // Check if wishlist badge exists
                const isWishlisted = !!giveaway.querySelector(Selectors.listView_wishlistIndicatorSelector);
                giveaway.style.display = isWishlisted ? originalDisplay : 'none';
                break;

            case 'level0':
                // Check level requirement
                const level = Utils.extractRequiredLevel(giveaway);
                giveaway.style.display = level === 0 ? originalDisplay : 'none';
                break;

            case 'high-value':
                // Check point cost (high value = 50+ points)
                const cost = Utils.extractCost(giveaway);
                giveaway.style.display = cost >= 50 ? originalDisplay : 'none';
                break;

            case 'ending-soon':
                // Check if ending soon based on threshold
                const endTime = Utils.extractEndTime(giveaway);
                if (endTime === null) {
                    giveaway.style.display = 'none';
                    return;
                }
                giveaway.style.display = endTime <= 60 ? originalDisplay : 'none';
                break;

            case 'good-odds':
                // Calculate entry to point ratio
                const entries = Utils.extractEntryCount(giveaway);
                const points = Utils.extractCost(giveaway);
                if (entries === null || points === null || points === 0) {
                    giveaway.style.display = 'none';
                    return;
                }

                const ratio = entries / points;
                giveaway.style.display = ratio < 10 ? originalDisplay : 'none';
                break;
        }
    });

    // Show a toast notification
    if (isActive) {
        const filterName = {
            'wishlist': 'Wishlist Items',
            'level0': 'Level 0 Giveaways',
            'high-value': 'High Value (50P+)',
            'ending-soon': 'Ending Soon',
            'good-odds': 'Good Odds (< 10 entries/P)'
        }[filter];

        if (filterName) {
            Utils.showToast(`Showing only: ${filterName}`, 'info');
        }
    }
}

/**
 * Game Card View: Convert standard giveaway list to card view
 */
function enableGameCardView() {
    // Check storage to see if card view is enabled
    chrome.storage.sync.get({ enableCardView: false }, (data) => {
        if (!data.enableCardView) return;

        // Add card view switch to quick filter bar
        const quickFilterBar = document.querySelector('.sg-quick-filter-bar');
        if (quickFilterBar) {
            const viewToggle = document.createElement('button');
            viewToggle.className = 'sg-quick-filter sg-accent';
            viewToggle.dataset.filter = 'toggle-view';
            viewToggle.innerHTML = '<i class="fa fa-th"></i> Card View';
            viewToggle.setAttribute('data-tooltip', 'Toggle between list and card view');

            // Check if view is currently card view
            chrome.storage.sync.get({ currentView: 'list' }, (viewData) => {
                if (viewData.currentView === 'card') {
                    viewToggle.classList.add('active');
                    applyCardView();
                }
            });

            viewToggle.addEventListener('click', () => {
                viewToggle.classList.toggle('active');

                if (viewToggle.classList.contains('active')) {
                    applyCardView();
                    chrome.storage.sync.set({ currentView: 'card' });
                } else {
                    removeCardView();
                    chrome.storage.sync.set({ currentView: 'list' });
                }
            });

            quickFilterBar.querySelector('.sg-quick-filter-section:last-child').appendChild(viewToggle);
        }
    });
}

/**
 * Apply card view to giveaways
 */
function applyCardView() {
    // Get all giveaway elements
    const giveaways = document.querySelectorAll('.giveaway__row-outer-wrap');

    // Create container for cards
    let cardContainer = document.querySelector('.sg-card-container');
    if (!cardContainer) {
        cardContainer = document.createElement('div');
        cardContainer.className = 'sg-card-container';
        cardContainer.style.display = 'grid';
        cardContainer.style.gridTemplateColumns = 'repeat(auto-fill, minmax(250px, 1fr))';
        cardContainer.style.gap = '20px';
        cardContainer.style.margin = '20px 0';

        // Insert after widget-container or page heading
        const widgetContainer = document.querySelector('.widget-container');
        const pageHeading = document.querySelector('.page__heading');
        const target = widgetContainer || pageHeading;

        if (target && target.parentNode) {
            target.parentNode.insertBefore(cardContainer, target.nextSibling);
        }
    }

    // Hide original giveaways
    giveaways.forEach(giveaway => {
        giveaway.style.display = 'none';

        // Skip if already processed
        if (giveaway.dataset.cardCreated === 'true') return;
        giveaway.dataset.cardCreated = 'true';

        // Extract giveaway data
        const link = giveaway.querySelector('.giveaway__heading__name');
        const image = giveaway.querySelector('.giveaway_image_thumbnail');
        const imageSrc = image ? image.src : 'https://cdn.cloudflare.steamstatic.com/steam/apps/480/header.jpg';

        const title = link ? link.textContent.trim() : 'Unknown Game';
        const href = link ? link.href : '#';
        const cost = Utils.extractCost(giveaway) || 0;

        // Create card element
        const card = document.createElement('div');
        card.className = 'sg-game-card';
        card.dataset.giveawayId = href.split('/').pop();

        // Check if already joined
        const isJoined = giveaway.classList.contains(Selectors.listView_alreadyJoinedClass) ||
                        giveaway.parentElement?.classList.contains(Selectors.listView_alreadyJoinedClass);

        // Special indicators
        const isWishlisted = !!giveaway.querySelector(Selectors.listView_wishlistIndicatorSelector);
        const isGroup = !!giveaway.querySelector(Selectors.listView_groupIndicatorSelector);
        const levelInfo = giveaway.querySelector('.giveaway__column--contributor-level');
        const level = levelInfo ? parseInt(levelInfo.textContent.trim().replace('Level ', ''), 10) || 0 : 0;

        // Entries and time
        const entries = Utils.extractEntryCount(giveaway) || 0;
        const timeLeft = Utils.extractEndTime(giveaway) || 0;

        // Create ribbon if needed
        if (isJoined || isWishlisted) {
            const ribbon = document.createElement('div');
            ribbon.className = 'sg-game-card-ribbon';
            ribbon.textContent = isJoined ? 'ENTERED' : 'WISHLIST';
            ribbon.style.backgroundColor = isJoined ? 'var(--sg-success)' : 'var(--sg-primary)';
            card.appendChild(ribbon);
        }

        // Format the time left
        let timeLeftText = 'Unknown time';
        if (timeLeft === 0) {
            timeLeftText = 'Ending soon';
        } else if (timeLeft < 60) {
            timeLeftText = `${timeLeft}m left`;
        } else if (timeLeft < 1440) { // Less than 24 hours
            timeLeftText = `${Math.floor(timeLeft / 60)}h ${timeLeft % 60}m left`;
        } else {
            timeLeftText = `${Math.floor(timeLeft / 1440)}d ${Math.floor((timeLeft % 1440) / 60)}h left`;
        }

        // Construct card content
        card.innerHTML = `
            <a href="${href}" target="_blank">
                <img src="${imageSrc}" alt="${title}" class="sg-game-card-image">
            </a>
            <div class="sg-game-card-content">
                <div class="sg-game-card-title">${title}</div>
                <div class="sg-game-card-info">
                    <span>${entries} entries</span>
                    <span>${timeLeftText}</span>
                </div>
                <div class="sg-game-card-actions">
                    ${!isJoined ? `<button class="sg-game-card-button sg-card-join-button" data-giveaway-id="${card.dataset.giveawayId}">Join (${cost}P)</button>` :
                    `<button class="sg-game-card-button" disabled>Entered</button>`}
                    <span class="sg-game-card-cost">${level > 0 ? `Level ${level}` : 'No level req.'}</span>
                </div>
            </div>
        `;

        // Add group indicator if needed
        if (isGroup) {
            const groupBadge = document.createElement('div');
            groupBadge.style.position = 'absolute';
            groupBadge.style.top = '10px';
            groupBadge.style.left = '10px';
            groupBadge.style.backgroundColor = 'rgba(0, 0, 0, 0.6)';
            groupBadge.style.color = 'white';
            groupBadge.style.padding = '4px 8px';
            groupBadge.style.borderRadius = '4px';
            groupBadge.style.fontSize = '12px';
            groupBadge.innerHTML = '<i class="fa fa-users"></i> Group';
            card.appendChild(groupBadge);
        }

        // Add card to container
        cardContainer.appendChild(card);

        // Add join functionality
        const joinButton = card.querySelector('.sg-card-join-button');
        if (joinButton) {
            joinButton.addEventListener('click', async (e) => {
                e.preventDefault();
                e.stopPropagation();

                const giveawayId = joinButton.dataset.giveawayId;
                if (!giveawayId) return;

                // Show loading state
                joinButton.disabled = true;
                joinButton.innerHTML = '<i class="fa fa-spinner fa-spin"></i>';

                // Join the giveaway
                const success = await attemptAjaxJoin(giveawayId, cost, giveaway, null);

                if (success) {
                    // Update button
                    joinButton.innerHTML = 'Entered';
                    joinButton.disabled = true;

                    // Add ribbon
                    if (!card.querySelector('.sg-game-card-ribbon')) {
                        const ribbon = document.createElement('div');
                        ribbon.className = 'sg-game-card-ribbon';
                        ribbon.textContent = 'ENTERED';
                        ribbon.style.backgroundColor = 'var(--sg-success)';
                        card.appendChild(ribbon);
                    }
                } else {
                    // Restore button
                    joinButton.disabled = false;
                    joinButton.innerHTML = `Join (${cost}P)`;
                    Utils.showToast("Failed to join giveaway", "error");
                }
            });
        }
    });
}

/**
 * Remove card view and go back to list view
 */
function removeCardView() {
    // Show original giveaways
    const giveaways = document.querySelectorAll('.giveaway__row-outer-wrap');
    giveaways.forEach(giveaway => {
        giveaway.style.display = 'block';
    });

    // Hide card container
    const cardContainer = document.querySelector('.sg-card-container');
    if (cardContainer) {
        cardContainer.style.display = 'none';
    }
}

/**
 * Enable quick jump panel for easy navigation
 */
function enableQuickJumpPanel() {
    chrome.storage.sync.get({ enableQuickJump: true }, (data) => {
        if (!data.enableQuickJump) return;

        // Create quick jump panel
        const quickJump = document.createElement('div');
        quickJump.className = 'sg-quick-jump';
        quickJump.style.position = 'fixed';
        quickJump.style.left = '30px';
        quickJump.style.top = '50%';
        quickJump.style.transform = 'translateY(-50%)';
        quickJump.style.backgroundColor = 'var(--sg-white)';
        quickJump.style.borderRadius = 'var(--sg-radius)';
        quickJump.style.boxShadow = 'var(--sg-shadow-lg)';
        quickJump.style.padding = '10px';
        quickJump.style.display = 'flex';
        quickJump.style.flexDirection = 'column';
        quickJump.style.gap = '10px';
        quickJump.style.zIndex = '990';

        // Add jump buttons
        const buttons = [
            { icon: 'home', label: 'Home', url: '/' },
            { icon: 'gift', label: 'Giveaways', url: '/giveaways/search?type=wishlist' },
            { icon: 'user', label: 'Profile', url: '/account' },
            { icon: 'trophy', label: 'Won', url: '/giveaways/won' },
            { icon: 'heart', label: 'Wishlist', url: '/account/wishlist' },
            { icon: 'users', label: 'Groups', url: '/account/groups' }
        ];

        buttons.forEach(button => {
            const btnElement = document.createElement('a');
            btnElement.href = button.url;
            btnElement.className = 'sg-quick-jump-button';
            btnElement.style.width = '40px';
            btnElement.style.height = '40px';
            btnElement.style.borderRadius = '50%';
            btnElement.style.backgroundColor = 'var(--sg-white)';
            btnElement.style.color = 'var(--sg-primary)';
            btnElement.style.display = 'flex';
            btnElement.style.justifyContent = 'center';
            btnElement.style.alignItems = 'center';
            btnElement.style.fontSize = '18px';
            btnElement.style.transition = 'all 0.2s ease';
            btnElement.style.textDecoration = 'none';
            btnElement.setAttribute('data-tooltip', button.label);
            btnElement.innerHTML = `<i class="fa fa-${button.icon}"></i>`;

            // Hover effect
            btnElement.addEventListener('mouseenter', () => {
                btnElement.style.backgroundColor = 'var(--sg-primary)';
                btnElement.style.color = 'var(--sg-white)';
                btnElement.style.transform = 'scale(1.1)';
            });

            btnElement.addEventListener('mouseleave', () => {
                btnElement.style.backgroundColor = 'var(--sg-white)';
                btnElement.style.color = 'var(--sg-primary)';
                btnElement.style.transform = 'scale(1)';
            });

            quickJump.appendChild(btnElement);
        });

        // Add to body
        document.body.appendChild(quickJump);

        // Make panel draggable
        let isDragging = false;
        let offsetX, offsetY;

        quickJump.addEventListener('mousedown', (e) => {
            isDragging = true;
            offsetX = e.clientX - quickJump.getBoundingClientRect().left;
            offsetY = e.clientY - quickJump.getBoundingClientRect().top;
            quickJump.style.cursor = 'grabbing';
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;

            const left = e.clientX - offsetX;
            const top = e.clientY - offsetY;

            quickJump.style.left = `${left}px`;
            quickJump.style.top = `${top}px`;
            quickJump.style.transform = 'none';
        });

        document.addEventListener('mouseup', () => {
            isDragging = false;
            quickJump.style.cursor = 'grab';
        });

        // Make panel collapsible
        const collapseBtn = document.createElement('button');
        collapseBtn.className = 'sg-quick-jump-collapse';
        collapseBtn.style.width = '40px';
        collapseBtn.style.height = '40px';
        collapseBtn.style.borderRadius = '50%';
        collapseBtn.style.backgroundColor = 'var(--sg-primary)';
        collapseBtn.style.color = 'var(--sg-white)';
        collapseBtn.style.border = 'none';
        collapseBtn.style.display = 'flex';
        collapseBtn.style.justifyContent = 'center';
        collapseBtn.style.alignItems = 'center';
        collapseBtn.style.cursor = 'pointer';
        collapseBtn.innerHTML = '<i class="fa fa-chevron-left"></i>';
        collapseBtn.setAttribute('data-tooltip', 'Collapse panel');

        let isCollapsed = false;
        collapseBtn.addEventListener('click', () => {
            isCollapsed = !isCollapsed;
            collapseBtn.innerHTML = isCollapsed ? '<i class="fa fa-chevron-right"></i>' : '<i class="fa fa-chevron-left"></i>';

            // Hide/show all buttons except collapse button
            Array.from(quickJump.children).forEach(child => {
                if (child !== collapseBtn) {
                    child.style.display = isCollapsed ? 'none' : 'flex';
                }
            });

            // Update panel style
            quickJump.style.transition = 'all 0.3s ease';
            quickJump.style.width = isCollapsed ? 'auto' : '';
        });

        quickJump.appendChild(collapseBtn);
        quickJump.style.cursor = 'grab';
    });
}

/**
 * Enable real-time point tracking
 */
function enableRealtimePointTracking() {
    chrome.storage.sync.get({ enableRealtimePoints: true }, (data) => {
        if (!data.enableRealtimePoints) return;

        // Find the points element
        const pointsElement = document.querySelector('.nav__points');
        if (!pointsElement) return;

        // Create tracker container
        const trackerContainer = document.createElement('div');
        trackerContainer.className = 'sg-points-tracker';
        trackerContainer.style.position = 'absolute';
        trackerContainer.style.top = '100%';
        trackerContainer.style.right = '0';
        trackerContainer.style.backgroundColor = 'var(--sg-white)';
        trackerContainer.style.borderRadius = 'var(--sg-radius)';
        trackerContainer.style.boxShadow = 'var(--sg-shadow)';
        trackerContainer.style.padding = '8px 12px';
        trackerContainer.style.fontSize = '12px';
        trackerContainer.style.zIndex = '100';
        trackerContainer.style.width = '180px';
        trackerContainer.style.display = 'none';

        trackerContainer.innerHTML = `
            <div class="sg-points-tracker-header" style="font-weight: 600; margin-bottom: 5px; display: flex; justify-content: space-between; align-items: center;">
                <span>Points Tracker</span>
                <span class="sg-points-tracker-close" style="cursor: pointer;"><i class="fa fa-times"></i></span>
            </div>
            <div class="sg-points-tracker-history" style="max-height: 120px; overflow-y: auto;">
                <div class="sg-points-tracker-entry" style="display: flex; justify-content: space-between;">
                    <span>Starting points:</span>
                    <span class="sg-starting-points">0P</span>
                </div>
                <div class="sg-points-tracker-entry" style="display: flex; justify-content: space-between;">
                    <span>Points spent:</span>
                    <span class="sg-points-spent" style="color: var(--sg-danger);">0P</span>
                </div>
                <div class="sg-points-tracker-entry" style="display: flex; justify-content: space-between;">
                    <span>Points earned:</span>
                    <span class="sg-points-earned" style="color: var(--sg-success);">0P</span>
                </div>
                <div class="sg-points-tracker-entry" style="display: flex; justify-content: space-between; font-weight: 600; margin-top: 5px; border-top: 1px solid var(--sg-light-gray); padding-top: 5px;">
                    <span>Current points:</span>
                    <span class="sg-current-points">0P</span>
                </div>
            </div>
        `;

        // Add close button functionality
        const closeBtn = trackerContainer.querySelector('.sg-points-tracker-close');
        closeBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            trackerContainer.style.display = 'none';
        });

        // Position the container relative to points element
        pointsElement.style.position = 'relative';
        pointsElement.appendChild(trackerContainer);

        // Toggle display on click
        pointsElement.addEventListener('click', () => {
            const isVisible = trackerContainer.style.display === 'block';
            trackerContainer.style.display = isVisible ? 'none' : 'block';

            // Update data when opened
            if (!isVisible) {
                updatePointsTracker();
            }
        });

        // Initial data population
        function updatePointsTracker() {
            chrome.storage.sync.get({
                initialPoints: 0,
                pointsSpent: 0,
                pointsEarned: 0
            }, (stats) => {
                // If no initial points recorded, get current points
                const currentPoints = Utils.getCurrentPoints() || 0;
                const initialPoints = stats.initialPoints || currentPoints;

                // Save initial points if not set
                if (!stats.initialPoints) {
                    chrome.storage.sync.set({ initialPoints: currentPoints });
                }

                // Update display
                trackerContainer.querySelector('.sg-starting-points').textContent = `${initialPoints}P`;
                trackerContainer.querySelector('.sg-points-spent').textContent = `${stats.pointsSpent}P`;
                trackerContainer.querySelector('.sg-points-earned').textContent = `${stats.pointsEarned}P`;
                trackerContainer.querySelector('.sg-current-points').textContent = `${currentPoints}P`;
            });
        }

        // Update tracker every 30 seconds
        setInterval(updatePointsTracker, 30000);
    });
}

/**
 * Enable advanced giveaway analytics
 */
function enableGiveawayAnalytics() {
    chrome.storage.sync.get({ enableGiveawayAnalytics: true }, (data) => {
        if (!data.enableGiveawayAnalytics) return;

        // Find all giveaways
        const giveaways = document.querySelectorAll('.giveaway__row-outer-wrap');
        giveaways.forEach(giveaway => {
            // Skip if already processed
            if (giveaway.dataset.analyticsAdded === 'true') return;
            giveaway.dataset.analyticsAdded = 'true';

            // Extract data
            const entries = Utils.extractEntryCount(giveaway) || 0;
            const cost = Utils.extractCost(giveaway) || 0;

            // Skip if no entries or cost
            if (entries === 0 || cost === 0) return;

            // Calculate odds and expected value
            const odds = entries > 0 ? 1 / entries : 0;
            const oddsPerPoint = cost > 0 ? odds / cost : 0;
            const oddsPercent = (odds * 100).toFixed(4);
            const valueRating = oddsPerPoint * 1000;

            // Create analytics badge with proper positioning
            const infoBadge = document.createElement('div');
            infoBadge.className = 'sg-analytics-badge';
            infoBadge.style.display = 'inline-flex';
            infoBadge.style.alignItems = 'center';
            infoBadge.style.marginLeft = '8px';
            infoBadge.style.position = 'relative';
            infoBadge.style.zIndex = '5';

            // Style the badge contents
            const badgeText = document.createElement('span');
            badgeText.textContent = getRatingText(valueRating);
            badgeText.style.backgroundColor = getValueColor(valueRating);
            badgeText.style.color = 'white';
            badgeText.style.padding = '3px 8px';
            badgeText.style.borderRadius = '12px';
            badgeText.style.fontSize = '11px';
            badgeText.style.fontWeight = 'bold';
            badgeText.style.cursor = 'pointer';
            badgeText.style.whiteSpace = 'nowrap';
            badgeText.style.boxShadow = '0 1px 3px rgba(0,0,0,0.2)';

            // Create popup that's properly positioned
            const popup = document.createElement('div');
            popup.className = 'sg-analytics-popup';
            popup.style.position = 'absolute';
            popup.style.top = 'calc(100% + 8px)';
            popup.style.left = '50%';
            popup.style.transform = 'translateX(-50%)';
            popup.style.backgroundColor = 'white';
            popup.style.border = '1px solid #e5e5e5';
            popup.style.borderRadius = '6px';
            popup.style.boxShadow = '0 4px 12px rgba(0,0,0,0.15)';
            popup.style.padding = '12px';
            popup.style.width = '220px';
            popup.style.zIndex = '10';
            popup.style.display = 'none';
            popup.style.fontSize = '12px';

            // Add triangle pointer
            popup.innerHTML = `
                <div style="position: absolute; top: -6px; left: 50%; transform: translateX(-50%);
                            width: 0; height: 0; border-left: 6px solid transparent;
                            border-right: 6px solid transparent; border-bottom: 6px solid white;"></div>
                <div style="font-weight: 600; margin-bottom: 8px; font-size: 13px; color: #333;">Giveaway Analytics</div>
                <div style="margin-bottom: 8px;">
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Entries:</span>
                        <b>${entries}</b>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Cost:</span>
                        <b>${cost}P</b>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Win Chance:</span>
                        <b>${oddsPercent}%</b>
                    </div>
                    <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
                        <span>Value Rating:</span>
                        <b>${valueRating.toFixed(2)}</b>
                    </div>
                </div>
                <div style="padding-top: 6px; border-top: 1px solid #f0f0f0; color: #666; font-style: italic;">
                    ${getValueDescription(valueRating)}
                </div>
            `;

            // Add hover events for showing/hiding popup
            infoBadge.addEventListener('mouseenter', () => {
                popup.style.display = 'block';
            });

            infoBadge.addEventListener('mouseleave', () => {
                popup.style.display = 'none';
            });

            // Add badge and popup to the DOM
            infoBadge.appendChild(badgeText);
            infoBadge.appendChild(popup);

            // Find a better place to insert the badge - right after the giveaway price
            const priceElement = giveaway.querySelector('.giveaway__heading__thin');
            if (priceElement) {
                priceElement.insertAdjacentElement('afterend', infoBadge);
            } else {
                // Fallback - add to the end of heading
                const heading = giveaway.querySelector('.giveaway__heading');
                if (heading) {
                    heading.appendChild(infoBadge);
                }
            }

            // Add CSS animation for the badge
            if (!document.getElementById('sg-analytics-styles')) {
                const styleEl = document.createElement('style');
                styleEl.id = 'sg-analytics-styles';
                styleEl.textContent = `
                    .sg-analytics-badge {
                        transition: transform 0.2s ease;
                    }

                    .sg-analytics-badge:hover {
                        transform: translateY(-2px);
                    }

                    .sg-analytics-popup {
                        animation: sg-popup-fade-in 0.2s ease forwards;
                    }

                    @keyframes sg-popup-fade-in {
                        from { opacity: 0; transform: translateX(-50%) translateY(-5px); }
                        to { opacity: 1; transform: translateX(-50%) translateY(0); }
                    }
                `;
                document.head.appendChild(styleEl);
            }
        });

        // Helper functions
        function getValueColor(rating) {
            if (rating > 5) return '#2ECC71'; // Excellent - green
            if (rating > 2) return '#3498DB'; // Good - blue
            if (rating > 1) return '#F39C12'; // Average - orange
            if (rating > 0.5) return '#E67E22'; // Below average - dark orange
            return '#E74C3C'; // Poor - red
        }

        function getRatingText(rating) {
            if (rating > 5) return 'Excellent Value';
            if (rating > 2) return 'Good Value';
            if (rating > 1) return 'Average';
            if (rating > 0.5) return 'Below Average';
            return 'Poor Value';
        }

        function getValueDescription(rating) {
            if (rating > 5) return 'This giveaway offers exceptional value for the points spent.';
            if (rating > 2) return 'This giveaway offers good value compared to average giveaways.';
            if (rating > 1) return 'This giveaway has average value for the points spent.';
            if (rating > 0.5) return 'This giveaway offers below average value.';
            return 'This giveaway offers poor value for the points required.';
        }
    });
}

/**
 * Initialize the main functionality
 */
function initialize() {
    console.log("[SG AutoJoin] Initializing main...");

    // Initialize the status indicator
    initializeIndicator();

    // Add quick filter bar to the page
    addQuickFilterBar();

    // Listen for storage changes
    chrome.storage.onChanged.addListener((changes, areaName) => {
        if (areaName === 'sync') {
            // Handle auto-join feature toggle
            if (changes.autoJoinEnabled) {
                const newStatus = !!changes.autoJoinEnabled.newValue;
                State.setAutoJoinEnabled(newStatus);
                updateIndicatorUI(newStatus);

                // Show toast for status change
                Utils.showToast(
                    newStatus ? "Features enabled. Join buttons will now appear." : "Features disabled",
                    newStatus ? "success" : "info"
                );

                // Refresh buttons if enabled
                if (newStatus) {
                    processListViewToAddButtons();
                }
            }

            // Handle auto-mode toggle
            if (changes.autoModeEnabled) {
                const wasEnabled = State.isAutoModeEnabled();
                const isNowEnabled = !!changes.autoModeEnabled.newValue;
                State.setAutoModeEnabled(isNowEnabled);

                // Show toast and manage auto-join cycle
                if (!wasEnabled && isNowEnabled) {
                    Utils.showToast(
                        "Auto-Join mode enabled. Giveaways will be joined automatically.",
                        "success"
                    );
                    // Start auto-join immediately
                    processListViewForAutoJoin();
                } else if (wasEnabled && !isNowEnabled) {
                    Utils.showToast(
                        "Auto-Join mode disabled. Automatic joining stopped.",
                        "info"
                    );
                }
            }

            // Handle join interval change
            if (changes.joinInterval && typeof changes.joinInterval.newValue === 'number') {
                initializeTimer(changes.joinInterval.newValue * 1000);
            }

            // Handle max joins per cycle change
            if (changes.maxJoinsPerCycle && typeof changes.maxJoinsPerCycle.newValue === 'number') {
                MAX_JOIN_ATTEMPTS_PER_CYCLE = changes.maxJoinsPerCycle.newValue;
            }

            // Update basic state variables
            if (changes.pointBuffer) State.setPointBuffer(changes.pointBuffer.newValue);
            if (changes.maxCost) State.setMaxCost(changes.maxCost.newValue);
            if (changes.minCost) State.setMinCost(changes.minCost.newValue);
            if (changes.maxLevel) State.setMaxLevel(changes.maxLevel.newValue);
            if (changes.minLevel) State.setMinLevel(changes.minLevel.newValue);
            if (changes.wishlistOnly) State.setWishlistOnly(changes.wishlistOnly.newValue);
            if (changes.skipGroups) State.setSkipGroups(changes.skipGroups.newValue);
            if (changes.skipOwned) State.setSkipOwned(changes.skipOwned.newValue);
            if (changes.blacklistKeywords) State.setBlacklistKeywords(changes.blacklistKeywords.newValue);
            if (changes.whitelistKeywords) State.setWhitelistKeywords(changes.whitelistKeywords.newValue);

            // Update advanced state variables
            if (changes.blacklistPublishers) State.setBlacklistPublishers(changes.blacklistPublishers.newValue);
            if (changes.whitelistPublishers) State.setWhitelistPublishers(changes.whitelistPublishers.newValue);
            if (changes.skipEntryLimited) State.setSkipEntryLimited(changes.skipEntryLimited.newValue);
            if (changes.entryLimitThreshold) State.setEntryLimitThreshold(changes.entryLimitThreshold.newValue);
            if (changes.sortByEndingSoon) State.setSortByEndingSoon(changes.sortByEndingSoon.newValue);
            if (changes.endingSoonThreshold) State.setEndingSoonThreshold(changes.endingSoonThreshold.newValue);
            if (changes.dynamicPointBuffer) State.setDynamicPointBuffer(changes.dynamicPointBuffer.newValue);
            if (changes.pointSpendingStrategy) State.setPointSpendingStrategy(changes.pointSpendingStrategy.newValue);

            // Update dynamic point buffer settings
            const updatePointsToPreserve =
                changes.morningPointBuffer ||
                changes.afternoonPointBuffer ||
                changes.eveningPointBuffer ||
                changes.nightPointBuffer;

            if (updatePointsToPreserve) {
                chrome.storage.sync.get({
                    morningPointBuffer: 0,
                    afternoonPointBuffer: 0,
                    eveningPointBuffer: 0,
                    nightPointBuffer: 0
                }, (items) => {
                    State.setPointsToPreserve({
                        morning: items.morningPointBuffer,
                        afternoon: items.afternoonPointBuffer,
                        evening: items.eveningPointBuffer,
                        night: items.nightPointBuffer
                    });
                });
            }

            if (changes.useRegexFilters) State.setUseRegexFilters(changes.useRegexFilters.newValue);

            // Refresh buttons when filter settings change and feature is enabled
            if (State.isAutoJoinEnabled() &&
                (changes.maxCost || changes.minCost || changes.maxLevel || changes.minLevel ||
                 changes.wishlistOnly || changes.skipGroups || changes.skipOwned ||
                 changes.blacklistKeywords || changes.whitelistKeywords ||
                 changes.blacklistPublishers || changes.whitelistPublishers ||
                 changes.skipEntryLimited || changes.entryLimitThreshold ||
                 changes.sortByEndingSoon || changes.endingSoonThreshold ||
                 changes.dynamicPointBuffer || changes.useRegexFilters ||
                 updatePointsToPreserve)) {
                processListViewToAddButtons();

                Utils.showToast("Filter settings updated, refreshing buttons", "info");
            }
        }
    });

    // Listen for runtime messages
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        if (message.action === "getPopupState") {
            const points = State.getPointsAtStart();
            const status = State.isProcessing() ? "joining" : (State.isAutoModeEnabled() ? "active" : "idle");
            chrome.runtime.sendMessage({ action: "getJoinCount" }, (swResponse) => {
                let count = 'N/A';
                if (chrome.runtime.lastError) {
                    console.error("Error getting join count from SW:", chrome.runtime.lastError.message);
                    count = 'Error';
                } else if (swResponse?.error) {
                     console.error("SW reported error getting join count:", swResponse.error);
                     count = 'Error';
                } else if (typeof swResponse?.count === 'number') {
                    count = swResponse.count;
                    State.setSessionJoinCount(count);
                }
                sendResponse({ points: points, joinCount: count, status: status });
            });
            return true;
        } else if (message.action === "joinAllVisible") {
            joinAllVisibleGiveaways().then((result) => {
                sendResponse(result);
            }).catch(err => {
                 console.error("Error during joinAllVisible:", err);
                 sendResponse({ status: "error", message: err.message });
            });
            return true;
        }
        return false;
    });

    // Initialize timer with default interval
    initializeTimer();

    // Check if keyboard shortcuts are enabled
    chrome.storage.sync.get({ enableKeyboardShortcuts: true }, (items) => {
        if (items.enableKeyboardShortcuts) {
            setupKeyboardShortcuts();
        }
    });

    // Initial run check for settings
    runCheck();

    // Initialize UI components
    Utils.injectStyles();

    // Initialize new features
    enableGameCardView();
    enableQuickJumpPanel();
    enableRealtimePointTracking();
    enableGiveawayAnalytics();

    // Enable new features by default
    chrome.storage.sync.set({
      enableCardView: true,
      enableQuickJump: true,
      enableRealtimePoints: true,
      enableGiveawayAnalytics: true
    });
}

/**
 * Set up keyboard shortcuts
 */
function setupKeyboardShortcuts() {
    document.addEventListener('keydown', (event) => {
        // Check if we should process shortcuts (not in input fields)
        if (event.target.tagName === 'INPUT' || event.target.tagName === 'TEXTAREA' ||
            event.target.isContentEditable) {
            return;
        }

        // Alt+J = Join All Visible
        if (event.altKey && event.key === 'j') {
            if (!State.isProcessing()) {
                Utils.showToast("Starting Join All Visible (Alt+J)", "info");
                joinAllVisibleGiveaways();
            }
        }

        // Alt+A = Toggle Auto Mode
        if (event.altKey && event.key === 'a') {
            const newState = !State.isAutoModeEnabled();
            chrome.storage.sync.set({ autoModeEnabled: newState });
        }

        // Alt+S = Open Settings
        if (event.altKey && event.key === 's') {
            chrome.runtime.sendMessage({ action: "openOptionsPage" });
        }
    });
}

// Initialize the application
initialize();