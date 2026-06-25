# Kisaki Extension Tooling v0.0.3

## Breaking Changes

- Changed `create-kisaki-extension` to use subcommands; create repositories with `pnpm create kisaki-extension init <dir>`
- Removed `--publish` in favor of `--layout single|monorepo` and `--provider manual|github` for choosing repository layout and release provider separately
- Required extension packages to declare `private: true`, with extension versions sourced from `manifest.json`
- Required Kisaki tooling packages in `devDependencies`, with external runtime dependencies shipped in `.kisx` kept in `dependencies` or `optionalDependencies`

## Features

- Added `create-kisaki-extension add` for appending extensions to generated monorepos
- Added `kisx --project <dir>` support for running build, validate, pack, and dev from any directory

## Fixes

- Fixed stale default installs during 0.x tooling releases
- Fixed GitHub Releases being created or updated after failed npm publishing

## Improvements

- Improved scaffold structure, supporting independent composition of repository layout and release provider
- Improved the template merge protocol with `template.json` declarations for `json.merge` and `text.slot`
- Optimized `kisx pack` archives to copy only external runtime dependencies that must ship in `.kisx`
- Improved lockstep tooling releases with unified version checks, builds, output verification, packing, and npm publish dry-run validation
