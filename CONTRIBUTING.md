# Contributing to SteamGifts AutoJoin

Thank you for your interest in contributing to SteamGifts AutoJoin! This document provides guidelines and best practices for contributing to the codebase.

## Project Structure

The extension is organized as follows:

- `content_scripts/` - Contains content scripts that run on SteamGifts pages
  - `utils/` - Modular utility functions organized by category
    - `core-utils.js` - Core functions like points handling, delay, formatting
    - `dom-utils.js` - DOM manipulation, UI elements, toast notifications
    - `extraction-utils.js` - Functions for extracting data from page elements
    - `filter-utils.js` - Functions for filtering giveaways
    - `ui-utils.js` - Functions for enhancing the SteamGifts UI
    - `index.js` - Re-exports all utility functions
  - `main.js` - Main content script entry point
  - `ajax.js` - AJAX request handling
  - `buttonHandler.js` - Button click handlers
  - `selectors.js` - DOM selectors used throughout the extension
  - `state.js` - State management for the extension
  - `timer.js` - Timer functionality
  - `ui.js` - UI rendering and management
- `dist/` - Built extension files (not checked into git)
- `__tests__/` - Jest tests organized by module
- `manifest.json` - Extension manifest
- `options.html/js` - Options page
- `popup.html/js` - Popup page
- `service-worker.js` - Background service worker

## Coding Standards

### General Guidelines

- **Follow ESLint Rules**: The project uses ESLint with Airbnb-base configuration. Run `npm run lint` to check for issues and `npm run lint:fix` to automatically fix them.
- **Use Modern JavaScript**: Use ES6+ features like arrow functions, destructuring, template literals, etc.
- **Be Conservative with Dependencies**: Avoid adding new dependencies unless absolutely necessary.
- **Write Tests**: Add tests for new functionality using Jest.

### Naming Conventions

- **Variables and Functions**: Use camelCase for variables and functions (`getUserPoints`, `extractCost`).
- **Constants**: Use UPPER_SNAKE_CASE for constants (`MAX_RETRIES`, `DEFAULT_DELAY`).
- **Classes and Components**: Use PascalCase for classes and components (`StatusIndicator`, `ProgressBar`).
- **Files**: Use kebab-case for file names (`core-utils.js`, `extraction-utils.js`).
- **Private Functions/Variables**: Prefix with underscore (`_compiledRegex`, `_processQueue`).

### Function Design

- **Single Responsibility**: Each function should do one thing only.
- **Descriptive Names**: Use descriptive names that indicate what the function does.
- **Default Parameters**: Use default parameters when appropriate.
- **Error Handling**: Wrap code in try/catch blocks and log errors appropriately.
- **Return Early**: Return early from functions to avoid deep nesting.

Example:
```javascript
export function extractCost(giveawayElement) {
  if (!giveawayElement) return null;
  
  try {
    // Function implementation
  } catch (e) {
    error('Error extracting cost:', e);
    return null;
  }
}
```

### Documentation

- **JSDoc Comments**: Use JSDoc comments for functions and classes.
- **Module Headers**: Add a descriptive header at the top of each file.
- **Code Comments**: Comment non-obvious code sections.

Example:
```javascript
/**
 * Extract cost from giveaway element
 * @param {HTMLElement} giveawayElement - The giveaway element
 * @returns {number|null} Cost in points or null if not found
 */
export function extractCost(giveawayElement) {
  // Implementation
}
```

## Development Process

1. **Fork the repository**
2. **Create a feature branch**: `git checkout -b feature/your-feature-name`
3. **Install dependencies**: `npm install`
4. **Make your changes**
5. **Run linting**: `npm run lint`
6. **Run tests**: `npm test`
7. **Build the extension**: `npm run build`
8. **Submit a pull request**

## Testing

- Use Jest for writing tests.
- Place tests in the `__tests__` directory, matching the structure of the source code.
- Run tests with `npm test`.

## Building

- `npm run dev` - Watch mode for development
- `npm run build` - Production build
- `npm run dist` - Production build without optimization (for debugging)

## Code Reviews

All submissions require review. We use GitHub pull requests for this purpose.

Thank you for your contribution!