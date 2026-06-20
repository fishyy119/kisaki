# Kisaki Extension Tooling v0.0.2

## Features

- Added Webview extension UIs with dialogs, pages, appearance sync, typed RPC, and development HMR.
- Added `@kisaki3/extension-ui-vue` with Vue components and semantic styles matching Kisaki.
- Added task-run APIs with phase and work progress, bounded result summaries, and `cancelOwn`.
- Added library graph import APIs for entities, relations, and source data.
- Upgraded scaffolding and `kisx` with multiple UI stacks, publishing modes, and layered host/UI builds.

## Breaking Changes

- Removed `settingsPanels`; settings and interactive surfaces should now open Webviews through `cardActions`.
- Replaced `Serializable*` with `JsonValue`, `JsonObject`, and strictly wire-safe RPC values.
- Renamed `backgroundTasks` to `automations` and `ExtensionTaskRun*` to `TaskRun*`.
- Required manifest `entry` and `ui` paths to start with `./` and adopted a new host/UI output layout.
- Scoped scraper provider and scraped-identity contracts by media type.

## Improvements

- Strengthened host, UI, and shared-code boundaries and completed generated project configuration.
- Stabilized development-extension reloads and output watching.
- Centralized tooling packages, build order, required outputs, and lockstep versions.
