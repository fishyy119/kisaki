# Kisaki Extension Tooling v0.0.4

## 破壊的変更

- `kisx.config.ts` を変更し、Node ホスト対象の設定を `entry` ではなく `host` で指定するよう変更
- registry のパッケージ説明をローカライズされた `description` ドキュメントに変更し、`summary` を置換
- release メタデータを `changelog.text` と `changelog.url` からローカライズされた `changelog` と `releasePage` に変更
- `yanked` を取り下げ時刻と任意の理由を持つオブジェクトに変更
- スキャフォールドの `--layout` と `--package-name` を削除し、生成リポジトリを単一の workspace 形式に統一して安定 ID からパッケージ名を生成

## 移行メモ

- 既存の `kisx.config.ts` を変更し、`entry` を `host` に改名
- 公開または検証の前に、registry manifest の description、changelog、yanked フィールド構造を更新

## 新機能

- registry のローカライズ説明と release changelog に対応
- `kisx registry add-release --changelogs <dir> --default-locale <locale>` を追加
- 公開済みリリースを取り下げまたは復元する `kisx registry yank` と `kisx registry unyank` を追加
- webview フレームワークに `kisaki-ui-vue` を重ねるスキャフォールド `--webview-addon` に対応

## 改善

- `create-kisaki-extension` のプロンプトを改善し、生成済み workspace 内では既定で拡張機能を追加
- registry、workspace、extension の各フィールドにわたるスキャフォールドのメタデータフローを改善
- `kisx dev` の webview 配信を改善し、開発時とパッケージ済み webview が同じセキュリティ境界を共有しつつ HMR を維持
- GitHub 公開テンプレートを改善し、成果物検証、tag と release の作成、registry manifest 更新を自動化
