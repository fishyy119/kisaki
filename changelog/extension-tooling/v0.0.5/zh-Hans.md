# Kisaki Extension Tooling v0.0.5

## 破坏性变更

- 调整脚手架 `init`，只创建扩展 workspace 与 registry
- 调整脚手架 `add`，扩展 ID 改为位置参数并移除 `--extension-id`
- 调整脚手架 workspace 配置，`provider` 改为 `publishProvider`

## 迁移说明

- 要求先运行 `pnpm create kisaki-extension init` 创建 workspace，再进入目录运行 `pnpm create kisaki-extension add <extension-id>`
- 要求将 `kisaki-extension-workspace.json` 中的 `provider` 改为 `publishProvider`

## 改进

- 改进脚手架无子命令用法，在有效 workspace 内默认进入 `add`
- 改进脚手架无效 workspace 报错，配置错误时不再回退到 `init`
- 改进脚手架交互分组，区分 workspace、registry 与 extension 信息
