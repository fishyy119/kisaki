# Changelog

This reference is the source of truth for release changelog writing rules. Load it before creating
or editing files under `changelog/<target>/vX.Y.Z/`.

Changelogs are reader-facing release notes, not commit summaries or code ownership reports.

Release validation implements these rules in `.github/scripts/release/validate.ts`.

## Required Files

For each release target and version `X.Y.Z`, create exactly these files:

- `changelog/<target>/vX.Y.Z/zh-Hans.md`
- `changelog/<target>/vX.Y.Z/en.md`
- `changelog/<target>/vX.Y.Z/ja.md`

Supported targets:

- `desktop`: the end-user desktop application.
- `extension-tooling`: the extension author toolchain, released as one unit.

Example:

- `changelog/desktop/v1.2.3/zh-Hans.md`
- `changelog/desktop/v1.2.3/en.md`
- `changelog/desktop/v1.2.3/ja.md`
- `changelog/extension-tooling/v1.2.3/zh-Hans.md`
- `changelog/extension-tooling/v1.2.3/en.md`
- `changelog/extension-tooling/v1.2.3/ja.md`

## File Format

Use a single H1 title followed by release sections:

```md
# Kisaki vX.Y.Z

## Features

- Added extension update checks.
```

Desktop titles use `# Kisaki vX.Y.Z`. Extension tooling titles use
`# Kisaki Extension Tooling vX.Y.Z`.

Use the localized section heading for each locale file. Omit empty sections, but keep
the remaining sections in this order:

| Order | en               | zh-Hans    | ja             | Use for                                                                                   |
| ----- | ---------------- | ---------- | -------------- | ----------------------------------------------------------------------------------------- |
| 1     | Highlights       | 重点       | ハイライト     | The 1-3 most important user-facing changes in a larger release.                           |
| 2     | Breaking Changes | 破坏性变更 | 破壊的変更     | Changes that break existing behavior, data, configuration, APIs, or extensions.           |
| 3     | Migration Notes  | 迁移说明   | 移行メモ       | Required manual steps for users or extension authors.                                     |
| 4     | Features         | 新功能     | 新機能         | New capabilities users or extension authors can use.                                      |
| 5     | Fixes            | 修复       | 修正           | Corrected bugs, crashes, incorrect data, UI errors, packaging issues, or release issues.  |
| 6     | Improvements     | 改进       | 改善           | Existing behavior that is smoother, clearer, more stable, or easier to use.               |
| 7     | Performance      | 性能       | パフォーマンス | Startup, scanning, scraping, build, memory, or size improvements.                         |
| 8     | Security         | 安全       | セキュリティ   | Security fixes, permission changes, signing, integrity checks, or vulnerability handling. |
| 9     | Compatibility    | 兼容性     | 互換性         | OS, Electron, Node.js, extension API, dependency, or data compatibility changes.          |
| 10    | Documentation    | 文档       | ドキュメント   | User or extension author documentation changes.                                           |
| 11    | Known Issues     | 已知问题   | 既知の問題     | Known limitations or unresolved issues in this release.                                   |

## Classification Rules

1. Organize by reader impact type, not by package, code module, pull request, or commit.
2. Do not create package sections such as `CLI`, `SDK`, `Registry`, or `Desktop UI` by default.
3. If scope matters, add it inside the bullet text, for example `Extension CLI: Added release package validation`.
4. Extension tooling changelogs describe the whole toolchain; do not split them by package.
5. Put user-visible rewrites and refactors under `Improvements`, unless they add a clearly new capability.
6. Put speed, memory, startup, build, scanning, and scraping throughput changes under `Performance`.
7. Keep `Highlights` short. Do not repeat every detailed section there.
8. Do not include internal-only refactors unless they affect users, extension authors, release artifacts, or compatibility.

## Entry Wording

1. Entry wording is mandatory. Release validation fails when a bullet does not follow these rules.
2. `v0.0.1` changelogs are initial release records and may keep the natural initial release wording:
   `Initial release`, `初始版本发布`, and `初回リリース`.
3. Keep bullets short, result-oriented, and consistent with the existing desktop changelogs.
4. Every bullet must use one of the localized action prefixes below. Without a scope prefix, the
   action prefix must be the first text after `- `. With a scope prefix, use
   `<Scope>: <Action> ...` or `<Scope>：<Action> ...`, and the text after the colon must start with
   one of these action prefixes.
   - `zh-Hans`: `新增`, `支持`, `修复`, `改进`, `优化`, `重构`, `调整`, `移除`, `要求`
   - `en`: `Added`, `Supported`, `Fixed`, `Improved`, `Optimized`, `Refactored`, `Changed`, `Removed`, `Required`
   - `ja`: `追加`, `対応`, `修正`, `改善`, `最適化`, `再構成`, `変更`, `削除`, `必須化`
5. For `zh-Hans`, action prefixes may attach directly to the result text. For `en` and `ja`, put a
   space after the action prefix.
6. For `zh-Hans`, omit terminal punctuation for bullet entries, matching the desktop release notes.
7. Use scope prefixes only when they make the reader impact clearer. Prefer public surfaces such as
   `Extension CLI`, `Scaffold`, `Pack`, `Release`, or their localized equivalents; do not prefix every
   bullet and do not use internal package names as routine prefixes.
8. Do not use colon-led fragments when a normal action sentence is clearer. For example, prefer
   `新增 kisx --project <dir>，支持从任意目录运行 build、validate、pack 和 dev` over
   `kisx --project <dir>：从任意目录运行 build、validate、pack、dev`.

## Writing Rules

1. Version folder must match release version exactly (`vX.Y.Z`).
2. Files are raw Markdown content; no front matter is required.
3. Keep language files semantically aligned, but wording can be localized naturally.
4. Release workflow fails when any required locale file is missing or empty.
5. Use concise bullets that describe the resulting behavior.
6. Avoid implementation details unless they explain an action readers must take.
7. Do not leave placeholder bullets such as `...`, `……`, `TBD`, or `TODO`.
8. Do not add empty sections.

## Author Checklist

Before pushing `release(<target>): vX.Y.Z`:

- [ ] `changelog/<target>/vX.Y.Z/zh-Hans.md` exists.
- [ ] `changelog/<target>/vX.Y.Z/en.md` exists.
- [ ] `changelog/<target>/vX.Y.Z/ja.md` exists.
- [ ] Files use the title and section order defined above.
- [ ] Entry Wording rules are satisfied.
- [ ] Empty sections and placeholder bullets are removed.
- [ ] Content is reviewed and finalized.
