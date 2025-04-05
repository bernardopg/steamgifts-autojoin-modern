/**
 * DOM Selector Module
 *
 * Centralized location for all DOM selectors used in the extension.
 * This makes it easier to update if SteamGifts changes their DOM structure.
 * Each selector is documented with its purpose and the expected element(s) it should match.
 */

// Core selectors for navigation elements
export const SELECTORS = {
  // Main navigation and user info
  NAV: {
    POINTS: '.nav__points', // Points display in navigation bar
    USER_DROPDOWN: '.nav__button-container--dropdown', // User dropdown menu
    USERNAME: '.nav__avatar-outer-wrap', // Username container
  },

  // List view giveaway elements
  LIST_VIEW: {
    GIVEAWAY_CONTAINER: 'div.giveaway__row-inner-wrap', // Container for each giveaway in list
    GIVEAWAY_LINK: 'a.giveaway__heading__name', // Title and link to giveaway
    COST_INDICATOR: 'span.giveaway__heading__thin', // Shows the point cost of giveaway
    ALREADY_JOINED_CLASS: 'is-faded', // Class added to giveaways that user has joined
    COPIES_INDICATOR: '.giveaway__heading__thin:nth-of-type(1)', // Shows number of copies
    END_TIME_INDICATOR: '.giveaway__columns .giveaway__column--width-fill span', // End time text
    ENTRIES_COUNT: '.giveaway__links a[href*="entries"]', // Number of entries link
    COMMENTS_COUNT: '.giveaway__links a[href*="comments"]', // Number of comments link

    // Special indicators for filtering
    WISHLIST_INDICATOR: '.giveaway__column--wishlist', // Item is on user's wishlist
    LEVEL_INDICATOR: 'div.giveaway__column--contributor-level', // Required level to enter
    GROUP_INDICATOR: '.giveaway__column--group', // Giveaway requires group membership
    OWNED_INDICATOR: '.giveaway__row-inner-wrap.is-owned', // User already owns this game

    // Content types
    GAME_THUMBNAIL: '.giveaway_image_thumbnail', // Game image thumbnail
    GAME_DESCRIPTION: '.giveaway__description', // Game description when available
  },

  // Giveaway detail page
  DETAIL_VIEW: {
    GIVEAWAY_HEADING: '.page__heading__breadcrumbs', // Giveaway title in detail view
    ENTER_BUTTON: '.sidebar__entry-insert', // Button to enter giveaway
    LEAVE_BUTTON: '.sidebar__entry-delete', // Button to leave giveaway
    ERROR_MESSAGE: '.sidebar__error', // Error message container
    SUCCESS_MESSAGE: '.sidebar__success', // Success message container
    POINTS_DISPLAY: '.live__entry-count', // Dynamic point display in detail view
  },

  // Form elements and inputs
  FORM: {
    XSRF_TOKEN: 'input[name="xsrf_token"]', // CSRF token for form submissions
    GIVEAWAY_CODE: 'input[name="code"]', // Giveaway code in forms
  },

  // Custom extension UI elements
  EXTENSION_UI: {
    STATUS_INDICATOR_ID: 'sg-autojoin-status-indicator', // Status indicator element ID
    MANUAL_JOIN_BUTTON_CLASS: 'sgaj-manual-join-btn', // Manual join button class
    PROGRESS_BAR_ID: 'sg-autojoin-progress-bar', // Progress bar container ID
    STATS_PANEL_ID: 'sg-autojoin-stats-panel', // Statistics panel container ID
    TOAST_CONTAINER_ID: 'sg-toast-container', // Toast notification container
  },

  // Featured container (for removal)
  FEATURED_CONTAINER: '.featured__container', // Featured giveaways container

  // General selectors
  HEADER: '.header__inner-wrap', // Main header container
  FOOTER: '.footer__inner-wrap', // Footer container
};

// For backwards compatibility, export individual selectors
export const pointsSelector = SELECTORS.NAV.POINTS;
export const listView_giveawaySelector = SELECTORS.LIST_VIEW.GIVEAWAY_CONTAINER;
export const listView_costSelector = SELECTORS.LIST_VIEW.COST_INDICATOR;
export const listView_alreadyJoinedClass = SELECTORS.LIST_VIEW.ALREADY_JOINED_CLASS;
export const listView_giveawayLinkSelector = SELECTORS.LIST_VIEW.GIVEAWAY_LINK;
export const xsrfTokenSelector = SELECTORS.FORM.XSRF_TOKEN;
export const listView_wishlistIndicatorSelector = SELECTORS.LIST_VIEW.WISHLIST_INDICATOR;
export const listView_levelIndicatorSelector = SELECTORS.LIST_VIEW.LEVEL_INDICATOR;
export const listView_groupIndicatorSelector = SELECTORS.LIST_VIEW.GROUP_INDICATOR;
export const listView_ownedIndicatorSelector = SELECTORS.LIST_VIEW.OWNED_INDICATOR;
export const statusIndicatorId = SELECTORS.EXTENSION_UI.STATUS_INDICATOR_ID;
export const manualJoinButtonClass = SELECTORS.EXTENSION_UI.MANUAL_JOIN_BUTTON_CLASS;
