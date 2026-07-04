# Kisaki Extension Tooling v0.0.2

## 新機能

- 追加 ダイアログ、ページ、外観同期、型付き RPC、開発時 HMR に対応した Webview UI
- 追加 Kisaki に準拠した Vue コンポーネントとセマンティックスタイルを提供する `@kisaki3/extension-ui-vue`
- 追加 フェーズと作業進捗、サイズ制限付き結果、`cancelOwn` に対応したタスク実行 API
- 追加 エンティティ、関連、ソースデータ向けのライブラリグラフインポート API
- 改善 スキャフォールドと `kisx` で、複数の UI 構成、公開方式、host/UI 分層ビルドに対応

## 破壊的変更

- 削除 `settingsPanels`、設定画面や対話 UI は `cardActions` から Webview として開く必要あり
- 変更 `Serializable*` を `JsonValue`、`JsonObject`、厳密な wire-safe RPC 値へ置換
- 変更 `backgroundTasks` を `automations` に、`ExtensionTaskRun*` を `TaskRun*` に改名
- 必須化 マニフェストの `entry` と `ui` の `./` 接頭辞、および新しい host/UI 出力構成
- 変更 スクレイパープロバイダーと取得結果の識別子をメディア種別ごとのスコープへ移行

## 改善

- 改善 host、UI、shared コードの境界と生成プロジェクトの設定
- 改善 開発拡張のリロードと出力監視の安定性
- 改善 ツールチェーンのパッケージ管理、ビルド順序、必須出力、ロックステップバージョン管理
