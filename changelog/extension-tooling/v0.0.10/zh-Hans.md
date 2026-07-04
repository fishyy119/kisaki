# Kisaki Extension Tooling v0.0.10

## 破坏性变更

- 调整 `kisx registry add-release --changelogs`，要求每个 `<locale>.md` 通过顶部 front matter 的 `summary` 字段声明摘要
- 调整 GitHub 发布脚手架，读取 `extensions/<extension-id>/changelogs/v<version>` 而不是无前缀版本目录

## 迁移说明

- 要求 0.0.9 脚手架生成的仓库将扩展 changelog 目录从 `changelogs/<version>` 迁移到 `changelogs/v<version>`
- 要求已有扩展 changelog 文件将首行摘要迁移到顶部 front matter，例如 `summary: ...`

## 改进

- 改进脚手架生成的发布说明，同步展示 v 前缀 changelog 路径和 front matter 摘要格式
- 改进 `kisx registry add-release --help` 和 README，说明 changelog 文件需要 summary front matter
