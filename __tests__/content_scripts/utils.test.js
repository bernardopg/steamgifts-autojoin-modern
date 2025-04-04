import * as Utils from '../../content_scripts/utils.js';
import * as Selectors from '../../content_scripts/selectors.js';
import * as State from '../../content_scripts/state.js';

// Mock modules
jest.mock('../../content_scripts/state.js');
jest.mock('../../content_scripts/selectors.js', () => ({
  pointsSelector: '.points-selector',
  xsrfTokenSelector: '.xsrf-token-selector',
  listView_giveawaySelector: '.giveaway-selector',
  listView_alreadyJoinedClass: 'is-joined',
  listView_costSelector: '.cost-selector',
  listView_levelIndicatorSelector: '.level-indicator',
  listView_giveawayLinkSelector: '.giveaway-link',
  listView_groupIndicatorSelector: '.group-indicator',
  listView_wishlistIndicatorSelector: '.wishlist-indicator',
  listView_ownedIndicatorSelector: '.owned-indicator',
}));

describe('Utils Module', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
    
    // Reset document
    document.body.innerHTML = '';
    
    // Reset State mocks
    State.getPointsAtStart.mockReturnValue(null);
    State.setPointsAtStart.mockImplementation();
    State.getBlacklistKeywords.mockReturnValue([]);
    State.getWhitelistKeywords.mockReturnValue([]);
    State.shouldSkipOwned.mockReturnValue(false);
  });
  
  describe('getCurrentPoints', () => {
    it('should return points from State if available', () => {
      State.getPointsAtStart.mockReturnValue(100);
      expect(Utils.getCurrentPoints()).toBe(100);
    });
    
    it('should extract points from DOM when not in State', () => {
      document.body.innerHTML = `<div class="points-selector">100P</div>`;
      expect(Utils.getCurrentPoints()).toBe(100);
      expect(State.setPointsAtStart).toHaveBeenCalledWith(100);
    });
    
    it('should handle missing points element', () => {
      expect(Utils.getCurrentPoints()).toBeNull();
    });
  });
  
  describe('getXsrfTokenFromPage', () => {
    it('should extract token from DOM', () => {
      document.body.innerHTML = `<input class="xsrf-token-selector" value="test-token" />`;
      expect(Utils.getXsrfTokenFromPage()).toBe('test-token');
    });
    
    it('should return null if token not found', () => {
      expect(Utils.getXsrfTokenFromPage()).toBeNull();
    });
  });
  
  describe('extractGiveawayCodeFromUrl', () => {
    it('should extract code from valid URL', () => {
      const url = 'https://www.steamgifts.com/giveaway/abcde/game-name';
      expect(Utils.extractGiveawayCodeFromUrl(url)).toBe('abcde');
    });
    
    it('should return null for invalid URL', () => {
      const url = 'https://www.steamgifts.com/not-a-giveaway/';
      expect(Utils.extractGiveawayCodeFromUrl(url)).toBeNull();
    });
  });
  
  describe('extractCost', () => {
    it('should extract cost from giveaway element', () => {
      const element = document.createElement('div');
      element.innerHTML = `<div class="cost-selector">50P</div>`;
      expect(Utils.extractCost(element)).toBe(50);
    });
    
    it('should return null if cost not found', () => {
      const element = document.createElement('div');
      expect(Utils.extractCost(element)).toBeNull();
    });
  });
  
  describe('isBlacklisted', () => {
    it('should return true if title contains blacklisted word', () => {
      State.getBlacklistKeywords.mockReturnValue(['test']);
      const element = document.createElement('div');
      element.innerHTML = `<a class="giveaway-link">Test Game</a>`;
      expect(Utils.isBlacklisted(element)).toBe(true);
    });
    
    it('should return false if title does not contain blacklisted word', () => {
      State.getBlacklistKeywords.mockReturnValue(['dlc']);
      const element = document.createElement('div');
      element.innerHTML = `<a class="giveaway-link">Test Game</a>`;
      expect(Utils.isBlacklisted(element)).toBe(false);
    });
  });
});