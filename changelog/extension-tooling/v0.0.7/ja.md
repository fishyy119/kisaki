# Kisaki Extension Tooling v0.0.7

## ハイライト

- 修正 GitHub provider の公開フローで、GitHub Release 作成前に registry 検証を実行
- 変更 生成 GitHub provider の公開フローを commit message ではなく `<extension-id>-v<semver>` tag ベースに移行
- 必須化 拡張機能ツールチェーンと生成プロジェクトの Node.js 24 以降
- 改善 生成 workspace の Git hooks で、コミット時は staged ファイルのみを修正し、push 前に workspace 全体のチェックを実行

## 破壊的変更

- 必須化 拡張機能ツールチェーンパッケージ、生成プロジェクト、生成 GitHub workflow の Node.js 24 以降
- 変更 生成 GitHub provider の公開 workflow は `publish(<extension-id>): v<semver>` commit message を検出せず、`<extension-id>-v<semver>` tag から公開を開始

## 移行メモ

- 必須化 拡張機能のインストールまたは公開前に、ローカルと CI の Node.js ランタイムを 24 以降へ更新
- GitHub provider を使う生成リポジトリでは、manifest のバージョン更新をコミットして `main` に push した後、`<extension-id>-v<semver>` tag を push。公開失敗後は同じ tag を修正済みコミットへ移動して再 push 可能

## 新機能

- 追加 生成 workspace に、拡張機能署名キーを作成する `key:generate` コマンド

## 修正

- 修正 GitHub provider の公開フローで、registry 更新失敗時に公開 tag が先に残らないよう変更
- 修正 生成 GitHub workflow が registry release に書き込む時刻を UTC ISO 文字列に統一
- 修正 生成 `.gitignore` で拡張機能パッケージ、署名、tarball、一時出力を無視

## 改善

- 改善 生成 Lefthook 設定で、コミット前に staged ファイルへ Prettier と ESLint を順番に実行
- 改善 生成 pre-push hook で、統一された `pnpm check` 品質ゲートを実行
- 改善 生成 workspace のチェックに、ルート ESLint、staged ファイル hook runner、workflow スクリプトの型チェックを追加
- 改善 生成 CI と公開 workflow で、公開前に同じ workspace チェックを実行
- 改善 生成 GitHub provider の公開 workflow で、明示した tag による再実行と tag ソースからのパッケージ構築に対応
