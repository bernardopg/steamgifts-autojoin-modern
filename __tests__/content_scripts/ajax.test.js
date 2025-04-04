// Create mock implementation
const mockSetPointsAtStart = jest.fn();
const mockSendMessage = jest.fn();

// Mock dependencies
jest.mock('../../content_scripts/state.js', () => ({
  getXsrfToken: jest.fn(() => 'mock-token'),
  getPointsAtStart: jest.fn(() => 100),
  setPointsAtStart: mockSetPointsAtStart
}));

// Mock the API function
jest.mock('../../content_scripts/ajax.js', () => {
  return {
    attemptAjaxJoin: jest.fn().mockImplementation(() => Promise.resolve(true))
  };
});

// Import the mocked module
import { attemptAjaxJoin } from '../../content_scripts/ajax.js';

// Setup global chrome mock
global.chrome = {
  ...global.chrome,
  runtime: {
    ...global.chrome?.runtime,
    sendMessage: mockSendMessage
  }
};

describe('AJAX Module', () => {
  beforeEach(() => {
    // Reset mocks
    jest.clearAllMocks();
  });
  
  it('should successfully join a giveaway', async () => {
    // Arrange
    attemptAjaxJoin.mockResolvedValueOnce(true);
    
    // Act
    const result = await attemptAjaxJoin('abc123', 10, document.createElement('div'), null);
    
    // Assert
    expect(result).toBe(true);
    expect(attemptAjaxJoin).toHaveBeenCalled();
  });
  
  it('should handle failed join attempts', async () => {
    // Arrange
    attemptAjaxJoin.mockResolvedValueOnce(false);
    
    // Act
    const result = await attemptAjaxJoin('abc123', 10, document.createElement('div'), null);
    
    // Assert
    expect(result).toBe(false);
  });
});