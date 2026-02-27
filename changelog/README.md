# Changelog Contract

This directory is the source of truth for desktop release changelog content.

## Required structure

For each desktop version `X.Y.Z`, create exactly these files:

- `changelog/desktop/vX.Y.Z/zh-Hans.md`
- `changelog/desktop/vX.Y.Z/en.md`
- `changelog/desktop/vX.Y.Z/ja.md`

Example:

- `changelog/desktop/v1.2.3/zh-Hans.md`
- `changelog/desktop/v1.2.3/en.md`
- `changelog/desktop/v1.2.3/ja.md`

## Rules

1. Version folder must match release version exactly (`vX.Y.Z`).
2. Files are raw Markdown content; no front matter is required.
3. Keep language files semantically aligned, but wording can be localized naturally.
4. Desktop release workflow fails when any required locale file is missing.

## Author checklist

Before pushing `release(desktop): vX.Y.Z`:

- [ ] `changelog/desktop/vX.Y.Z/zh-Hans.md` exists.
- [ ] `changelog/desktop/vX.Y.Z/en.md` exists.
- [ ] `changelog/desktop/vX.Y.Z/ja.md` exists.
- [ ] Content is reviewed and finalized.
