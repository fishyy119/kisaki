# Kisaki Extension Tooling v0.0.4

## 破坏性变更

- 调整 `kisx.config.ts`，Node 主机目标配置由 `entry` 改为 `host`
- 调整扩展 registry 包描述为本地化 `description`，不再使用 `summary`
- 调整 release 元数据，`changelog.text` 和 `changelog.url` 改为本地化 `changelog` 与 `releasePage`
- 调整 `yanked` 为包含时间与原因的对象
- 移除脚手架 `--layout` 和 `--package-name`，生成仓库统一为 workspace 结构，包名由稳定 ID 派生

## 迁移说明

- 调整旧 `kisx.config.ts`，将 `entry` 配置改名为 `host`
- 更新 registry manifest 的描述、changelog 与 yanked 字段结构后再发布或校验

## 新功能

- 新增 registry 本地化描述与 release changelog 支持
- 新增 `kisx registry add-release --changelogs <dir> --default-locale <locale>`
- 新增 `kisx registry yank` 和 `kisx registry unyank`，支持撤回或恢复已发布版本
- 新增脚手架 `--webview-addon`，支持在 webview 框架上叠加 `kisaki-ui-vue`

## 改进

- 改进 `create-kisaki-extension` 交互流程，在已生成 workspace 中默认追加扩展
- 改进脚手架元数据流，registry、workspace 与 extension 字段更清晰
- 改进 `kisx dev` 的 webview 开发服务，使开发与打包 webview 共享同一安全边界并保留 HMR
- 改进 GitHub 发布模板，自动验证产物、创建 tag 和 release，并更新 registry manifest
