# Kisaki Extension Tooling v0.0.3

## 破壊的変更

- 変更 `create-kisaki-extension` をサブコマンド形式にし、リポジトリ作成には `pnpm create kisaki-extension init <dir>` が必要
- 削除 `--publish`、`--layout single|monorepo` と `--provider manual|github` でリポジトリ構成とリリース方法を個別に選択
- 必須化 拡張パッケージの `private: true` 宣言、拡張バージョンは `manifest.json` を参照
- 必須化 Kisaki ツールチェーンパッケージの `devDependencies` 配置、`.kisx` に同梱する外部ランタイム依存のみを `dependencies` または `optionalDependencies` に保持

## 新機能

- 追加 `create-kisaki-extension add`、生成済みの monorepo に拡張機能を追加可能
- 追加 `kisx --project <dir>`、任意のディレクトリから build、validate、pack、dev を実行可能

## 修正

- 修正 0.x ツールチェーンリリース後に既定のインストールが古いバージョンを解決することがある問題
- 修正 npm 公開失敗後も GitHub Release が作成または更新されることがある問題

## 改善

- 改善 スキャフォールド構造、リポジトリ構成とリリース方法の独立した組み合わせに対応
- 改善 テンプレートマージプロトコル、`template.json` で `json.merge` と `text.slot` を宣言
- 最適化 `kisx pack` のアーカイブ内容、`.kisx` に同梱する外部ランタイム依存のみをコピー
- 改善 ツールチェーンのロックステップリリース、バージョン検査、ビルド、出力検証、パッケージ作成、npm publish dry-run 検証を統一
