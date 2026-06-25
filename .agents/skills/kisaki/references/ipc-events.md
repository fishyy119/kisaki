# IPC & Events

## Key Files

- `apps/desktop/src/shared/ipc.ts` - IPC type contracts (`IpcMainHandlers`, `IpcMainListeners`, `IpcRendererEvents`, `IpcResult`)
- `apps/desktop/src/shared/task-run.ts` - Cross-process TaskRun contracts
- `apps/desktop/src/shared/events/index.ts` - Event type contracts (`AppEvents`)
- `apps/desktop/src/shared/events/library.ts` - Typed library event contracts
- `apps/desktop/src/main/services/ipc/service.ts` - Main IPC service wrapper
- `apps/desktop/src/main/services/ipc/result.ts` - Main `wrapIpc` / `wrapIpcVoid` helpers
- `apps/desktop/src/main/services/<service>/ipc.ts` - Per-service IPC registration
- `apps/desktop/src/main/services/event/service.ts` - Main event service
- `apps/desktop/src/renderer/src/core/ipc.ts` - Renderer IPC manager
- `apps/desktop/src/renderer/src/core/event.ts` - Renderer event manager
- `apps/desktop/src/preload/index.ts` - Preload bridge (`window.electron`)

## IPC Contracts

### Type Definitions

```typescript
// Request-response (invoke/handle)
interface IpcMainHandlers {
  'db:execute': (params: DbExecuteParams) => IpcResult<DbExecuteResult>
  'notify:show': (options: NotifyOptions) => IpcVoidResult
  // ...
}

// One-way main listeners (send/on)
interface IpcMainListeners {
  'event:forward': (event: string, payload: unknown) => void
  // ...
}

// Main → Renderer events
interface IpcRendererEvents {
  'extension:contributions-changed': (snapshot: ExtensionContributionSnapshot) => void
  'db.updated': (table: string, id: string) => void
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

// Listen to main events
ipcManager.on('channel-name', (data) => {
  // Handle event
})
```

### TaskRun IPC State Source

Long-running application workflows use dedicated `task-run:*` IPC channels and the renderer task-run
store as their UI state source. Do not model high-frequency TaskRun progress as AppEvents or generic
database events.

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

`task_run_history` may participate in existing `db.*` trigger events because it is a SQLite table,
but task center UI must not subscribe to those DB events as its state source.

Notify is only a presentation layer for TaskRun. A loading toast can be closable, and
`notify:closed` should only inform the notification coordinator that the user dismissed the toast; it
must not cancel the run.

## Event System

### AppEvents Contract

Events are defined in `apps/desktop/src/shared/events/index.ts`:

```typescript
interface AppEvents {
  'app.locale.changed': [locale: AppLocale]
  'db.inserted': [table: string, id: string]
  'db.updated': [table: string, id: string]
  'db.deleted': [table: string, id: string]
  'app.ready': []
  // ...
}
```

### Event Naming

AppEvents use pure dot topics:

```typescript
<subject>[.<aspect>].<event>
```

- Use lowerCamelCase for every segment.
- Use `.` for semantic hierarchy; do not use `:` or `-` in AppEvents.
- Reserve `:` for IPC channels such as `db:execute`, `event:forward`, and `scanner:scan-game`.
- Name the subject as the domain object whose state changed, not the service that emitted it.
- Use `created` / `updated` / `deleted` for persisted entity lifecycle events.
- Use `started` / `finished` for runtime lifecycle events. Put final status in the payload when needed.
- Keep high-frequency progress streams out of AppEvents; use IPC/store state instead.
- TaskRun progress specifically belongs in `task-run:*` IPC/store state, not AppEvents. Add
  low-frequency `taskRun.started` or `taskRun.finished` events only when there is a real non-UI
  consumer.
- Do not add speculative events. Define an event only when it has a real emitter and a real consumer, or it is an intentional public extension contract.
- Extension API host events must use the same topic names as public AppEvents. Extension-owned custom events are a separate extension-scoped message namespace and are not part of the AppEvents/HostEvents naming migration.

Examples:

```typescript
game.created
game.started
scanner.finished
app.locale.changed
entity.merged
```

### Cross-Process Event Forwarding

Events are forwarded between main and renderer via `event:forward` IPC channel:

```
Main EventService ←→ event:forward IPC ←→ Renderer eventManager
```

Use `{ local: true }` to prevent cross-process forwarding (local-only event).

### Vue Component Subscription

```typescript
// In <script setup>
import { useEvent, useEventOnce } from '@renderer/composables/use-event'

// Subscribe (auto-cleanup on unmount)
useEvent('db.updated', (table, id) => {
  if (table === 'games' && id === props.gameId) {
    refetch()
  }
})

// One-time subscription
useEventOnce('app.ready', () => {
  // Handle once
})
```

## Search Patterns

- IPC types: `IpcMainHandlers`, `IpcMainListeners`, `IpcRendererEvents`, `IpcResult`
- Main registration: `ipcService.handle(`, `ipcService.on(`
- Renderer calls: `ipcManager.invoke(`, `ipcManager.send(`, `ipcManager.on(`
- Event types: `AppEvents`
- Event usage: `eventService.on(`, `eventService.emit(`, `eventManager.on(`, `eventManager.emit(`
- Vue subscription: `useEvent(`, `useEventOnce(`
- Common channels: `'db:execute'`, `'event:forward'`, `'notify:*'`, `'task-run:*'`, `'extension:*'`

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

### Adding a New Event

1. Define in `apps/desktop/src/shared/events/index.ts`:

   ```typescript
   interface AppEvents {
     'myDomain.changed': [data: MyEventData]
   }
   ```

2. Emit from main or renderer:

   ```typescript
   eventService.emit('myDomain.changed', data) // main
   eventManager.emit('myDomain.changed', data) // renderer
   ```

3. Subscribe in Vue component:
   ```typescript
   useEvent('myDomain.changed', (data) => {
     /* handle */
   })
   ```

## Constraints

- IPC handlers must return `IpcResult` / `IpcVoidResult` format
- Main request-response handlers must use `wrapIpc` or `wrapIpcVoid`
- IPC registration must stay as a thin adapter: forward typed arguments to service/domain methods and keep runtime shape parsing, business branching, and orchestration out of `ipc.ts`
- Service-owned IPC registration belongs in `services/<service>/ipc.ts`, not `service.ts`
- `IpcError` contains only `success: false` and `error: string`
- `shared/` only contains contracts and pure types; no runtime code from main/renderer
- IPC payloads should be serializable; prefer passing IDs over large objects
- Renderer code must not branch on `result.error` string values
- Event names are public API; avoid renaming without considering consumers
- Event payloads should be small and stable; avoid non-serializable objects
- Event definitions should not be dead declarations; remove events with no emitter and no consumer
- Don't trigger cascading writes in event callbacks (causes race conditions)

## Related

- [Architecture](architecture.md) - Service patterns
- [Data Layer](data-layer.md) - DB events (`db:*`)
- [Extension System](extension-system.md) - Extension events
- [Conventions](conventions.md) - Error handling patterns
