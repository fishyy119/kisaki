# Kisaki Extension Tooling v0.0.2

## 新機能

- ダイアログ、ページ、外観同期、型付き RPC、開発時 HMR に対応した Webview UI を追加しました。
- Kisaki に準拠した Vue コンポーネントとセマンティックスタイルを提供する `@kisaki3/extension-ui-vue` を追加しました。
- フェーズと作業進捗、サイズ制限付き結果、`cancelOwn` に対応したタスク実行 API を追加しました。
- エンティティ、関連、ソースデータ向けのライブラリグラフインポート API を追加しました。
- 複数の UI 構成、公開方式、host/UI 分層ビルドに対応するよう、スキャフォールドと `kisx` を更新しました。

## 破壊的変更

- `settingsPanels` を削除しました。設定画面や対話 UI は `cardActions` から Webview として開いてください。
- `Serializable*` を `JsonValue`、`JsonObject`、厳密な wire-safe RPC 値へ置き換えました。
- `backgroundTasks` を `automations` に、`ExtensionTaskRun*` を `TaskRun*` に改名しました。
- マニフェストの `entry` と `ui` に `./` 接頭辞を必須とし、新しい host/UI 出力構成を採用しました。
- スクレイパープロバイダーと取得結果の識別子をメディア種別ごとのスコープへ変更しました。

## 改善

- host、UI、shared コードの境界を強化し、生成プロジェクトの設定を整備しました。
- 開発拡張のリロードと出力監視を安定化しました。
- ツールチェーンのパッケージ、ビルド順序、必須出力、ロックステップバージョンを一元管理しました。
