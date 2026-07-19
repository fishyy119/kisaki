# Kisaki Extension Tooling v0.0.11

## 破坏性变更

- 调整扩展工具链所有包为仅 ESM 构建，不再发布 CommonJS 产物
- 要求扩展入口文件使用 `.mjs`，清单不再接受 `.cjs` 入口
- 调整注册表清单，包描述改为纯文本 `summary` 与可选 `description`，发行版 changelog 改为 `text` / `url` 字段，并移除 `releasePage` 与本地化文档集
- 调整 `kisx registry add-release`，新增 `--changelog <text>` 与 `--changelog-url <url>`，移除 `--release-page`、`--changelogs` 和 `--default-locale`
- 移除 webview 主题令牌 `card` 与 `cardForeground` 及其 SDK CSS 变量

## 迁移说明

- 要求使用 `.cjs` 入口的扩展迁移到 `.mjs`，并以 ESM 方式导入工具链包
- 要求现有注册表清单将本地化描述与 changelog 迁移为纯文本 `summary` / `description` 与 `changelog.text` / `changelog.url`
- 要求旧脚手架生成的发布流程改用 `--changelog` / `--changelog-url` 传递发行说明，不再维护 `<locale>.md` changelog 目录
- 要求 webview UI 将 `bg-card` 等 card 令牌替换为 `bg-surface`、`bg-input` 等现有令牌

## 改进

- 改进 `kisx pack` 打包实现，生成可逐字节复现的 `.kisx` 归档
- 改进扩展 UI 组件的视觉一致性，包括复选框、开关、标签页与字段分隔符
- 改进脚手架模板，升级到 ESLint 10、TypeScript 6.0 等最新工具链，并统一 lint 缓存配置
