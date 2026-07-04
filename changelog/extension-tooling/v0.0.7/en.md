# Kisaki Extension Tooling v0.0.7

## Highlights

- Fixed GitHub provider publishing so registry validation runs before GitHub Release creation
- Changed generated GitHub provider publishing to use `<extension-id>-v<semver>` tags instead of commit messages
- Required Node.js 24 or newer across the extension toolchain and generated projects
- Improved generated workspace hooks so commits only fix staged files and pushes run the full workspace check

## Breaking Changes

- Required Node.js 24 or newer for extension tooling packages, scaffolded projects, and generated GitHub workflows
- Changed generated GitHub provider publish workflows so they no longer detect `publish(<extension-id>): v<semver>` commit messages and now start from `<extension-id>-v<semver>` tags

## Migration Notes

- Required updating local and CI Node.js runtimes to 24 or newer before installing or publishing extensions
- Required generated repositories using the GitHub provider to commit the manifest version update, push `main`, then push `<extension-id>-v<semver>`; after a failed publish, move the same tag to the fixed commit and push it again

## Features

- Added a generated workspace `key:generate` command for creating extension signing keys

## Fixes

- Fixed GitHub provider release publishing so failed registry updates no longer leave early publish tags
- Fixed registry release timestamps from generated GitHub workflows to use UTC ISO strings
- Fixed generated `.gitignore` files to ignore extension packages, signatures, tarballs, and temporary output

## Improvements

- Improved generated Lefthook hooks to run Prettier and ESLint on staged files in order before commit
- Improved generated pre-push hooks to run the unified `pnpm check` quality gate
- Improved generated workspace checks with root ESLint, a staged-file hook runner, and workflow script type checking
- Improved generated CI and publish workflows to run the same workspace checks before publishing
- Improved generated GitHub provider publish workflows so they can be rerun with an explicit tag and build packages from the tagged source
