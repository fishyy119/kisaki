# Kisaki v0.0.6

## Highlights

- Added an ambient light and glass visual system that casts a soft cover-derived glow across the UI.
- Refactored statistics report pages with a new editorial layout.

## Breaking Changes

- Changed extension repository manifests to plain-text descriptions and changelogs; localized metadata is no longer supported and older repositories need to publish updated manifests.

## Features

- Added ambient light that extracts colors from covers, casts a soft glow across the UI, and transitions smoothly between pages.
- Added glass effects and a unified shadow elevation system for dialogs, menus, and other overlays.

## Fixes

- Fixed extension repositories failing to recover automatically after their cached manifest became invalid, previously requiring removing and re-adding the repository.
- Fixed weekly report trend and heatmap charts not rendering.
- Fixed inaccurate leap year day counts on statistics pages.

## Improvements

- Refactored statistics report pages around the period's most played cover, reorganizing duration changes, composition, and rankings.
- Improved statistics heatmaps with per-report granularity and relative intensity scaling.
- Improved loading, error, and empty states on people and character pages.
- Improved searcher layout and state feedback.
- Changed component styles and shadow tiers for a consistent look across the app.

## Compatibility

- Changed the Electron runtime from 39 to 41.
