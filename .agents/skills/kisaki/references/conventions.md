# Coding Conventions

## Key Files

- `apps/desktop/src/shared/` - Shared contracts and types
- `apps/desktop/eslint.config.ts` - ESLint configuration
- `.prettierrc.yaml` - Prettier configuration
- `apps/desktop/src/main/services/notify/service.ts` - Notification service
- `apps/desktop/src/renderer/src/core/notify.ts` - Renderer notifications
- `apps/desktop/src/shared/i18n/` - Locale types, message catalogs, formatters

## Async Patterns

### Prefer async/await

```typescript
// Good
async function fetchData() {
  try {
    const result = await api.get()
    return result
  } catch (e) {
    log.error('Fetch failed', e)
    throw e
  }
}

// Avoid Promise chains
function fetchData() {
  return api
    .get()
    .then((result) => result)
    .catch((e) => {
      /* easy to swallow errors */
    })
}
```

### Fire-and-Forget

Must explicitly handle errors:

```typescript
// Good - explicit error handling
void doAsyncWork().catch((e) => log.error('Background task failed', e))

// Bad - silent failure
doAsyncWork() // Unhandled rejection
```

## Error Handling

### Separation of Concerns

- **Logs**: Detailed stack traces for debugging (main process)
- **User notifications**: Readable summaries (renderer)

```typescript
// Main IPC adapter
ipc.handle('feature:save', async (_, input) => wrapIpcVoid(() => service.save(input)))

// Renderer
if (!result.success) {
  notify.error('Operation Failed', result.error)
}
```

### Error Messages

Write error messages in our own safe English wording:

- Messages may embed the dynamic values a reader needs to act on the failure: entity ids, file
  paths, directory and entry names, enum values, counts. A value that lets the user fix the problem
  (`Save directory not found: ${savePath}`) or lets a developer trace it belongs in the message.
- Messages never embed secrets or credentials, raw library/system error text (wrap it: throw our
  own wording, keep the original as `cause`, and log it at the owning layer), remote-sourced
  content such as scraped text or response bodies (ids and entry names from remote sources are
  fine), or unbounded collections and full rows.
- Renderer-facing notifications own their localized title and context; `result.error` is diagnostic
  detail, not primary UI copy. Expected, actionable outcomes belong in typed result unions (see
  Notifications), not in richer error messages.

Message text is never a contract. No process branches on `error.message` content; cross-module
classification uses typed error classes or reason fields, e.g. `ScrapeFailure` with
`reason: 'profile-unavailable' | 'provider-unavailable' | 'metadata-missing'` for the
scraper → ingest → scanner pipeline.

### IPC Boundaries

- IPC handlers return `IpcResult` format
- Internal functions use exceptions
- Converge errors at boundaries
- Main IPC adapters use `wrapIpc` / `wrapIpcVoid`
- IPC adapters forward arguments to service/domain methods; business branching and orchestration belong in service/domain code
- `wrapIpc` / `wrapIpcVoid` accept only the operation; define user-facing error semantics in the service/domain layer, not in IPC registration
- `IpcError` has only `error: string`; do not add `code` or `details`
- No process compares `error` message strings for control flow; classify with typed errors (see Error Messages)

## Import Boundaries

### Layer Rules

```
shared/     → Pure types and contracts only
main/       → Can import shared/
renderer/   → Can import shared/
main/ ←✗→ renderer/  (Never cross-import)
```

### `utils` and `shared`

- `utils` means small pure helpers and framework glue: deterministic formatting, display mapping,
  URL/key construction, layout constants, collection transforms, type helpers, path/string/date
  helpers, or calculations with no runtime side effects. Light local domain vocabulary is acceptable
  when the code remains pure, small, and policy-free.
- Do not use `utils.ts` or `utils/` as a place for clear business ownership: update policy, scraper
  strategy, extension runtime coordination, scanner workflow, persistence, IPC, notifications, or
  service/container access should get a responsibility name.
- `shared` must describe a real sharing boundary. `src/shared/` is for pure cross-process contracts
  and functions; `components/shared/` is for reusable renderer components; local `shared.ts` files
  are only for small implementation details shared by sibling files in one module.
- If a local `shared.ts` starts accumulating unrelated helpers, split it into semantic files or move
  the code to the module that owns the behavior. Do not split one small cohesive shared helper group
  into several one-function files unless the extra boundary makes the code easier to navigate.

### Path Aliases

Use aliases for cross-module imports. Within the same feature module, prefer relative imports:

```typescript
// Good
import { IpcResult } from '@shared/ipc'
import { DbService } from '@main/services/db'
import { useAsyncData } from '@renderer/composables/use-async-data'
import { parseEntry } from './parser'

// Avoid
import { IpcResult } from '../../../shared/ipc'
import { parseEntry } from '@main/services/library/parser'
```

Available aliases:

- `@main` - Main process
- `@renderer` - Renderer process
- `@shared` - Shared code
- `@assets` - Renderer assets

Rule for same-module imports:

- Within the same module, import sibling files via relative paths (`./` and `../`).
- Avoid self-referencing aliases that point back into the current module.

## Validation vs Business Checks

Keep validation predicates and business predicates separate in meaning, name, and placement.

### Validation

Validation decides whether untrusted, external, or user-authored data can be accepted as a contract value. It covers JSON shape, unknown keys, required fields, primitive types, enum membership, string formats, path confinement, duplicate protocol keys, semver syntax, URL safety, and other protocol invariants.

Validation belongs in `validation.ts`, parser modules, explicit external-boundary helpers, or the service/domain layer that owns the invariant. Internal main-app IPC payloads already have shared TypeScript contracts; do not add runtime shape parsers in IPC registration just to re-check trusted renderer calls.

Use these names:

- `matches*Format(value)` returns a boolean for lexical or regex-style string checks, such as `matchesExtensionRegistryArtifactTargetFormat(value)`.
- `validate*(value, ...)` returns validation issues or a validation result. It must not throw for ordinary invalid input.
- `validate*Shape(value)` validates raw object shape before semantic validation.
- `parse*(value, ...)` converts unknown input into a typed result and returns errors/issues instead of throwing when that is the local parser pattern.
- `assertValid*(value, ...)` wraps validation and throws a structured error.
- `require*(value, ...)` is allowed at CLI, file/network, extension-host, and other truly untrusted boundaries when invalid input should abort immediately. For internal main-app IPC, prefer forwarding the typed payload and letting service/domain code enforce its own invariants.

Do not export naked `is*(value)` functions for schema, format, or type-guard validation of public contract data. Prefer `matches*Format`, `validate*`, `parse*`, `assertValid*`, or `require*` so the caller can see that this is input validation.

### Business Checks

Business checks evaluate behavior or state after data is already trusted and parsed. They answer domain questions such as whether an extension is enabled, whether an artifact target is compatible with the current platform, whether a release can be auto-updated, whether a signer is trusted, or whether a task should run.

Business checks belong next to the domain logic they reason about, not in `validation.ts`.

Use these names:

- `is*Compatible`, `is*Enabled`, `is*Installed`, `is*Yanked`, `is*Trusted` for domain state predicates.
- `has*` for ownership or presence of an already-modeled domain property.
- `can*` for permission or capability checks.
- `should*` for policy decisions.
- `allows*` / `requires*` for rule objects or policy objects.
- `select*`, `resolve*`, or `plan*` when the function chooses or derives a domain result rather than returning a boolean.

If a predicate can be called safely on arbitrary JSON, it is probably validation. If it requires trusted domain objects or current application state, it is probably a business check.

## Boundary Parsing: Lenient Read, Strict Write

Applies to boundaries that re-enter previously persisted or foreign data: custom JSON columns
(`fromDriver`), extension inputs, imported files.

- Read paths must be total: `fromDriver` / `parse*` never throw on malformed content; they return
  the documented safe default (for example an empty filter) so user data files always open.
- Write paths stay strict: `toDriver` / `assertValid*` throw on invalid values so the app never
  persists garbage it produced itself.

### Strict Write = Round-Trip Integrity

`toDriver` may accept a value only if reading it back through this column's lenient parser yields an
equivalent value. The cheapest compliant implementation is: parse the input with the read-side total
parser to get its canonical form, throw when that form is not equivalent to the input, and persist
the canonical form.

- No silent repair: never persist a parse result that differs materially from the input. The caller
  asked to store something the column cannot represent, and that is a bug to surface, not to patch.
- No under-validation: nested garbage must not reach storage. A value that reads back as the safe
  default is silent data loss wearing the shape of success.
- Benign normalization is allowed: key order, dropping `undefined`, trimming to a canonical
  representation — anything where the written and requested values are equivalent.
- Reuse the read-side parser on the write path. Do not maintain a parallel `assertValid*` tree that
  can drift from what reads accept.
- Each column then holds a testable property: `read(write(value))` equals `value` for every accepted
  value.
- The read-side default is not a backward-compatibility shim; it exists for corrupt or foreign
  bytes regardless of history. Do not add shape recognition for retired formats — retired shapes
  fall into the same "unrecognized -> default" bucket.
- Choose defaults that degrade safely for the domain and never let unparsed data reach query
  building or business logic.

Reference implementations: `shared/db/columns/json/filter.ts` (`filterState`) and
`shared/db/columns/json/collection.ts` (`dynamicCollectionConfig`, which also deep-normalizes and
fills missing entity keys with disabled defaults).

## Target Media Types

Kisaki targets eight root media types. The list is the product's closed growth plan: a new root
media type is added only when it fails every existing type's split test below.

| Media type | Consumption unit               | Playback/technical layer    | Status  |
| ---------- | ------------------------------ | --------------------------- | ------- |
| game       | Session on an installed build  | Process launch + monitoring | Shipped |
| anime      | Episode within a season entry  | Video playback (mpv)        | Shipped |
| tv         | Episode within a season entry  | Video playback (mpv)        | Planned |
| movie      | Single feature                 | Video playback (mpv)        | Planned |
| music      | Track within a release         | Audio playback              | Planned |
| audio      | Track within a release (voice) | Audio playback              | Planned |
| comic      | Page within a volume/chapter   | Image reading               | Planned |
| book       | Page/position within a volume  | Text reading                | Planned |

Splitting rules, in the order they decide:

1. **Consumption unit differs.** The unit a user finishes, resumes, and counts progress against
   (session, episode, track, page) drives the owned-item table and the progress model. Two media
   with different units are different types.
2. **Technical layer differs.** Process launch, video playback, audio playback, and reading are
   distinct engines with distinct capabilities; a type never straddles two.
3. **Metadata graph differs.** Distinct role vocabularies and satellite link semantics (staff roles,
   studios vs. labels vs. publishers) justify a split even when unit and engine match.
4. **Otherwise it is a format, not a type.** Anime films stay `anime` with `format: 'movie'`;
   drama CDs stay `audio`. Formats are enum values on the entry, never new tables.

Consequences of the taxonomy:

- `anime` and `tv` share the season-with-episodes shape and the video engine, but keep separate
  entries because their metadata graphs and sources differ; whatever they prove invariant may be
  extracted once both exist.
- `movie` has one playable file per entry, so it owns no episode table.
- `comic` and `book` split on the technical layer (image reading vs. text reflow), not on genre.
- Seasons are separate entries linked by media relations; trailers and creditless openings are
  extras of an entry, not episodes.

## Precise Abstraction & Media-Type Extensibility

Kisaki grows along the media-type axis above. Entity-generic code must scale by declaration, not by
copy-paste.

### Declare Per-Entity Behavior as Data

- Per-entity differences (tables, key columns, filter/search/sort fields, link tables) belong in
  specs and registries keyed by the entity-type union: `getFilterQuerySpec`, `getSearchQuerySpec`,
  `getFilterUiSpec`, `ENTITY_TABLES`, `COLLECTION_LINKS`.
- Consumers resolve behavior through the registry and stay entity-generic. Do not duplicate
  per-entity `switch` statements across composables, stores, and dialogs; one registry plus one
  shared executor (for example `queryEntities` / `countEntities`) replaces them.
- Exhaustiveness comes from the type system: registries are `Record<AllEntityType, ...>` and
  entity `switch` statements have no `default`. Adding a media type must produce compile errors at
  every remaining decision point — never a silent `default: return []`.
- Adding a media type should cost roughly: +1 table, +1 query spec, +1 UI spec, +1 entry per
  registry. If a change fans out into many scattered call sites, the consumer layer is
  under-abstracted; fix the registry or executor, not the call sites.

### Abstract Precisely, Not Speculatively

- Model exactly what the product needs today, with a deliberate seam only on the known growth
  axis: the entity-type unions and the spec registries are that seam.
- Do not add speculative machinery for hypothetical needs: nested boolean filter ASTs, per-field
  operator frameworks beyond the closed op vocabulary, visitor/strategy layers, or plugin points
  nothing consumes.
- When a real need arrives, extend the closed vocabulary (a new field kind, a new op, a new
  registry entry) instead of generalizing early. Closed unions plus total switches keep extension
  cheap and compiler-checked.

### Technical Abstraction Only, Never Business Abstraction

Entity-generic code may abstract mechanics; it must not abstract domain meaning. A business
abstraction hard-codes domain propositions into a generic interface — "every entity has tags",
"every update has core/media/relation surfaces", "every media type is searched by name". Those
propositions hold for games today, but each future media type gets a vote, and one wrong vote baked
into a generic engine collapses the design.

Tests for a technical abstraction:

- Parameterized only by schema facts (table refs, column names) and injected functions; no domain
  vocabulary in the abstraction's own signature. Renaming every entity to A/B/C must not make the
  abstraction nonsensical.
- Opt-in: a media type that does not fit simply does not call the helper. If adding a media type
  requires distorting it (fake fields, empty stub steps) to satisfy the generic interface, the
  abstraction is business-level — dismantle it instead of patching it.
- Flow ownership stays explicit: workflow ordering and step selection live in per-entity
  coordinators; shared helpers implement individual steps. Do not move flow into template-method
  base classes or a generic handler that enumerates everyone's steps.
- Closed entity unions (`AllEntityType`) appear as data-registry keys only, never in generic engine
  signatures or branches.

Distinguish the two growth axes:

- Satellite entities (person, company, character) are cross-media and shared; media types attach to
  them through per-media link tables. Deduplicating genuinely uniform mechanics across satellites
  is safe — they are structurally identical, not coincidentally similar.
- Root media types grow one exemplar at a time (game and anime are shipped; the rest of the
  taxonomy above is planned). Never extract a generic root-media flow, engine, or entity spec from
  a single sample — with one sample you cannot tell invariants from media-specific accidents. When
  the second sample lands, extract only what both proved invariant (the scanner's shared
  media-handler mechanics and the feed's media projection descriptors are the game+anime
  precedents); every further media type re-earns its place in a shared mechanism the same way.

Keep registries per consumer (merge config, feed projection, delete config, query spec). Each
consumer declares only the schema facts it needs. Do not merge them into one grand all-consumer
entity spec that every future media type must fully satisfy.

## CLI Command Naming

- Keep Commander declarations in `cli/commands/`, CLI workflows in `cli/actions/`, and reusable rules in their owning domain modules.
- Use one command factory file per top-level CLI command: `create<Name>Command()`.
- Name action inputs `<Name>Options` and action functions `run<Name>()`. Actions must not import Commander.
- Command modules may parse arguments, attach defaults, and adapt global options; they must not contain workflows or business branching.
- Dependencies flow from commands to actions to domain. Domain modules must not import either CLI layer.
- Do not add command barrels, registrar functions, group entry files, or shared option-type aggregation files.

## DB Transaction Constraints

### Synchronous Callbacks

better-sqlite3 transactions are synchronous:

```typescript
// Good
db.transaction(() => {
  db.insert(table).values(data).run()
  db.update(table).set(updates).run()
})()

// Bad - await inside transaction
db.transaction(async () => {
  await db.insert(table).values(data) // WRONG
})()
```

### Async Side Effects

Execute after transaction commits:

```typescript
db.transaction(() => {
  // DB operations only
})()

// After transaction
await sendNotification()
await writeFile()
```

### Main DB Calls Are Sync

Don't use `await` with Drizzle in main:

```typescript
// Good
const result = db.select().from(table).all()

// Bad - unnecessary await
const result = await db.select().from(table).all()
```

## Commenting Standards

### Core Rules

- Write concise, high-signal English comments only.
- Comment intent, constraints, invariants, and side effects.
- Do not narrate obvious code line by line.

### Formats

- Use sentence case and end with a period.
- Use `// ...` for local notes.
- Use TSDoc `/** ... */` for exported/public classes, functions, and composables.
- Keep comments short (usually 1-3 lines).

### TSDoc Standards

#### Scope

- TSDoc is required for exported/public `class`, `function`, `interface`, `type`, `enum`, and exported composables.
- For internal declarations, add TSDoc only when intent/constraints are non-obvious.
- Do not use TSDoc to restate type syntax that is already clear from TypeScript.
- Vue-specific usage follows the `Vue Component Comments` section in this document.

#### Tag Order

- Use tags in this order when needed: `@remarks`, `@typeParam`, `@param`, `@returns`, `@throws`, `@example`, `@deprecated`.
- `@param` is required for non-obvious parameters (units, ranges, defaults, or behavior constraints).
- `@returns` is required for non-`void` functions when return semantics are not obvious from the signature.
- `@throws` is required when the function intentionally throws and callers should handle it.
- `@example` is optional and should be added only for non-trivial usage patterns.

#### Style

- First line is a concise summary sentence ending with a period.
- Prefer behavior and boundary wording over implementation details.
- Keep each tag description short and specific.

```typescript
/**
 * Search entities by normalized query text.
 * @remarks Uses FTS and returns empty arrays for blank queries.
 * @param query - Reactive input query. Empty input returns no results.
 * @param debounceMs - Debounce delay in milliseconds. Defaults to 300.
 * @returns Grouped search results and loading state.
 */
```

### Temporary Comments

- Temporary comments are not allowed in normal committed code.
- If an exception is unavoidable, it must use an uppercase prefix: `TEMP:`, `TODO:`, or `FIXME:`.
- Exception comments must include a concrete removal condition (issue ID, version, or date).

```typescript
// TEMP: Workaround for upstream bug. Remove after lib@2.0.0 ships (#123).
// @ts-expect-error TEMP: Incorrect upstream types in lib@1.x. Remove after upgrade (#456).
```

### Prohibited Styles

- No Chinese or mixed-language comments.
- No ASCII art or diagram-style comments in code comments.
- No decorative separator comments.

### Vue Component Comments

#### File Header (Required)

- Every `.vue` component must include a short file header comment at the top of the file using `<!-- ... -->`.
- Place the header before the first `<template>`, `<script>`, or `<style>` block.
- Header comments must describe component purpose and key boundary/constraint in 1-3 lines.

```vue
<!--
MediaGrid renders pageable media cards for the library view.
Boundary: emits selection changes, but does not fetch remote data.
-->
<template>
  <div />
</template>
```

#### `<script setup>`

- Use TSDoc for non-trivial component logic (state sync rules, side effects, lifecycle constraints).
- Document `defineProps`/`defineEmits` only when constraints are not obvious from types.
- Prefer precise wording over long explanations.

```typescript
/**
 * Syncs external selection into local state.
 * Constraint: ignore updates while the user is editing.
 */
function syncSelection(value: string): void {
  selectedId.value = value
}
```

#### `<template>`

- `<!-- ... -->` comments are allowed to separate meaningful template modules/regions.
- Keep section labels concise and stable.
- Do not over-segment templates or restate obvious markup.
- Do not leave temporary tags in templates unless they follow the same uppercase-prefix exception rule.

```vue
<template>
  <!-- Search Controls -->
  <SearchToolbar />

  <!-- Results Grid -->
  <MediaGrid />
</template>
```

## i18n Patterns

See [i18n.md](i18n.md) for the full system reference, copy style guide, and glossary.

### Locale Types

```typescript
// @shared/i18n - UI language (messages, formatters)
type UiLocale = 'en' | 'ja' | 'zh-Hans' | 'zh-Hant'
// @shared/i18n - media metadata language (scrapers, content)
type ContentLocale = 'en' | 'zh-Hans' | 'zh-Hant' | 'ja' | 'ko' | /* ... */ 'uk'
```

The extension protocol (`@kisaki3/extension-api`) declares structurally identical locale types
independently; never re-export across that boundary.

### Settings

- `settings.uiLocale = null` → Follow system language
- `settings.uiLocale = 'ja'` → Fixed UI locale

### Language Change Flow

1. Renderer calls `setPreference(locale | null)` (`i18n:set-preference`)
2. Main `I18nService` persists `settings.ui_locale` and recomputes the effective locale
3. Main emits `app.ui-locale.changed` with `{ preference, effective }`
4. Renderer core/i18n applies the state; `m` / `f` recompute reactively

### Message Rules

1. `messages/en/` is the schema source; other locales use `satisfies Messages['<domain>']`
2. Keep keys stable (avoid renaming); English camelCase named by role
3. Don't use Chinese as keys
4. No CJK literals outside the `zh-hans` / `zh-hant` / `ja` catalogs
5. Locale-aware value display goes through `useI18n().f`; never hardcode a locale in `Intl`
   constructors or `toLocale*` calls

## Notifications

Kisaki provides a unified `notify` API that is callable from both main and renderer processes (same interface, different transport).

### Responsibility (who triggers UX)

- **Renderer-initiated actions** (button clicks, dialogs, form submits): **renderer owns notifications**.
  - Main returns an `IpcResult` with a safe English `error` message. Keep IPC adapters thin; log only in the service/domain layer when that layer has useful context.
  - Renderer owns the local notification title/context and may display `result.error` as fallback detail.
- **Main-initiated actions** (background jobs, startup tasks, auto-updates, headless workflows): **main may notify** (toast via forwarding, or native notifications).
  - Prefer emitting an app event and letting renderer decide the UX when the flow is UI-visible and has a clear surface.

### Placement (keep layers reusable)

- `notify` belongs to the surface that owns a user-facing flow, never to shared capability code.
  - A flow surface is the single place a user or external trigger enters the flow: a renderer
    component, a deeplink route handler, a tray/menu action, or a background job coordinator.
  - Capability code that more than one flow can invoke (media service handlers, domain modules,
    pure utilities) stays silent: return a result union for expected outcomes, throw stable
    errors for unexpected ones, and log detail once at the layer that owns the context.
  - Folder names do not decide this; ownership does. `activity/handlers/game.ts` is a shared
    capability (play button, deeplinks, automations) and must not notify;
    `deeplink/handlers/launch.ts` is the entry adapter of one flow and owns its notifications.
- Keep `ipc.handle(...)` functions as **thin adapters**: forward typed arguments to a service/use-case method + map to `IpcResult`.
  - Do not add runtime shape parsers for internal main-app IPC calls; put necessary safety and business invariants in the owning service/domain module.
  - Do not embed business workflows (DB lookups, process management, orchestration) directly inside anonymous IPC handlers.
  - Do not call `notify` from IPC handlers for renderer-initiated actions; let renderer decide.

### API

```typescript
notify.success('Title', 'Optional message')
notify.error('Title', 'Optional message')
notify.warning('Title', 'Optional message')
notify.loading('Title', 'Optional message')
```

### Modes

- `toast` - In-app toast notification
- `native` - System notification
- `auto` - Toast if focused, native if not

## Search Patterns

- Async: `async function`, `await `, `.then(`, `.catch(`
- Fire-and-forget: `void `, `queueMicrotask`
- IPC: `IpcResult`, `ipc.handle(`
- Notifications: `notify.success`, `notify.error`
- DB: `.run(`, `.get(`, `.all(`, `.transaction(`
- Comments: `TEMP:`, `@ts-expect-error`, `eslint-disable`
- i18n: `useI18n(`, `getMessages(`, `app.ui-locale.changed`

## Constraints

- All comments in English
- No `watchEffect`/`watchPostEffect`/`watchSyncEffect` in Vue
- No `await` inside better-sqlite3 transactions
- No `await` on main process DB calls
- Use path aliases for cross-module imports, but use relative imports inside the same module
- Separate error logs from user notifications
- Temporary comments are disallowed; unavoidable exceptions require uppercase prefix and a removal condition
- No ASCII art or diagram-style comments
- Vue `.vue` components must include a top-of-file `<!-- ... -->` header comment

## Related

- [Architecture](architecture.md) - Service patterns
- [IPC & Events](ipc-events.md) - IPC result format
- [Data Layer](data-layer.md) - Transaction details
- [Renderer Patterns](renderer.md) - Vue conventions
