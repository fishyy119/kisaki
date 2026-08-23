# Main Process Architecture

## Key Files

- `apps/desktop/src/main/index.ts` - Entry point, service registration order
- `apps/desktop/src/main/container/container.ts` - ServiceContainer implementation
- `apps/desktop/src/main/container/types.ts` - ServiceRegistry type mapping
- `apps/desktop/src/main/services/*/service.ts` - Individual service implementations
- `apps/desktop/src/main/services/task-run/` - Application-level long-running task run infrastructure
- `apps/desktop/src/main/services/automation/` - Persistent automation rules, scheduling, and invocation history
- `apps/desktop/src/main/services/file-watch/` - Debounced filesystem watch scopes shared by every watcher
- `apps/desktop/src/main/services/media-files/` - Local media files of an entry and their row ownership

## ServiceContainer & DI Pattern

Services are managed by a central container with automatic lifecycle management:

```typescript
// Phase 1: register service instances (no side effects)
await container.register(new DbService())
await container.register(new IpcService())
// ...register all services (order does not matter)

// Phase 2: initialize in dependency order (based on service.deps)
await container.initAll()

// On app quit, dispose() called in reverse init order
await container.disposeAll()
```

### Service Layers

Services fall into three layers. The layer is a property of a service, not a folder: `services/` stays
flat so a service id maps to exactly one directory, and the layering is enforced by `deps` plus
`ScopedContainer`, not by location.

**Red line**: a capability service declares no domain dependency. Its `deps` is empty or `['ipc']`.
Domain services consume capabilities, never the reverse.

| Layer      | Services                                                                                                      | Charter                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Platform   | `ipc`, `db`, `window`, `native`, `notify`, `network`, `deeplink`, `updater`, `i18n`                           | Wrap Electron, the OS, and transports; no library business rules  |
| Capability | `task-run`, `file-watch`, `media-info`, `process`, `player`                                                   | Technical abilities with no domain vocabulary and no library rows |
| Domain     | `scraper`, `ingest`, `scanner`, `media-files`, `activity`, `attachment`, `command`, `automation`, `extension` | Own library meaning and workflows; grow one media type at a time  |

Three neighbours are easy to confuse, so their charters are stated once here:

- `media-info` answers "what is this file": container and track facts, no database access.
- `media-files` answers "which files does this entry have": the seam between user-owned media on
  disk and the consumption-unit rows that play it, including row ownership (`isManual`) and
  watch-driven reconcile.
- `attachment` owns app-owned derived assets (covers, backdrops) whose bytes the app stores itself.

### Service Interface

```typescript
interface IService {
  readonly id: string // Unique identifier, must match ServiceRegistry key
  readonly deps: readonly string[] // Explicit dependencies (service IDs)
  init(container: ServiceContainer): Promise<void>
  dispose?(): Promise<void>
}

// For media-related services (scanner, scraper, activity, etc.)
interface IMediaService extends IService {
  // Additional media-specific methods
}
```

### Folder Organization Semantics

Every folder should have one clear organizational meaning. Choose the meaning before naming entry
files or deciding whether a role-specific entry such as `manager.ts`, `coordinator.ts`,
`gateway.ts`, `provider.ts`, `point.ts`, or `registry.ts` belongs there.

#### Category Organization

A category folder groups peer modules that are close in responsibility but do not form one module
with a shared public boundary.

Rules:

- The folder itself is not a runtime/domain module.
- Children are siblings, not implementation details of the category folder.
- Do not add a category-level entry file only to make the folder look uniform.
- External code may import the specific child module it needs, subject to that child module's own
  boundary.
- `index.ts`, when present, is only an explicit convenience export list.

Examples:

```text
packages/
  extension-api/
  extension-registry/
  extension-sdk/
  extension-cli/
  create-kisaki-extension/

services/extension/contributions/
  commands/
  themes/
  settings-panels/
```

#### Coupled Module Split

A coupled module folder represents one module whose implementation is split across files. The
folder owns a public boundary, and files inside it are implementation parts of the same module.

Rules:

- External code should use the module's public entry, not reach into arbitrary implementation files.
- Internal file names should describe their actual responsibility instead of following a universal
  template.
- Prefer concise semantic file names over full exported class or function names; let folder context
  carry repeated qualifiers when it remains clear.
- `index.ts`, when present, re-exports only the public entry and intentional public types.
- Do not create a facade just to satisfy a naming pattern; the folder must first be a real coupled
  module.
- Name the public entry by the module's role. Do not force every coupled module through
  `manager.ts`.

#### Single File Versus Folder

Decide by whether the module is a standalone module or a member of a templated collection:

- A standalone module chooses its form by actual size. One cohesive file stays a single file
  (`development-watcher.ts`, `webviews.ts`); do not wrap it in a folder whose `index.ts` only
  re-exports that file. Promote it to a coupled module folder only when a real second
  implementation file appears. Promotion is cheap and import-stable: `from '../<name>'` resolves
  the same for `<name>.ts` and `<name>/index.ts`, so callers do not change.
- Members of a templated collection keep the collection's uniform shape even while some members
  are currently single-file. When a category folder mandates a member template (for example
  contribution points: a `<point>/` directory with a `point.ts` entry, mirrored across packages
  and processes), a member folder containing only `point.ts` plus its `index.ts` export list is
  correct, not a facade. Uniform member shape is what keeps lookup, naming rules, and mirrored
  directories mechanical; do not flatten individual members into files.

#### `utils` and `shared` Naming

Use `utils` sparingly, but do not eliminate it on naming purity alone. A `utils.ts` file or
`utils/` folder is appropriate for small pure helpers and framework glue: deterministic formatting,
display mapping, URL/key construction, layout constants, small collection transforms, type-level
helpers, path/string/date helpers, or deterministic calculations with no side effects. These helpers
may carry light local domain vocabulary when the implementation remains pure and policy-free.

Move code out of `utils` when it clearly owns business rules, workflows, persistence access, IPC
calls, service/container access, runtime side effects, user-facing policy, or domain orchestration.
When the behavior is substantial enough to own one of those responsibilities, name the file after
that responsibility instead:

- `merge.ts` / `reconciliation.ts` for domain merge policy.
- `normalization.ts` for contract/domain normalization.
- `selection.ts` for selection state and selection derivation.
- `messages.ts` for user-facing copy mapping.
- `projection.ts` / `mappers.ts` for DB or DTO projection.
- `serialization.ts` for wire/runtime serialization.
- `path-confinement.ts` for path safety boundaries.

Use `shared` only when the sharing itself is the real boundary. Examples include cross-process
contracts under `src/shared/`, package-level shared value objects, reusable renderer components
under `components/shared/`, or implementation genuinely shared by sibling files in one coupled
module. A local `shared.ts` should stay small and infrastructure-like; if it grows business rules or
domain policy, move that code to a semantic owner file. Do not split tiny cohesive helpers into
multiple files only to avoid a broad name; a small local `shared.ts` can be clearer than several
one-function files.

Common public-entry naming preferences:

- Functional module split: the module is mostly stateless functions or small procedures. Use file
  names that describe the concrete responsibility, such as `validation.ts`, `mappers.ts`,
  `normalization.ts`, `planner.ts`, or `view.ts`.
- `manager.ts` / `*Manager`: long-lived objects that own state, lifecycle, registrations,
  sessions, caches, or invariants.
- `coordinator.ts` / `*Coordinator`: workflow objects that coordinate several owned/public modules
  to keep one operation consistent, especially when the coordination spans filesystem changes,
  persistence, or recovery. Do not use `manager.ts` only because the workflow is commit-oriented.
- `gateway.ts` / `*Gateway`: route or aggregate calls across peer adapters without owning the
  domain state itself.
- `provider.ts` / `*Provider`: public capability adapters that expose application-owned services to
  another runtime or boundary. Do not reuse `*Provider` for internal subdomain stores beneath a
  capability provider.
- `point.ts` / `*ContributionPoint`: extension contribution point boundaries. Use this entry
  consistently for main-process and extension-host contribution point folders.
- `host.ts` / `*Host`: runtime host process or boundary objects where "host" is the domain role.
  Do not use `*Host` for main-process capability adapters.
- `controller.ts` / `*Controller`: process, OS, or transport controllers.
- `registry.ts` / `*Registry`: registration tables and contribution/catalog registries.
- `store.ts` / `*Store`: persistence wrappers and CRUD-oriented domain stores.
- `planner.ts` / `*Planner`: pure or mostly pure plan/candidate selection.
- `view.ts` / `*View`: read models assembled from multiple sources.

Examples:

```text
services/extension/runtime/
  manager.ts
  state.ts
  storage.ts
  secrets.ts
  host-controller.ts

services/extension/repositories/
  manager.ts
  store.ts
  fetcher.ts
  aggregate.ts
  types.ts

services/extension/packages/
  commit.ts
  recovery.ts
  integrity.ts
  cleanup.ts
  layout.ts
  preparer.ts
  types.ts

services/extension/capabilities/
  gateway.ts
  network.ts
  notify.ts
  library/
    provider.ts
    entities/
      store.ts
    attachments.ts
    relations.ts

services/extension/contributions/
  registry.ts
  entity-menus/
    point.ts
    types.ts
  settings-panels/
    point.ts
    sessions.ts

services/extension/
  ipc.ts
```

`runtime/` and `repositories/` use `manager.ts` because they own long-lived state and lifecycle.
`capabilities/gateway.ts` is an aggregate gateway, while `capabilities/library/provider.ts` is a
capability provider. Internal library subdomains such as entities, relations, and attachments are
stores or role-named helpers, not nested capability providers. `contributions/registry.ts` is a
registry aggregate, and individual contribution point folders use `point.ts` with
`*ContributionPoint` entry classes even when their internal implementation manages registrations,
sessions, or release state.
Service-level IPC registration belongs in service-root `ipc.ts`. Do not add runtime shape parsers
for internal main-app IPC payloads; keep validation in the service/domain layer that owns the
invariant.

### Service Module API Shape

This rule applies only to the first folder level below a service root, for example
`services/extension/<submodule>/`. It does not recursively constrain deeper folders.

For services with first-level submodules, `service.ts` remains the main service class. It may own
real service-level business logic, state, externally triggered workflows, cross-submodule
orchestration, and lifecycle. The namespace rule is only meant to prevent `service.ts` from becoming
a flat facade that rewrites or forwards every submodule method.

Rules:

- Expose first-level submodules as named service properties or namespaces.
- Do not rewrite, duplicate, or forward a submodule's public methods on `service.ts` only to make a
  flat service API.
- IPC handlers and internal callers should call the owning namespace, such as
  `service.repositories.refreshRepository(id)`, instead of `service.refreshRepository(id)`.
- Treat each first-level submodule as a public module boundary. Sibling submodules may depend on each
  other only through explicit public APIs exported by the target submodule entry, or through the
  namespace exposed by `service.ts`; do not import another sibling's private split files.
- A first-level submodule may expose more than one public role when those roles are stable and real,
  such as `Manager`, `Store`, `Transaction`, `Planner`, or public `types`. `index.ts` should make
  that public surface intentional and explicit; it is not required to collapse the submodule to one
  public class or one public file.
- When two sibling submodules repeatedly need the same implementation detail, do not share it by
  reaching across private files. Move the detail to the true owning/shared submodule, or merge the
  siblings if they are one coupled use-case family.
- Keep true service-level responsibilities on `service.ts`, such as `init`, `dispose`, externally
  triggered entrypoints, coordination that belongs to the service as a whole, and narrowly scoped
  service-level helpers.
- Do not move cohesive service-level logic into a new submodule only to satisfy the namespace API
  shape. Create a first-level submodule only when it represents a real capability or boundary.
- Do not apply this namespace rule below the first submodule layer. Deeper folders follow the folder
  organization semantics above.

Example:

```ts
// Preferred
service.repositories.refreshRepository(id)
service.updates.checkUpdates()

// Avoid
service.refreshRepository(id)
service.checkUpdates()
```

### TaskRunService Boundary

`TaskRunService` is the reusable infrastructure for producer-created long-running run instances. It
owns the lifecycle, progress snapshots, cooperative control signals, task center read model, optional
notification presentation, and bounded completed history for runs that producers explicitly create.
It does not replace scanner, ingest, updater, extension, automation, or any other domain owner.
Business state, trigger records, and domain-specific history remain in the owning service.

Rules:

- The service id is `task-run`.
- `TaskRunService` should initialize before services and handlers that can create task runs.
- `service.ts` is the composition root; active run state belongs under `runs/`, completed history
  under `history/`, IPC registration in service-root `ipc.ts`, and notification presentation in the
  task-run module.
- Expose first-level capabilities as namespaces: `service.runs.create(...)`,
  `service.runs.list(...)`, `service.history.list(...)`, and `service.history.clearCompleted()`.
  Do not flatten these methods onto `service.ts`.
- `TaskRunService` does not import scanner, ingest, updater, extension package, repository, command,
  or automation business modules. Producers create a run, pass `TaskRunContext` into their own work,
  report progress, and explicitly finish with `complete()`, `fail()`, or `cancel()`.
- Active runs are in-memory only. `task_run_history` stores final snapshots; it is not an active
  state recovery log and should not synthesize failed history after restart.
- TaskRun metadata uses `category`, `operation`, `owner`, `initiator`, and `subject`. `subject` does
  not carry renderer routes; renderer navigation is derived from `subject.type` plus `subject.id`.

### AutomationService Boundary

`AutomationService` owns persistent automation configuration, scheduling, and
`automation_run_history`. It invokes commands and records command invocation facts. It must not store
TaskRun ids, TaskRun snapshots, TaskRun progress, or TaskRun results.

### CommandService Boundary

`CommandService` owns the command registry and thin invocation routing only. It does not own
execution ids, progress, cancellation, wait state, notifications, or command history. A long-running
command handler calls the real producer or scoped extension task-run API and returns the created
`runId`.

### Scraper & Ingest Boundary

`ScraperService` turns provider answers into a fact bundle; `IngestService` decides what those facts
change in the library. Two contracts hold the seam together:

- **Slot presence is authority.** A provider omits a slot it cannot answer and returns an empty
  collection only when the source states the entity has none. The merge layer keeps that distinction
  (`foldCollectionResults`), incoming availability is computed from presence rather than length, and
  the `replace` collection policy may therefore clear tags, external ids, related sites, and
  relations. An empty answer never satisfies a `first` strategy slot, so the remaining providers are
  still consulted.
- **Writing and clearing need different authority.** Several fact sources can feed one link table:
  `game_person_links` takes the `persons` slot plus the cast stated by characters. So `availability`
  carries two sets: `surfaces` (any source answered, gates writing) and `completeLinks` (every source
  answered, gates deleting). `update/link-topology.ts` declares the topology once — each link table
  with the surface that selects it and the fact sources that feed it — keyed by the graph builder's
  link output so a new link table cannot skip its declaration. `resolveLinkWrites` downgrades
  `replace` to `merge` for an incomplete table, and the update coordinator reports a
  `collection-replace-degraded` warning when the downgrade actually preserved rows. Without this, a
  profile that cannot ask about staff would delete staff rows no source contradicted.
- **Cancellation is a signal, not a status poll.** Every provider entry point takes
  `ScraperProviderContext` (`{ locale, signal }`), and ingest threads the same signal down to network
  calls and asset flushes. `AbortError` propagates instead of degrading into a partial scrape, and
  cancellation checks stop at the commit point: once a transaction commits, the run finishes.

### Service Directory Structure

**Required files:**

- `service.ts` - Main service class (required for all services)
- `index.ts` - Re-exports only, no business logic (optional but common)

**Optional files by service type:**

| File/Directory | Used By                                          | Purpose                                   |
| -------------- | ------------------------------------------------ | ----------------------------------------- |
| `handlers/`    | activity, attachment, deeplink, scanner, scraper | IMediaService handlers or route handlers  |
| `types.ts`     | db, deeplink, extension, process                 | Service-specific type definitions         |
| `ipc.ts`       | Any service with IPC channels                    | IPC registration using `wrapIpc` helpers  |
| `router.ts`    | deeplink                                         | URL route definitions (deeplink-specific) |
| `locales/`     | i18n                                             | Translation resources (i18n-specific)     |

**Complex services** may have additional domain-specific files:

- `db/`: attachment.ts, fts.ts, helper.ts, thumbnail.ts, trigger.ts
- `extension/`: service.ts, ipc.ts, installations/, installer/, packages/, repositories/, signers/, updates/, runtime/, capabilities/, contributions/

## Bootstrap Sequence

### Pre-Ready Phase (before `app.whenReady()`)

Must complete before Electron is ready:

- `app.setPath('userData', ...)` - Set user data directory
- Protocol registration (`setAsDefaultProtocolClient`)
- Single instance lock (`requestSingleInstanceLock`)
- Portable mode detection

### Post-Ready Phase (after `app.whenReady()`)

- Service registration (in dependency order)
- `TaskRunService` should be registered and initialized before updater, scanner, extension,
  automation, or other services that can create long-running runs
- Window creation
- Extension loading
- Deeplink processing (queued during pre-ready)

## Search Patterns

- Service registration: `container.register(`
- Container lifecycle: `register(`, `disposeAll(`, `initOrder`, `serviceStatus`
- Service identity: `readonly id =`, `implements IService`
- IPC binding: `ipc.handle(`, `ipc.on(`
- Dependency access: `container.get('<id>')`
- Task runs: `TaskRunService`, `task-run`, `service.runs.create`, `task_run_history`
- Automations: `AutomationService`, `automations`, `automation_run_history`

## Procedures

### Adding a New Main Service

1. Create `apps/desktop/src/main/services/<name>/service.ts`:

   ```typescript
   export class MyService implements IService {
     readonly id = 'my-service'
     readonly deps = ['ipc'] as const

     async init(container: ServiceContainer) {
       // Setup logic.
       void container
     }

     dispose() {
       // Cleanup: remove listeners, close connections
     }
   }
   ```

2. Update `apps/desktop/src/main/container/types.ts`:

   ```typescript
   import type { MyService } from '../services/my-service/service'

   export interface ServiceRegistry {
     // ... existing services
     'my-service': MyService
   }
   ```

3. Register in `apps/desktop/src/main/index.ts`:

   ```typescript
   await container.register(new MyService())
   ```

4. If service needs IPC:
   - Create `apps/desktop/src/main/services/<name>/ipc.ts`
   - Export `register<Name>Ipc(service, ipc)` and call it from `init()`
   - Use `wrapIpc` / `wrapIpcVoid` for request-response handlers
   - Clean up in `dispose()`

## Constraints

- `service.id` must be unique and stable; must match `ServiceRegistry` key
- `service.deps` must list all required dependencies; the container initializes services in dependency order
- IPC handlers must use `wrapIpc` / `wrapIpcVoid`; return safe English error summaries
- Services with listeners/timers/watchers must clean up in `dispose()`
- `index.ts` files should only re-export, no business logic

## Related

- [IPC & Events](ipc-events.md) - IPC contracts and event system
- [Data Layer](data-layer.md) - Database service patterns
- [Conventions](conventions.md) - Async patterns, error handling
