# Kisaki Extension Tooling v0.0.10

## 破壊的変更

- 必須化 `kisx registry add-release --changelogs` の各 `<locale>.md` file で、先頭 front matter の `summary` field に summary を宣言
- 変更 GitHub publish scaffold が `extensions/<extension-id>/changelogs/v<version>` を読み取り、prefix なしの version directory を使用しないように変更

## 移行メモ

- 必須化 0.0.9 scaffold で生成した repository の extension changelog directory を `changelogs/<version>` から `changelogs/v<version>` へ移行
- 必須化 既存の extension changelog file で、先頭行の summary を `summary: ...` 形式の top front matter へ移行

## 改善

- 改善 scaffolded publishing docs が v prefix 付き changelog path と summary front matter format を表示
- 改善 `kisx registry add-release --help` と README が summary front matter requirement を説明
