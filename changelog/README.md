# Changelog Contract

This directory is the source of truth for release changelog content.

## Required structure

For each release target and version `X.Y.Z`, create exactly these files:

- `changelog/<target>/vX.Y.Z/zh-Hans.md`
- `changelog/<target>/vX.Y.Z/en.md`
- `changelog/<target>/vX.Y.Z/ja.md`

Supported targets:

- `desktop`
- `extension-tooling`

Example:

- `changelog/desktop/v1.2.3/zh-Hans.md`
- `changelog/desktop/v1.2.3/en.md`
- `changelog/desktop/v1.2.3/ja.md`
- `changelog/extension-tooling/v1.2.3/zh-Hans.md`
- `changelog/extension-tooling/v1.2.3/en.md`
- `changelog/extension-tooling/v1.2.3/ja.md`

## Rules

1. Version folder must match release version exactly (`vX.Y.Z`).
2. Files are raw Markdown content; no front matter is required.
3. Keep language files semantically aligned, but wording can be localized naturally.
4. Release workflow fails when any required locale file is missing or empty.
5. Extension tooling changelogs describe the toolchain as one release unit; do not split them by package.

## Author checklist

Before pushing `release(<target>): vX.Y.Z`:

- [ ] `changelog/<target>/vX.Y.Z/zh-Hans.md` exists.
- [ ] `changelog/<target>/vX.Y.Z/en.md` exists.
- [ ] `changelog/<target>/vX.Y.Z/ja.md` exists.
- [ ] Content is reviewed and finalized.
