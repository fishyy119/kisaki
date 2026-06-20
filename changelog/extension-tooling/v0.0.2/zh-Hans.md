# Kisaki Extension Tooling v0.0.2

## 新功能

- 新增 Webview 扩展界面，支持对话框、页面、外观同步、类型化 RPC 和开发时 HMR。
- 新增 `@kisaki3/extension-ui-vue`，提供符合 Kisaki 设计规范的 Vue 组件和语义样式。
- 新增扩展任务运行 API，支持阶段与工作进度、受限结果摘要和 `cancelOwn`。
- 新增库图谱导入 API，用于批量导入实体、关系和来源数据。
- 升级脚手架与 `kisx`，支持多种 UI 技术栈、发布模式及主机/UI 分层构建。

## 破坏性变更

- 移除 `settingsPanels`；设置和交互界面应通过 `cardActions` 打开 Webview。
- 扩展边界改用 `JsonValue`、`JsonObject` 和严格的 wire-safe RPC 值，并移除 `Serializable*`。
- 将 `backgroundTasks` 重命名为 `automations`，将 `ExtensionTaskRun*` 重命名为 `TaskRun*`。
- 要求清单中的 `entry` 和 `ui` 路径以 `./` 开头，并采用新的主机/UI 输出布局。
- 调整抓取器提供者和抓取结果标识契约，使其按媒体类型划分作用域。

## 改进

- 强化主机、UI 和共享代码边界，并完善生成项目的开发配置。
- 稳定开发扩展的重新加载与输出监听。
- 统一管理工具链包、构建顺序、必需输出和锁步版本。
