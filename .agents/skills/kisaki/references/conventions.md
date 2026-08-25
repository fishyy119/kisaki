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

Kisaki is an ACGN library manager. Its scope is the works that share one metadata graph — visual
novels and games, anime, comics, novels, and the audio works around them — and the list below
is the product's closed growth plan: a new root media type is added only when it fails every
existing type's split test.

Live-action film and television are deliberately out of scope. They fail the shared-graph test in
both directions: they have no character entity worth modelling (a cast credit names an actor, not a
character with an identity, a designer, and physical attributes), and their consumption habits,
sources, and UI conventions have nothing to reuse from an ACGN library. Serving them would mean
carrying a second, weaker data model behind the same tables.

| Media type | Consumption unit               | Playback/technical layer    | Status  |
| ---------- | ------------------------------ | --------------------------- | ------- |
| game       | Session on an installed build  | Process launch + monitoring | Shipped |
| anime      | Episode within a season entry  | Video playback (mpv)        | Shipped |
| comic      | Page within a volume/chapter   | Image reading               | Shipped |
| novel      | Page/position within a volume  | Text reading                | Shipped |
| music      | Track within a release         | Audio playback              | Planned |
| audio      | Track within a release (voice) | Audio playback              | Planned |

The first four are the core ring; `music` and `audio` are the second ring, reached through the works
they accompany.

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

- `game` is ACGN games, visual novels first. A general video-game catalogue is not a goal; what
  keeps a game in scope is that it has characters the rest of the graph can point at.
- `comic` is comics at large — manga, manhua, manhwa, doujinshi — not one country's style. Like
  `game`, the identifier is structural and the ACGN scope doctrine above draws the boundary.
- `novel` is narrative fiction, light novels first. It is not `book`: a work qualifies by having
  characters the graph can point at, which excludes non-fiction and reference works by the same
  test that excludes live-action.
- `comic` and `novel` split on the technical layer (image reading vs. text reflow), not on genre.
- Trailers and creditless openings are extras of an entry, not episodes.

### Entry Grain

The split test decides _whether_ a media type exists; entry grain decides _what one row of its table
is_. An entry owns naming identity, tracking status, rating, the external-id anchor for re-scrapes
and dedupe, directory ownership, and every user-data attachment (notes, tags, collections). Those
must sit on one layer, so grain is a deliberate per-type decision.

Put the entry where the domain puts strong identity — the layer at which upstream production and the
metadata sources issue ids, titles, and ratings. Grain is not a UI preference, and it is never
inherited from whichever media type shipped first.

- **`anime` entries are seasons and standalone works.** TV anime is commissioned per cour, so
  sequels ship as new productions with their own titles, staff, and ids; every anime source
  (Bangumi, MAL, AniList, AniDB) anchors ids, ratings, and watch status there, and none issues a
  franchise id. A franchise is therefore a connected component of `media_relations`, not a row: the
  sequel graph is not a tree (interleaved films, split cours, side stories, summaries, alternative
  retellings), so an integer season number would lose information. Anime owns no season table: with
  the entry at season grain there is nothing left for one to hold.
- **`comic` and `novel` entries are the work or series, not the volume.** Sources issue one id,
  title, rating, and status per serialized work; a volume has no independent identity and no rating
  anywhere. Volumes and chapters are therefore unit rows under the entry, not entries.
- **Comic units carry two numbers, not two grains.** One `comic_chapters` row is either a collected
  volume (volume number, no chapter number) or a serialized chapter (chapter number, plus the volume
  it was collected into when known). Novels need only the volume number, so they carry one.
  - A chapter's identity is its **full numbering**, not the chapter number alone: magazine
    serialization numbers chapters continuously, but works collected straight to volumes restart at
    chapter 1 in every volume, and both must fit. Two partial unique indexes enforce this, because
    SQLite counts NULLs in a unique index as distinct.
  - Identity and realignment are different concerns. Identity is what the indexes enforce and
    `comicUnitIdentityKey` computes — ingest, file sync, and entity merge all call that one
    function, because a key the application reads as new but an index reads as taken aborts the
    whole write. Realignment is how a re-scrape or a file rename finds the existing row, and it is
    allowed to be looser: external id, then exact numbering, then one pass for a chapter whose
    volume the source learned or forgot. That last pass claims only an unambiguous single
    candidate, so per-volume numbering never cross-matches.
- Remaining planned types decide their grain when they land, by the same question.

Grain differences stay contained. Below the entry, mechanics are isomorphic (watch state, resume
position, sessions, file probing, player integration), and above it the entity seam is unchanged, so
adding a type still costs +1 table, +1 query spec, +1 UI spec, +1 registry entry.

Do not resolve a grain mismatch by letting grain vary per row, by adding a franchise entity no
source can identify, or by collapsing every type into one generic parent-child item table. Each
trades a per-type decision for per-row ambiguity and loses typed vocabulary plus compile-time
exhaustiveness.

## Precise Abstraction & Media-Type Extensibility

Kisaki grows along the media-type axis above. Entity-generic code must scale by declaration, not by
copy-paste.

### Declare Per-Entity Behavior as Data

- Per-entity differences (tables, key columns, filter/search/sort fields, link tables) belong in
  specs and registries keyed by the entity-type union: `getFilterQuerySpec`, `getSearchQuerySpec`,
  `getFilterUiSpec`, `ENTITY_TABLES`, `COLLECTION_LINKS`, `TAG_LINKS`.
- Consumers resolve behavior through the registry and stay entity-generic. Do not duplicate
  per-entity `switch` statements across composables, stores, and dialogs; one registry plus one
  shared executor (for example `queryEntities` / `countEntities`) replaces them.
- Exhaustiveness comes from the type system: registries are `Record<AllEntityType, ...>` and
  entity `switch` statements have no `default`. Adding a media type must produce compile errors at
  every remaining decision point — never a silent `default: return []`.
- Adding a media type should cost roughly: +1 table, +1 query spec, +1 UI spec, +1 entry per
  registry. If a change fans out into many scattered call sites, the consumer layer is
  under-abstracted; fix the registry or executor, not the call sites.

### Keying, Correlation, and Exhaustiveness

- Registries are keyed **by** the entity-type union, never the reverse: declare
  `Record<AllEntityType, X>` (or a mapped type over the union) so the compiler demands one entry per
  type. Do not derive the union from a registry with `keyof typeof` — a forgotten entry then
  silently shrinks the union instead of failing. Use `as const satisfies Record<Union, Shape>` when
  entries must keep precise value types (concrete tables, literal channel names) and still be
  checked for coverage.
- Every per-entity fact has exactly one holder. Before adding a column, table, or image field to a
  new place, check whether an existing registry already owns it and read from there.
- Keep the type and its payload correlated by construction: a generic parameter plus `EntityRowMap[T]`
  ties `entityType` to `entity`, so no caller can pair one entity's id with another's row.
- `as` on an entity payload is allowed only inside the single generic mechanism that owns that
  correlation, with a comment saying why (`queryEntities`, `queryTaggedEntities`, `EntityCard`'s
  target pair). Call sites never cast: a cast at a call site means the mechanism above it is missing.
- Template dispatch narrows a discriminated union and ends with `assertNever`, so a new entity type
  fails to compile instead of rendering nothing. A bare `v-else` tail in a dispatch chain is a
  defect — it renders some other entity's component for the unhandled type.
- Do not restate coverage with sentinel data (`satisfies Record<MediaType, true>`) or comments; make
  the data flow as a union so the compiler states it.
- None of this constrains boundary parsing of untrusted input, which stays total by design (see
  Boundary Parsing above): a `default` that degrades unknown input to a documented safe value is a
  contract, not a missing branch.

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
- Root media types grow one exemplar at a time (game, anime, comic, and novel are shipped; the rest
  of the taxonomy above is planned). Never extract a generic root-media flow, engine, or entity spec
  from a single sample — with one sample you cannot tell invariants from media-specific accidents.
  Extract only what the shipped samples proved invariant (the scanner's shared media-handler
  mechanics and the feed's media projection descriptors are the original game+anime precedents;
  comic and novel widened them rather than forking them); every further media type re-earns its
  place in a shared mechanism the same way. Four samples is still not a licence to generalize a
  surface only one type needs — the reader's page engine is shared by comic and novel because both
  page through images, while their unit lists and catch-up flows stay mirrored per type.

Keep registries per consumer (merge config, feed projection, delete config, query spec). Each
consumer declares only the schema facts it needs. Do not merge them into one grand all-consumer
entity spec that every future media type must fully satisfy.

## Relationship Families

Entity-to-entity relationships split into three families with different shapes. Classify by the
question the row answers, not by table name.

### Links: cross-class attachments

- A **link** attaches entities of _different_ classes: media↔metadata (`game_person_links`),
  organizer↔content (`collection_game_links`, `game_tag_links`), and metadata↔metadata across
  kinds (`character_person_links`). One table per ordered pair; rows carry `role` (where a role
  vocabulary exists), `is_spoiler`, `note`, and an order column per side. Links have real FKs.
- Links stay per-pair. Do not fold them into a polymorphic table: their vocabularies, spoiler
  semantics, and satellite resolution differ per pair, and the per-pair tables are what the merge
  config, feed projection, and extension link store key on.
- Reserved future pairs follow the same shape: `person_company_links` (employment) when needed.

### Cast: the one ternary fact

- **Casting is three-way** — a person voices a character _in a given entry_ — so it gets its own
  tables (`game_cast_links`, `anime_cast_links`) keyed on all three endpoints. Splitting it into a
  media-person link and a character-person link loses the pairing: no join can tell which of an
  entry's actors voices which of its characters.
- This is the only ternary in the schema, and it earns the exception because ACGN recasts are
  routine: the same character is voiced by different people across an adult original, its all-ages
  port, and its anime adaptation. A `playing` string column on the person link cannot express that
  and cannot be joined to a character row; it was removed for exactly this reason.
- A cast row carries no role, spoiler flag, or order of its own. Being there is the fact; the
  spoiler decision belongs to the character link, and display order follows the character link.
- Cast and `character_person_links` are two layers, not duplicates. `character_person_links` is the
  **knowledge layer** — who voices this character at all, independent of any one work — so it is
  merge-only and a scrape never deletes from it, whether the scrape entered through an entry or
  through the character itself. That is declared once, as `mergeOnly` on the link topology, so no
  update path can opt back into replace. Cast is the **confirmed credit** for one entry, so it is
  replaced wholesale and a removed row means the credit is gone. A recast reads as a new cast row
  plus a retained knowledge row, which is the truth.
- Cast rows are derived, not hand-authored twice: an `actor`-role character-person fact on a media
  entry produces both the person link and the cast row. A provider without character entities
  (TMDB) contributes the person link only, and the entry simply has actors without attribution.

### Relations: same-class entry graphs

- A **relation** connects entries of the _same_ class: media↔media lives in the single polymorphic
  `media_relations` table (`from_type`/`from_id`/`to_type`/`to_id` + `type` + `note` +
  `order_in_from`, unique on the five identity columns). Polymorphic ends cannot carry FKs, so
  referential integrity is owned by the application choke points: entity delete clears both ends,
  entity merge remaps them.
- Rows are **directed** and stored exactly as written. Readers merge both directions: out-edges
  keep their stored `type`, in-edges are labelled through the total `MEDIA_RELATION_TYPE_INVERSE`
  map. Never write mirror rows to make a pair visible from both sides.
- The ordered endpoint pair constrains the vocabulary (`MEDIA_RELATION_TYPE_RULES`): same-type
  pairs carry the structural words (sequel/prequel, sideStory/parentStory, summary/fullStory,
  alternative), cross-type pairs carry provenance plus derivation (adaptation/sourceMaterial,
  sideStory/parentStory). Adding a media type forces new pair entries at compile time.
- `sideStory`/`parentStory` is a cross-type pair precisely because ACGN spin-offs cross media: a
  fandisc of a visual novel, a spin-off comic of an anime. Restricting derivation words to same-type
  pairs would force those edges into `other`.
- The vocabulary states narrative derivation between two entries and nothing else. A shared setting
  is an n-ary group fact and belongs in a collection; a shared cast is already encoded by two entries
  linking the same character. Neither becomes an edge type.
- **`company_relations`** is the same-class graph for companies (parent/subsidiary, brand/owner,
  renames, spin-offs). Both ends are companies, so unlike `media_relations` it carries real FKs and
  needs no pair-dependent vocabulary; it is otherwise the same directed shape with a total inverse
  map. It exists because a brand and its parent are different companies that credit different works,
  and collapsing them loses credits while leaving them unlinked loses the succession.
- Merging two entities of the class **remaps both ends of its relations in one pass**
  (`SAME_CLASS_RELATION_MERGES`), never through the cross-class link machinery. An edge between the
  two merged entities collapses onto itself and must vanish, which is only visible while both ends
  are being rewritten together; a second pass over the other end would store the self-edge first and
  leave a hole in the surviving order. Renumbering happens after all collapsing, and only for the
  target's own out-edges — third entities' edge lists were loaded partially and keep their ordering.

### Which satellite edges exist

The satellite entities are character, person, and company. The graph between them is closed, and
each absent edge is a decision, not an omission:

| Edge                           | Status   | Why                                                                                      |
| ------------------------------ | -------- | ---------------------------------------------------------------------------------------- |
| media↔character/person/company | Present  | The credit lists every source publishes.                                                 |
| character↔person               | Present  | Work-independent knowledge: who voices, draws, or designed this character.               |
| (media, character, person)     | Present  | Cast — the ternary above; the only three-endpoint fact in the schema.                    |
| company↔company                | Present  | `company_relations`: succession a single company row cannot express.                     |
| character↔character            | Absent   | Sources state relations in prose, per work, and they are spoilers; no stable vocabulary. |
| character↔company              | Absent   | Ownership follows from the works it appears in; an edge would restate the media links.   |
| person↔person                  | Absent   | Real-person biography, not work metadata, and no source publishes it structurally.       |
| person↔company                 | Reserved | Employment is real but time-bounded; add `person_company_links` only with dated columns. |

Before adding a satellite edge, require all three: a source publishes it structurally, it is not
derivable from the existing graph, and it has a closed vocabulary the UI can label.

### Vocabulary: kind / role / type

- **kind** identifies _which relationship table or edge shape_: `LibraryLinkKind`
  (`'game-person'`), graph edge kinds, `GameLinkKind` in the ingest topology.
- **role** is the vocabulary a link row carries: the `role` column, `GamePersonRole`,
  `metadata.role` in the extension link protocol, `role` fields on scraped link facts.
- **type** is reserved for relation vocabulary (`MediaRelationType` on `media_relations.type`) and
  for genuine type-of-thing enums (`AnimeEpisodeType`, media type discriminators). Never name a
  link's role column or field `type`.
- Table names put the subject first: `<owner>_<related>_links` from the owning side
  (`game_person_links`), `media_relations` for the polymorphic entry graph.

### Scraped related entries never create media entries

Scraper facts reference related media by external identity only
(`ScrapedRelatedEntryFact { mediaType, source, externalId, type }`). Ingest resolves them against
library entries and drops the rest with a `related-entry-not-in-library` warning. Creating a media
entry is always an explicit user or import decision — a scrape must never fabricate library
entries as a side effect of relating to them. Bidirectional reads make this converge: once the
other entry is imported and scraped, its own out-edges surface on both detail pages.

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
