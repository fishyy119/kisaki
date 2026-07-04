# Kisaki Extension Tooling v0.0.7

## 重点

- 修复 GitHub provider 发布流程，先完成 registry 校验再创建 GitHub Release
- 将生成的 GitHub provider 发布流程改为基于 `<extension-id>-v<semver>` tag，不再依赖提交信息
- 要求扩展工具链和生成项目使用 Node.js 24 或更高版本
- 改进生成 workspace 的 Git hooks，提交时只修复暂存文件，推送前运行完整 workspace 检查

## 破坏性变更

- 要求扩展工具链包、脚手架生成项目和生成的 GitHub workflow 使用 Node.js 24 或更高版本
- 生成的 GitHub provider 发布 workflow 不再识别 `publish(<extension-id>): v<semver>` 提交信息，发布入口改为 `<extension-id>-v<semver>` tag

## 迁移说明

- 要求在安装或发布扩展前，将本地和 CI 的 Node.js 运行时更新到 24 或更高版本
- 使用 GitHub provider 的生成仓库发布扩展时，先提交 manifest 版本更新并推送 `main`，再推送 `<extension-id>-v<semver>` tag；发布失败后可以将同名 tag 移到修复后的提交并重新推送

## 新功能

- 新增生成 workspace 的 `key:generate` 命令，用于创建扩展签名密钥

## 修复

- 修复 GitHub provider 发布流程，registry 更新失败时不再提前留下发布 tag
- 修复生成的 GitHub workflow 写入 registry release 时使用非 UTC 时间戳的问题
- 修复生成的 `.gitignore`，忽略扩展包、签名、tarball 和临时输出

## 改进

- 改进生成的 Lefthook 配置，提交前按顺序对暂存文件运行 Prettier 和 ESLint
- 改进生成的 pre-push hook，统一运行 `pnpm check` 质量门
- 改进生成 workspace 的检查流程，加入根目录 ESLint、暂存文件 hook runner 和 workflow 脚本类型检查
- 改进生成的 CI 和发布 workflow，在发布前运行一致的 workspace 检查
- 改进生成的 GitHub provider 发布 workflow，支持手动指定发布 tag 重新运行，并在 tag 源码上构建扩展包
