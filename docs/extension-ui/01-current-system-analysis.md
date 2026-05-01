# 01 Current System Analysis

当前扩展系统已经具备正确的大边界：扩展运行在 shared extension host process，renderer 不导入扩展入口代码，只消费 main 通过 `extension:*` IPC 提供的结构化 DTO。Extension UI 重写应该保留这个安全边界，但彻底替换 settings/entity menus 内部 UI 模型。

## 项目相关边界

扩展公共 API 位于 `packages/extension-api/src/`，SDK 位于 `packages/extension-sdk/src/`。桌面端主进程扩展服务位于 `apps/desktop/src/main/services/extension/`，renderer 扩展 facade 位于 `apps/desktop/src/renderer/src/core/extensions/`，当前扩展 UI 渲染组件位于 `apps/desktop/src/renderer/src/components/shared/extension/`。

当前服务链路如下：

- `ExtensionService` 负责 catalog、install/update、runtime reconcile、IPC 注册和 contribution snapshot emit。
- `RuntimeManager` 管理 shared extension host、handshake、load/unload/reload、crash recovery。
- extension host 内的 `ExtensionHostSdkBridge` 创建 `ExtensionContext`，把 `context.contributes.*` 绑定到 host-side contribution domain。
- main 内的 `ExtensionContributionRegistry` 汇总各贡献点，向 renderer 发送 `extension:contributions-changed`。
- renderer 通过 `@renderer/core/extensions` 访问 IPC，并用 shared extension Vue 组件渲染 settings 和 entity menus。

这些边界是新系统要继承的基础。

## 当前 settings UI

公共契约在 `packages/extension-api/src/contributions/settings/contracts.ts`。它定义了专用 settings node：

- 容器：`section`
- 文本与状态：`text`、`notice`、`status`、`divider`
- 表单控件：`switch`、`checkbox`、`select`、`textInput`、`textarea`、`numberInput`
- 操作：`button`、`dialog`

扩展注册 settings 时需要传入：

- `id`
- `title`
- `rootScreenId`
- `screens: Record<string, SettingsScreen>`

每个 screen 的 `resolve(context, settings)` 返回 `SettingsScreenModel`，可选 `submit(event)` 处理表单提交。host 侧 `HostSettingsContributions` 会把 `onChange`、`onClick` 函数替换成 `callbackId`，保留 callback map，再把 `SettingsResolvedScreenModel` 发送给 main。

renderer 侧 `settings-dialog-stack.vue` 管 settings session 和 frame stack，`settings-dialog-frame.vue` 管表单 draft，`settings-node.vue` 递归渲染每种 node。

### 限制

- UI 能力被固定在 settings 表单场景，无法表达通用布局、复杂列表、表格、tabs、popover、toolbar、empty、progress、image、markdown editor 等组件。
- screen 与 node 是 settings 专属概念，无法被 entity menu 或未来 surface 复用。
- UI 复用只能靠扩展作者写 JS 函数返回数组，缺少标准组件定义、参数 schema、slots 和 mount 语义。
- `submit` 与每个控件的 `onChange` 分属 settings 专有协议，未来其他 UI surface 会继续复制类似逻辑。

## 当前 entity menus UI

公共契约在 `packages/extension-api/src/contributions/entity-menus/contracts.ts`。它定义了菜单专用节点：

- `action`
- `checkbox`
- `select`
- `separator`

扩展注册 entity menu 时传入：

- `id`
- `target`
- `order`
- `resolve(input, menu)`

host 侧 `HostEntityMenuContributions` 在每次 resolve 时创建 session，把 `onClick`、`onChange` 替换成 callbackId。main 侧 `ExtensionEntityMenuContributionHost` 根据 target 聚合各扩展菜单。renderer 侧 `entity-menu-items.vue` 把 DTO 渲染到调用方传入的 dropdown/context menu component set。

### 限制

- 菜单 DSL 与 settings DSL 重复但不能互用。
- 菜单项只支持很窄的交互集合，无法表达 richer menu，例如 group、submenu header、inline status、loading region、danger confirmation、custom row layout。
- registration 必须写 resolver，而不是 mount 一个预定义 UI 并传入 entity input 参数。
- callback refresh 只能返回 `UiCallbackResult.refresh`，无法表达通用 UI patch、局部更新或 surface command。

## 当前 renderer UI 组件库

`apps/desktop/src/renderer/src/components/ui/` 已经有较完整的基础组件：

- 操作与输入：button、button-group、input、input-group、textarea、checkbox、switch、radio-group、select、slider、segmented-control。
- 展示：badge、card、empty、icon、markdown、progress、separator、spinner、table、stats-grid、charts。
- overlay：dialog、alert-dialog、dropdown-menu、context-menu、popover、hover-card、tooltip。
- 结构与高级组件：field、form、collapsible、resizable、tabs、virtual、virtualized-combobox。

组件风格符合桌面软件：高信息密度、语义 token、紧凑控件、弱阴影、边框和背景层表达结构。

### 缺少的 Extension UI 布局层

当前 UI 库有业务可用组件，但没有一组适合公开给 Extension UI 的布局 primitive。新系统需要补齐：

- `Stack`: 垂直/水平基础流布局。
- `Inline`: 单行 wrapping 布局，适合按钮组、状态项。
- `Grid`: 响应式列布局。
- `Split`: 主从区域或 resizable split 的稳定公共封装。
- `ScrollArea`: 统一滚动区域，承接 settings dialog、menu panel、future panel。
- `Panel`、`Section`、`Group`: 用语义 background/border 表达区域，而不是暴露 card 滥用。
- `Toolbar`: 工具条布局，支持 icon button、segmented control、search input。

这些组件应进入 `apps/desktop/src/renderer/src/components/ui/layout/`，同时在 Extension UI registry 中以稳定 schema 暴露。

## 当前设计中值得保留的约束

- renderer 不执行扩展代码。
- IPC/RPC payload 必须可序列化。
- callbacks 保存在 extension host，renderer 只持有 callback/action id。
- main 负责 contribution snapshot，renderer 有轻量 store 接收 `extension:contributions-changed`。
- host/main RPC 已有 timeout、abort signal、runtime cleanup、crash recovery。
- 项目仍在 0.1.0 前，允许破坏性修改，无需兼容旧扩展 UI。

## 重写结论

应该删除 settings/entity menu 两套专用 UI DSL，建立统一 Extension UI core。settings 和 entity menus 只保留 surface metadata 与 surface-specific input，实际 UI 都是同一种 `ExtensionUiDocument`、同一种 action dispatch、同一种 renderer component registry。

删除是最终形态，不是前置实现步骤。实施时应先新增统一 UI contract/runtime/renderer，并保持旧 settings/entity menu 路径短期可编译；待 built-ins、scaffold 和 renderer 调用点全部迁移后，再集中移除旧 DSL、旧 IPC 和旧 renderer 直连组件。
