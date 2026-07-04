# Kisaki Extension Tooling v0.0.9

## 破壊的変更

- 変更 `createExtensionRegistryManifest` が remote registry schema URL を既定で書き込まないようにし、editor hint が必要な場合は呼び出し側で `$schema` を渡す方式に変更

## 移行メモ

- 必須化 既存の registry repository で `registry/manifest.json` の `$schema` をローカルの `@kisaki3/extension-registry` package schema に更新し、対応する `@kisaki3/extension-registry` version を導入

## 改善

- 改善 `kisx registry init` が manifest path からの相対パスでローカル registry schema reference を既定生成
- 改善 scaffolded workspace が `@kisaki3/extension-registry` を導入し、registry manifest にローカル package schema reference を書き込み
- 改善 extension と registry の schema metadata で、packaged schema が remote canonical URL を宣言しないように変更
