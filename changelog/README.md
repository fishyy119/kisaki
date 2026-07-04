# Changelog

This directory contains localized release changelog content for Kisaki release targets.
Changelogs are reader-facing release notes.

## Structure

Each release version has one folder per target:

```text
changelog/<target>/vX.Y.Z/
```

Supported targets:

- `desktop`: the end-user desktop application.
- `extension-tooling`: the extension author toolchain, released as one unit.

Each release folder contains exactly these locale files:

- `zh-Hans.md`
- `en.md`
- `ja.md`

Examples:

- `changelog/desktop/v1.2.3/zh-Hans.md`
- `changelog/desktop/v1.2.3/en.md`
- `changelog/desktop/v1.2.3/ja.md`
- `changelog/extension-tooling/v1.2.3/zh-Hans.md`
- `changelog/extension-tooling/v1.2.3/en.md`
- `changelog/extension-tooling/v1.2.3/ja.md`
