# Data Layer

## Key Files

- `apps/desktop/src/shared/db/schema.ts` - Drizzle schema definitions
- `apps/desktop/src/shared/db/schema-relations.ts` - Table relations
- `apps/desktop/src/shared/db/custom-types.ts` - Custom column types (enum, JSON)
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

## Schema Definition

```typescript
// apps/desktop/src/shared/db/schema.ts
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

## Triggers & Change Feed

`TriggerStore` automatically creates SQLite triggers for all schema tables. Each `INSERT` /
`UPDATE` / `DELETE` produces a `RawDbChange` (`shared/db/changes.ts`) that is handed to the
`DbChangeFeed` (`services/db/feed/`). The feed debounces and groups changes, then fans out to the
batched `db:changed` IPC push, the `library.changed` module hook, and the settings projection; see
[ipc-events.md](ipc-events.md).

Change delivery is deferred via `queueMicrotask()` to avoid SQLite busy errors. Row snapshots in
`RawDbChange` never leave the main process.

**Assumption**: All tracked tables have an `id` column (default primary key).

## Full-Text Search (FTS5)

FTS is configured for entity tables (games, characters, persons, companies):

- Virtual table with `tokenize='unicode61'`
- Sync triggers keep FTS index updated
- Rebuild one entity index via `db:rebuild-fts`; rebuild all via `db:rebuild-all-fts`

## Search Patterns

- Schema: `sqliteTable(`, `drizzle-orm/sqlite-core`
- Initialization: `drizzle(`, `journal_mode = WAL`, `migrate(`
- Renderer proxy: `drizzle-orm/sqlite-proxy`, `ipcManager.invoke('db:execute'`
- Triggers: `emit_db_change`, `CREATE TRIGGER`, `DROP TRIGGER`
- FTS: `FtsStore`, `CREATE VIRTUAL TABLE`, `tokenize='unicode61'`
- Transaction: `.transaction(`

## Procedures

### Schema Changes (columns, indexes, constraints)

1. Modify schema in `apps/desktop/src/shared/db/schema.ts`
2. Update relations in `schema-relations.ts` if needed
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
7. Check FTS impact if modifying games/characters/persons/companies

### Adding a New Table

1. Define table in `apps/desktop/src/shared/db/schema.ts`:

   ```typescript
   export const myTable = sqliteTable('my_table', {
     ...baseColumns
     // ... columns
   })
   ```

2. Add relations in `schema-relations.ts` if needed

3. Generate and verify migration

4. Triggers are auto-created by `TriggerStore` (requires `id` column)

5. Consider FTS inclusion if it's an entity table

## Constraints

- **Main DB calls are synchronous**: Don't write `await db.select()...` in main process
- **Transaction callbacks are synchronous**: No `await` inside `.transaction()` callback
- Async side effects (network, file IO) must happen after transaction commits
- Reading DB immediately after event may hit busy state; use `queueMicrotask()` if needed
- FTS changes may require explicit rebuild strategy (drop/recreate)

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
