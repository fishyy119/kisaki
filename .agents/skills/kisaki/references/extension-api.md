# Extension API Contracts

Read this before changing `packages/extension-api/**`, public extension types, extension RPC payloads, contribution DTOs, or validation helpers.

## Package Layers

`packages/extension-api/src` has four public contract layers:

- `shared/` - reusable value objects, serialization, validation helpers, errors, `Disposable`, locale and library enum values. It must not depend on capabilities, contributions, or RPC.
- Top-level `manifest.ts`, `context.ts`, `kisaki.ts`, `version.ts` - extension identity, activation context, and the aggregate `KisakiApi`.
- `capabilities/` - host-owned services exposed as `kisaki.*`. These are things extensions call, such as `library`, `network`, `notify`, `events`, `runtime`, `scrapers`, `ingest`, `commands`, `automations`, and `taskRuns`.
- `contributions/` - extension-owned registrations consumed by the host. These are things extensions provide through `context.contributions.*`.
- `rpc/` - transport-only request, response, event, and map types between main and extension host. Do not put business model logic here.

Distributed extension registry manifest, artifact, validation, digest, and signer contracts belong in `packages/extension-registry/**`, not in `packages/extension-api/**`.

## TaskRun Contracts

`packages/extension-api` must define public extension TaskRun DTOs independently. Do not import
`apps/desktop/src/shared/task-run.ts` from extension API, SDK, or tooling packages. The desktop host
provider maps public `ExtensionTaskRun*` DTOs to app-internal `TaskRun*` contracts.

Rules:

- `kisaki.taskRuns` is a scoped capability for extension-owned long-running runs. Extensions can
  create, report, checkpoint, complete/fail/cancel, list own active/history runs, get own runs, and
  wait for own active runs.
- Public `ExtensionTaskRunHandle` exposes `report`, `checkpoint`, `complete`, `fail`, and `cancel`.
  It must not expose `finish(result)` or `finishFromError()`.
- Public controls contain only `cancelable` and `pausable`.
- Public operation names are extension-local stable names. The host maps them to app-internal
  `extension.task.<extensionId>.<operation>` operations and maps them back before returning snapshots
  to the extension.
- Extensions cannot provide TaskRun owner, category, or app-internal operation. Owner comes from
  runtime metadata. Initiator is display/filter attribution and never an authorization boundary.
- TaskRun subject DTOs are bounded and do not include renderer routes.
- Extension API and SDK do not export task-run payload, length, or query limit constants. The host
  provider is the unknown boundary and owns validation limits.

Command contracts do not carry long-running execution progress. A long-running extension command
handler creates a run through `kisaki.taskRuns` and returns `{ runId }`; command invocation context
only describes the command id and source.

## Automation Contracts

- `kisaki.automations` owns extension-created persistent automation configuration. Do not keep
  `backgroundTasks` aliases in public contracts, RPC maps, SDK exports, or built-in extensions.
- Automation history records command invocation facts only. It must not store TaskRun ids, TaskRun
  progress, TaskRun output, or TaskRun result snapshots.

## Contribution Points

Contribution point names must describe the registered object, not a broad domain:

- `entityMenus` registers `EntityMenuContribution`
- `settingsPanels` registers `SettingsPanelContribution`
- `scraperProviders` registers `GameScraperProvider`, `PersonScraperProvider`, `CompanyScraperProvider`, or `CharacterScraperProvider`
- `deeplinkRoutes` registers `DeeplinkRouteContribution`
- `themes` registers `ThemeContribution`
- `commands` registers `CommandContribution`

All public registrars expose `register(...)`. Put domain/scope in the registrar path only when it changes the register parameter type, such as `entityMenus.game.single.register(...)` and `scraperProviders.game.register(...)`.

Contribution directories under `packages/extension-api/src/contributions/` must match the contribution point in kebab-case plural form: `entity-menus`, `settings-panels`, `scraper-providers`, `deeplink-routes`, `themes`, `commands`. Their `index.ts` files should only re-export contracts and validation.

## Naming Suffixes

Use suffixes by API layer. Contribution contracts are intentionally more uniform than capability
contracts; capability contracts should prefer domain clarity over mechanical suffix uniformity.

Contribution and callback suffixes should stay consistent:

- `Capability` - host-owned callable service under `kisaki.*`, e.g. `LibraryCapability`.
- `Contribution` - extension-owned object passed to a registrar, e.g. `SettingsPanelContribution`.
- `Registrar` - public `context.contributions.<point>` entry, e.g. `ScraperProviderRegistrar`.
- `RegistrationPoint` - domain/scope object with `register(...)`, e.g. `EntityMenuRegistrationPoint`.
- `Registration` - synchronous disposable returned from `register(...)`, e.g. `ThemeRegistration`.
- `RegistrationInfo` - serializable snapshot visible to main/renderer or stored in RPC payloads.
- `Definition` - static sub-definition inside a contribution, e.g. `SettingsPanelDialogDefinition`.
- `Model` - extension callback return structure before host normalization.
- `Node` - renderable structured UI element.
- `Event` - extension callback input.
- `Result` - extension callback output.
- `Factory` - stateless helper that preserves type inference.
- `Snapshot` - captured runtime/draft state.
- `Handle` - live object returned to the extension that carries methods or lifecycle state and is
  not just a serializable DTO.
- `Rpc*`, `*RequestMap`, `*EventMap` - transport typing and method maps.

Capability DTO suffixes are role hints, not a single rigid template:

- `CreateInput` - create operation payload.
- `Patch` - partial update payload. Do not use `UpdateInput` for a partial update patch.
- `Query` - list/search filter payload.
- `Options` - optional behavior toggles that are secondary to the main operation input, usually the
  final optional parameter of a method.
- `Input` - full operation argument object when no clearer domain noun exists, e.g. `PickFileInput`.
- `Result` - operation return data when the method returns a data summary rather than a domain
  entity.

Do not rename capability types only to satisfy suffix uniformity. `Request` and `Response` may be
valid public capability names when they are part of the capability's domain language, such as
network/HTTP request-response concepts or command invocation requests. The thing to avoid is leaking
transport wrapper naming into public contracts. A type named `FooRequest` in `capabilities/` should
mean “a domain request submitted by the extension,” not “the RPC envelope for method Foo.”

Public callback contracts should use `Event`/`Result`; transport wrappers should use
`Request`/`Response`. Renderer-facing DTOs in `apps/desktop/src/shared/extension.ts` use an
`Extension*` prefix and must remain serializable.

Capability method parameters should be named after their semantics:

- `input` for create/full operation payloads when the type is an `Input`.
- `request` for domain requests when the type is intentionally a `Request`.
- `patch` for partial updates.
- `query` for list/search filters.
- `options` for optional behavior toggles.
- domain ids such as `commandId`, `profileId`, or `grantId` for scalar identity arguments.

RPC wrapper payload fields should preserve the public method's parameter semantics rather than
inventing new generic names. For example, if `kisaki.commands.invoke(request)` accepts a public
`CommandInvocationRequest`, the RPC transport request should carry `request`, while still naming the
transport wrapper itself with a transport suffix such as `CommandInvocationRpcRequest`.

## Event Topic Rules

- Public host events exposed by `kisaki.events.on(...)` and `kisaki.events.once(...)` use the same topic names as the corresponding public AppEvents. Do not create extension-only aliases for host events.
- Event topics use pure dot notation: `<subject>[.<aspect>].<event>`.
- Topic segments use lowerCamelCase. Do not use `:`, `-`, or suffix-compressed names such as `localeChanged` in event topics.
- Use `created` / `updated` / `deleted` for persisted entity lifecycle events.
- Use `started` / `finished` for runtime lifecycle events. Put final status in the payload when needed.
- Extension-owned custom events used by `kisaki.events.onExtension(...)` and `kisaki.events.emit(...)` are a separate extension-scoped message namespace. Do not fold them into the AppEvents/HostEvents naming migration.
- Do not support compatibility aliases for previous event spellings.

## Validation Names

- `validate*Shape(value)` validates public contribution object shape.
- `validate*(value)` validates a concrete DTO, input, patch, query, result, node, or model.
- `assertValid*(value)` wraps validation and throws a structured extension validation error.
- `matches*Format(value)` checks lexical string formats and belongs in validation modules.
- `is*(value)` may be exported as a boolean type guard only when it is a thin wrapper over a matching
  `validate*` or `validate*Shape` function and intentionally drops diagnostic details.
  Do not use `is*` as the primary validation API at host boundaries.

Validation modules should depend on `shared/validation` helpers and the local contracts they validate. Avoid duplicating allowed-key sets or enum arrays when an exported `*_VALUES` or `*_TYPES` constant already exists.

## RPC Rules

- RPC method strings use `capabilities.<capability>.<operation>` or `contributions.<contributionPoint>.<operation>`.
- Nested capability RPC method strings must mirror the public SDK namespace and leaf method, e.g.
  `kisaki.library.graph.apply(...)` maps to `capabilities.library.graph.apply`.
- Use one method with a discriminator for multi-domain operations when the payload shape is shared;
  split into nested namespaces only when the public parameter types or ownership boundaries differ.
- TaskRun capability RPC uses `capabilities.taskRuns.*`, including the main-to-host
  `capabilities.taskRuns.cancelRequested` event.
- Automation capability RPC uses `capabilities.automations.*`; do not expose
  `capabilities.backgroundTasks.*`.
- Command contribution RPC must not expose `contributions.commands.reportProgress` or command
  execution progress methods.
- Directional maps must stay explicit: `MainToHost*` for callbacks into extensions, `HostToMain*` for host calls into main.
- RPC payloads carry serializable DTOs only. Callback functions, factories, `AbortSignal`, and host objects stay in runtime registries.
- For discriminated multi-domain RPC, use a single method with a clear discriminator such as `mediaType` rather than duplicating method names by domain.

## Boundary Checks

Before finishing extension API changes, run the narrowest useful checks:

```powershell
pnpm --filter @kisaki/extension-api typecheck
pnpm --filter @kisaki/extension-api lint
pnpm build:extension-tooling
```

For contribution renames, also search public API boundaries for old names:

```powershell
rg -n "context\.contributions\.(menus|settings|scrapers|deeplinks)(\.|\b)|register(Game|Person|Company|Character)Provider|defineSettingsContribution|\b(ScraperRegistrar|SettingsRegistrar|DeeplinkRegistrar|MenuRegistrar)\b" packages/extension-api packages/extension-sdk extensions packages/create-kisaki-extension .codex --glob "!**/extension-api.md"
rg -n "contributions\.(menus|settings|scrapers|deeplinks)(\.|\b)" packages/extension-api/src/rpc apps/desktop/src/main/services/extension apps/desktop/src/shared apps/desktop/src/renderer/src
rg -n "packages/extension-api/src/contributions/(menus|settings|scrapers|deeplinks)" docs .codex packages apps extensions --glob "!**/extension-api.md"
```
