# Kisaki Extension Tooling v0.0.11

## 破壊的変更

- 変更 extension tooling の全 package を ESM only build に変更し、CommonJS 成果物の配布を終了
- 必須化 extension entry file の `.mjs` 化。manifest は `.cjs` entry を受け付けない
- 変更 registry manifest の package description を plain text の `summary` と任意の `description` に、release changelog を `text` / `url` field に変更し、`releasePage` と localized document set を廃止
- 変更 `kisx registry add-release` に `--changelog <text>` と `--changelog-url <url>` を追加し、`--release-page`、`--changelogs`、`--default-locale` を廃止
- 削除 webview theme token の `card` と `cardForeground`、および対応する SDK CSS variable

## 移行メモ

- 必須化 `.cjs` entry を使用する extension の `.mjs` への移行と、tooling package の ESM import への切り替え
- 必須化 既存 registry manifest の localized description と changelog を plain text の `summary` / `description` と `changelog.text` / `changelog.url` へ移行
- 必須化 旧 scaffold で生成した publish workflow を `--changelog` / `--changelog-url` でのリリースノート指定へ変更し、`<locale>.md` changelog directory の運用を終了
- 必須化 webview UI の `bg-card` などの card token を `bg-surface` や `bg-input` などの既存 token へ置き換え

## 改善

- 改善 `kisx pack` がバイト単位で再現可能な `.kisx` archive を生成
- 改善 extension UI component（checkbox、switch、tabs、field separator）の視覚的一貫性
- 改善 scaffold template を ESLint 10、TypeScript 6.0 などの最新 toolchain へ更新し、lint cache 設定を統一
