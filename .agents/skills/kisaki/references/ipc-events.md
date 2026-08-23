# IPC & Cross-Process Communication

Cross-process communication uses three explicit mechanisms. There is no generic event bus:

1. **Typed IPC** - request/response (`IpcMainHandlers`), renderer-to-main one-way
   (`IpcMainListeners`), and main-to-renderer domain pushes (`IpcRendererEvents`).
2. **Db change feed** - batched `db:changed` pushes for renderer query invalidation.
3. **Module hooks** - main-process-only workflow participation points (`@main/hooks`), also the
   substrate for the extension `hooks` contribution point.

## Key Files

- `apps/desktop/src/shared/ipc.ts` - IPC type contracts (`IpcMainHandlers`, `IpcMainListeners`, `IpcRendererEvents`, `IpcResult`)
- `apps/desktop/src/shared/db/changes.ts` - `RawDbChange` / `DbChangeSummary` contracts
- `apps/desktop/src/shared/task-run.ts` - Cross-process TaskRun contracts
- `apps/desktop/src/main/hooks.ts` - Module hook engine (`@main/hooks`)
- `apps/desktop/src/main/services/db/feed/` - `DbChangeFeed` (trigger stream debounce/grouping and outlets)
- `apps/desktop/src/main/services/ipc/service.ts` - Main IPC service wrapper
- `apps/desktop/src/main/services/ipc/result.ts` - Main `wrapIpc` / `wrapIpcVoid` helpers
- `apps/desktop/src/main/services/<service>/ipc.ts` - Per-service IPC registration
- `apps/desktop/src/renderer/src/core/ipc.ts` - Renderer IPC manager
- `apps/desktop/src/renderer/src/composables/use-ipc.ts` - `useIpc` / `useIpcOnce` subscription composables
- `apps/desktop/src/renderer/src/composables/use-db-changes.ts` - `useDbChanges` invalidation composable
- `apps/desktop/src/preload/index.ts` - Preload bridge (`window.kisaki`)

## IPC Contracts

### Type Definitions

```typescript
// Request-response (invoke/handle)
interface IpcMainHandlers {
  'db:execute': (params: DbExecuteParams) => IpcResult<DbExecuteResult>
  'notify:show': (options: NotifyOptions) => IpcVoidResult
  // ...
}

// One-way renderer-to-main listeners (send/on)
interface IpcMainListeners {
  'app:theme-changed': [theme: 'light' | 'dark' | 'system']
  // ...
}

// Main → Renderer pushes
interface IpcRendererEvents {
  'db:changed': [changes: DbChangeSummary[]]
  'library:entity-merged': [event: LibraryEntityMergedEvent]
  'automation:run-finished': [record: AutomationRunHistoryRecord]
  'i18n:state-changed': [state: UiLocaleState]
  // ...
}

// Standard result format
type IpcResult<T> = { success: true; data: T } | { success: false; error: string }
type IpcVoidResult = { success: true } | { success: false; error: string }
```

### Usage Patterns

**Main side** (in `services/<service>/ipc.ts`):

```typescript
import { wrapIpc, wrapIpcVoid } from '@main/services/ipc'

export function registerMyServiceIpc(service: MyService, ipc: IpcService): void {
  ipc.handle('my:get-data', async (_, id) => wrapIpc(() => service.getData(id)))

  ipc.handle('my:save-data', async (_, input) => wrapIpcVoid(() => service.saveData(input)))
}
```

**Service side** (in `init()`):

```typescript
async init(container: ServiceInitContainer<this>): Promise<void> {
  registerMyServiceIpc(this, container.get('ipc'))
}
```

**One-way listener**:

```typescript
export function registerMyServiceIpc(service: MyService, ipc: IpcService): void {
  ipc.on('my:notify', (_, payload) => {
    service.receive(payload)
  })
}
```

`IpcError.error` is the only IPC failure payload. It must be a safe English message suitable for
renderer fallback display. Do not add `code` or `details` to `IpcError`; model recoverable business
states in the successful data payload instead.

**Renderer side**:

```typescript
const result = await ipcManager.invoke('channel-name', params)
if (result.success) {
  // Use result.data
}

// Or throw IpcInvocationError on failure.
const data = unwrapIpcData(await ipcManager.invoke('channel-name', params))

// One-way send
ipcManager.send('channel-name', payload)

// Listen to main pushes (auto-cleanup in components via useIpc)
useIpc('library:entity-merged', (_e, event) => {
  // Handle push
})
```

## Db Change Feed

SQLite triggers append changes to a transactional outbox that is drained after commit, producing
`RawDbChange` records (row snapshots stay in the main process). The `DbChangeFeed`
(`services/db/feed/`) debounces and groups them, then fans out to four outlets:

1. **`db:changed` IPC push** - batched `DbChangeSummary[]` (`{ operation, table, id, occurredAt }`,
   no row snapshots) for renderer query invalidation, chunked so bulk writes stay deliverable.
2. **`db.changed` module hook** - the same batches on `DbService.hooks`, for main-process modules
   that must react to rows the renderer writes. Main-internal: it is not bound to the extension
   hooks point, because extensions get the entity-grouped `library.changed` instead.
3. **`library.changed` module hook** - entity-grouped change summaries with facet-level diffs,
   dispatched on `DbService.hooks` for main-process subscribers and the extension hooks point.
4. **Settings projection** - `settings` table changes dispatch `settingsChanged` on `DbService.hooks`.

### Renderer Writes And Main-Process Reactions

The renderer writes configuration rows (scanners, scraper profiles, collections, settings, and
entity edits) directly through `db:execute`; there is no CRUD channel per table. Two rules keep that
honest:

- A write whose only effect is stored state may go through the renderer's Drizzle proxy.
- A write that must cause main-process behaviour is never assumed to be observed: either the
  renderer calls the owning service over IPC, or the owning service subscribes to `db.changed` and
  reconciles from the row. `ScannerWatchCoordinator` and `AnimeAutoSync` take the second route,
  which is why turning on a scanner's watch in a dialog remounts its watcher.

Renderer components subscribe with a single handler and branch on `operation` / `table`:

```typescript
import { useDbChanges } from '@renderer/composables'

useDbChanges(({ operation, table, id }) => {
  if (operation === 'deleted' && table === 'games' && id === gameId.value) {
    router.push(backTo.value)
  }
})
```

The db change feed is an invalidation signal, not a data source: refetch through the query layer
instead of patching local state from change payloads.

## Domain IPC Pushes

Services push domain state changes to the renderer directly through `IpcRendererEvents` channels
(`ipc.send(...)` in the owning service). Examples: `automation:changed|deleted|run-started|run-finished`,
`library:entity-merged`, `i18n:state-changed`, `scanner:run-state-changed`, `task-run:changed`,
`updater:state-changed`. Keep payloads small, serializable, and stable. Renderer components
subscribe through `useIpc` / `useIpcOnce`.

Do not add speculative channels: define a push only when it has a real emitter and a real consumer.

## Module Hooks

Main-process modules own their hook points as native extensibility primitives. See
`apps/desktop/src/main/hooks.ts` (`@main/hooks`) for the engine and
[extension-system.md](extension-system.md) for how the extension `hooks` contribution point
subscribes to them.

- `createNotifyHook<TPayload>()` - after-the-fact notification. `dispatch` never affects the
  workflow; per-tap failures are logged and isolated. `settle(payload, { budgetMs })` awaits all
  taps within a total budget (used only for flush-window anchors such as `appShuttingDown`).
- `createWaterfallHook<TValue>()` - ordered value transformation via `transform(value)`; a failing
  tap is skipped and the previous value is kept.
- `createVetoHook<TPayload>()` - ordered gatekeeping via `dispatch(payload)`; the first tap that
  returns `{ veto: true, reason? }` stops dispatch, and a failing tap counts as "no veto".
- `tap(handler, { priority })` returns an untap function; dispatch order is ascending priority,
  then registration order. Zero-tap dispatch short-circuits.

Each module exposes its hook surface as `service.hooks` built by a `createXxxHooks()` factory in
the service-root `hooks.ts` (e.g. `ScraperHooks`, `IngestHooks`, `DbHooks`). Bootstrap-owned hooks
live in `main/bootstrap/hooks.ts`.

**Anchor rules**: waterfall/veto hooks dispatch before write transactions, notify hooks dispatch
after commit. Hooks never run inside a transaction. Hook points only expose workflow boundaries -
input data, decisions, results; internal intermediate representations never become hook points.

**Naming**: hook point properties on module hook surfaces use lowerCamelCase workflow names
(`committing`, `committed`, `entryDiscovered`, `sessionEnding`). Use `created`/`updated`/`deleted`
semantics for persisted entity lifecycle, `-ing` forms for pre-write participation points, and
`started`/`finished`/`ended` for runtime lifecycle. Reserve `:` for IPC channel names and dotted
lowercase ids for public extension hook point ids (`ingest.game.committing`).

## TaskRun IPC State Source

Long-running application workflows use dedicated `task-run:*` IPC channels and the renderer task-run
store as their UI state source. Do not model high-frequency TaskRun progress as hooks or database
change pushes.

Required channel semantics:

- `task-run:list-active` reads only `TaskRunService.runs.list(query)` from the main-process active
  run map.
- `task-run:list-history` reads only `TaskRunService.history.list(query)` from persisted final
  `task_run_history` rows.
- `task-run:get-active` and `task-run:get-history` stay separate. Do not add a generic get facade
  that merges active and history.
- `task-run:wait` waits only for an active run. If a run is no longer active, callers should read
  `task-run:get-history`.
- `task-run:changed` sends a full `TaskRun` snapshot every time. Renderer stores replace by
  `run.id`; they do not apply incremental progress patches.
- `task-run:deleted` removes completed history snapshots after main-side history clearing.
- Progress-only changes may be coalesced in main, but start, controls, cancel/pause/resume, and final
  snapshots flush immediately.

`task_run_history` may appear in the `db:changed` feed because it is a SQLite table, but task center
UI must not subscribe to db changes as its state source.

Notify is only a presentation layer for TaskRun. A loading toast can be closable, and
`notify:closed` should only inform the notification coordinator that the user dismissed the toast; it
must not cancel the run.

## Search Patterns

- IPC types: `IpcMainHandlers`, `IpcMainListeners`, `IpcRendererEvents`, `IpcResult`
- Main registration: `ipcService.handle(`, `ipcService.on(`, `ipc.send(`
- Renderer calls: `ipcManager.invoke(`, `ipcManager.send(`, `ipcManager.on(`
- Vue subscription: `useIpc(`, `useIpcOnce(`, `useDbChanges(`
- Hooks: `createNotifyHook`, `createWaterfallHook`, `createVetoHook`, `.hooks.`, `@main/hooks`
- Db feed: `DbChangeFeed`, `DbChangeSummary`, `'db:changed'`, `hooks.dbChanged`
- Common channels: `'db:execute'`, `'db:changed'`, `'notify:*'`, `'task-run:*'`, `'extension:*'`,
  `'media-files:*'`

## Procedures

### Adding a New IPC Channel

1. Define type in `apps/desktop/src/shared/ipc.ts`:

   ```typescript
   interface IpcMainHandlers {
     'my:channel': (params: MyParams) => IpcResult<MyResult>
   }
   ```

2. Implement handler in `apps/desktop/src/main/services/<service>/ipc.ts`:

   ```typescript
   export function registerMyServiceIpc(service: MyService, ipc: IpcService): void {
     ipc.handle('my:channel', async (_, params) => wrapIpc(() => service.doSomething(params)))
   }
   ```

3. Call `registerMyServiceIpc(this, container.get('ipc'))` from the service `init()`.

4. Call from renderer:
   ```typescript
   const result = await ipcManager.invoke('my:channel', params)
   ```

### Adding a Renderer Push

1. Define the channel in `IpcRendererEvents` in `apps/desktop/src/shared/ipc.ts`.
2. Send from the owning service where the state changes: `this.ipc.send('my:changed', payload)`.
3. Subscribe in the renderer with `useIpc('my:changed', (_e, payload) => { ... })`.

### Adding a Module Hook Point

1. Add the point to the module's `hooks.ts` factory with the appropriate kind
   (`createNotifyHook` / `createWaterfallHook` / `createVetoHook`).
2. Dispatch it at the workflow boundary following the anchor rules (waterfall/veto before the
   transaction, notify after commit).
3. If extensions should see it, add the public contract, catalog entry, and binding; see
   [extension-system.md](extension-system.md).

## Constraints

- IPC handlers must return `IpcResult` / `IpcVoidResult` format
- Main request-response handlers must use `wrapIpc` or `wrapIpcVoid`
- IPC registration must stay as a thin adapter: forward typed arguments to service/domain methods and keep runtime shape parsing, business branching, and orchestration out of `ipc.ts`
- Service-owned IPC registration belongs in `services/<service>/ipc.ts`, not `service.ts`
- `IpcError` contains only `success: false` and `error: string`
- `shared/` only contains contracts and pure types; no runtime code from main/renderer
- IPC payloads should be serializable; prefer passing IDs over large objects
- Renderer code must not branch on `result.error` string values
- Hook payloads are bounded summaries: no full database rows, no unbounded arrays, no secrets
- Don't trigger cascading writes in notify hook taps or push handlers (causes race conditions)
- Do not reintroduce a generic cross-process event bus, `AppEvents`, or event forwarding channels

## Related

- [Architecture](architecture.md) - Service patterns
- [Data Layer](data-layer.md) - Triggers feeding the db change feed
- [Extension System](extension-system.md) - Extension hooks contribution point
- [Conventions](conventions.md) - Error handling patterns
