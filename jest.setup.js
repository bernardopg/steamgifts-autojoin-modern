// Mock Chrome Extension API
global.chrome = {
  runtime: {
    lastError: null,
    onMessage: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
    onInstalled: {
      addListener: jest.fn(),
    },
    onStartup: {
      addListener: jest.fn(),
    },
    sendMessage: jest.fn(),
  },
  storage: {
    sync: {
      get: jest.fn(),
      set: jest.fn(),
    },
    session: {
      get: jest.fn(),
      set: jest.fn(),
    },
    onChanged: {
      addListener: jest.fn(),
      removeListener: jest.fn(),
    },
  },
  alarms: {
    create: jest.fn(),
    onAlarm: {
      addListener: jest.fn(),
    },
    clear: jest.fn(),
  },
};

// Mock fetch API
global.fetch = jest.fn();

// Mock DOM methods that might not be in jsdom
document.querySelector = document.querySelector || jest.fn();
document.querySelectorAll = document.querySelectorAll || jest.fn(() => []);

// Silence console during tests
global.console.log = jest.fn();
global.console.error = jest.fn();
global.console.warn = jest.fn();