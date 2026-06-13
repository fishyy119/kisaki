# Vnite Importer

Built-in Vnite database backup importer for Kisaki.

This extension imports games and user-owned library data from Vnite backup zip files into the
Kisaki game library. It provides a guided import dialog, write preview, configurable field mapping,
background import progress, diagnostics, and optional metadata completion through Kisaki scraper
profiles.

## Features

- Reads Vnite backup zip files containing the `game`, `game-local`, and `game-collection` PouchDB
  databases.
- Imports core game metadata, related sites, external IDs, NSFW markers, launcher data, game
  folders, save paths, play status, score, play time, sessions, created time, and last played time.
- Imports collections, tags, genres as tags, optional platforms as tags, companies, optional extra
  people, and optional unknown extra data as notes.
- Imports media attachments including covers, backdrops, logos, icons, optional description images,
  optional save backup archives, and memory notes with optional images.
- Lets users choose exactly which field groups are written before running an import.
- Supports previewing the write plan before applying changes.
- Supports conflict handling with skip existing, merge selected fields, or overwrite selected fields.
- Runs imports as cancelable Kisaki task runs with progress notifications and a final report.
- Can optionally run metadata completion after import by using a configured Kisaki scraper profile.

## Import Flow

1. Open the Vnite importer from the built-in extension card action.
2. Choose a Vnite database backup `.zip` file.
3. Review import options, selected fields, conflict behavior, attachment handling, and optional
   metadata completion.
4. Generate a preview to inspect created, updated, skipped, warning, and error counts.
5. Start the import and follow progress through the task run notification or the wizard.
6. Review the completion summary and diagnostics.

## Notes

- Backup archives must be zip files and are limited to 2 GiB.
- The importer works locally unless metadata completion is enabled. Completion depends on the
  selected Kisaki scraper profile.
- Attachment export failures are recorded as diagnostics by default. Enabling strict attachment
  handling makes attachment failures stop the graph write.
- Vnite wide-cover attachments are currently reported as unsupported diagnostics.
- If a Vnite game has multiple save paths, Kisaki imports the first one and reports a warning.
- Temporary extraction and attachment workspaces are cleaned up after preview or import runs.

## Development

```bash
pnpm build
pnpm validate
pnpm typecheck
pnpm lint
pnpm test:backup
pnpm test:mapping
pnpm test:import
```
