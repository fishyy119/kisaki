# Vocabulary

The canonical nouns of the codebase, what each one means, and the near-synonyms it excludes. A name
is an assertion (see [conventions.md](conventions.md#naming-claims)); this file is the dictionary
those assertions are checked against. When a new word is needed, add it here first and state what it
excludes.

## Entity Axis

| Word               | Meaning                                                                                       | Excludes                                                        |
| ------------------ | --------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| **media type**     | A work users consume: `game`, `anime`, `comic`, `novel` (`MediaType`)                         | Never used for the seven-entity union                           |
| **satellite type** | Cross-media shared entity a work links to: `character`, `person`, `company` (`SatelliteType`) | `metadata type` — a person is an entity, not data about a work  |
| **organizer type** | Container that groups content: `collection`, `tag`                                            |                                                                 |
| **content entity** | Media or satellite — anything an organizer can group (`ContentEntityType`)                    | `media type` when satellites are included (scraper profiles are |
|                    |                                                                                               | keyed by _entity_ type)                                         |
| **entry**          | One row of a media table — the unit of library membership                                     | `item`, `title`                                                 |
| **unit**           | A consumption unit row: episode, chapter, volume                                              |                                                                 |
| **metadata**       | The scraped field contracts of an entity (`CoreGameMetadata`, `shared/metadata/`)             | Any use meaning "satellite"                                     |

## Services and Layers

| Word             | Meaning                                                                                                                             | Excludes                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **scraper**      | Fetches metadata from providers                                                                                                     |                                                                                                                                                                            |
| **ingest**       | Writes scraped graphs into the library (add/update/persist/batch)                                                                   | `import` for this flow                                                                                                                                                     |
| **scanner**      | Walks directories to discover entries and hand them to ingest                                                                       |                                                                                                                                                                            |
| **holdings**     | The user's own files for entries: unit files, sync from disk walks, recognition                                                     | `files` as a service name                                                                                                                                                  |
| **activity**     | Consumption of an entry: launching, watching, reading, sessions — the umbrella over every vertical                                  | `play` as the umbrella (`play` is game's verb)                                                                                                                             |
| **attachment**   | A file bound to a row. The **attachment store** (`db.attachment`) is the mechanism; the **attachment service** owns workflows on it | `files` (user media), `assets` (backups are not assets),                                                                                                                   |
|                  |                                                                                                                                     | `storage` (extension KV)                                                                                                                                                   |
| **image**        | Domain-free sharp transforms: staging crops/previews, icon encoding                                                                 |                                                                                                                                                                            |
| **native**       | OS integration: shell, dialogs, auto-launch, shortcuts                                                                              |                                                                                                                                                                            |
| **process**      | Launching and watching OS processes (technical layer)                                                                               |                                                                                                                                                                            |
| **video**        | Playback sessions (technical layer); `Playback*` names the session concept inside it                                                |                                                                                                                                                                            |
| **reader**       | Reader windows and book containers (technical layer)                                                                                |                                                                                                                                                                            |
| **reading**      | The consumption mode shared by comic and novel (`ReadingCoordinator`, `use-comic-reading`)                                          | `read` — the per-unit completion flag                                                                                                                                      |
| **notification** | The platform service and every reference that holds it: id, class, folder, IPC prefix, `notification: NotificationService` fields   | `notify` names callable verb surfaces only: the renderer `notify.success()` function, the `kisaki.notify` capability, the `notify` hook kind, `presentation.notify` config |
| **task run**     | A progress-tracked long operation (`task-run` service); the renderer surface is the task center                                     |                                                                                                                                                                            |
| **command**      | An invocable operation; **automation** schedules command runs                                                                       |                                                                                                                                                                            |

## Consumption

| Word                      | Meaning                                                                                        | Excludes         |
| ------------------------- | ---------------------------------------------------------------------------------------------- | ---------------- |
| **session**               | One consumption span with a start and end (`*_sessions` tables)                                | `completion`     |
| **completion**            | Whether a unit has been consumed (`watched` / `read` flags, catch-up marking)                  | `marks`          |
| **marks**                 | Bookmarks and highlights made while reading (`ReadingMarks`)                                   | Completion flags |
| **progress**              | Position within a playback or a text; `watch-progress` for the video thresholds                |                  |
| **launch / watch / read** | The per-media verbs: game=play (launch is the pre-process step), anime=watch, comic/novel=read |                  |

## Role Nouns

Behavior classes are `<Domain><Role>`; the role noun names the behavioral shape. Definitions live in
[architecture.md](architecture.md#folder-organization-semantics).

| Role                                                                            | Shape                                                                          |
| ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------ |
| **Store**                                                                       | Holds rows or bytes and keeps their invariants                                 |
| **Coordinator**                                                                 | Orchestrates several units into one workflow, with ordering guarantees         |
| **Engine**                                                                      | Generic core driven by per-entity specs                                        |
| **Runner**                                                                      | Executes one task to completion with progress and cancellation                 |
| **Persister**                                                                   | Writes a prepared graph into rows and links                                    |
| **Adapter**                                                                     | Shapes one media type's tables onto a shared coordinator                       |
| **Server**                                                                      | Serves bytes through a protocol or cache                                       |
| **Manager**                                                                     | Owns the lifecycle of a set of live instances, paired with a Store             |
| **Router / Feed / Launcher / Watcher / Finder / Executor / Planner / Registry** | Single behavioral identities                                                   |
| **Handler**                                                                     | Callback-shaped _types_ only (`DeeplinkRouteHandler`, `IpcMainHandlers`, taps) |

## Sharing Words

Exactly two: `utils` (by nature — small, pure, liftable) and `shared` (by relationship — siblings
share it, at any scope). Excluded: `common`, `helper(s)`, `base`, `misc`. Code that owns a mechanism
gets a semantic name.

## Identifiers

`newId()` from `@shared/id` mints every identifier (RFC 9562 UUID). Copy actions, deeplinks
(`kisaki://open/<type>/<id>`, `kisaki://launch/<media>/<id>`), and shortcuts address entities by id;
the UI exposes ids through copy actions in menus, never as displayed fields.
