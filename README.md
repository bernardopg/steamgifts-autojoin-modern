# SteamGifts AutoJoin Modern

A modernized browser extension to assist with SteamGifts giveaways with manual and automatic AJAX joining and advanced filtering.

## Features

- Manual AJAX joining of giveaways without page reload
- Automatic mode for hands-free joining
- Advanced filtering options:
  - Point buffer
  - Min/max giveaway cost
  - Level requirements
  - Wishlist-only option
  - Group giveaway filtering
  - Owned games filtering
  - Blacklist and whitelist keywords

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
  - `ajax.js` - AJAX request handling
  - `buttonHandler.js` - Button creation and handling
  - `main.js` - Main entry point
  - `selectors.js` - DOM selectors
  - `state.js` - Application state management
  - `timer.js` - Timer functionality
  - `ui.js` - UI manipulation
  - `utils.js` - Utility functions
- `service-worker.js` - Background service worker
- `popup.html/js` - Extension popup
- `options.html/js` - Extension options page

## Contributing

Contributions are welcome. Please make sure to add tests for new features or bug fixes.