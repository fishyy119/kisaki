# Kisaki Extension Tooling v0.0.5

## 破壊的変更

- 変更 スキャフォールド `init` の作成対象を extension workspace と registry のみに変更
- 変更 スキャフォールド `add` の拡張機能 ID を位置引数に変更し、`--extension-id` を削除
- 変更 スキャフォールド workspace 設定の `provider` を `publishProvider` に変更

## 移行メモ

- 必須化 `pnpm create kisaki-extension init` で workspace を作成してから、生成先で `pnpm create kisaki-extension add <extension-id>` を実行する手順
- 必須化 `kisaki-extension-workspace.json` の `provider` から `publishProvider` への変更

## 改善

- 改善 スキャフォールドのサブコマンドなし実行を、有効な workspace 内では既定で `add` に変更
- 改善 スキャフォールドの無効な workspace エラーで、設定エラー時に `init` へ戻らないよう変更
- 改善 スキャフォールドのプロンプト分類で、workspace、registry、extension 情報を区別
