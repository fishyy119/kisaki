# Extension System

## Key Files

### Host (App)

- `apps/desktop/src/main/services/extension/service.ts` - Main extension service
- `apps/desktop/src/main/services/extension/installations/view.ts` - Installed extension aggregation from SQLite installation records and package manifests
- `apps/desktop/src/main/services/extension/installations/store.ts` - SQLite-backed installation records
- `apps/desktop/src/main/services/extension/installer/manager.ts` - Repository and local `.kisx` package install orchestration
- `apps/desktop/src/main/services/extension/installer/planner.ts` - Install plan creation, risk reporting, and signer confirmation checks
- `apps/desktop/src/main/services/extension/packages/` - Package layout, verification, download, extraction, commit, recovery, operation cancellation, and icons
- `apps/desktop/src/main/services/extension/packages/preparer.ts` - Low-level repository/local package preparation for an existing package operation
- `apps/desktop/src/main/services/extension/packages/commit.ts` - Active package and installation row commit/removal
- `apps/desktop/src/main/services/extension/packages/recovery.ts` - Startup package store reconciliation
- `apps/desktop/src/main/services/extension/packages/integrity.ts` - Active package/archive/source integrity checks
- `apps/desktop/src/main/services/extension/repositories/` - Distributed repository refresh and catalog aggregation
- `apps/desktop/src/main/services/extension/signers/` - Extension-scoped signer trust storage and fingerprint checks
- `apps/desktop/src/main/services/extension/updates/` - Update candidate selection and automatic-update eligibility
- `apps/desktop/src/main/services/extension/runtime/manager.ts` - Extension host lifecycle and bridge requests
- `apps/desktop/src/main/services/extension/runtime/host/entry.ts` - Shared extension host process entry
- `apps/desktop/src/main/services/extension/capabilities/task-runs/` - Scoped extension-owned TaskRun provider
- `apps/desktop/src/main/services/extension/contributions/` - Main-side contribution adapters
- `apps/desktop/src/renderer/src/core/extensions/` - Renderer-side structured contribution consumption

### SDK & Tooling

- `extensions/` - Built-in extension projects bundled with the desktop app
- `packages/extension-api/` - Public contracts, DTOs, schema, and RPC protocol
- `packages/extension-registry/` - Distributed registry manifest, artifact, validation, digest, and signing helper contracts
- `packages/extension-sdk/` - Author-facing `defineExtension`, `kisaki`, and context bridge
- `packages/extension-cli/` - `kisx` CLI (`build`, `validate`, `pack`, `key`, `registry`, `dev`)
- `packages/create-kisaki-extension/` - Extension scaffold
- `apps/desktop/tools/builtin-extensions/` - Builds or watches built-in extensions for desktop dev/build flows

## Architecture

Extensions run in one shared extension host process. The renderer never imports extension entry code; it only renders structured DTOs received from main through `extension:*` IPC channels.

### Service Boundary Map

Keep extension responsibilities split by process and transport boundary:

- `ExtensionService` is the main-process composition root. It owns path setup, first-level manager wiring, lifecycle init/dispose, contribution snapshot emission, and IPC registration. Renderer-facing work is exposed through namespaces such as `service.repositories`, `service.installations`, `service.installer`, `service.updates`, `service.signers`, and `service.contributions`.
- `repositories/**` owns repository configuration, manifest fetching, snapshot persistence, icon proxying, and in-memory catalog aggregation. Repository manifests are remote declarations, not installed-state facts.
- `installations/**` owns SQLite-backed installation rows and the installed DTO assembled from DB rows, package manifests, built-ins, dev extensions, and runtime state.
- `packages/**` owns path confinement, `.kisx` download, hash/signature/package verification, extraction, active-package commit/removal, startup recovery, operation cancellation, and extension icon serving. It does not own install/update business policy, signer trust decisions, or runtime lifecycle.
- `installer/**` owns renderer-facing install plans and all repository/local package mutation orchestration, including the package replacement path used by updates. Main returns risks and plan fingerprints; renderer performs confirmation.
- `updates/**` owns update candidate selection, preview-update/pin compatibility, signer trust eligibility, and automatic-update filtering. It delegates execution to the public installer command and must not import installer private split files such as confirmation, preparation, source snapshot, or signer trust helpers.
- `signers/**` owns extension-scoped signer trust. Trusting one fingerprint for one extension never grants global signer trust.
- `installations/view.ts`, `installations/store.ts`, `installer/planner.ts`, `packages/preparer.ts`, `packages/manifest.ts`, `packages/layout.ts`, `packages/commit.ts`, `packages/recovery.ts`, `packages/integrity.ts`, `repositories/manager.ts`, `updates/planner.ts`, `reload-watcher.ts`, and `shared/path-confinement.ts` are single-purpose helpers. Keep scan, installation records, package validation, repository download, and path safety logic out of anonymous IPC handlers.
- `runtime/manager.ts` owns the desired-vs-loaded runtime state machine for the shared extension host. `runtime/host-controller.ts`, `runtime/rpc-client.ts`, `runtime/rpc-core.ts`, `runtime/storage.ts`, and `runtime/secrets.ts` are runtime infrastructure, not contribution or capability logic.
- `runtime/host/**` is code that runs inside the extension host process. It loads extension entries, builds the SDK bridge, normalizes extension-owned contributions, and talks back to main through typed RPC only.
- `capabilities/**` are main-side adapters for host-owned services that extensions call through `kisaki.*`.
- `contributions/**` are main-side adapters for extension-owned registrations. They own renderer-facing snapshots, callback routing, and release of runtime-scoped registrations.
- `packages/extension-api/**` defines extension runtime public contracts first. Main, host, renderer, SDK, CLI, and built-in extensions consume those contracts rather than inventing local public shapes. Distributed repository manifest and signing contracts live in `packages/extension-registry/**`.

First-level extension service submodules are module boundaries. Cross-submodule calls go through the
submodule public entry or through the namespace on `ExtensionService`; a submodule public entry may
explicitly expose multiple stable roles such as manager, store, commit, recovery, or types. When two
sibling submodules need one private helper, move that helper to the true owning/shared submodule or
merge the coupled use case instead of importing private files across the boundary.

### Distributed Registry Model

Use this vocabulary consistently:

- `Repository` is a user-managed manifest URL. Repositories have no official, default, built-in, or app-managed identity.
- `Repository snapshot` is the last successfully parsed manifest stored on `extension_repositories.manifest_snapshot`.
- `Catalog` is the main-process aggregation of enabled repository snapshots. Search and discovery must use `extension:search-catalog`; it must not hit the network.
- Packaged builds must enforce the secure repository URL policy on both new refresh results and persisted snapshots before catalog aggregation or install candidate selection. Development-only `file:` and local `http:` URLs never survive into packaged catalog/install use.
- `Installation` is the local SQLite fact in `extension_installations`. Runtime loading must derive the active path from the installation id through `ExtensionPackageLayout`.
- Active package directories under `packages/<id>` are derived runtime artifacts. If a directory has no matching SQLite installation row, startup recovery quarantines it and it does not enter the installed view.
- Original `.kisx` archives are content-addressed records under `archives/<sha256>.kisx`; they are recovery and verification inputs, not active package payload.
- `Signer trust` is extension-scoped and stored in `extension_signer_trusts`.

Do not reintroduce source providers, provider/locator pairs, GitHub topic search as discovery, package-directory source files, or a filesystem JSON install-state file. Repository manifests describe what can be installed; SQLite installation rows describe what is installed.

Remote install/update flow:

1. Renderer asks main for `extension:create-install-plan`.
2. Main selects a concrete release/artifact from the aggregated catalog, reports sha256/signature/signer risks, and returns a plan id plus fingerprint.
3. Renderer shows the app dialog and sends the confirmed plan id/fingerprint, signer trust choice, enabled state, and update policy to `extension:install-release` or `extension:update`.
4. Main revalidates the plan, writes approved signer trust before package preparation when requested, downloads to `userData/extensions/temp/operations/downloads`, verifies size/sha256/signature/package identity, extracts to staging, and commits through `ExtensionPackageCommitter`.
5. Runtime reconciliation happens only after the active package and SQLite row agree. Failed activation keeps the committed package and is exposed through runtime status/diagnostics.

Updates use the same installer command for package execution after `updates/**` has selected an
eligible candidate. Update-specific installed-state fields such as update policy and pinned version
are read from the current installation, not passed as updater request data into the installer.
Manual update checks refresh repositories and return per-extension candidates for renderer
confirmation. Automatic updates are a startup lifecycle task owned by main: each app launch runs one
background automatic update pass after repositories and installations initialize, and it only installs
updates for `auto` policy extensions whose signer is already trusted.

Local file install uses `extension:install-from-file`, still creates an install plan, records `source.kind = 'local-file'`, marks the default update policy as `manual`, and does not bind the extension to repository updates automatically.

Uninstall removes code and keeps extension data. Data deletion is the separate `extension:purge-data` command.

### Mirrored Domains

Contribution point directories must stay mirrored exactly across:

```
packages/extension-api/src/contributions/<point>/
apps/desktop/src/main/services/extension/contributions/<point>/
apps/desktop/src/main/services/extension/runtime/host/contributions/<point>/
apps/desktop/src/renderer/src/components/extension/<point>/        # when renderer-visible UI exists
```

Use kebab-case plural directory names: `entity-menus`, `settings-panels`, `scraper-providers`, `deeplink-routes`, `themes`, `commands`, `webviews`. Capability names must mirror the public `kisaki.*` namespace across `packages/extension-api/src/capabilities/` and `apps/desktop/src/main/services/extension/capabilities/`; `library` and `task-runs` may be directories because they have subdomains or provider internals. Use `automations`, not `background-tasks`.

### Naming Rules

- Main facade and helpers use `Extension*`: `ExtensionService`, `ExtensionInstallationManager`, `ExtensionInstallerManager`, `ExtensionUpdateManager`, `ExtensionRepositoryManager`, `ExtensionSignerTrustManager`, `ExtensionReloadWatcher`.
- The capability aggregate is `ExtensionCapabilityGateway` in `capabilities/gateway.ts`. Capability adapters use `Extension<Capability>CapabilityProvider` when they expose app-owned services to the extension runtime; `capabilities/library/provider.ts` is the public entry for the split library capability. Do not use `*Provider` for internal capability subdomain stores such as library entities, relations, or attachments.
- The contribution aggregate is `ExtensionContributionRegistry` in `contributions/registry.ts`. Main-process contribution point folders use `point.ts` and `Extension<ContributionPointSingular>ContributionPoint`, and expose stable verbs such as `register`, `unregister`, `getSnapshot`, `releaseRuntime`, and `releaseAll` as applicable.
- Package state uses `commit.ts` and `ExtensionPackageCommitter` for active package plus installation row commits, `recovery.ts` and `ExtensionPackageRecovery` for startup reconciliation, and `integrity.ts` for pure package/archive/source checks. Signer trust belongs to `signers/**`; runtime activation belongs to `runtime/**`.
- Host-process contribution point folders also use `point.ts` and `Host<ContributionPoint>ContributionPoint`. The `Host` prefix means "inside the extension host process"; do not use it for main-process adapters.
- RPC wrappers are directional: main side uses `ExtensionHostRpcClient`, host side uses `ExtensionHostRpcServer`; public RPC maps use `MainToHost*` and `HostToMain*`.
- Use `runtimeHandle` for a live activation scope and `extensionId` for the package identity. Runtime-scoped maps, callbacks, subscriptions, storage, and secrets should key by `runtimeHandle` until they must present package identity.
- Main-internal catalog/state types use `Entry`, `Record`, `Document`, `Result`, and `Options` suffixes. Renderer/shared DTOs in `apps/desktop/src/shared/extension/` use the `Extension*` prefix and remain serializable.
- Use `Request`/`Response` only at IPC/RPC boundaries. Use `Event` for pushed notifications and extension callback inputs, `Result` for callback outputs, and `Snapshot` for captured session/draft state.
- Helper verbs stay consistent: `require*` validates truly untrusted boundaries and throws, `to*` maps between layers, `create*` builds objects/factories, `normalize*` converts extension-authored models to host DTOs, and `validate*/assertValid*/matches*Format` stay in public validation modules. Reserve `is*` for business predicates such as compatibility or state checks.

### Lifecycle

1. `ExtensionService.init()` prepares extension paths and runs `ExtensionPackageRecovery.recover()` before loading runtime state.
2. `ExtensionRepositoryManager` rebuilds catalog from enabled manifest snapshots and refreshes repositories in the background.
3. Main scans built-in packages and SQLite-backed installations under `userData/extensions/packages/*/manifest.json`.
4. `ExtensionInstallationManager` aggregates package manifests and `extension_installations` rows into the installed view.
5. `RuntimeManager` starts the shared extension host and completes the handshake.
6. The host loads enabled extension `entry` files and calls `activate(context)`.
7. Contributions are normalized in the host and synchronized to the main contribution registry.
8. Renderer consumes contribution snapshots and forwards UI interactions through main.

### Public Runtime Model

Extensions use a single `manifest.json` with an `entry` field and implement `activate(context)`. Public APIs come from `@kisaki/extension-api` and `@kisaki/extension-sdk`; app internals such as `ServiceContainer`, Electron modules, Drizzle schema, Vue app, router, Pinia, and renderer components are not exposed.

## Contribution Points

- `entityMenus` - Structured entity menu items and callbacks
- `settingsPanels` - Controlled settings panels and callback results
- `scraperProviders` - Provider registrations adapted into `ScraperService`
- `deeplinkRoutes` - Namespaced extension deeplink handlers
- `commands` - Extension-owned command handlers registered into the app command service
- `themes` - Semantic token theme contributions
- `webviews` - Declared webview pages (optional top-level nav placement) and reusable dialogs

Contribution points are extension-owned content that the host consumes. Some are executable
callbacks (`entityMenus`, `settingsPanels`, `scraperProviders`, `deeplinkRoutes`, `commands`) and some are
declarative content (`themes`, `webviews`). Capabilities are host-owned services that extensions call through
`kisaki.*`. Runtime context services such as `logger`, `storage`, and `secrets` are part of
`ExtensionContext` but are not capabilities.

Webviews pair a declarative contribution with a same-named capability: pages and dialogs are
declared through `context.contributions.webviews.pages/dialogs.register(...)` and opened by id
through `kisaki.webviews.openPage` / `openDialog`. Main keeps at most one live session per declared
id (reopening a page replaces its session, reopening a dialog adopts it), and session wiring
happens once through `registration.onOpen(handle)` regardless of the open trigger. Nav-enabled
pages project into the contribution snapshot and render in the app sidebar under the stable
`/extension-page/:extensionId/:pageId` route.

Contribution `icon` fields use the shared `ContributionIcon` contract: `mdi:<name>` for the MDI set
bundled with the app, or a `./`-prefixed package-relative image file. Main resolves both forms to
the renderer DTO `ExtensionIconInfo` (registration-time path confinement for files), and the
renderer draws them as currentColor masks, so custom icon files should be monochrome silhouettes.

All UI callbacks return `UiCallbackResult` with explicit `success`, `refresh`, and structured `error` semantics.

## TaskRun Capability

Long-running extension command handlers must use scoped `kisaki.taskRuns`; they must not use command
progress APIs. The host provider creates app-internal TaskRuns with `category: 'extension'`,
operation `extension.task.<extensionId>.<operation>`, and owner derived from runtime metadata. The
extension supplies an extension-local operation name and optional initiator; it cannot provide or
override owner, category, or app-internal operation.

Rules:

- `CommandService` remains only a command registry and thin invocation router. Extension command
  handlers that start long work create a task run and return `{ runId }`.
- The extension task-run provider authorizes reads, waits, and cancellation by
  `owner.type === 'extension'` and `owner.extension.id`, not by parsing operation strings or
  inspecting initiator.
- `capabilities.taskRuns.cancelRequested` is the main-to-host signal for an accepted task-run cancel
  request. The SDK bridge aborts the corresponding local handle signal, and extension code responds
  at checkpoints.
- `ExtensionTaskRunHandle` exposes `report`, `checkpoint`, `complete`, `fail`, and `cancel`. It does
  not expose `finish(result)` or `finishFromError()`.
- Extension TaskRun `subject` is a bounded DTO such as `{ type: 'command', id }` or
  `{ type: 'extension', id }`. It does not contain renderer routes.

## Automation Capability

`kisaki.automations` owns extension-accessible automation configuration. It replaces the old
background task naming; do not expose or reintroduce `backgroundTasks` aliases. Automation history is
owned by `AutomationService` and records command invocation facts only. It does not store TaskRun ids
or TaskRun snapshots.

## IPC and Renderer Boundaries

- Keep renderer-facing extension IPC in `apps/desktop/src/shared/ipc.ts` under `extension:*`.
- Implement those channels only in `apps/desktop/src/main/services/extension/ipc.ts`; handlers should stay thin: forward typed arguments to `ExtensionService` and map to `IpcResult` or `IpcVoidResult`.
- Put serializable request/response/event DTOs in `apps/desktop/src/shared/extension/` with an `Extension*` prefix. Do not move callback functions, `AbortSignal`, Electron objects, class instances, or extension entry exports across IPC.
- Use action-style IPC names for mutations (`extension:enable`, `extension:create-install-plan`, `extension:install-release`, `extension:install-from-file`, `extension:uninstall`, `extension:purge-data`, `extension:update`, `extension:set-update-policy`, `extension:remove-trusted-signer`, `extension:invoke-settings-panel-node`, `extension:open-webview-page`) and `get-*` names for snapshots (`extension:get-installed-packages`, `extension:get-automatic-update-run`, `extension:get-contribution-snapshot`, `extension:get-webview-sessions`).
- Repository, catalog, and trust IPC uses `extension:list-repositories`, `extension:add-repository`, `extension:update-repository`, `extension:remove-repository`, `extension:refresh-repository`, `extension:refresh-repositories`, `extension:search-catalog`, and `extension:list-trusted-signers`.
- Repository refresh channels return `TaskRunStartResult` for long-running refresh work. Extension
  package install, update, import, and uninstall operations are app-owned TaskRuns; renderer does not
  generate package operation ids.
- Main-to-renderer extension events belong in `IpcRendererEvents`, usually `extension:<domain>-changed`, `extension:<domain>-run-changed`, or `extension:<domain>-refresh-requested`; keep payloads small and serializable.
- `@renderer/core/extensions/` owns app-wide contribution synchronization such as snapshots and themes.
- `@renderer/features/extension/` owns the extension management/discovery UI and calls IPC through `ipcManager` plus `unwrapIpcData` / `unwrapIpcVoid`.
- `@renderer/components/extension/` owns reusable contribution renderers such as settings panels and entity menus. These components consume shared DTOs and callback IDs; they never import `apps/desktop/src/main/**`, `extensions/*`, or extension entry code.
- Renderer sessions must release main/host resources through the matching `extension:release-*` channel when a menu/panel scope is closed or abandoned.
- Renderer must not fetch repository manifests, `.kisx` packages, or remote extension icons directly. Use main IPC and app-local icon URLs.
- Install, update, and uninstall confirmation UI belongs in renderer dialogs. Main may open native OS file selection for a local `.kisx`, but must not use Electron native confirmation dialogs for extension mutations.

### Renderer Copy Rules

- User-facing copy should say `仓库`, `发现目录`, `版本`, `安装包`, `签名指纹`, `清除数据`, and `更新策略`.
- Avoid exposing protocol terms such as `Manifest` or `Release` in normal UI labels. If a digest is useful in details/diagnostics, label it as `清单摘要` or `版本摘要`.
- `卸载` means removing extension code while preserving settings, cache, and secrets. Use `清除数据` only for deleting local extension data.
- Repository pages can show health details such as last success, last error, manifest digest, ETag, and Last-Modified, but must not imply a repository is trusted. Trust belongs to an extension signer fingerprint.

## Adding Extension Surface Area

Add public contracts before implementation.

For a new capability:

1. Add the public callable shape under `packages/extension-api/src/capabilities/<name>.ts` and export it.
2. Add typed RPC payloads and method strings in `packages/extension-api/src/rpc/capabilities.ts`.
3. Implement the main adapter under `apps/desktop/src/main/services/extension/capabilities/<name>.ts` and wire it through `ExtensionCapabilityGateway`.
4. Expose the SDK bridge in `runtime/host/sdk-bridge/kisaki-api.ts` and `packages/extension-sdk/src/index.ts`.
5. Keep method strings in the form `capabilities.<capability>.<operation>`.

For a new contribution point:

1. Add contracts and validation under `packages/extension-api/src/contributions/<point>/`.
2. Add RPC payloads and method strings in `packages/extension-api/src/rpc/contributions.ts`.
3. Add host-process registration/normalization under `runtime/host/contributions/<point>/`, with public entry `point.ts` exporting `Host<ContributionPoint>ContributionPoint`, and SDK registrar wiring in `runtime/host/sdk-bridge/registrars.ts`.
4. Add main-process adapter under `contributions/<point>/`, with public entry `point.ts` exporting `Extension<ContributionPointSingular>ContributionPoint`, and wire it through `ExtensionContributionRegistry`.
5. If renderer-visible, add shared DTOs in `apps/desktop/src/shared/extension/`, IPC channels in `apps/desktop/src/shared/ipc.ts`, main handlers in `extension/ipc.ts`, and renderer consumption under `@renderer/core/extensions` or `@renderer/components/extension/<point>`.
6. Keep method strings in the form `contributions.<contributionPoint>.<operation>`.

## Packaging & Dev

- Official package format: `.kisx`
- Official CLI: `kisx`
- Registry manifests are static JSON documents managed with `kisx registry *`; authors should not hand-edit release artifacts when the CLI can derive them from `.kisx`.
- Dev flag: `--dev-extension=<path>`
- Built-in extensions live under root `extensions/*` and should use "built-in" / `builtin` naming in code and logs.
- Desktop `pnpm dev` uses `apps/desktop/tools/builtin-extensions/cli.ts watch` to write built-ins to `apps/desktop/out/extensions`.
- Desktop `pnpm build` uses `apps/desktop/tools/builtin-extensions/cli.ts build --target=resources` to write built-ins to `apps/desktop/resources/extensions`.
- Root scripts:
  - `pnpm check:extension-tooling`
  - `pnpm version:extension-tooling <version>`
  - `pnpm build:extension-tooling`
- Extension tooling packages are released as one lockstep version with `extension-tooling-vX.Y.Z`; do not publish `extension-api`, `extension-registry`, `extension-sdk`, `extension-cli`, or `create-kisaki-extension` independently.

Registry publishing flow:

```bash
kisx build
kisx pack --out-dir artifacts
kisx registry init --out registry/manifest.json --id example.extensions --name "Example Extensions"
kisx registry add-release artifacts/example-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/example-0.0.1.kisx
kisx registry validate registry/manifest.json
```

Signed publishing adds:

```bash
kisx key generate --out .keys/author.ed25519.json
kisx pack --out-dir artifacts --sign --key .keys/author.ed25519.json
kisx registry add-release artifacts/example-0.0.1.kisx --manifest registry/manifest.json --url https://example.com/extensions/example-0.0.1.kisx --signature artifacts/example-0.0.1.sig
```

## Search Patterns

- Services: `ExtensionService`, `ExtensionRepositoryManager`, `ExtensionInstallerManager`, `ExtensionUpdateManager`, `RuntimeManager`, `ExtensionContributionRegistry`
- IPC: `extension:search-catalog`, `extension:list-repositories`, `extension:install-release`, `extension:check-updates`, `extension:get-automatic-update-run`, `extension:get-installed-packages`, `extension:list-trusted-signers`, `extension:contributions-changed`, `extension:resolve-settings-panel`
- Host bridge: `runtime.storage.*`, `runtime.secrets.*`, `contributions.*`, `capabilities.*`, `capabilities.taskRuns.*`, `capabilities.automations.*`, `runtimeHandle`
- TaskRun: `kisaki.taskRuns`, `ExtensionTaskRunHandle`, `capabilities.taskRuns.cancelRequested`, `extension.task.<extensionId>.<operation>`
- Automations: `kisaki.automations`, `AutomationService`, `automation_run_history`
- Renderer: `@renderer/core/extensions`, `ExtensionSettingsPanelDialog`, `ExtensionEntityMenuItems`
- Tooling: `kisx`, `.kisx`, `kisx registry`, `kisx key generate`, `--dev-extension`, `prepare-builtin-extensions`

For the registry refactor, run the acceptance searches listed in
`docs/extension-distributed-registry-redesign.md`. The negative searches should return no
matches outside that design document. The positive searches should find the new registry
DTOs, IPC, managers, package commit/recovery/icon services, and SQLite tables.

## Constraints

- Public contracts are defined in `packages/extension-api` before host implementation.
- Distributed registry contracts are defined in `packages/extension-registry`; do not export them from `@kisaki/extension-api`.
- Host implementation stays inside `apps/desktop/src/main/services/extension/**`.
- Renderer must not execute extension code or import extension entries.
- Renderer must not fetch remote repository manifests, `.kisx` artifacts, or remote icons directly.
- UI contributions must stay structured and serializable.
- Extension storage uses `userData/extensions/data/<extension-id>/storage.json`.
- Extension package loading uses paths derived by `ExtensionPackageLayout`; do not persist executable absolute package paths in SQLite.
- Built-in extension projects must stay valid standalone extension projects; app build scripts should consume them through `kisx output` rather than importing their source directly.
- Extension projects declare `@kisaki3/extension-sdk`, `@kisaki3/extension-api`, UI frameworks, and build plugins in `devDependencies`; kisx bundles them into host or webview output. Only genuine host runtime packages belong in `dependencies` / `optionalDependencies`, and kisx copies those packages into `.kisx`.

## Related

- [Architecture](architecture.md) - Main process service patterns
- [IPC & Events](ipc-events.md) - `extension:*` channels
- [Extension API Contracts](extension-api.md) - Public extension type architecture and naming rules
- [Build & Release](build-release.md) - Extension tooling build
