# Data Layer

## Key Files

- `apps/desktop/src/shared/db/schema/tables/` - Drizzle table definitions (one file per domain)
- `apps/desktop/src/shared/db/schema/relations/` - Drizzle relation declarations
- `apps/desktop/src/shared/db/columns/` - Custom column types (enum, JSON, base columns)
- `apps/desktop/src/shared/db/contracts/` - Enum unions, JSON payload types, vocabulary contracts
- `apps/desktop/src/shared/db/table-names.ts` - Table name constants
- `apps/desktop/drizzle.config.ts` - Drizzle Kit configuration
- `apps/desktop/drizzle/` - Migration files
- `apps/desktop/src/main/services/db/service.ts` - Main DB service
- `apps/desktop/src/main/services/db/trigger.ts` - SQLite trigger management
- `apps/desktop/src/main/services/db/fts.ts` - Full-text search setup
- `apps/desktop/src/renderer/src/core/db.ts` - Renderer DB proxy

## Architecture

### Main Process

- Uses `better-sqlite3` driver with Drizzle ORM
- **Synchronous execution**: `.get()`, `.all()`, `.run()` are sync
- Initializes SQLite with WAL mode
- Runs migrations on startup
- Manages triggers for change events
- Provides FTS5 full-text search

### Renderer Process

- Uses Drizzle `sqlite-proxy` driver
- All queries go through `db:execute` IPC channel
- Never directly accesses SQLite file

```
Renderer (sqlite-proxy) → IPC 'db:execute' → Main (better-sqlite3) → SQLite
```

### Renderer Direct-Write Allowlist

Renderer direct SQL is the intended model for **user-curation state** — rows the UI edits in
place. The allowlist is enforced by the `kisaki/renderer-direct-write` ESLint rule in
`apps/desktop/eslint.config.ts`, which resolves the written table by import origin: the argument
must be a `@shared/db` export (named or through a namespace import) whose exported name is on the
list, so local aliases stay allowed and anything unresolvable fails closed. Extending the list is
a reviewed decision, not a workaround.

Allowed table families (see the rule for the exact list):

- Entity core rows and organizer rows: `games`/`animes`/… , `tags`, `collections`,
  `showcase_sections`, `scanners`, `scraper_profiles`, `settings`
- Consumption units and user-managed unit files: episodes/extras/chapters/volumes and the
  chapter/volume file rows (anime file rows go through the spec-typed
  `use-anime-file-records` writer)
- Notes, sessions, link rows, relation rows, external-id rows

Writes that must go through the owning main-process workflow instead:

- Scraped metadata graphs → ingest (`ingest:add-*` / `ingest:update-*`)
- Sync-owned unit file rows (create/delete from disk walks) → holdings (`holdings:sync-*`)
- App-owned asset bytes → attachment service
- Reading marks written during playback/reading → activity service
- Task-run history, extension installations/repositories/trusts → their owning services

Dynamic write machinery (`core/db/**`, `use-anime-file-records.ts`) is exempt from the
import-origin rule because its table sets are bound in typed specs.

## Schema Definition

```typescript
// apps/desktop/src/shared/db/schema/tables/content.ts
import { sqliteTable, text, integer } from 'drizzle-orm/sqlite-core'

export const games = sqliteTable('games', {
  id: text('id').primaryKey(),
  name: text('name').notNull()
  // ... columns
})
```

### Base Columns Pattern

Most tables use `baseColumns` for common fields:

```typescript
const baseColumns = {
  id: text('id')
    .primaryKey()
    .$defaultFn(() => nanoid()),
  createdAt: integer('created_at', { mode: 'timestamp' }).$defaultFn(() => new Date()),
  updatedAt: integer('updated_at', { mode: 'timestamp' }).$defaultFn(() => new Date())
}
```

### Identity Key Columns

Columns whose value is an identity rather than display text use `identityKeyText`
(`shared/db/columns/identity.ts`), which applies `normalizeKeyText` (NFKC + case folding) on write.
The stored value is the comparison key, so lookups can match with a plain `eq(...)` instead of
normalizing in application code.

`tags` keeps both forms: `name` is the display name and `normalized_name` is the unique identity
key. Resolve or create tags through `resolveTagId` (`services/db/helper/tag.ts`) so every ingest path
shares one matching semantic.

## Triggers & Change Feed

`TriggerStore` creates TEMP `AFTER` triggers for all schema tables. Each `INSERT` / `UPDATE` /
`DELETE` appends a row to the TEMP `db_change_outbox` table and signals the store to drain.

Delivery is **transactional**: the outbox row is written inside the caller's transaction, so a
rollback discards it along with the rest of the transaction's writes. A drain is deferred via
`queueMicrotask()` (also avoiding SQLite busy errors) and skipped while `sqlite.inTransaction` is
true, so changes only reach consumers after their transaction commits. Draining consumes the outbox
before dispatching, so listeners that write to the database cannot redeliver the same batch.
`DbService.dispose` drains and flushes once more so deletions captured just before shutdown still
reach attachment cleanup.

Drained rows become `RawDbChange` values (`shared/db/changes.ts`) handed to the `DbChangeFeed`
(`services/db/feed/`). The feed debounces and groups changes, then fans out to the chunked
`db:changed` IPC push, the `library.changed` module hook, and the settings projection; see
[ipc-events.md](ipc-events.md). Row snapshots in `RawDbChange` never leave the main process.

Triggers and the outbox are TEMP objects owned by the connection: they never persist and are
rebuilt on every start. `dropAllTriggers` clears _persisted_ triggers (FTS sync, plus change
triggers left by older versions) before migrations run.

**Assumption**: All tracked tables have an `id` column (default primary key).

## Full-Text Search (FTS5)

FTS is configured for entity tables (games, animes, characters, persons, companies):

- Virtual table with `tokenize='unicode61'`
- Sync triggers keep FTS index updated
- Rebuild one entity index via `db:rebuild-fts`; rebuild all via `db:rebuild-all-fts`

### Derived State Reconciles, It Does Not Migrate

Search indexes and attachment directories are derived from the schema, not part of it, so their
declarations are the only truth and startup makes the database match them. Migrations never touch
either.

- `FTS_TABLES` in `db/fts.ts` declares which indexes exist and which columns they carry. `init`
  compares each index's real columns against it, rebuilds and repopulates on any difference, and
  drops indexes no entity type declares.
- The attachment layout is `<storage>/<table>/<row>/<file>`, so `AttachmentStore.reconcileStorage`
  drops directories of tables the schema no longer has — nothing else could ever reach them.
- Both are stated as "match the declaration", not as recognition of known-old shapes, so they
  resolve future drift (a new indexed column, a removed entity type) the same way.

## Search Patterns

- Schema: `sqliteTable(`, `drizzle-orm/sqlite-core`
- Initialization: `drizzle(`, `journal_mode = WAL`, `migrate(`
- Renderer proxy: `drizzle-orm/sqlite-proxy`, `ipcManager.invoke('db:execute'`
- Triggers: `emit_db_change_signal`, `db_change_outbox`, `CREATE TEMP TRIGGER`, `DROP TRIGGER`
- FTS: `FtsStore`, `CREATE VIRTUAL TABLE`, `tokenize='unicode61'`
- Transaction: `.transaction(`

## Procedures

### Schema Changes (columns, indexes, constraints)

1. Modify the table file in `apps/desktop/src/shared/db/schema/tables/`
2. Update declarations in `schema/relations/` if needed
3. Determine if migration is required:
   - TypeScript-only changes (type inference): No migration
   - SQLite structure changes: Migration required
4. Generate migration:
   ```bash
   pnpm --filter kisaki drizzle-kit generate
   ```
5. Verify migration runs on startup (check main logs)
6. Check trigger impact:
   - Table renames affect event `table` values
   - Update renderer event filters accordingly
7. If the change adds or removes a searchable column, update `FTS_TABLES`; the index reconciles on
   the next start and needs no migration statement

### Adding a New Table

1. Define the table in a domain file under `apps/desktop/src/shared/db/schema/tables/` and export
   it from the folder's `index.ts`:

   ```typescript
   export const myTable = sqliteTable('my_table', {
     ...baseColumns
     // ... columns
   })
   ```

2. Add declarations in `schema/relations/` if needed

3. Generate and verify migration

4. Triggers are auto-created by `TriggerStore` (requires `id` column)

5. Consider FTS inclusion if it's an entity table

## Constraints

- **Main DB calls are synchronous**: Don't write `await db.select()...` in main process
- **Transaction callbacks are synchronous**: No `await` inside `.transaction()` callback
- Async side effects (network, file IO) must happen after transaction commits
- Reading DB immediately after event may hit busy state; use `queueMicrotask()` if needed
- FTS column changes need no migration: edit `FTS_TABLES` and the next start rebuilds the index

## Notes

- Custom JSON columns follow "lenient read, strict write": `fromDriver` never throws and returns
  the documented safe default, `toDriver` throws on invalid values. See
  [Conventions](conventions.md#boundary-parsing-lenient-read-strict-write).
- Migration files are versioned and committed
- `drizzle/` directory must be accessible in packaged app
- `attachment://` protocol provides access to DB attachment files

## Related

- [IPC & Events](ipc-events.md) - `db:*` events
- [Architecture](architecture.md) - DbService patterns
- [Build & Release](build-release.md) - Migration packaging
- [Conventions](conventions.md) - Transaction boundaries
