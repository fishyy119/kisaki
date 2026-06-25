# Kisaki Extension Tooling v0.0.3

## 破坏性变更

- `create-kisaki-extension` 改为子命令形式，创建仓库用 `pnpm create kisaki-extension init <dir>`。
- 移除 `--publish`，改用 `--layout single|monorepo` 与 `--provider manual|github` 分别选择仓库布局和发布提供者。
- `kisx validate` 要求扩展包声明 `private: true`，扩展版本仅以 `manifest.json` 为准。
- Kisaki 工具链包放入 `devDependencies`；`dependencies` 与 `optionalDependencies` 仅保留需随 `.kisx` 发布的外部运行时依赖。

## 新功能

- `create-kisaki-extension add`：向生成的多扩展仓库追加扩展，沿用其发布提供者。
- `kisx --project <dir>`：从任意目录运行 build、validate、pack、dev。

## 改进

- 脚手架分层重做，布局与发布提供者正交组合；模板合并改为显式 `template.json` 协议（`json.merge` / `text.slot`）。
- `kisx pack` 仅复制外部运行时依赖，已打入主机 bundle 的 SDK/API 不再进入归档。
- 工具链锁步发布统一版本检查、构建、产物校验、打包与 npm 发布预检。

## 修复

- 0.x 工具链发布同步 `experimental` 与 `latest` dist-tag。
- GitHub Release 仅在 npm 发布成功后创建或更新，避免渠道状态不一致。
