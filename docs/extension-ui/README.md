# Extension UI 重写方案

本文档集定义 Kisaki 扩展 UI 系统的彻底重写方案。目标是把当前分散在 settings 和 entity menus 中的专用 UI DSL 重构为统一的 Extension UI 平台。Extension UI 本质上仍是结构化、跨进程渲染的 UI，renderer 侧落点沿用现有 shared extension 组件边界。

## 文档结构

- [01-current-system-analysis.md](01-current-system-analysis.md): 当前扩展 UI、runtime、IPC、renderer 与 UI 组件库分析。
- [02-target-architecture.md](02-target-architecture.md): 目标架构、边界、模块职责、生命周期和设计原则。
- [03-public-api-and-schema.md](03-public-api-and-schema.md): 扩展作者 API、Extension UI schema、组件目录、参数传递和组合模型。
- [04-runtime-protocol-and-host.md](04-runtime-protocol-and-host.md): extension host、main、renderer 之间的 Extension UI 协议与会话模型。
- [05-renderer-and-components.md](05-renderer-and-components.md): renderer 渲染引擎、UI component registry、布局组件补齐与 surface adapter。
- [06-contribution-integration.md](06-contribution-integration.md): settings、entity menus 如何注册和消费预写 UI，以及旧系统删除范围。
- [07-implementation-phases.md](07-implementation-phases.md): 可独立验收的分阶段实施计划、测试和风险控制。

## 最终形态

扩展 UI 将只有一套公共模型：

- `@kisaki/extension-api` 定义纯类型、schema、验证器、RPC contract。
- `@kisaki/extension-sdk` 暴露 `ui` builder、组件定义、参数化 mount、action 绑定。
- SDK authoring tree 和 renderer document 明确分层：扩展作者可以写函数、组件引用和 action handler，但 renderer 永远只收到 normalized DTO。
- extension host 执行扩展 UI render 和 action callback，但只把序列化后的 Extension UI document 发给 main。
- main 只保存贡献点元数据、管理会话、转发 IPC/RPC，不执行扩展代码。
- renderer 只根据 Extension UI document 渲染白名单组件，并把事件 dispatch 回 main。

## 关键决策

- 不保留旧 settings/entity menu UI DSL。`SettingsNode`、`EntityMenuNode`、两套 builder、两套会话协议在重写完成后删除。
- 旧系统删除必须发生在内置扩展和 scaffold 完成迁移之后；实现阶段可以短期并行，但最终不能长期双轨。
- Extension UI 不是把 Vue 暴露给扩展。扩展写 TypeScript builder，renderer 永远只接收结构化 DTO。
- 复杂 UI 通过组件组合、children、slots、参数化 mount、layout primitives、surface adapters 实现，而不是开放 arbitrary HTML/CSS。
- settings 和 entity menus 变成 Extension UI 的两个 surface。后续详情页面板、向导、状态页、扩展命令面板可以复用同一套协议。
- 组件 API 命名参考 `apps/desktop/src/renderer/src/components/ui/`，但 Extension UI props 是稳定的公共契约，不直接泄露 Vue/Reka/Tailwind 内部类型。
- 第一版按最小端到端闭环收窄组件集，优先覆盖 settings dialog、entity menu content、action dispatch、dialog outlet 和受限节点级 patch；复杂 table、popover、完整 menu overlay 等能力后续追加。
- main 维护 active UI session owner table；renderer dispatch 不自报 runtime owner，也不回传 `surfaceInput`。
- 第一版表单控件同时支持非受控 `defaultValue` 和受控 `value`；节点级 patch 作为基础 document update 协议一并定稿；复杂数据视图留到后续阶段。
- icon 使用 Kisaki 公共 icon id 或构建期 safelist，不接受扩展运行时传入任意 Tailwind/Iconify class。

## 建议落点

```text
packages/extension-api/src/ui/
packages/extension-sdk/src/ui/
apps/desktop/src/main/services/extension/ui/
apps/desktop/src/main/services/extension/runtime/host/ui/
apps/desktop/src/renderer/src/core/extensions/ui/
apps/desktop/src/renderer/src/components/shared/extension/
apps/desktop/src/renderer/src/components/ui/layout/
```

这套结构把公共 contract、SDK 语法、host 执行、main 会话转发、renderer 渲染和基础 UI 组件分开，符合当前 monorepo 的主进程、renderer、shared、extension-api 边界。
