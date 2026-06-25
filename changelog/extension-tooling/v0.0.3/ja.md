# Kisaki Extension Tooling v0.0.3

## 破壊的変更

- `create-kisaki-extension` はサブコマンド形式になりました。リポジトリ作成には `pnpm create kisaki-extension init <dir>` を使ってください。
- `--publish` を廃止し、`--layout single|monorepo` と `--provider manual|github` でリポジトリ構成とリリース提供元を別々に選びます。
- `kisx validate` は `private: true` を必須とし、拡張バージョンは `manifest.json` のみを正とします。
- Kisaki ツールチェーンパッケージは `devDependencies` に置きます。`dependencies` と `optionalDependencies` は `.kisx` に同梱する外部ランタイム依存のみに使います。

## 新機能

- `create-kisaki-extension add` は生成済みの monorepo に拡張を追加し、リリース提供元を引き継ぎます。
- `kisx --project <dir>` で任意のディレクトリから build、validate、pack、dev を実行できます。

## 改善

- スキャフォールドのレイヤーを再構成し、構成とリリース提供元を直交して組み合わせられるようにしました。テンプレートのマージは明示的な `template.json` プロトコル（`json.merge` / `text.slot`）に移行しました。
- `kisx pack` は外部ランタイム依存のみをコピーし、host 出力にバンドルされる SDK/API パッケージはアーカイブに含めません。
- ロックステップのツールチェーンリリースで、バージョン検査、ビルド、出力検証、パッケージ作成、npm 公開前チェックを一元化しました。

## 修正

- 0.x ツールチェーンリリースで `experimental` と `latest` の dist-tag を同期します。
- GitHub Release は npm 公開の成功後にのみ作成・更新し、公開チャネルのずれを防ぎます。
