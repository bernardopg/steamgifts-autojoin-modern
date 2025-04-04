# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build Commands
- `npm run dev` - Watch mode for development (builds to dist/)
- `npm run build` - Production build (minified, no source maps)
- `npm test` - Run all tests
- `npm test -- -t "Utils Module"` - Run specific test suite
- `npm test -- --watch` - Run tests in watch mode

## Code Style Guidelines
- **Imports**: Use ES modules syntax with named imports/exports
- **Formatting**: Use 2-space indentation, semicolons at end of statements
- **Error Handling**: Use try/catch for async operations, check chrome.runtime.lastError
- **Logging**: Prefix console logs with "[SG AutoJoin]" for easy identification
- **Naming**: Use camelCase for variables/functions, descriptive names
- **File Organization**: Keep related functionality in separate modules
- **Variables**: Prefer const over let, avoid var
- **Async/Await**: Use async/await for asynchronous operations
- **DOM Manipulation**: Use selectors module for centralized DOM query selectors
- **State Management**: Use the State module for managing extension state
- **Testing**: Use Jest for unit tests, JSDOM for DOM testing