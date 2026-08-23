---
name: kisaki
description: Kisaki project architecture and coding standards guide. Use when developing, refactoring, or debugging within this Electron + Vue 3 + SQLite monorepo. Covers main process services (ServiceContainer/DI), renderer patterns (Vue 3 SFC/composables), IPC contracts and module hooks, data layer (Drizzle/SQLite), extension system and built-in extension development, runtime logging/error boundaries, UI design system (Tailwind semantic tokens), and build/release workflows.
---

# Kisaki Project Guide

This skill serves as the main entry point for development within the Kisaki repository. Load topic-specific references as needed (avoid loading all at once).

## Project Overview

**Kisaki** is an ACGN library manager built as an Electron desktop application.

### Tech Stack

- **Runtime**: Electron 41 + Node.js
- **Frontend**: Vue 3 + TypeScript + Vite
- **Database**: SQLite + Drizzle ORM
- **Styling**: TailwindCSS v4 (semantic tokens)
- **Build**: in-repo Vite bundler (`apps/desktop/tools/bundler`) + electron-builder

### Repository Structure

```
kisaki/
├── apps/desktop/           # Main Electron application
│   ├── src/main/           # Main process (services, IPC)
│   ├── src/preload/        # Preload scripts
│   ├── src/renderer/       # Vue 3 renderer
│   └── src/shared/         # Shared types & contracts
├── extensions/             # Built-in extension projects bundled with the desktop app
├── packages/
│   ├── extension-api/      # Public extension contracts
│   ├── extension-registry/ # Distributed extension registry contracts and tooling
│   ├── extension-sdk/      # Extension author SDK
│   ├── extension-cli/      # kisx CLI tools
│   └── create-kisaki-extension/
├── tools/                  # Repository-internal automation tools
└── pnpm-workspace.yaml
```

## Topic Index (references/)

Load the relevant reference based on your task:

| Topic                     | Reference                                             | When to Use                                                                                            |
| ------------------------- | ----------------------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Renderer Patterns         | [renderer.md](references/renderer.md)                 | Vue patterns, composables, dialogs, and renderer naming/organization rules                             |
| Main Process Architecture | [architecture.md](references/architecture.md)         | Adding services, understanding DI container, bootstrap sequence                                        |
| IPC & Hooks               | [ipc-events.md](references/ipc-events.md)             | Adding IPC channels, db change feed, renderer domain pushes, module hook points                        |
| Data Layer                | [data-layer.md](references/data-layer.md)             | Schema changes, migrations, DB queries, triggers, FTS                                                  |
| UI Design System          | [ui-system.md](references/ui-system.md)               | Styling, semantic tokens, component recipes, forms                                                     |
| Extension System          | [extension-system.md](references/extension-system.md) | Extension runtime, service architecture, main/renderer/IPC naming, SDK, packaging, contribution points |
| Extension API Contracts   | [extension-api.md](references/extension-api.md)       | Public extension API type architecture, naming, DTO, validation, and RPC rules                         |
| Build & Release           | [build-release.md](references/build-release.md)       | Building, packaging, NSIS, monorepo scripts                                                            |
| Changelog                 | [changelog.md](references/changelog.md)               | Release changelog file structure, section classification, writing rules, and entry wording             |
| i18n                      | [i18n.md](references/i18n.md)                         | Message catalogs, UiLocale/ContentLocale, formatters, copy style guide, four-language glossary         |
| Coding Conventions        | [conventions.md](references/conventions.md)           | Async patterns, error handling, comments, i18n                                                         |

## Quick Search

Search within `references/` for keywords:

- Service patterns: `container.register`, `IService`, `IMediaService`
- IPC: `IpcMainHandlers`, `IpcResult`, `ipc.handle`
- Hooks & pushes: `createNotifyHook`, `service.hooks`, `useDbChanges`, `useIpc`, `db:changed`
- Extension API: `ExtensionContext`, `KisakiApi`, `Contribution`, `Capability`, `RpcMethodDefinition`
- DB: `sqliteTable`, `drizzle`, `migrate`
- Vue: `defineProps`, `defineModel`, `useAsyncData`
- UI: `bg-surface`, `text-foreground`, `buttonVariants`
- i18n: `useI18n`, `Messages`, `UiLocale`, `LocalizedText`, `createFormatters`

## Project Preferences

- Every extension API is a capability the application modules natively already have; the extension API is only an intermediary invocation and storage adaptation layer. Module-owned hook systems are the native extensibility primitive: modules dispatch hooks at their own workflow boundaries, the extension system merely taps them as one subscriber, and application modules never depend on the extension mechanism.
- Do not create local type aliases or barrel-style re-exports that only import a type from its source of truth and immediately export it under another local name. Use sites should import shared contracts directly from the owning module, unless the local type adds real domain semantics or narrows/extends the source type.
- Avoid repeated path segment names for ordinary TypeScript logic modules. Do not create files like `ipc/ipc.ts`, `repository/repository.ts`, or `store/store.ts`; use responsibility names such as `register.ts`, `manager.ts`, `store.ts`, `validation.ts`, `types.ts`, `controller.ts`, or `mappers.ts`. Repeated names are allowed for component-family root components, such as `dialog/dialog.vue` or `chart/chart.tsx`, when the file is the primary component for that folder. `index.ts` remains an entrypoint-only exception and should contain explicit exports only.
- Treat folders as either category organization or coupled module split. Category folders group peers and do not need a single entry; MediaService `handlers/` folders are valid category folders. Coupled module folders split one module across files and should have a clear role entry such as `manager.ts`, `coordinator.ts`, `gateway.ts`, `provider.ts`, `point.ts`, `controller.ts`, `registry.ts`, `planner.ts`, or `view.ts`. Standalone cohesive single-file modules stay single-file instead of gaining a folder plus re-export `index.ts`; members of a templated collection (such as mirrored contribution points) keep the uniform folder shape even when currently single-file. See `references/architecture.md` for the full rule.
- Use `utils` for small pure helpers and framework glue, even when they carry light local domain vocabulary such as display formatting, URL/key construction, layout constants, or deterministic calculations. Move code out of `utils.ts` / `utils/` only when it clearly owns business rules, workflows, persistence, IPC, runtime side effects, user-facing policy, or service orchestration; choose a semantic name such as `merge.ts`, `normalization.ts`, `selection.ts`, `serialization.ts`, `messages.ts`, `projection.ts`, or `path-confinement.ts`. Use `shared` only for intentional contracts or implementation genuinely shared by sibling modules, not as a generic catch-all, and do not split tiny cohesive helpers only for naming purity. See `references/architecture.md` and `references/conventions.md`.
- Prefer concise semantic file names over mirroring full class or function names. Let folder context carry repeated qualifiers when it remains clear.
- For main-process services with IPC channels, place registration in service-root `ipc.ts` and export `register<Name>Ipc(service, ipc)`. Call it from `service.ts`, and use `wrapIpc` / `wrapIpcVoid` from `@main/services/ipc`. Keep IPC registration as a thin adapter: forward arguments to service/domain methods and do not put runtime shape parsing, business branching, or orchestration in `ipc.ts`.
- In service roots, expose first-level capabilities as namespaces instead of forwarding their public methods on `service.ts`, e.g. `service.cropper.cropToTemp(...)` rather than `service.cropToTemp(...)`. This API rule does not require converting single files into folders, only applies one level below the service root, and does not forbid `service.ts` from owning real service-level business logic, entry workflows, state, or orchestration.
- Treat real first-level service submodules as boundaries. Sibling submodules should call each other through the target's public API, not private split files. If shared private details are needed repeatedly, move them to the true owner/shared module or merge the coupled responsibility.
- Keep validation and business predicates distinct. Validation of untrusted contract data uses `matches*Format`, `validate*`, `parse*`, `assertValid*`, or boundary `require*` names in validation modules; reserve `is*`, `has*`, `can*`, and `should*` for trusted domain/business checks. See `references/conventions.md`.
- Boundaries that re-enter persisted or foreign data (custom JSON columns, extension inputs, imported files) follow "lenient read, strict write": read paths are total and degrade malformed content to a documented safe default, write paths throw on invalid values. The read-side default is not a backward-compatibility shim and never recognizes retired formats. Strict write means round-trip integrity: accept a value only if reading it back yields an equivalent value, so reuse the read parser, persist its canonical form, and throw instead of silently repairing. See `references/conventions.md`.
- Distinguish "unknown" from "known to be empty" across the scraper/ingest pipeline. A missing slot means the source could not answer; an empty collection means the source says there is none. Providers omit slots they cannot answer, merges preserve presence rather than collapsing empty arrays to `undefined`, and the `replace` collection policy may clear stored collections on an authoritative empty. Deleting needs stronger authority than writing: when several fact sources feed one link table, `replace` only clears once every source has answered, and degrades to `merge` with a warning otherwise. The link topology is declared once in `update/link-topology.ts`. See `references/architecture.md`.
- Kisaki is an ACGN library manager and targets six root media types: game (ACGN games, visual novels first), anime, comic, and novel (narrative fiction, light novels first) as the core ring, plus music and audio as a second ring. Live-action film and television are deliberately out of scope: they have no character entity worth modelling and share no consumption habits, sources, or UI with the rest. A new root type is justified only by a different consumption unit (session/episode/track/page), a different technical layer (process launch, video playback, audio playback, reading), or a different metadata graph; anything else is a `format` enum value on an existing type. Entry grain is a separate per-type decision: the entry sits where the domain puts strong identity, never inherited from the type that shipped first. `anime` entries are seasons and standalone works, with franchises as `media_relations` components. See `references/conventions.md`.
- Casting is a three-way fact (person voices character in this entry) and lives in its own `*_cast_links` tables — the only ternary in the schema. It is layered against `character_person_links`: the latter is work-independent knowledge and is merge-only, cast is a per-entry confirmed credit and is replaced wholesale, so a recast reads as a new credit plus a retained knowledge row. Cast rows derive from `actor`-role character-person facts; a provider without character entities contributes the person link alone. See `references/conventions.md`.
- Kisaki grows by media type. Declare per-entity behavior once in specs/registries keyed by the entity-type union (`Record<AllEntityType, ...>`, entity switches without `default`) so adding a media type is +1 table/spec/registry entry and the compiler flags every remaining decision point. Abstract precisely: keep the entity-type seam for known growth, and do not add speculative machinery (nested filter ASTs, operator frameworks, plugin points nothing consumes). See `references/conventions.md`.
- Key registries by the union, not the union by the registry: no `keyof typeof` unions, one holder per per-entity fact, and `as const satisfies Record<Union, Shape>` when entries must keep precise value types. Correlate an entity type with its payload by construction (`EntityRowMap[T]` on a generic function or component); `as` on an entity payload belongs only inside the one mechanism that owns the correlation, never at a call site. Template dispatch chains narrow a discriminated union and end with `assertNever` instead of a bare `v-else`. Untrusted-input parsing keeps its total `default` (lenient read). See `references/conventions.md`.
- Abstract mechanics, never domain meaning. Shared entity-generic code is parameterized only by schema facts (tables, columns) and injected functions; flow ordering stays in explicit per-entity coordinators, and helpers are opt-in for media types that fit. Satellite entities (person/company/character) are cross-media shared and safe to dedupe; root media types grow one exemplar at a time (game and anime shipped) — never extract generic root-media flows or a single all-consumer entity spec from one sample. Keep registries per consumer. See `references/conventions.md`.

## Runtime Logging And Error Boundaries

- Use the project log wrappers (`@main/log` and `@renderer/core/log`) in app runtime code; do not scatter direct `electron-log/*` imports through business modules. `shared/**` stays pure and does not write runtime logs.
- Main app logs are thin `electron-log` wrappers: add one stable prefix, route to `userData/logs/main.log` or `userData/logs/renderer.log`, and pass through the remaining arguments. Do not add custom JSON formatting, Error serialization, semantic redaction, or log protocols in business code.
- Extension author logs are a separate extension-scoped capability. `context.logger` writes to `userData/extensions/data/<extensionId>/logs/extension.log`; the host must not inject app prefixes, extension ids, or rewrite extension messages.
- Logger prefixes are single-level stable domains such as `Extension`, `Db`, `Window`, `Updater`, `Scanner`, `Watch`, `MediaFiles`, `MediaInfo`, `Activity`, `Player`, `Process`, `Library`, `Theme`, `Hook`, `Ipc`, or `AsyncData`. Do not use dotted prefixes, `main`/`renderer`, file names, class names, function names, or dynamic ids as prefixes; pass dynamic values as log arguments.
- Log lifecycle events, background task results, external boundary failures, recovery/degradation, extension host state, renderer global errors, and cross-process sync failures. Avoid logging ordinary renders, every watcher tick, form input, routine IPC calls, or tight-loop item details.
- Never log secrets, auth headers, OAuth code/state, PKCE verifier, extension storage/secrets values, user body text, notes, comments, clipboard content, full DB rows, full HTTP bodies, unbounded arrays, private keys, or signing keys. Prefer basenames, ids, or app-derived paths over full user paths.
- Catch only to add business semantics, recover, change the boundary message, or record full context once at the layer that owns it. Re-throw safe English errors in our own wording such as `new Error('Failed to install extension package.')`; messages may embed the dynamic values a reader needs to act (ids, paths, names, enum values), but never raw library messages (wrap with `cause` and log instead), secrets, remote-sourced content, or unbounded collections. Never branch on `error.message` text; classify errors with typed classes or reason fields. See `references/conventions.md` for details.
