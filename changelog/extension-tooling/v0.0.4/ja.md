# Kisaki Extension Tooling v0.0.4

## 破壊的変更

- 変更 `kisx.config.ts`、Node ホスト対象の設定を `entry` ではなく `host` で指定
- 変更 registry のパッケージ説明をローカライズされた `description` ドキュメントにし、`summary` を置換
- 変更 release メタデータを `changelog.text` と `changelog.url` からローカライズされた `changelog` と `releasePage` に移行
- 変更 `yanked` を取り下げ時刻と任意の理由を持つオブジェクトに移行
- 削除 スキャフォールドの `--layout` と `--package-name`、生成リポジトリを単一の workspace 形式に統一して安定 ID からパッケージ名を生成

## 移行メモ

- 変更 既存の `kisx.config.ts`、`entry` を `host` に改名
- 必須化 公開または検証前の registry manifest description、changelog、yanked フィールド構造更新

## 新機能

- 対応 registry のローカライズ説明と release changelog
- 追加 `kisx registry add-release --changelogs <dir> --default-locale <locale>`
- 追加 公開済みリリースを取り下げまたは復元する `kisx registry yank` と `kisx registry unyank`
- 対応 webview フレームワークに `kisaki-ui-vue` を重ねるスキャフォールド `--webview-addon`

## 改善

- 改善 `create-kisaki-extension` のプロンプト、生成済み workspace 内では既定で拡張機能を追加
- 改善 registry、workspace、extension の各フィールドにわたるスキャフォールドのメタデータフロー
- 改善 `kisx dev` の webview 配信、開発時とパッケージ済み webview が同じセキュリティ境界を共有しつつ HMR を維持
- 改善 GitHub 公開テンプレート、成果物検証、tag と release の作成、registry manifest 更新を自動化
