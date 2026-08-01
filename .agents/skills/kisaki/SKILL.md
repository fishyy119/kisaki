---
name: kisaki
description: Kisaki project architecture and coding standards guide. Use when developing, refactoring, or debugging within this Electron + Vue 3 + SQLite monorepo. Covers main process services (ServiceContainer/DI), renderer patterns (Vue 3 SFC/composables), IPC/events contracts, data layer (Drizzle/SQLite), extension system and built-in extension development, runtime logging/error boundaries, UI design system (Tailwind semantic tokens), and build/release workflows.
---

# Kisaki Project Guide

This skill serves as the main entry point for development within the Kisaki repository. Load topic-specific references as needed (avoid loading all at once).

## Project Overview

**Kisaki** is a multimedia library manager built as an Electron desktop application.

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
| IPC & Events              | [ipc-events.md](references/ipc-events.md)             | Adding IPC channels, cross-process events, event contracts                                             |
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
- Events: `AppEvents`, `useEvent`, `event:forward`
- Extension API: `ExtensionContext`, `KisakiApi`, `Contribution`, `Capability`, `RpcMethodDefinition`
- DB: `sqliteTable`, `drizzle`, `migrate`
- Vue: `defineProps`, `defineModel`, `useAsyncData`
- UI: `bg-surface`, `text-foreground`, `buttonVariants`
- i18n: `useI18n`, `Messages`, `UiLocale`, `LocalizedText`, `createFormatters`

## Project Preferences

- Do not create local type aliases or barrel-style re-exports that only import a type from its source of truth and immediately export it under another local name. Use sites should import shared contracts directly from the owning module, unless the local type adds real domain semantics or narrows/extends the source type.
- Avoid repeated path segment names for ordinary TypeScript logic modules. Do not create files like `ipc/ipc.ts`, `repository/repository.ts`, or `store/store.ts`; use responsibility names such as `register.ts`, `manager.ts`, `store.ts`, `validation.ts`, `types.ts`, `controller.ts`, or `mappers.ts`. Repeated names are allowed for component-family root components, such as `dialog/dialog.vue` or `chart/chart.tsx`, when the file is the primary component for that folder. `index.ts` remains an entrypoint-only exception and should contain explicit exports only.
- Treat folders as either category organization or coupled module split. Category folders group peers and do not need a single entry; MediaService `handlers/` folders are valid category folders. Coupled module folders split one module across files and should have a clear role entry such as `manager.ts`, `coordinator.ts`, `gateway.ts`, `provider.ts`, `point.ts`, `controller.ts`, `registry.ts`, `planner.ts`, or `view.ts`. Standalone cohesive single-file modules stay single-file instead of gaining a folder plus re-export `index.ts`; members of a templated collection (such as mirrored contribution points) keep the uniform folder shape even when currently single-file. See `references/architecture.md` for the full rule.
- Use `utils` for small pure helpers and framework glue, even when they carry light local domain vocabulary such as display formatting, URL/key construction, layout constants, or deterministic calculations. Move code out of `utils.ts` / `utils/` only when it clearly owns business rules, workflows, persistence, IPC, runtime side effects, user-facing policy, or service orchestration; choose a semantic name such as `merge.ts`, `normalization.ts`, `selection.ts`, `serialization.ts`, `messages.ts`, `projection.ts`, or `path-confinement.ts`. Use `shared` only for intentional contracts or implementation genuinely shared by sibling modules, not as a generic catch-all, and do not split tiny cohesive helpers only for naming purity. See `references/architecture.md` and `references/conventions.md`.
- Prefer concise semantic file names over mirroring full class or function names. Let folder context carry repeated qualifiers when it remains clear.
- For main-process services with IPC channels, place registration in service-root `ipc.ts` and export `register<Name>Ipc(service, ipc)`. Call it from `service.ts`, and use `wrapIpc` / `wrapIpcVoid` from `@main/services/ipc`. Keep IPC registration as a thin adapter: forward arguments to service/domain methods and do not put runtime shape parsing, business branching, or orchestration in `ipc.ts`.
- In service roots, expose first-level capabilities as namespaces instead of forwarding their public methods on `service.ts`, e.g. `service.cropper.cropToTemp(...)` rather than `service.cropToTemp(...)`. This API rule does not require converting single files into folders, only applies one level below the service root, and does not forbid `service.ts` from owning real service-level business logic, entry workflows, state, or orchestration.
- Treat real first-level service submodules as boundaries. Sibling submodules should call each other through the target's public API, not private split files. If shared private details are needed repeatedly, move them to the true owner/shared module or merge the coupled responsibility.
- Keep validation and business predicates distinct. Validation of untrusted contract data uses `matches*Format`, `validate*`, `parse*`, `assertValid*`, or boundary `require*` names in validation modules; reserve `is*`, `has*`, `can*`, and `should*` for trusted domain/business checks. See `references/conventions.md`.

## Runtime Logging And Error Boundaries

- Use the project log wrappers (`@main/log` and `@renderer/core/log`) in app runtime code; do not scatter direct `electron-log/*` imports through business modules. `shared/**` stays pure and does not write runtime logs.
- Main app logs are thin `electron-log` wrappers: add one stable prefix, route to `userData/logs/main.log` or `userData/logs/renderer.log`, and pass through the remaining arguments. Do not add custom JSON formatting, Error serialization, semantic redaction, or log protocols in business code.
- Extension author logs are a separate extension-scoped capability. `context.logger` writes to `userData/extensions/data/<extensionId>/logs/extension.log`; the host must not inject app prefixes, extension ids, or rewrite extension messages.
- Logger prefixes are single-level stable domains such as `Extension`, `Db`, `Window`, `Updater`, `Scanner`, `Launcher`, `Library`, `Theme`, `Event`, `Ipc`, or `AsyncData`. Do not use dotted prefixes, `main`/`renderer`, file names, class names, function names, or dynamic ids as prefixes; pass dynamic values as log arguments.
- Log lifecycle events, background task results, external boundary failures, recovery/degradation, extension host state, renderer global errors, and cross-process sync failures. Avoid logging ordinary renders, every watcher tick, form input, routine IPC calls, or tight-loop item details.
- Never log secrets, auth headers, OAuth code/state, PKCE verifier, extension storage/secrets values, user body text, notes, comments, clipboard content, full DB rows, full HTTP bodies, unbounded arrays, private keys, or signing keys. Prefer basenames, ids, or app-derived paths over full user paths.
- Catch only to add business semantics, recover, change the boundary message, or record full context once at the layer that owns it. Re-throw stable safe English errors such as `new Error('Failed to install extension package.')`; do not rethrow raw library messages or add dynamic values to error messages.
