# Kisaki Extension Tooling v0.0.3

## 破壊的変更

- `create-kisaki-extension` をサブコマンド形式に変更し、リポジトリ作成には `pnpm create kisaki-extension init <dir>` が必要
- `--publish` を削除し、`--layout single|monorepo` と `--provider manual|github` でリポジトリ構成とリリース方法を個別に選択
- 拡張パッケージの `private: true` 宣言を必須化し、拡張バージョンは `manifest.json` を参照
- Kisaki ツールチェーンパッケージは `devDependencies` に配置し、`.kisx` に同梱する外部ランタイム依存のみを `dependencies` または `optionalDependencies` に保持

## 新機能

- `create-kisaki-extension add` を追加し、生成済みの monorepo に拡張機能を追加可能
- `kisx --project <dir>` を追加し、任意のディレクトリから build、validate、pack、dev を実行可能

## 修正

- 0.x ツールチェーンリリース後に既定のインストールが古いバージョンを解決することがある問題を修正
- npm 公開失敗後も GitHub Release が作成または更新されることがある問題を修正

## 改善

- スキャフォールド構造を改善し、リポジトリ構成とリリース方法の独立した組み合わせに対応
- テンプレートマージプロトコルを改善し、`template.json` で `json.merge` と `text.slot` を宣言
- `kisx pack` のアーカイブ内容を最適化し、`.kisx` に同梱する外部ランタイム依存のみをコピー
- ツールチェーンのロックステップリリースを改善し、バージョン検査、ビルド、出力検証、パッケージ作成、npm publish dry-run 検証を統一
