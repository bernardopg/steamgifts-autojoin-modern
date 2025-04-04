import * as Selectors from './selectors.js';
import * as State from './state.js';
import * as Utils from './utils.js';
import { attemptAjaxJoin } from './ajax.js';

async function handleManualJoinClick(event) {
    event.preventDefault();
    event.stopPropagation();

    const button = event.currentTarget;
    if (button.classList.contains('filtered') || button.disabled) {
        console.log("Filtered/disabled button clicked, ignoring.");
        return;
    }
    console.log("[SG AutoJoin] Manual Join Clicked:", button);

    const giveawayCode = button.dataset.code;
    const costText = button.dataset.cost;
    const cost = parseInt(costText, 10);
    const giveawayRow = button.parentElement;

    const expectedClassName = "giveaway__row-inner-wrap";
    if (!giveawayCode || isNaN(cost) || !giveawayRow || !giveawayRow.classList.contains(expectedClassName)) {
        console.error("Manual Join Error: Missing data or failed to find correct parent row.", { giveawayCode, cost, parentElementTag: giveawayRow?.tagName, expectedClass: expectedClassName, actualClasses: giveawayRow?.classList?.toString(), buttonElement: button });
        button.innerHTML = '<i class="fa fa-exclamation-triangle"></i> Error';
        return;
    }

    const currentPoints = Utils.getCurrentPoints();
    const xsrfToken = State.getXsrfToken();

    if (currentPoints === null) { alert("Could not determine points. Please refresh."); return; }
    if (!xsrfToken) { alert("Could not find security token (XSRF). Please refresh."); return; }

    if (currentPoints < cost + State.getPointBuffer()) { alert(`Cannot join: Insufficient points.\nNeed: ${cost + State.getPointBuffer()} (Cost: ${cost} + Buffer: ${State.getPointBuffer()})\nHave: ${currentPoints}`); return; }

    const isWhitelisted = Utils.isWhitelisted(giveawayRow);
    if (isWhitelisted) { console.log("  -> Whitelisted item found, bypassing some filters for manual join."); }

    if (!isWhitelisted && cost < State.getMinCost()) { alert(`Cannot join: Cost (${cost}P) is below your minimum setting (${State.getMinCost()}P).`); return; }
    if (!isWhitelisted && cost > State.getMaxCost()) { alert(`Cannot join: Cost (${cost}P) is above your maximum setting (${State.getMaxCost()}P).`); return; }
    const requiredLevel = Utils.extractRequiredLevel(giveawayRow);
    if (requiredLevel > State.getMaxLevel()) { alert(`Cannot join: Requires Level ${requiredLevel}, your maximum is ${State.getMaxLevel()}.`); return; }
    const isGroup = !!giveawayRow.querySelector(Selectors.listView_groupIndicatorSelector);
    if (!isWhitelisted && State.shouldSkipGroups() && isGroup) { alert(`Cannot join: You have chosen to skip group giveaways.`); return; }
    const isWishlistedOnPage = !!giveawayRow.querySelector(Selectors.listView_wishlistIndicatorSelector);
    if (!isWhitelisted && State.isWishlistOnly() && !isWishlistedOnPage) { alert(`Cannot join: You have chosen to only join wishlist giveaways.`); return; }
    if (Utils.isBlacklisted(giveawayRow)) { alert(`Cannot join: Game title is blacklisted in your settings.`); return; }
    if (Utils.isOwned(giveawayRow)) { alert(`Cannot join: Game is marked as owned in your library (based on page indicator).`); return; }

    await attemptAjaxJoin(giveawayCode, cost, giveawayRow, button);
}

function addOrUpdateButton(giveawayElement, giveawayCode, cost, passesFilters, filterReason = "") {
    let button = giveawayElement.querySelector(`.${Selectors.manualJoinButtonClass}`);

    if (!button) {
        button = document.createElement("button");
        button.className = `btn btn-sm ${Selectors.manualJoinButtonClass}`;
        giveawayElement.appendChild(button);
        button.addEventListener("click", handleManualJoinClick);
    }

    button.dataset.code = giveawayCode;
    button.dataset.cost = cost;

    if (passesFilters) {
        button.disabled = false;
        button.classList.remove("filtered", "btn-secondary");
        button.classList.add("btn-success");
        button.innerHTML = `<i class="fa fa-plus-circle"></i> Join (${cost}P)`;
        button.title = `Manually join this ${cost}P giveaway`;
    } else {
        button.disabled = true;
        button.classList.remove("btn-success");
        button.classList.add("filtered", "btn-secondary");
        button.innerHTML = `<i class="fa fa-ban"></i> Filtered (${cost}P)`;
        button.title = filterReason || `Filtered out by your settings (${cost}P)`;
    }
}

export function processListViewToAddButtons() {
    if (State.isProcessing()) { return; }
    console.log("[SG AutoJoin] Scanning list view to add/update buttons...");
    State.setIsProcessing(true);

    State.setXsrfToken(Utils.getXsrfTokenFromPage());

    const giveawayElements = document.querySelectorAll(Selectors.listView_giveawaySelector);
    if (giveawayElements.length === 0) { State.setIsProcessing(false); return; }

    console.log(`[SG AutoJoin] Scanning ${giveawayElements.length} giveaways.`);

    for (const giveawayElement of giveawayElements) {
        const isAlreadyJoined =
          giveawayElement.classList.contains(Selectors.listView_alreadyJoinedClass) ||
          giveawayElement.parentElement?.classList.contains(Selectors.listView_alreadyJoinedClass);

        const existingButton = giveawayElement.querySelector(`.${Selectors.manualJoinButtonClass}`);

        if (isAlreadyJoined) {
             if (existingButton) existingButton.remove();
             continue;
        }

        const cost = Utils.extractCost(giveawayElement);
        const linkElement = giveawayElement.querySelector(Selectors.listView_giveawayLinkSelector);
        const giveawayUrl = linkElement?.href;
        const giveawayCode = giveawayUrl ? Utils.extractGiveawayCodeFromUrl(giveawayUrl) : null;
        const requiredLevel = Utils.extractRequiredLevel(giveawayElement);
        const isWishlisted = !!giveawayElement.querySelector(Selectors.listView_wishlistIndicatorSelector);
        const isGroup = !!giveawayElement.querySelector(Selectors.listView_groupIndicatorSelector);
        const isBlacklisted = Utils.isBlacklisted(giveawayElement);
        const isOwned = Utils.isOwned(giveawayElement);

        if (giveawayCode === null || cost === null) {
            if (existingButton) existingButton.remove();
            continue;
        }

        let passesFilters = true;
        let filterReason = "";
        const isWhitelisted = Utils.isWhitelisted(giveawayElement);

        if (isBlacklisted) { passesFilters = false; filterReason = "Filtered: Blacklisted Keyword"; }
        else if (isOwned) { passesFilters = false; filterReason = "Filtered: Game Owned"; }
        else if (requiredLevel > State.getMaxLevel()) { passesFilters = false; filterReason = `Filtered: Requires Level ${requiredLevel} (Max: ${State.getMaxLevel()})`; }
        else if (!isWhitelisted) {
            if (State.shouldSkipGroups() && isGroup) { passesFilters = false; filterReason = "Filtered: Group Giveaway"; }
            else if (State.isWishlistOnly() && !isWishlisted) { passesFilters = false; filterReason = "Filtered: Not on Wishlist"; }
            else if (cost > State.getMaxCost()) { passesFilters = false; filterReason = `Filtered: Cost ${cost}P > Max Cost ${State.getMaxCost()}P`; }
            else if (cost < State.getMinCost()) { passesFilters = false; filterReason = `Filtered: Cost ${cost}P < Min Cost ${State.getMinCost()}P`; }
        }

        addOrUpdateButton(giveawayElement, giveawayCode, cost, passesFilters, filterReason);

    }

    console.log("[SG AutoJoin] Finished adding/updating buttons for this cycle.");
    State.setIsProcessing(false);
}
