# Kisaki Extension Tooling v0.0.2

## Features

- Added Webview extension UIs with dialogs, pages, appearance sync, typed RPC, and development HMR
- Added `@kisaki3/extension-ui-vue` with Vue components and semantic styles matching Kisaki
- Added task-run APIs with phase and work progress, bounded result summaries, and `cancelOwn`
- Added library graph import APIs for entities, relations, and source data
- Changed scaffolding and `kisx` to support multiple UI stacks, publishing modes, and layered host/UI builds

## Breaking Changes

- Removed `settingsPanels`; settings and interactive surfaces should now open Webviews through `cardActions`
- Changed `Serializable*` to `JsonValue`, `JsonObject`, and strictly wire-safe RPC values
- Changed `backgroundTasks` to `automations` and `ExtensionTaskRun*` to `TaskRun*`
- Required manifest `entry` and `ui` paths to start with `./` and adopted a new host/UI output layout
- Changed scraper provider and scraped-identity contracts to be scoped by media type

## Improvements

- Improved host, UI, and shared-code boundaries and completed generated project configuration
- Improved development-extension reloads and output watching stability
- Improved tooling package management, build order, required outputs, and lockstep versions
