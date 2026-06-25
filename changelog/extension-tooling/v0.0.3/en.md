# Kisaki Extension Tooling v0.0.3

## Breaking Changes

- `create-kisaki-extension` now uses subcommands; create repositories with `pnpm create kisaki-extension init <dir>`.
- `--publish` is removed; use `--layout single|monorepo` and `--provider manual|github` to choose repository layout and release provider separately.
- `kisx validate` now requires `private: true` and treats `manifest.json` as the sole source of the extension version.
- Kisaki tooling packages belong in `devDependencies`; `dependencies` and `optionalDependencies` are reserved for external runtime packages that must ship in the `.kisx`.

## Features

- `create-kisaki-extension add` appends an extension to a generated monorepo, inheriting its release provider.
- `kisx --project <dir>` runs build, validate, pack, and dev from any directory.

## Improvements

- Scaffold layers recomposed so layout and release provider combine orthogonally; template merging moves to an explicit `template.json` protocol (`json.merge` / `text.slot`).
- `kisx pack` copies only external runtime dependencies; SDK/API packages bundled into the host output no longer enter the archive.
- Lockstep tooling releases unify version checks, build, output verification, packing, and npm publish preflight.

## Fixes

- 0.x tooling releases now keep `experimental` and `latest` dist-tags in sync.
- GitHub Releases are created or updated only after npm publishing succeeds, preventing channel drift.
