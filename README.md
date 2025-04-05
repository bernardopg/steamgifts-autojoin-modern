# SteamGifts AutoJoin Modern

A modernized browser extension to assist with SteamGifts giveaways with manual and automatic AJAX joining and advanced filtering.

## Features

- Manual AJAX joining of giveaways without page reload
- Automatic mode for hands-free joining
- Advanced filtering options:
  - Point buffer with dynamic time-of-day settings
  - Min/max giveaway cost
  - Level requirements
  - Wishlist-only option
  - Group giveaway filtering
  - Owned games filtering
  - Entry limit filtering
  - Blacklist and whitelist keywords and publishers
  - Regular expression filter support
- UI Enhancements:
  - Toast notifications
  - Progress indicators
  - Entry stats display
  - Highlighting for giveaways ending soon
  - Ad removal
  - Fully customizable styling

## Development

### Setup

```bash
# Install dependencies
npm install
```

### Build commands

```bash
# Development mode with watching
npm run dev

# Production build
npm run build

# Production build without optimization (for debugging)
npm run dist

# Run linting
npm run lint

# Fix linting issues automatically
npm run lint:fix
```

### Testing

The project uses Jest for testing with JSDOM for DOM testing.

```bash
# Run all tests
npm test

# Run specific test suite
npm test -- -t "Utils Module"

# Run tests in watch mode
npm test -- --watch
```

## Extension Structure

- `content_scripts/` - Scripts injected into SteamGifts pages
  - `utils/` - Modular utility functions organized by category
    - `core-utils.js` - Core functions like points handling, delay, formatting
    - `dom-utils.js` - DOM manipulation, UI elements, toast notifications
    - `extraction-utils.js` - Functions for extracting data from page elements
    - `filter-utils.js` - Functions for filtering giveaways
    - `ui-utils.js` - Functions for enhancing the SteamGifts UI
    - `index.js` - Re-exports all utility functions
  - `ajax.js` - AJAX request handling
  - `buttonHandler.js` - Button creation and handling
  - `main.js` - Main entry point
  - `selectors.js` - DOM selectors with structured organization
  - `state.js` - Application state management using module pattern
  - `timer.js` - Timer functionality
  - `ui.js` - UI rendering and management
  - `utils.js` - Re-exports all utility functions
- `service-worker.js` - Background service worker
- `popup.html/js` - Extension popup
- `options.html/js` - Extension options page
- `__tests__/` - Jest tests organized by module
- `.eslintrc.json` - ESLint configuration
- `CONTRIBUTING.md` - Contribution guidelines and coding standards

## Code Quality

This extension follows modern JavaScript best practices:

- ESLint with Airbnb configuration for consistent code style
- Modular architecture with single-responsibility principle
- Comprehensive error handling and logging
- Defensive programming with input validation
- Well-documented code with JSDoc comments
- Throttled DOM operations for better performance
- Robust selectors for resilience against site changes

## Contributing

Contributions are welcome. Please read the [CONTRIBUTING.md](CONTRIBUTING.md) file for detailed guidelines and best practices. Make sure to add tests for new features or bug fixes.