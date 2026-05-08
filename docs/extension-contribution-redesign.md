# Extension Settings 与 Menus 贡献点重构设计

本文定义扩展 `settings` 与 `menus` 贡献点的新架构。新设计不兼容旧的
`settingsPanels`、settings screen/frame stack、`entityMenus` 和渲染进程扩展总出口。
重构目标是让公共 API、跨进程 DTO、host 会话和渲染进程消费都围绕同一套类型事实源展开。

## 目标

- `settings` 使用统一 field/node 核心；root、dialog、popover 只通过 surface 能力收窄行为。
- 所有可渲染单元统一使用 `Node` 后缀；control/action/display 是联合分类，不进入具体类型名。
- 扩展作者不能注册旧式 screen/section/dialog node，也不能手写 menu target 字符串。
- `settings` root 支持直接 `fields` 或 `tabs`；分类只用 tabs。
- `settings` dialog 只表示一层任务对话框，不作为分类导航。
- `settings` popover 只表示锚定到 button node 的轻量临时 surface。
- `menus` 使用 `context.contributions.menus.game.single` 这类 domain/scope 入口注册。
- 渲染进程不执行扩展代码，只渲染 main 提供的结构化 DTO。
- 渲染进程 settings/menus 不再通过纯中转 wrapper 或总出口导入类型和 IPC helper。

## 非目标

- 不保留旧 API 别名。
- 不保留旧 settings frame stack。
- 不支持扩展提供任意渲染进程组件。
- 不把 popover 设计成小型 dialog 或第三层导航。
- 不在本次重构中重做扩展 catalog、install、update、theme sync 等无关能力。

## 命名规则

命名规则是本次重构的类型边界，所有新增类型必须遵守。

| 后缀                                       | 含义                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------- |
| `Contribution`                             | 扩展作者注册到贡献点的完整贡献对象，例如 `SettingsContribution`、`MenuContribution<TInput>` |
| `Definition`                               | 扩展作者注册的定义，例如 `SettingsDialogDefinition`                                         |
| `Model`                                    | 扩展 `resolve` 返回的公共结构，例如 `SettingsRootModel`                                     |
| `Node`                                     | 可渲染 DTO 单元，例如 `SettingsTextInputNode`、`MenuActionNode`                             |
| `Field` / `Tab`                            | Settings 布局结构，不属于 node                                                              |
| `Event`                                    | callback / submit 的入参                                                                    |
| `Result`                                   | callback / submit 的出参                                                                    |
| `Factory`                                  | 只补全 `kind` 并保持推导，不保存状态                                                        |
| `ExtensionResolved*`                       | main 提供给渲染进程的归一化 DTO                                                             |
| `Extension*Request` / `Extension*Response` | 渲染进程 IPC 请求与响应                                                                     |

统一规则：

- 可渲染单元一律叫 `Node`，不使用 `Control` 作为具体类型后缀。
- `ControlNode`、`ActionNode`、`DisplayNode` 只作为 union 分类名。
- 输入文本叫 `SettingsTextInputNode`，`kind: 'textInput'`。
- 只读文本叫 `SettingsTextNode`，`kind: 'text'`。
- 数字输入叫 `SettingsNumberInputNode`，`kind: 'numberInput'`。
- `settings` button 与 menu action 都使用 `label`，不使用 `text` 表示按钮文案。
- `TaskDialog` 只作为文档术语，公共类型名使用 `SettingsDialogDefinition`。
- `settings` 泛型顺序统一为 `<TPopovers, TDialogs>`，因为 dialogs 依赖 popovers。
- `menus` 中 `Input` 只表示 `resolve(input, menu)` 的入参；domain/scope 选择后的 `register()` 参数类型由 `MenuContribution<TInput>` 泛型表达，不为每个 domain/scope 手写 `Contribution` 后缀别名。

## 架构分层

```text
packages/extension-api
  公共定义、模型、节点、事件、结果与校验

extension host 进程
  执行扩展回调，并把回调归一化为 callbackId

main 进程
  持有贡献点注册表、session、IPC handler 和渲染进程 refresh event

apps/desktop/src/shared
  ExtensionResolved* DTO 与 Extension*Request/Response 传输契约

renderer 进程
  渲染 DTO，持有本地 draft/session UI 状态，并通过 ipcManager 直接调用 IPC
```

公共 API 与 resolved DTO 使用同一套 field/node 结构思想：公共 API 节点携带回调函数，resolved DTO 节点携带 `callbackId` 与审计元数据。不要为 root/dialog/popover 或 public/resolved 手写三套结构。

## Settings 概念

- `root`：settings 根 surface。可以是直接 `fields`，也可以是 `tabs`。
- `dialog`：root 内打开的一层任务对话框。只能从 root button callback 打开。
- `popover`：锚定到 button node 的临时 surface。没有 submit/footer。
- `field`：settings 唯一布局单元，承载 label、description 和 content nodes。
- `node`：field content 内的扁平可渲染单元，不递归。
- `draft`：renderer 当前 surface 的临时值快照。事实源仍是扩展 storage/secrets/service。

Settings surface 能力矩阵：

| 能力          | root           | dialog    | popover |
| ------------- | -------------- | --------- | ------- |
| fields        | 支持           | 支持      | 支持    |
| tabs          | 支持           | 不支持    | 不支持  |
| submit        | 支持           | 支持      | 不支持  |
| open dialog   | 仅 root button | 不支持    | 不支持  |
| open popover  | 仅 button      | 仅 button | 不支持  |
| close root    | 支持           | 不支持    | 不支持  |
| close dialog  | 不支持         | 支持      | 不支持  |
| close popover | 支持           | 支持      | 支持    |

## Settings 公共 API

### 基础类型

```ts
export type MaybePromise<T> = T | Promise<T>

export interface SettingsSuccessOptions<
  TRefresh extends SettingsRefreshTarget = SettingsRefreshTarget
> {
  message?: string
  refresh?: TRefresh
  closePopover?: boolean
}

export interface SettingsFailureOptions<
  TRefresh extends SettingsRefreshTarget = SettingsRefreshTarget
> {
  refresh?: TRefresh
  closePopover?: boolean
}

export interface SettingsOpenOptions {
  message?: string
  closePopover?: boolean
}

export interface SettingsCloseOptions {
  message?: string
}

export interface SettingsClosePopoverOptions extends SettingsCloseOptions {
  closePopover?: boolean
}
```

### 注册

```ts
export interface SettingsRegistration extends Disposable {
  refresh(reason?: SettingsRefreshReason): Promise<void>
}

export interface SettingsRegistrar {
  register<
    const TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap,
    const TDialogs extends SettingsDialogMap<TPopovers> = EmptySettingsDialogMap
  >(
    contribution: SettingsContribution<TPopovers, TDialogs>
  ): SettingsRegistration
}

export function defineSettingsContribution<
  const TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap,
  const TDialogs extends SettingsDialogMap<TPopovers> = EmptySettingsDialogMap
>(
  contribution: SettingsContribution<TPopovers, TDialogs>
): SettingsContribution<TPopovers, TDialogs>

export interface SettingsRefreshReason {
  reason?: string
  params?: SerializableRecord
}
```

`defineSettingsContribution()` 是唯一正式公共 helper。它不包装运行时行为，只稳定完整 contribution 上下文的 const generic 推导，让 `openDialog()` 和 `openPopover()` 能拿到精确 key。Dialog 与 popover definition 不提供独立 helper，因为它们脱离完整 settings 注册上下文后无法保持一致的 id 推导语义。

### Maps 与 ID 推导

```ts
export type SettingsPopoverMap = Record<string, SettingsPopoverDefinition>
export type EmptySettingsPopoverMap = Record<never, never>

export type SettingsDialogMap<TPopovers extends SettingsPopoverMap = SettingsPopoverMap> = Record<
  string,
  SettingsDialogDefinition<SerializableRecord, TPopovers>
>

export type EmptySettingsDialogMap = Record<never, never>

export type SettingsPopoverId<TPopovers extends SettingsPopoverMap> = Extract<
  keyof TPopovers,
  string
>

export type SettingsDialogId<TDialogs extends SettingsDialogMap> = Extract<keyof TDialogs, string>

export type SettingsPopoverParams<TPopover> =
  TPopover extends SettingsPopoverDefinition<infer TParams> ? TParams : SerializableRecord

export type SettingsDialogParams<TDialog> =
  TDialog extends SettingsDialogDefinition<infer TParams, infer _TPopovers>
    ? TParams
    : SerializableRecord
```

### Contribution / Definition

```ts
export interface SettingsContribution<
  TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers> = EmptySettingsDialogMap
> {
  id: string
  title: string
  description?: string
  order?: number
  popovers?: TPopovers
  dialogs?: TDialogs
  resolve(
    context: SettingsRootResolveContext,
    settings: SettingsNodeFactory<SettingsRootNodeEvents<TPopovers, TDialogs>>
  ): MaybePromise<SettingsRootModel<TPopovers, TDialogs>>
  submit?(event: SettingsRootSubmitEvent): MaybePromise<SettingsRootSubmitResult>
}

export interface SettingsDialogDefinition<
  TParams extends SerializableRecord = SerializableRecord,
  TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap
> {
  title?: string
  size?: SettingsDialogSize
  resolve(
    context: SettingsDialogResolveContext<TParams>,
    settings: SettingsNodeFactory<SettingsDialogNodeEvents<TParams, TPopovers>>
  ): MaybePromise<SettingsDialogModel<TParams, TPopovers>>
  submit?(event: SettingsDialogSubmitEvent<TParams>): MaybePromise<SettingsDialogSubmitResult>
}

export interface SettingsPopoverDefinition<
  TParams extends SerializableRecord = SerializableRecord
> {
  title?: string
  width?: SettingsPopoverWidth
  resolve(
    context: SettingsPopoverResolveContext<TParams>,
    settings: SettingsNodeFactory<SettingsPopoverNodeEvents<TParams>>
  ): MaybePromise<SettingsPopoverModel<TParams>>
}
```

## Settings 统一 Field/Node 核心

Settings 只有一套 field/node 核心。Root、dialog、popover 的差异由 `SettingsNodeEvents` 带入。

```ts
export interface SettingsNodeEvents<TCommitEvent, TCommitResult, TButtonEvent, TButtonResult> {
  commitEvent: TCommitEvent
  commitResult: TCommitResult
  buttonEvent: TButtonEvent
  buttonResult: TButtonResult
}

export interface SettingsField<TEvents extends SettingsAnyNodeEvents> {
  id: string
  label?: string
  description?: string
  hidden?: boolean
  disabled?: boolean
  orientation?: 'vertical' | 'horizontal' | 'responsive'
  span?: 1 | 2 | 3 | 'full'
  contentLayout?: 'stack' | 'inline' | 'grid'
  contentColumns?: 1 | 2 | 3
  content: readonly SettingsFieldContentNode<TEvents>[]
}

export interface SettingsTab<TEvents extends SettingsAnyNodeEvents> {
  id: string
  label: string
  description?: string
  icon?: string
  fields: readonly SettingsField<TEvents>[]
}
```

节点基础类型：

```ts
export interface SettingsNodeBase {
  id: string
  hidden?: boolean
  disabled?: boolean
  grow?: boolean
  width?: SettingsNodeWidth
}

export interface SettingsValueNodeBase<
  TValue,
  TCommitEvent,
  TCommitResult
> extends SettingsNodeBase {
  initialValue: TValue
  onCommit?: (event: TCommitEvent) => MaybePromise<TCommitResult>
}
```

控制节点：

```ts
export interface SettingsSwitchNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  boolean,
  TCommitEvent,
  TCommitResult
> {
  kind: 'switch'
}

export interface SettingsCheckboxNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  boolean,
  TCommitEvent,
  TCommitResult
> {
  kind: 'checkbox'
}

export interface SettingsSelectNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  string,
  TCommitEvent,
  TCommitResult
> {
  kind: 'select'
  placeholder?: string
  options: readonly SettingsSelectOption[]
}

export interface SettingsMultiSelectNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  readonly string[],
  TCommitEvent,
  TCommitResult
> {
  kind: 'multiSelect'
  options: readonly SettingsSelectOption[]
}

export interface SettingsTextInputNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  string,
  TCommitEvent,
  TCommitResult
> {
  kind: 'textInput'
  placeholder?: string
  inputMode?: 'text' | 'email' | 'url' | 'search' | 'tel' | 'password'
}

export interface SettingsTextareaNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  string,
  TCommitEvent,
  TCommitResult
> {
  kind: 'textarea'
  placeholder?: string
  rows?: number
}

export interface SettingsNumberInputNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  number,
  TCommitEvent,
  TCommitResult
> {
  kind: 'numberInput'
  placeholder?: string
  min?: number
  max?: number
  step?: number
}

export interface SettingsStringListNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  readonly string[],
  TCommitEvent,
  TCommitResult
> {
  kind: 'stringList'
  addPlaceholder?: string
  itemPlaceholder?: string
}

export interface SettingsRecordListNode<TCommitEvent, TCommitResult> extends SettingsValueNodeBase<
  readonly SerializableRecord[],
  TCommitEvent,
  TCommitResult
> {
  kind: 'recordList'
  columns: readonly SettingsRecordListColumn[]
  addLabel?: string
  emptyLabel?: string
}
```

动作节点与展示节点：

```ts
export interface SettingsButtonNode<TButtonEvent, TButtonResult> extends SettingsNodeBase {
  kind: 'button'
  label: string
  icon?: string
  tone?: 'default' | 'primary' | 'danger'
  onClick?: (event: TButtonEvent) => MaybePromise<TButtonResult>
}

export interface SettingsTextNode extends SettingsNodeBase {
  kind: 'text'
  text: string
  tone?: 'default' | 'muted' | 'danger'
}

export interface SettingsNoticeNode extends SettingsNodeBase {
  kind: 'notice'
  tone: 'info' | 'warning' | 'error' | 'success'
  text: string
}

export interface SettingsStatusNode extends SettingsNodeBase {
  kind: 'status'
  tone?: 'neutral' | 'success' | 'warning' | 'danger'
  label?: string
  value: string
}

export interface SettingsTableNode extends SettingsNodeBase {
  kind: 'table'
  title?: string
  columns?: readonly SettingsTableColumn[]
  rows: readonly SerializableRecord[]
  emptyLabel?: string
}

export interface SettingsImageNode extends SettingsNodeBase {
  kind: 'image'
  src: string
  alt?: string
  fit?: 'contain' | 'cover'
}

export interface SettingsDividerNode extends SettingsNodeBase {
  kind: 'divider'
}
```

节点 union：

```ts
export type SettingsControlNode<TEvents extends SettingsAnyNodeEvents> =
  | SettingsSwitchNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsCheckboxNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsMultiSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsTextInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsTextareaNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsNumberInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsStringListNode<TEvents['commitEvent'], TEvents['commitResult']>
  | SettingsRecordListNode<TEvents['commitEvent'], TEvents['commitResult']>

export type SettingsActionNode<TEvents extends SettingsAnyNodeEvents> = SettingsButtonNode<
  TEvents['buttonEvent'],
  TEvents['buttonResult']
>

export type SettingsDisplayNode =
  | SettingsTextNode
  | SettingsNoticeNode
  | SettingsStatusNode
  | SettingsTableNode
  | SettingsImageNode
  | SettingsDividerNode

export type SettingsFieldContentNode<TEvents extends SettingsAnyNodeEvents> =
  | SettingsControlNode<TEvents>
  | SettingsActionNode<TEvents>
  | SettingsDisplayNode
```

辅助类型：

```ts
export type SettingsAnyNodeEvents = SettingsNodeEvents<unknown, unknown, unknown, unknown>
export type SettingsDialogSize = 'sm' | 'md' | 'lg' | 'xl'
export type SettingsPopoverWidth = 'sm' | 'md' | 'lg'
export type SettingsNodeWidth = 'auto' | 'sm' | 'md' | 'lg' | 'full'

export interface SettingsSelectOption {
  value: string
  label: string
  description?: string
  disabled?: boolean
}

export interface SettingsTableColumn {
  key: string
  label: string
  kind?: 'text' | 'number' | 'boolean' | 'badge'
}

export interface SettingsRecordListColumn {
  key: string
  label: string
  kind?: 'text' | 'select' | 'number' | 'boolean'
  options?: readonly SettingsSelectOption[]
}
```

## Settings 模型

```ts
export type SettingsRootNodeEvents<
  TPopovers extends SettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers>
> = SettingsNodeEvents<
  SettingsRootCommitEvent,
  SettingsRootCommitResult,
  SettingsRootButtonClickEvent<TPopovers, TDialogs>,
  SettingsRootButtonResult<TPopovers, TDialogs>
>

export type SettingsDialogNodeEvents<
  TParams extends SerializableRecord,
  TPopovers extends SettingsPopoverMap
> = SettingsNodeEvents<
  SettingsDialogCommitEvent<TParams>,
  SettingsDialogCommitResult,
  SettingsDialogButtonClickEvent<TParams, TPopovers>,
  SettingsDialogButtonResult<TPopovers>
>

export type SettingsPopoverNodeEvents<TParams extends SerializableRecord> = SettingsNodeEvents<
  SettingsPopoverCommitEvent<TParams>,
  SettingsPopoverCommitResult,
  SettingsPopoverButtonClickEvent<TParams>,
  SettingsPopoverButtonResult
>
```

Root 模型：

```ts
export type SettingsRootModel<
  TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers> = EmptySettingsDialogMap
> = SettingsRootModelBase &
  (
    | {
        fields: readonly SettingsField<SettingsRootNodeEvents<TPopovers, TDialogs>>[]
        tabs?: never
        activeTabId?: never
      }
    | {
        tabs: readonly SettingsTab<SettingsRootNodeEvents<TPopovers, TDialogs>>[]
        activeTabId?: string
        fields?: never
      }
  )

export interface SettingsRootModelBase {
  title?: string
  description?: string
  size?: SettingsDialogSize
}
```

Dialog 与 popover 模型：

```ts
export interface SettingsDialogModel<
  TParams extends SerializableRecord = SerializableRecord,
  TPopovers extends SettingsPopoverMap = EmptySettingsPopoverMap
> {
  title?: string
  description?: string
  size?: SettingsDialogSize
  fields: readonly SettingsField<SettingsDialogNodeEvents<TParams, TPopovers>>[]
}

export interface SettingsPopoverModel<TParams extends SerializableRecord = SerializableRecord> {
  title?: string
  description?: string
  width?: SettingsPopoverWidth
  fields: readonly SettingsField<SettingsPopoverNodeEvents<TParams>>[]
}
```

## Settings 事件与结果

Resolve 上下文：

```ts
export interface SettingsResolveContextBase {
  contributionId: string
  sessionId: string
  values: SerializableRecord
  dirtyNodeIds: readonly string[]
  reason?: SettingsRefreshReason
  signal: AbortSignal
}

export interface SettingsRootResolveContext extends SettingsResolveContextBase {
  surface: 'root'
}

export interface SettingsDialogResolveContext<
  TParams extends SerializableRecord = SerializableRecord
> extends SettingsResolveContextBase {
  surface: 'dialog'
  dialogId: string
  params: TParams
  parentValues: SerializableRecord
  parentDirtyNodeIds: readonly string[]
}

export interface SettingsPopoverResolveContext<
  TParams extends SerializableRecord = SerializableRecord
> extends SettingsResolveContextBase {
  surface: 'popover'
  popoverId: string
  params: TParams
  parent: { surface: 'root' } | { surface: 'dialog'; dialogId: string }
  parentValues: SerializableRecord
  parentDirtyNodeIds: readonly string[]
}
```

Action 事件：

```ts
export interface SettingsCommitEventBase {
  fieldId: string
  nodeId: string
  value: SerializableValue
}

export interface SettingsButtonClickEventBase {
  fieldId: string
  nodeId: string
}

export type SettingsRootCommitEvent = SettingsRootResolveContext &
  SettingsRootCommitHelpers &
  SettingsCommitEventBase

export type SettingsDialogCommitEvent<TParams> = SettingsDialogResolveContext<TParams> &
  SettingsDialogCommitHelpers &
  SettingsCommitEventBase

export type SettingsPopoverCommitEvent<TParams> = SettingsPopoverResolveContext<TParams> &
  SettingsPopoverActionHelpers &
  SettingsCommitEventBase

export type SettingsRootButtonClickEvent<TPopovers, TDialogs> = SettingsRootResolveContext &
  SettingsRootButtonHelpers<TPopovers, TDialogs> &
  SettingsButtonClickEventBase

export type SettingsDialogButtonClickEvent<TParams, TPopovers> =
  SettingsDialogResolveContext<TParams> &
    SettingsDialogButtonHelpers<TPopovers> &
    SettingsButtonClickEventBase

export type SettingsPopoverButtonClickEvent<TParams> = SettingsPopoverResolveContext<TParams> &
  SettingsPopoverActionHelpers &
  SettingsButtonClickEventBase

export interface SettingsRootSubmitEvent
  extends SettingsRootResolveContext, SettingsRootSubmitHelpers {}

export interface SettingsDialogSubmitEvent<TParams>
  extends SettingsDialogResolveContext<TParams>, SettingsDialogSubmitHelpers {}
```

目标：

```ts
export interface SettingsDialogTarget<
  TDialogs extends SettingsDialogMap,
  TDialogId extends SettingsDialogId<TDialogs> = SettingsDialogId<TDialogs>
> {
  dialogId: TDialogId
  params?: SettingsDialogParams<TDialogs[TDialogId]>
}

export interface SettingsPopoverTarget<
  TPopovers extends SettingsPopoverMap,
  TPopoverId extends SettingsPopoverId<TPopovers> = SettingsPopoverId<TPopovers>
> {
  popoverId: TPopoverId
  params?: SettingsPopoverParams<TPopovers[TPopoverId]>
}

export type SettingsRefreshTarget = 'self' | 'root' | 'dialog' | 'popover' | 'all'
```

Result 类型是少量 effect 的能力别名。非法 effect 必须通过类型别名排除，不应该留到运行时校验。

```ts
export type SettingsResult<
  TEffect extends object = Record<never, never>,
  TFailureRefresh extends SettingsRefreshTarget = SettingsRefreshTarget
> =
  | ({ success: true; message?: string } & TEffect)
  | {
      success: false
      error: ExtensionErrorShape
      refresh?: TFailureRefresh
      closePopover?: boolean
    }

export type SettingsRootCommitResult = SettingsResult<
  {
    refresh?: 'self' | 'root' | 'all'
    closePopover?: boolean
  },
  'self' | 'root' | 'all'
>

export type SettingsDialogCommitResult = SettingsResult<
  {
    refresh?: 'self' | 'dialog' | 'root' | 'all'
    closePopover?: boolean
  },
  'self' | 'dialog' | 'root' | 'all'
>

export type SettingsRootButtonEffect<
  TPopovers extends SettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers>
> =
  | {
      refresh?: 'self' | 'root' | 'all'
      closePopover?: boolean
      openDialog?: never
      openPopover?: never
      close?: never
    }
  | {
      openDialog: SettingsDialogTarget<TDialogs>
      closePopover?: boolean
      refresh?: never
      openPopover?: never
      close?: never
    }
  | {
      openPopover: SettingsPopoverTarget<TPopovers>
      closePopover?: boolean
      refresh?: never
      openDialog?: never
      close?: never
    }
  | {
      close: 'root'
      refresh?: never
      openDialog?: never
      openPopover?: never
    }

export type SettingsDialogButtonEffect<TPopovers extends SettingsPopoverMap> =
  | {
      refresh?: 'self' | 'dialog' | 'root' | 'all'
      closePopover?: boolean
      openPopover?: never
      close?: never
    }
  | {
      openPopover: SettingsPopoverTarget<TPopovers>
      closePopover?: boolean
      refresh?: never
      close?: never
    }
  | {
      close: 'dialog'
      closePopover?: boolean
      refresh?: never
      openPopover?: never
    }

export type SettingsPopoverEffect = {
  refresh?: 'self' | 'popover' | 'dialog' | 'root' | 'all'
  closePopover?: boolean
}

export type SettingsPopoverActionResult = SettingsResult<
  SettingsPopoverEffect,
  'self' | 'popover' | 'dialog' | 'root' | 'all'
>

export type SettingsPopoverCommitResult = SettingsPopoverActionResult

export type SettingsRootButtonResult<
  TPopovers extends SettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers>
> = SettingsResult<SettingsRootButtonEffect<TPopovers, TDialogs>, 'self' | 'root' | 'all'>

export type SettingsDialogButtonResult<TPopovers extends SettingsPopoverMap> = SettingsResult<
  SettingsDialogButtonEffect<TPopovers>,
  'self' | 'dialog' | 'root' | 'all'
>

export type SettingsPopoverButtonResult = SettingsPopoverActionResult

export type SettingsRootSubmitResult = SettingsResult<
  | {
      refresh?: 'self' | 'root' | 'all'
      closePopover?: boolean
      close?: never
    }
  | {
      close: 'root'
      closePopover?: boolean
      refresh?: never
    },
  'self' | 'root' | 'all'
>

export type SettingsDialogSubmitResult = SettingsResult<
  | {
      refresh?: 'self' | 'dialog' | 'root' | 'all'
      closePopover?: boolean
      close?: never
    }
  | {
      close: 'dialog'
      closePopover?: boolean
      refresh?: never
    },
  'self' | 'dialog' | 'root' | 'all'
>
```

Effect 别名必须表达以下规则：

- `openDialog`、`openPopover`、`close` 是互斥的最终 effect。
- `openDialog` 和 `openPopover` 不能与 `refresh` 同时出现。
- result 不能包含 `patch` 或 `parentPatch`；UI 当前态只能来自 `resolve()`。
- dialog result 不能关闭 root。
- 只有 root button result 可以包含 `openDialog`。
- 只有 root/dialog button result 可以包含 `openPopover`。
- popover result 不能关闭 root/dialog，也不能打开其它 surface。
- failure result 不能打开或关闭 surface。

Event helper 方法必须返回对应的收窄 result 类型。Button helper、commit helper 和 submit helper 是独立接口；submit event 不能继承 button 专属 helper。

```ts
export interface SettingsRootButtonHelpers<
  TPopovers extends SettingsPopoverMap,
  TDialogs extends SettingsDialogMap<TPopovers>
> {
  success(
    options?: SettingsSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'root' | 'all'>
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  refresh(
    target?: 'self' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  close(
    target: 'root',
    options?: SettingsCloseOptions
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  closePopover(
    options?: SettingsSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  openDialog<TDialogId extends SettingsDialogId<TDialogs>>(
    dialogId: TDialogId,
    params?: SettingsDialogParams<TDialogs[TDialogId]>,
    options?: SettingsOpenOptions
  ): SettingsRootButtonResult<TPopovers, TDialogs>
  openPopover<TPopoverId extends SettingsPopoverId<TPopovers>>(
    popoverId: TPopoverId,
    params?: SettingsPopoverParams<TPopovers[TPopoverId]>,
    options?: SettingsOpenOptions
  ): SettingsRootButtonResult<TPopovers, TDialogs>
}

export interface SettingsRootCommitHelpers {
  success(options?: SettingsSuccessOptions<'self' | 'root' | 'all'>): SettingsRootCommitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'root' | 'all'>
  ): SettingsRootCommitResult
  refresh(
    target?: 'self' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsRootCommitResult
  closePopover(options?: SettingsSuccessOptions<'self' | 'root' | 'all'>): SettingsRootCommitResult
}

export interface SettingsRootSubmitHelpers {
  success(options?: SettingsSuccessOptions<'self' | 'root' | 'all'>): SettingsRootSubmitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'root' | 'all'>
  ): SettingsRootSubmitResult
  refresh(
    target?: 'self' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'root' | 'all'>
  ): SettingsRootSubmitResult
  close(target: 'root', options?: SettingsClosePopoverOptions): SettingsRootSubmitResult
  closePopover(options?: SettingsSuccessOptions<'self' | 'root' | 'all'>): SettingsRootSubmitResult
}

export interface SettingsDialogButtonHelpers<TPopovers extends SettingsPopoverMap> {
  success(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogButtonResult<TPopovers>
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogButtonResult<TPopovers>
  refresh(
    target?: 'self' | 'dialog' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogButtonResult<TPopovers>
  close(
    target: 'dialog',
    options?: SettingsClosePopoverOptions
  ): SettingsDialogButtonResult<TPopovers>
  closePopover(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogButtonResult<TPopovers>
  openPopover<TPopoverId extends SettingsPopoverId<TPopovers>>(
    popoverId: TPopoverId,
    params?: SettingsPopoverParams<TPopovers[TPopoverId]>,
    options?: SettingsOpenOptions
  ): SettingsDialogButtonResult<TPopovers>
}

export interface SettingsDialogCommitHelpers {
  success(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogCommitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogCommitResult
  refresh(
    target?: 'self' | 'dialog' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogCommitResult
  closePopover(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogCommitResult
}

export interface SettingsDialogSubmitHelpers {
  success(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogSubmitResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogSubmitResult
  refresh(
    target?: 'self' | 'dialog' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogSubmitResult
  close(target: 'dialog', options?: SettingsClosePopoverOptions): SettingsDialogSubmitResult
  closePopover(
    options?: SettingsSuccessOptions<'self' | 'dialog' | 'root' | 'all'>
  ): SettingsDialogSubmitResult
}

export interface SettingsPopoverActionHelpers {
  success(
    options?: SettingsSuccessOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPopoverActionResult
  fail(
    error: ExtensionErrorShape,
    options?: SettingsFailureOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPopoverActionResult
  refresh(
    target?: 'self' | 'popover' | 'dialog' | 'root' | 'all',
    options?: SettingsSuccessOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPopoverActionResult
  closePopover(
    options?: SettingsSuccessOptions<'self' | 'popover' | 'dialog' | 'root' | 'all'>
  ): SettingsPopoverActionResult
}
```

Dialog button helper 不提供 `openDialog`；dialog submit/commit helper 不提供 `openPopover`。Popover helper 不提供 `openDialog`、`openPopover` 和 root/dialog close。所有 UI 值更新都应通过重新 `resolve()` 完成。

## Settings Node 工厂

`SettingsNodeFactory<TEvents>` 只负责补全 `kind` 并保持 event/result 推导。它不创建 contribution、model、field、tab、dialog 或 popover 结构。

```ts
export interface SettingsNodeFactory<TEvents extends SettingsAnyNodeEvents> {
  switch(
    node: Omit<SettingsSwitchNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsSwitchNode<TEvents['commitEvent'], TEvents['commitResult']>
  checkbox(
    node: Omit<SettingsCheckboxNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsCheckboxNode<TEvents['commitEvent'], TEvents['commitResult']>
  select(
    node: Omit<SettingsSelectNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  multiSelect(
    node: Omit<SettingsMultiSelectNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsMultiSelectNode<TEvents['commitEvent'], TEvents['commitResult']>
  textInput(
    node: Omit<SettingsTextInputNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsTextInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  textarea(
    node: Omit<SettingsTextareaNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsTextareaNode<TEvents['commitEvent'], TEvents['commitResult']>
  numberInput(
    node: Omit<SettingsNumberInputNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsNumberInputNode<TEvents['commitEvent'], TEvents['commitResult']>
  stringList(
    node: Omit<SettingsStringListNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsStringListNode<TEvents['commitEvent'], TEvents['commitResult']>
  recordList(
    node: Omit<SettingsRecordListNode<TEvents['commitEvent'], TEvents['commitResult']>, 'kind'>
  ): SettingsRecordListNode<TEvents['commitEvent'], TEvents['commitResult']>
  button(
    node: Omit<SettingsButtonNode<TEvents['buttonEvent'], TEvents['buttonResult']>, 'kind'>
  ): SettingsButtonNode<TEvents['buttonEvent'], TEvents['buttonResult']>
  text(node: Omit<SettingsTextNode, 'kind'>): SettingsTextNode
  notice(node: Omit<SettingsNoticeNode, 'kind'>): SettingsNoticeNode
  status(node: Omit<SettingsStatusNode, 'kind'>): SettingsStatusNode
  table(node: Omit<SettingsTableNode, 'kind'>): SettingsTableNode
  image(node: Omit<SettingsImageNode, 'kind'>): SettingsImageNode
  divider(node?: Omit<SettingsDividerNode, 'kind'>): SettingsDividerNode
}
```

`resolve` callback 中的公共参数名保持为 `settings`。

## Settings 示例

```ts
const registration = context.contributions.settings.register(
  defineSettingsContribution({
    id: 'bangumi',
    title: 'Bangumi',
    popovers: {
      'oauth-diagnostics': {
        title: 'OAuth diagnostics',
        async resolve(_ctx, settings) {
          return {
            fields: [
              {
                id: 'redirect-uri',
                label: 'Redirect URI',
                content: [
                  settings.status({
                    id: 'redirect-uri-value',
                    value: getRedirectUri()
                  })
                ]
              }
            ]
          }
        }
      }
    },
    dialogs: {
      'sync-preview': {
        title: 'Sync preview',
        async resolve(ctx, settings) {
          const plan = await createSyncPlan(ctx.parentValues)
          return {
            fields: [
              {
                id: 'plan-preview',
                content: [
                  settings.table({
                    id: 'plan',
                    rows: plan.rows
                  })
                ]
              }
            ]
          }
        }
      }
    },
    async resolve(_ctx, settings) {
      const accessToken = await readAccessToken()
      const autoSync = await readAutoSync()

      return {
        tabs: [
          {
            id: 'account',
            label: 'Account',
            fields: [
              {
                id: 'access-token',
                label: 'Access token',
                contentLayout: 'inline',
                content: [
                  settings.textInput({
                    id: 'access-token-input',
                    initialValue: accessToken,
                    inputMode: 'password',
                    grow: true
                  }),
                  settings.button({
                    id: 'verify-account',
                    label: 'Verify',
                    async onClick(ctx) {
                      await verifyAccount(ctx.values['access-token-input'])
                      return ctx.refresh('root', { message: 'Account verified' })
                    }
                  }),
                  settings.button({
                    id: 'oauth-diagnostics',
                    label: 'Diagnostics',
                    async onClick(ctx) {
                      return ctx.openPopover('oauth-diagnostics')
                    }
                  })
                ]
              }
            ]
          },
          {
            id: 'sync',
            label: 'Sync',
            fields: [
              {
                id: 'auto-sync',
                label: 'Auto sync',
                content: [
                  settings.switch({
                    id: 'auto-sync-switch',
                    initialValue: autoSync
                  })
                ]
              },
              {
                id: 'sync-preview-action',
                content: [
                  settings.button({
                    id: 'preview-sync',
                    label: 'Preview sync',
                    async onClick(ctx) {
                      return ctx.openDialog('sync-preview')
                    }
                  })
                ]
              }
            ]
          }
        ]
      }
    },
    async submit(event) {
      await saveSettings(event.values)
      return event.close('root', { message: 'Settings saved' })
    }
  })
)

context.subscriptions.add(registration)
```

## Settings 校验

模型校验：

- Root model 必须且只能提供 `fields` 或 `tabs` 之一。
- Root `fields` 模式不能提供 `activeTabId`。
- Root `tabs` 模式必须提供非空 `tabs`；如果提供 `activeTabId`，它必须指向现有 tab。
- Dialog 和 popover model 必须提供非空 `fields`。
- Field 不递归，不能包含子 field。
- Field id 在同一个 surface 内唯一。
- 所有 settings node 都必须提供 `id`。
- Node id 在同一个 surface 内唯一；value node 的 `id` 同时是 draft slot id。
- Value node 必须提供 `initialValue`；renderer 用它初始化 draft，并在 refresh merge 时作为非 dirty draft slot 的新基准。
- `initialValue` 必须通过对应 node schema 校验；不做隐式类型转换。
- `patch` / `parentPatch` 不属于 settings result；UI 当前态只能来自重新 `resolve()` 的模型。

控制节点 schema：

| Node                                | Value schema                  |
| ----------------------------------- | ----------------------------- |
| `switch` / `checkbox`               | boolean                       |
| `select` / `textInput` / `textarea` | string                        |
| `numberInput`                       | finite number                 |
| `multiSelect` / `stringList`        | readonly string[]             |
| `recordList`                        | readonly SerializableRecord[] |

Result 校验：

- Host 仍然要在运行时校验 result shape，因为扩展代码不可信。
- 运行时校验必须镜像编译期 capability alias。
- 过期 callback result 通过 request id 和 surface revision 忽略。
- Refresh 在应用新 DTO 前，必须先关闭被 refresh surface 下的 active popover。

Commit 行为：

- 当值通过 schema 校验时，渲染进程本地 draft 立即更新。
- `onCommit` 是可选远程 callback，不能阻塞本地 draft 更新。
- `numberInput` 可以保留内部编辑 buffer 承载不完整输入；draft 只保存 finite number。
- Submit 直接使用当前渲染进程 draft，不隐式触发所有 `onCommit` callback。

## Settings 共享 DTO 与 IPC

渲染进程 IPC channel：

- `extension:open-settings`
- `extension:refresh-settings`
- `extension:submit-settings`
- `extension:invoke-settings-node`
- `extension:release-settings`

渲染进程 event：

- `extension:settings-refresh-requested`

传输类型：

```ts
export type ExtensionSettingsSurface = 'root' | 'dialog' | 'popover'
export type ExtensionSettingsScope = ExtensionSettingsSurface | 'all'

export interface ExtensionSettingsDraftSnapshot {
  values: SerializableRecord
  dirtyNodeIds: readonly string[]
}

export interface ExtensionSettingsSessionRef {
  sessionId: string
  extensionId: string
  contributionId: string
}

export type ExtensionSettingsParentRef =
  | { surface: 'root' }
  | { surface: 'dialog'; dialogId: string }
```

Open 请求：

```ts
export type ExtensionSettingsOpenRequest =
  | {
      surface: 'root'
      extensionId: string
      contributionId: string
      reason?: SettingsRefreshReason
    }
  | (ExtensionSettingsSessionRef & {
      surface: 'dialog'
      dialogId: string
      params?: SerializableRecord
      parentDraft: ExtensionSettingsDraftSnapshot
      revision: number
    })
  | (ExtensionSettingsSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsParentRef
      params?: SerializableRecord
      parentDraft: ExtensionSettingsDraftSnapshot
      anchorNodeKey: string
      revision: number
    })
```

Refresh 请求：

```ts
export type ExtensionSettingsRefreshRequest =
  | (ExtensionSettingsSessionRef & {
      surface: 'root'
      draft: ExtensionSettingsDraftSnapshot
      reason?: SettingsRefreshReason
      revision: number
    })
  | (ExtensionSettingsSessionRef & {
      surface: 'dialog'
      dialogId: string
      draft: ExtensionSettingsDraftSnapshot
      parentDraft: ExtensionSettingsDraftSnapshot
      reason?: SettingsRefreshReason
      revision: number
    })
  | (ExtensionSettingsSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsParentRef
      draft: ExtensionSettingsDraftSnapshot
      parentDraft: ExtensionSettingsDraftSnapshot
      reason?: SettingsRefreshReason
      revision: number
    })
  | (ExtensionSettingsSessionRef & {
      surface: 'all'
      rootDraft: ExtensionSettingsDraftSnapshot
      activeDialog?: {
        dialogId: string
        draft: ExtensionSettingsDraftSnapshot
      }
      reason?: SettingsRefreshReason
      revision: number
    })
```

Submit 与 invoke 请求：

```ts
export type ExtensionSettingsSubmitRequest =
  | (ExtensionSettingsSessionRef & {
      surface: 'root'
      draft: ExtensionSettingsDraftSnapshot
      revision: number
    })
  | (ExtensionSettingsSessionRef & {
      surface: 'dialog'
      dialogId: string
      draft: ExtensionSettingsDraftSnapshot
      parentDraft: ExtensionSettingsDraftSnapshot
      revision: number
    })

export interface ExtensionSettingsInvokeBase extends ExtensionSettingsSessionRef {
  callbackId: string
  fieldId: string
  nodeId: string
  value?: SerializableValue
  requestId: string
  revision: number
}

export type ExtensionSettingsInvokeRequest =
  | (ExtensionSettingsInvokeBase & {
      surface: 'root'
      draft: ExtensionSettingsDraftSnapshot
    })
  | (ExtensionSettingsInvokeBase & {
      surface: 'dialog'
      dialogId: string
      draft: ExtensionSettingsDraftSnapshot
      parentDraft: ExtensionSettingsDraftSnapshot
    })
  | (ExtensionSettingsInvokeBase & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsParentRef
      draft: ExtensionSettingsDraftSnapshot
      parentDraft: ExtensionSettingsDraftSnapshot
    })
```

Release 请求：

```ts
export type ExtensionSettingsReleaseRequest =
  | (ExtensionSettingsSessionRef & { surface: 'root' | 'all' })
  | (ExtensionSettingsSessionRef & { surface: 'dialog'; dialogId: string })
  | (ExtensionSettingsSessionRef & {
      surface: 'popover'
      popoverId: string
      parent: ExtensionSettingsParentRef
    })
```

Response 必须通过 surface 区分：

```ts
export type ExtensionSettingsOpenResponse =
  | {
      surface: 'root'
      session: ExtensionSettingsSession
      view: ExtensionResolvedSettingsRoot
    }
  | {
      surface: 'dialog'
      dialog: ExtensionResolvedSettingsDialog
    }
  | {
      surface: 'popover'
      popover: ExtensionResolvedSettingsPopover
    }
```

Resolved DTO 名称：

- `ExtensionSettingsSession`
- `ExtensionResolvedSettingsRoot`
- `ExtensionResolvedSettingsDialog`
- `ExtensionResolvedSettingsPopover`
- `ExtensionResolvedSettingsField`
- `ExtensionResolvedSettingsNode`

Resolved node 使用同一套 node 名称，并额外携带 callback 元数据。只有 control node 和 button node 可以获得 `callbackId`。

Main 到 host 的 RPC：

- `contributions.settings.open`
- `contributions.settings.refresh`
- `contributions.settings.submit`
- `contributions.settings.invoke`
- `contributions.settings.release`

Host 到 main 的 RPC：

- `contributions.settings.register`
- `contributions.settings.unregister`
- `contributions.settings.refreshRequested`

## Settings Session

渲染进程 session state：

```ts
interface SettingsSessionState {
  sessionId: string
  extensionId: string
  contributionId: string
  root: SettingsSurfaceState<'root'>
  activeDialog?: SettingsSurfaceState<'dialog'>
  activeRootPopover?: SettingsSurfaceState<'popover'>
  activeDialogPopover?: SettingsSurfaceState<'popover'>
}
```

Surface state 包含：

- 已 resolve 的 model
- draft 值
- dirty node id 列表
- revision
- pending request id 集合
- active callback id 集合
- loading/error 状态

规则：

- 同一 session 同时只能打开一个 dialog。
- Root 和 active dialog 各自最多拥有一个 active popover。
- 打开 dialog 会关闭 root popover。
- 关闭 dialog 会释放 dialog popover。
- refresh root 会关闭 root popover。
- refresh dialog 会关闭 dialog popover。
- refresh all 会关闭所有 popover。

Host session state 使用同样的 surface shape，并复用 normalize、callback map 注册、invoke、refresh 和 release 的通用 helper。它可以暴露私有 `openRoot()`、`openDialog()` 和 `openPopover()` 方法，但不能实现三条互不相关的流水线。

## Menus 公共 API

`entityMenus` 替换为 `menus`。扩展作者通过 domain/scope 属性注册，不再手写 target 字符串。

```ts
export interface MenuRefreshReason {
  reason?: string
  params?: SerializableRecord
}

export interface MenuInputBase {
  domain: MenuDomain
  scope: string
}

export interface GameSingleMenuInput extends MenuInputBase {
  domain: 'game'
  scope: 'single'
  entityId: string
}

export interface GameBatchMenuInput extends MenuInputBase {
  domain: 'game'
  scope: 'batch'
  entityIds: readonly string[]
}

export interface CharacterSingleMenuInput extends MenuInputBase {
  domain: 'character'
  scope: 'single'
  entityId: string
}

export interface PersonSingleMenuInput extends MenuInputBase {
  domain: 'person'
  scope: 'single'
  entityId: string
}

export interface CompanySingleMenuInput extends MenuInputBase {
  domain: 'company'
  scope: 'single'
  entityId: string
}

export interface CollectionSingleMenuInput extends MenuInputBase {
  domain: 'collection'
  scope: 'single'
  entityId: string
}

export interface TagSingleMenuInput extends MenuInputBase {
  domain: 'tag'
  scope: 'single'
  entityId: string
}
```

Menu domain/scope/input 映射是 input 的唯一事实源。`MenuRegistrar` 从
`MenuInputMap` 直接派生，domain/scope 选择后的 `register()` 参数类型是
`MenuContribution<MenuInputMap[domain][scope]>` 的等价形式，不再维护额外的
contribution 映射或每个 domain/scope 的命名 contribution alias：

```ts
export interface MenuInputMap {
  game: {
    single: GameSingleMenuInput
    batch: GameBatchMenuInput
  }
  character: {
    single: CharacterSingleMenuInput
  }
  person: {
    single: PersonSingleMenuInput
  }
  company: {
    single: CompanySingleMenuInput
  }
  collection: {
    single: CollectionSingleMenuInput
  }
  tag: {
    single: TagSingleMenuInput
  }
}

export type MenuDomain = keyof MenuInputMap
export type MenuScope<TDomain extends MenuDomain> = Extract<keyof MenuInputMap[TDomain], string>

export type MenuInput = {
  [TDomain in keyof MenuInputMap]: MenuInputMap[TDomain][keyof MenuInputMap[TDomain]]
}[keyof MenuInputMap]

type MenuInputFor<
  TDomain extends MenuDomain,
  TScope extends MenuScope<TDomain>
> = MenuInputMap[TDomain][TScope] extends MenuInput ? MenuInputMap[TDomain][TScope] : never

export type MenuRegistrar = {
  [TDomain in MenuDomain]: {
    [TScope in MenuScope<TDomain>]: MenuRegistrationPoint<MenuInputFor<TDomain, TScope>>
  }
}
```

注册：

```ts
export interface MenuRegistration extends Disposable {
  refresh(reason?: MenuRefreshReason): Promise<void>
}

export interface MenuContribution<TInput extends MenuInput> {
  id: string
  order?: number
  resolve(input: TInput, menu: MenuNodeFactory<TInput>): MaybePromise<readonly MenuNode<TInput>[]>
}

export interface MenuRegistrationPoint<TInput extends MenuInput> {
  register(contribution: MenuContribution<TInput>): MenuRegistration
}
```

Menu 节点：

```ts
export interface MenuNodeBase {
  id: string
  hidden?: boolean
  disabled?: boolean
}

export interface MenuActionNode<TInput extends MenuInput = MenuInput> extends MenuNodeBase {
  kind: 'action'
  label: string
  icon?: string
  tone?: 'default' | 'danger'
  shortcut?: string
  onClick(event: MenuNodeEvent<TInput>): MaybePromise<UiCallbackResult>
}

export interface MenuCheckboxNode<TInput extends MenuInput = MenuInput> extends MenuNodeBase {
  kind: 'checkbox'
  label: string
  icon?: string
  checked: boolean
  onChange(checked: boolean, event: MenuNodeEvent<TInput>): MaybePromise<UiCallbackResult>
}

export interface MenuSelectNode<TInput extends MenuInput = MenuInput> extends MenuNodeBase {
  kind: 'select'
  label: string
  icon?: string
  value: string
  options: readonly MenuSelectOption[]
  onChange(value: string, event: MenuNodeEvent<TInput>): MaybePromise<UiCallbackResult>
}

export interface MenuSubmenuNode<TInput extends MenuInput = MenuInput> extends MenuNodeBase {
  kind: 'submenu'
  label: string
  icon?: string
  children: readonly MenuNode<TInput>[]
}

export interface MenuSeparatorNode {
  kind: 'separator'
  id?: string
  hidden?: boolean
}

export type MenuNode<TInput extends MenuInput = MenuInput> =
  | MenuActionNode<TInput>
  | MenuCheckboxNode<TInput>
  | MenuSelectNode<TInput>
  | MenuSubmenuNode<TInput>
  | MenuSeparatorNode

export interface MenuSelectOption {
  value: string
  label: string
  disabled?: boolean
}

export interface MenuNodeEvent<TInput extends MenuInput = MenuInput> {
  input: TInput
  nodeId: string
  nodePath: readonly string[]
}
```

工厂：

```ts
export interface MenuNodeFactory<TInput extends MenuInput = MenuInput> {
  action(node: Omit<MenuActionNode<TInput>, 'kind'>): MenuActionNode<TInput>
  checkbox(node: Omit<MenuCheckboxNode<TInput>, 'kind'>): MenuCheckboxNode<TInput>
  select(node: Omit<MenuSelectNode<TInput>, 'kind'>): MenuSelectNode<TInput>
  submenu(node: Omit<MenuSubmenuNode<TInput>, 'kind'>): MenuSubmenuNode<TInput>
  separator(node?: Omit<MenuSeparatorNode, 'kind'>): MenuSeparatorNode
}
```

`submenu` 是正式 API 名称。除非有很强的易用性理由，不应再引入 `sub` 短别名。

示例：

```ts
const registration = context.contributions.menus.game.single.register({
  id: 'open-bangumi',
  order: 20,
  async resolve(input, menu) {
    const subjectId = await findBangumiSubjectId(input.entityId)
    if (!subjectId) {
      return []
    }

    return [
      menu.submenu({
        id: 'bangumi',
        label: 'Bangumi',
        children: [
          menu.action({
            id: 'open',
            label: 'Open Bangumi page',
            async onClick() {
              await kisaki.runtime.openExternal(`https://bgm.tv/subject/${subjectId}`)
              return { success: true, refresh: false }
            }
          }),
          menu.action({
            id: 'copy-id',
            label: 'Copy subject id',
            async onClick() {
              await kisaki.clipboard.writeText(String(subjectId))
              return { success: true, refresh: false }
            }
          })
        ]
      })
    ]
  }
})

context.subscriptions.add(registration)
```

## Menus 校验

- Domain/scope 注册入口由 `MenuInputMap` 和 `MenuRegistrar` 派生。
- `MenuInputMap` 是 menus domain/scope/input 的唯一事实源；不要维护同 key 的 contribution map。
- `MenuNode.id` 在同级节点中必须唯一。
- `separator.id` 在公共 API 中是可选的。
- Normalize 阶段会生成稳定的内部 separator id，用于渲染进程 key。
- 隐藏节点过滤后，`submenu.children` 必须非空。
- `submenu` 可以嵌套，默认最大深度为 3。
- `separator` 不能作为第一个或最后一个可见同级节点。
- 连续 separator 会被折叠。
- 只有 action、checkbox 和 select node 会产生 callback id。
- Host 通过 `nodePath` 调用 callback，并拒绝调用 submenu/separator。

## Menus 共享 DTO 与 IPC

渲染进程 IPC channel：

- `extension:resolve-menu`
- `extension:invoke-menu`
- `extension:release-menu`

渲染进程 event：

- `extension:menus-refresh-requested`

DTO 名称：

- `ExtensionMenuContributionInfo`
- `ExtensionResolvedMenu`
- `ExtensionResolvedMenuGroup`
- `ExtensionResolvedMenuNode`
- `ExtensionMenuResolveRequest`
- `ExtensionMenuInvokeRequest`
- `ExtensionMenuInvokeResponse`
- `ExtensionMenuReleaseRequest`

Request 结构：

```ts
export interface ExtensionMenuResolveRequest {
  input: MenuInput
}

export interface ExtensionMenuInvokeRequest {
  sessionId: string
  extensionId: string
  contributionId: string
  nodePath: readonly string[]
  input: MenuInput
  value?: boolean | string
}

export interface ExtensionMenuReleaseRequest {
  sessionId: string
}
```

Main 到 host 的 RPC：

- `contributions.menus.resolve`
- `contributions.menus.invoke`
- `contributions.menus.release`

Host 到 main 的 RPC：

- `contributions.menus.register`
- `contributions.menus.unregister`
- `contributions.menus.refreshRequested`

## 渲染进程文件组织

新增文件：

```text
apps/desktop/src/renderer/src/components/extension/
  settings/
    settings-dialog.vue
    settings-session.ts
    surface/
      root-surface.vue
      dialog-surface.vue
      popover-surface.vue
      tabs.vue
      field.vue
    node/
      switch-node.vue
      checkbox-node.vue
      select-node.vue
      multi-select-node.vue
      text-input-node.vue
      textarea-node.vue
      number-input-node.vue
      string-list-node.vue
      record-list-node.vue
      button-node.vue
      text-node.vue
      notice-node.vue
      status-node.vue
      table-node.vue
      image-node.vue
      divider-node.vue
  menus/
    menu-items.vue
    menu-session.ts
    node/
      action-node.vue
      checkbox-node.vue
      select-node.vue
      submenu-node.vue
      separator-node.vue
```

规则：

- Settings/menu 组件从 `@shared/extension` 导入 DTO 类型。
- 只有需要公共 API 类型时，才从 `@kisaki/extension-api` 导入。
- 组件不从 `@renderer/core/extensions` 总出口导入。
- `settings-session.ts` 和 `menu-session.ts` 可以持有 request id、revision、draft merge、callback release 和错误处理逻辑。
- Session 模块不能变成每个 channel 一个函数的 IPC wrapper。
- IPC 调用在 session/controller 边界直接使用 `ipcManager.invoke`。

## Main / Host 文件组织

新增或重命名文件：

```text
apps/desktop/src/main/services/extension/contributions/
  settings.ts
  menus.ts

apps/desktop/src/main/services/extension/runtime/host/contributions/
  settings.ts
  menus.ts
```

Host 职责：

- 注册前校验公共 definition。
- 使用正确的 surface context resolve model。
- Normalize field/menu node。
- 把 callback 替换为 callback id。
- 按 surface/session 维护 callback map。
- 应用 effect 前校验 callback result。
- surface close/refresh 时释放 callback map。

Main 职责：

- 持有已安装贡献点 snapshot。
- 持有面向渲染进程的 IPC handler。
- 把 resolve/invoke/release 转发给 host。
- 发送 refresh-requested event。
- 作为 settings/menu session 生命周期的权威来源。

## 删除旧模型

删除且不保留别名：

- `entityMenus`
- `EntityMenu*`
- `SettingsScreen`
- `SettingsScreenModel`
- `SettingsResolvedScreenModel`
- `SettingsSectionNode`
- `SettingsDialogNode`
- `SettingsCommand`
- `SettingsBuilder`
- `SettingsPopoverBuilder`
- `SettingsDialogStack`
- `SettingsDialogFrame`
- `ExtensionResolvedSettingsFrame`
- `extension:open-settings-session`
- `extension:open-settings-frame`
- `extension:refresh-settings-frame`
- `extension:submit-settings-frame`
- `extension:release-settings-frame`
- `extension:release-settings-session`
- `extension:resolve-entity-menu`
- `extension:invoke-entity-menu`
- `extension:release-entity-menu-session`
- `contributions.entityMenus.*`
- 渲染进程 settings/menus 纯 IPC wrapper 和类型总出口

## 实施顺序

1. 重写 `packages/extension-api/src/contributions/settings/contracts.ts`。
2. 按新的统一 node 核心和 capability result alias 重写 settings validation。
3. 把 entity menu 公共 API 重命名为 `menus`，并实现由 `MenuInputMap` / `MenuRegistrar` 派生的注册入口。
4. 更新 `packages/extension-api/src/context.ts`。
5. 更新 SDK bridge registrar 与 extension host contribution handler。
6. 重写 `apps/desktop/src/shared/extension.ts` 中的 settings/menu DTO。
7. 更新 `apps/desktop/src/shared/ipc.ts` channel 与 request/response 类型。
8. 重写 settings 和 menus 的 main contribution host。
9. 将渲染进程组件移动到 `components/extension/settings` 和 `components/extension/menus`。
10. 更新内置扩展和 create-extension 模板。
11. 删除旧文件和旧别名。
12. 运行完整 typecheck、extension contract build 和 desktop renderer smoke test。

## 验收标准

- 公共 settings node 类型全部使用 `Node` 后缀。
- 公共 settings control 使用 `textInput` 和 `numberInput` 名称，不使用含混的 `text` 或 `number`。
- settings 只有一套 field/node 核心，由 root/dialog/popover capability preset 共享。
- Root settings 只能返回 fields 或 tabs 之一，不能同时返回。
- Dialog 和 popover model 不能返回 tabs。
- Dialog callback 不能打开 dialog。
- Dialog result 不能关闭 root。
- Popover callback 不能打开 dialog、打开 popover、关闭 root 或关闭 dialog。
- 所有 settings node 都必须有 `id`。
- Settings value node 必须使用 `initialValue`，不能使用 surface 级 `initialValues`。
- Value node 的 `id` 同时是 draft slot id，且 node id 在同一个 surface 内唯一。
- Settings result 不能返回 `patch` 或 `parentPatch`。
- Settings refresh 使用显式 target，不使用 boolean `true`。
- 渲染进程 draft merge 在 refresh 后保留 dirty node id 对应的 draft。
- `registration.refresh()` 会刷新已打开的渲染进程 session，但不直接推送 DTO。
- Menus 使用 `context.contributions.menus.<domain>.<scope>`。
- Menu domain/scope/input 类型由 `MenuInputMap` 派生，register 参数类型由 `MenuContribution<MenuInputMap[domain][scope]>` 的等价形式派生。
- 不为每个 menu domain/scope 手写 `Contribution` 后缀命名类型。
- Submenu 使用 `MenuSubmenuNode` 和 `kind: 'submenu'`。
- Menu callback 通过 `nodePath` 调用。
- 渲染进程 settings/menus 组件不从 `@renderer/core/extensions` 导入。
- 渲染进程没有 settings/menus 纯 IPC wrapper 或类型 re-export 总出口。
- 旧的 `entityMenus`、screen/frame stack 和 settings builder 类型被删除且不保留别名。
