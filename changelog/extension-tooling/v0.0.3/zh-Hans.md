# Kisaki Extension Tooling v0.0.3

## 破坏性变更

- 调整 `create-kisaki-extension` 为子命令形式，创建仓库需使用 `pnpm create kisaki-extension init <dir>`
- 移除 `--publish`，改用 `--layout single|monorepo` 和 `--provider manual|github` 分别选择仓库布局与发布方式
- 要求扩展包声明 `private: true`，扩展版本以 `manifest.json` 为准
- 要求 Kisaki 工具链包放入 `devDependencies`，随 `.kisx` 发布的外部运行时依赖保留在 `dependencies` 或 `optionalDependencies`

## 新功能

- 新增 `create-kisaki-extension add`，可向已生成的多扩展仓库追加扩展
- 新增 `kisx --project <dir>`，支持从任意目录运行 build、validate、pack 和 dev

## 修复

- 修复 0.x 工具链发布时 `experimental` 与 `latest` dist-tag 不一致的问题
- 修复 npm 发布失败后仍可能创建或更新 GitHub Release 的问题

## 改进

- 改进脚手架结构，支持独立组合仓库布局与发布方式
- 改进模板合并协议，使用 `template.json` 声明 `json.merge` 和 `text.slot`
- 优化 `kisx pack` 归档内容，仅复制需要随 `.kisx` 发布的外部运行时依赖
- 改进工具链锁步发布流程，统一版本检查、构建、产物校验、打包与 npm 发布预检
