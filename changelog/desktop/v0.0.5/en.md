# Kisaki v0.0.5

## Highlights

- Added the Task Center to track progress and history for scanning, ingest, extension, and update tasks.
- Improved automations with manual, startup, and Cron command triggers plus run results.
- Added duplicate entity merging for games, people, companies, characters, collections, and tags.

## Breaking Changes

- Changed extension compatibility checks to use the Extension API version instead of the Kisaki engine version.
- Removed the legacy extension settings-panel contribution surface; extensions need to migrate to Webview UI.

## Features

- Added Task Center search, category filters, active task controls, and completed record cleanup.
- Added an extension task-run API so extensions can surface long-running work in the Task Center.
- Added extension Webview UI capabilities for larger dialogs, theme appearance bridging, and task result display.
- Added library graph import support for extensions to batch write related media, people, companies, characters, and attachments.
- Added a Bangumi Webview settings page for account, sync, import, automation, and maintenance workflows.
- Supported one-click adding for the Kisaki official extension repository.

## Fixes

- Fixed global scrollbar styling and app font loading issues.
- Fixed delete confirmation dialogs possibly keeping stale state after closing.
- Fixed alert dialog action semantics and incorrect stacking for some overlays.
- Fixed library graph import external ID conflicts being detected across unrelated nodes.
- Fixed inconsistent author spacing on extension cards.
- Fixed incorrect sequence numbers in automation run history.

## Improvements

- Improved progress display for scanning, scraping, ingest, extension installation, repository refresh, and app updates.
- Improved extension install and update flows with unified release plans, signing risks, changelogs, and apply results.
- Improved Bangumi import and sync previews so options and diagnostics are clearer before running.
- Changed game launch and stop flows to include status notifications.
- Changed scraper provider IDs to be scoped by media type, reducing conflicts between media sources.
- Optimized extension Webview font loading by serving fonts from packaged app resources.
