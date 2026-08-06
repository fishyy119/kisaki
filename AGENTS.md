# Kisaki Repository Guide

Kisaki is a multifunctional media library manager. It aims to provide one coherent desktop
experience and data model for recording, managing, building, syncing, and showcasing media
collections and memories.

This project is still before `0.1.0`; prefer clean architecture and clear ownership over preserving
old internal shapes.

## Product Principles

- Keep the desktop app local-first, predictable, and resilient around user-owned media data.
- Treat the library data model, extension contracts, and cross-process IPC as durable boundaries.
- Prefer explicit workflows over hidden side effects, especially for filesystem, database, extension,
  and background task behavior.
- Make feature surfaces useful before making them decorative; renderer UI should be efficient,
  scannable, and consistent with the existing design system.

## Architecture

- `apps/desktop/` is the Electron app:
  - `src/main/` owns services, lifecycle, IPC registration, database access, background work, and
    extension hosting.
  - `src/preload/` exposes the safe bridge between Electron and the renderer.
  - `src/renderer/` owns the Vue UI, composables, dialogs, and renderer-local state.
  - `src/shared/` contains pure cross-process contracts and shared value definitions only.
- `packages/` contains reusable extension-facing tooling and contracts:
  - `extension-api`, `extension-registry`, `extension-sdk`, `extension-cli`, and
    `create-kisaki-extension`.
- `extensions/` contains built-in extension projects bundled with the desktop app.
- `tools/` contains repository-internal automation. Keep tool CLIs thin and put workflows in the
  tool's own modules.

## Tech Stack

- Runtime: Electron 41 + Node.js.
- Frontend: Vue 3 + TypeScript + Vite.
- Data: SQLite with Drizzle ORM.
- Styling: TailwindCSS v4 using semantic tokens.
- Build and release: in-repo Vite bundler (`apps/desktop/tools/bundler`), electron-builder, pnpm
  workspaces.

## Main Process Standards

- Services are managed by `ServiceContainer`; register services first, initialize by declared deps,
  and dispose in reverse initialization order.
- Service ids must be stable and match the `ServiceRegistry` key.
- Keep `service.ts` as the service boundary. For real first-level service capabilities, expose
  namespaces such as `service.repositories.refreshRepository()` instead of flattening every method
  onto the service.
- Put service IPC registration in service-root `ipc.ts`, export `register<Name>Ipc(service, ipc)`,
  and call it from `service.ts`.
- IPC adapters must be thin: forward typed arguments to service/domain methods and use `wrapIpc` /
  `wrapIpcVoid`. Runtime shape parsing, business branching, and orchestration belong in the owning
  service or domain module.
- Main-process database calls are synchronous. Do not `await` Drizzle calls, and do not put async
  work inside better-sqlite3 transactions.

## Renderer Standards

- Use Vue 3 SFCs, composables, and existing renderer module boundaries.
- Keep `.vue` components documented with a concise top-of-file purpose comment.
- Use Tailwind semantic tokens such as `bg-surface` and `text-foreground`; avoid one-off visual
  systems unless the local design system already supports them.
- Renderer-initiated actions own their user notifications. Main process code returns safe error
  summaries and logs at the owning boundary.

## Shared Contracts

- `src/shared/` must stay pure: types, contracts, constants, validation helpers, and deterministic
  functions only.
- Do not cross-import `main` and `renderer`. Both may import from `shared`.
- Do not duplicate contracts through local alias types or pass-through re-exports. Import shared
  contracts from the module that owns them.
- Validation of untrusted contract data should use names like `matches*Format`, `validate*`,
  `parse*`, `assertValid*`, or `require*`. Reserve `is*`, `has*`, `can*`, and `should*` for trusted
  domain/business checks.

## Code Organization

- Follow existing module boundaries and naming rules before adding abstractions.
- Keep code style clean, clear, unified, modern, and aligned with project standards; implement
  changes thoroughly, without backward-compatibility shims, legacy fallbacks, or redundant code.
  Total-parse safe defaults at storage and untrusted boundaries ("lenient read, strict write") are
  boundary contracts, not legacy fallbacks; see `.agents/skills/kisaki` conventions.
- Treat folders as either category organization or coupled module splits. Do not add facade entries
  or `index.ts` files just for symmetry.
- Use concise responsibility names such as `manager.ts`, `coordinator.ts`, `gateway.ts`,
  `provider.ts`, `registry.ts`, `store.ts`, `validation.ts`, `mappers.ts`, or `types.ts`.
- Use `utils` only for small pure helpers and framework glue. Move business policy, persistence,
  IPC, orchestration, or runtime side effects into a semantic owner module.
- Keep `index.ts` files as explicit public export lists only.

## Runtime And Logging

- Use project log wrappers (`@main/log` and `@renderer/core/log`) in runtime code.
- Never log secrets, auth headers, OAuth values, extension storage/secrets, full user content, full
  database rows, full HTTP bodies, unbounded arrays, private keys, or signing keys.
- Catch errors only to add business context, recover, change the boundary message, or log once at the
  layer that owns the failure.
- Throw stable safe English errors for user-facing boundaries.

## Language And Comments

- Code comments must be English, concise, and high signal.
- Comment intent, constraints, invariants, or side effects; do not narrate obvious code.
- Temporary comments are not allowed in normal code. Unavoidable exceptions must use `TEMP:`,
  `TODO:`, or `FIXME:` with a concrete removal condition.
- Do not use Chinese strings as i18n keys.

## Detailed References

- Use `.agents/skills/kisaki` for task-specific implementation guidance.
- Load the specific reference file that matches the task instead of pulling every reference into
  context.

## Workspace Commands

- Use `pnpm` from the repository root.
- Use `rg` / `rg --files` for searches unless unavailable.
- Run the package-specific typecheck, lint, or build command that matches the code changed.
- For broad shared behavior, prefer `pnpm typecheck` and `pnpm lint` before opening a PR.
