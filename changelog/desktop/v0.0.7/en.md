# Kisaki v0.0.7

## Features

- Added top-level extension navigation; declared webview pages can join the sidebar with stable, history-friendly routes
- Added a runtime icon system bundling the full MDI set; extension contribution icons render from built-in MDI names or icon files inside the extension package, matching the app style

## Improvements

- Refactored extension webview session management; pages and dialogs open from their declarations with at most one live session each, and repeated dialog triggers adopt the open session
