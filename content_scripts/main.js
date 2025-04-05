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
                sendResponse({ points: points, joinCount: count });
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