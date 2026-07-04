# Kisaki Extension Tooling v0.0.7

## ハイライト

- 修正 GitHub provider の公開フローで、GitHub Release 作成前に registry 検証を実行
- 必須化 拡張機能ツールチェーンと生成プロジェクトの Node.js 24 以降
- 改善 生成 workspace の Git hooks で、コミット時は staged ファイルのみを修正し、push 前に workspace 全体のチェックを実行

## 破壊的変更

- 必須化 拡張機能ツールチェーンパッケージ、生成プロジェクト、生成 GitHub workflow の Node.js 24 以降

## 移行メモ

- 必須化 拡張機能のインストールまたは公開前に、ローカルと CI の Node.js ランタイムを 24 以降へ更新

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
