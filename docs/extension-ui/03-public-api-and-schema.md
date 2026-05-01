# 03 Public API And Schema

公共 API 应让扩展作者感觉像在写 Kisaki UI 组件，而不是拼低层 DTO。底层仍然必须是可序列化 schema，所有函数只停留在 extension host。

## Authoring 与 Document 分层

Extension UI 的公共模型必须明确区分两种树：

- Authoring tree：SDK builder 返回的中间结构，只在 extension host 内部流转。它可以包含 action handler、component reference、params resolver 和 typed slots。
- Document tree：host normalize 后发送给 main/renderer 的 DTO。它只能包含可序列化值、白名单 component type、slots/children、action id 和静态 command。

扩展作者永远不直接构造 renderer document。`ui.defineComponent(...)`、`ui.component(...)`、`ui.action(...)`、`ui.mount(...)` 都是 authoring API；host render 时会递归展开组件、注册 action、校验 props，并生成 `ExtensionUiDocument`。renderer 不接收函数、不接收组件引用、不接收 slot function，也不能按扩展传入的任意字符串动态加载组件。

## 核心类型草案

```ts
import type { SerializableValue } from '../shared'

export type ExtensionUiValue = SerializableValue
export type ExtensionUiParams = Record<string, ExtensionUiValue>

export type ExtensionUiSurfaceKind = 'settings' | 'entity-menu' | 'dialog'
export type ExtensionUiContributionSurfaceKind = 'settings' | 'entity-menu'

export interface ExtensionUiSettingsSurfaceInput {
  surface: 'settings'
  frameId?: string
  params?: ExtensionUiParams
}

export interface ExtensionUiEntityMenuSurfaceInput<
  TInput extends EntityMenuResolveInput = EntityMenuResolveInput
> {
  surface: 'entity-menu'
  input: TInput
}

export interface ExtensionUiDialogSurfaceInput {
  surface: 'dialog'
  opener?: ExtensionUiDialogOpenerInfo
  params?: ExtensionUiParams
}

export type ExtensionUiSurfaceInput =
  | ExtensionUiSettingsSurfaceInput
  | ExtensionUiEntityMenuSurfaceInput
  | ExtensionUiDialogSurfaceInput

export interface ExtensionUiElement {
  kind: 'element'
  id?: string
  type: ExtensionUiComponentType
  key?: string
  props?: ExtensionUiProps
  children?: readonly ExtensionUiNode[]
  slots?: Record<string, readonly ExtensionUiNode[]>
}

export interface ExtensionUiText {
  kind: 'text'
  value: string
}

export interface ExtensionUiFragment {
  kind: 'fragment'
  children: readonly ExtensionUiNode[]
}

export type ExtensionUiNode = ExtensionUiElement | ExtensionUiText | ExtensionUiFragment

export interface ExtensionUiDocument {
  schemaVersion: 1
  documentId: string
  surface: ExtensionUiSurfaceKind
  root: ExtensionUiNode
  metadata?: Record<string, ExtensionUiValue>
}

export type ExtensionUiPropValue = ExtensionUiValue | ExtensionUiEventHandler
export type ExtensionUiProps = Record<string, ExtensionUiPropValue>
```

`ExtensionUiComponentType` 是白名单 union，不允许扩展传 arbitrary component name。`ExtensionUiProps` 由每个组件类型约束。Document 不包含 `title`、`description`、`size` 这类展示字段；这些信息属于 `Dialog`、`Section` 等具体组件 props，surface adapter 只把 root component 的结构解释成宿主 UI。

公共 schema 保留独立的 `children` 和 `slots`。`children` 表示默认内容，`slots` 表示命名内容，例如 `trigger`、`content`、`footer`、`control`。SDK helper 的 slot value 可以是单个 node 或 node array，normalizer 会统一成数组。`props` 只放可序列化值、action ref 和 command ref，不放 UI 节点；renderer 只渲染序列化节点，不接收 slot function。

authoring 层还需要定义 component 和 mount 类型，但这些类型不进入 renderer document：

```ts
export interface ExtensionUiRenderContext<
  TInput extends ExtensionUiSurfaceInput = ExtensionUiSurfaceInput
> {
  extension: ExtensionRuntimeMetadata
  storage: ExtensionStorage
  logger: ExtensionLogger
  kisaki: KisakiApi
  surfaceInput: TInput
  signal: AbortSignal
}

export interface ExtensionUiComponentDefinition<
  Props extends ExtensionUiParams = ExtensionUiParams
> {
  componentId: string
  render(
    context: ExtensionUiRenderContext,
    params: Props,
    slots: ExtensionUiAuthoringSlots
  ): Promise<ExtensionUiAuthoringNode> | ExtensionUiAuthoringNode
}

export interface ExtensionUiMountResolverContext<
  TInput extends ExtensionUiSurfaceInput = ExtensionUiSurfaceInput
> {
  surfaceInput: TInput
  extension: ExtensionRuntimeMetadata
  contributionId?: string
}

export type ExtensionUiMountParamsResolver<
  TSurfaceInput extends ExtensionUiSurfaceInput = ExtensionUiSurfaceInput,
  TParams extends ExtensionUiParams = ExtensionUiParams
> = (context: ExtensionUiMountResolverContext<TSurfaceInput>) => TParams

export interface ExtensionUiMount<
  TParams extends ExtensionUiParams = ExtensionUiParams,
  TSurfaceInput extends ExtensionUiSurfaceInput = ExtensionUiSurfaceInput
> {
  componentId: string
  params?: TParams | ExtensionUiMountParamsResolver<TSurfaceInput, TParams>
  title?: string
}
```

`ExtensionUiAuthoringNode` 是 SDK 内部类型，可以表示 element、fragment、text、component reference、mount target 和 action handler。host normalizer 必须把它全部转换为 `ExtensionUiNode` 和 session-local action map；转换失败时该 session open/refresh 返回 validation error。`ExtensionUiMount.title` 只作为 contribution list 或 opener fallback metadata，不参与 document rendering。

### 组件定义注册与生命周期

`ui.defineComponent(...)` 返回一个 authoring definition object，可以安全写在扩展模块顶层；它不依赖当前 active extension scope，也不会直接注册到 main 或 renderer。组件真正进入 host runtime registry 的时机是 host normalize 过程中：

- 注册 contribution 时，host 先捕获 `view: ui.mount(Component, ...)` 指向的 component definition。
- render 期间遇到 `ui.component(...)`、static `ui.command.open(ui.mount(...))` 或 action result 中的 mount target 时，host 把被引用 component definition 记录到当前 runtime registry。
- registry key 是当前 extension runtime + `componentId`，`componentId` 只要求在同一扩展内唯一。重复 id 指向不同 render function 时视为 validation error；同一 definition 多次引用是幂等的。
- normalized document 和 IPC payload 里只出现 `componentId`，不出现 definition object、render function 或 slot function。
- mount session 只能打开同一 runtime registry 中的 component；main/host 都必须拒绝跨 extension/runtime 的 componentId。
- runtime unload/reload 时清理该 runtime 的 component registry、sessions、action map 和 pending render/action。

## Action 模型

```ts
export interface ExtensionUiActionRef {
  actionId: string
}

export interface ExtensionUiEvent {
  sessionId: string
  documentId: string
  nodeId?: string
  actionId: string
  event: ExtensionUiEventName
  value?: ExtensionUiValue
  values?: Record<string, ExtensionUiValue>
}

export interface ExtensionUiMountTarget {
  componentId: string
  params?: ExtensionUiParams
  title?: string
}

export type ExtensionUiOpenOutlet = 'current' | 'dialog'

export interface ExtensionUiOpenCommand {
  type: 'open'
  target: ExtensionUiMountTarget
  outlet?: ExtensionUiOpenOutlet
}

export type ExtensionUiStaticCommand =
  | { type: 'refresh'; scope: 'current' | 'parent' | 'stack' | 'session' }
  | ExtensionUiOpenCommand
  | { type: 'close'; scope: 'current' | 'all' }
  | {
      type: 'notify'
      tone: 'success' | 'info' | 'warning' | 'error'
      title: string
      message?: string
    }

export type ExtensionUiPatch =
  | { op: 'mergeProps'; nodeId: string; props: ExtensionUiProps }
  | { op: 'replaceNode'; nodeId: string; node: ExtensionUiNode }
  | { op: 'removeNode'; nodeId: string }
  | { op: 'replaceChildren'; nodeId: string; children: readonly ExtensionUiNode[] }
  | { op: 'replaceSlot'; nodeId: string; slot: string; children: readonly ExtensionUiNode[] }

export interface ExtensionUiPatchCommand {
  type: 'patch'
  baseDocumentId: string
  documentId: string
  patches: readonly ExtensionUiPatch[]
}

export type ExtensionUiDocumentUpdateCommand =
  | { type: 'replace'; document: ExtensionUiDocument }
  | ExtensionUiPatchCommand

export type ExtensionUiCommand = ExtensionUiStaticCommand | ExtensionUiDocumentUpdateCommand

export interface ExtensionUiDispatchResult {
  success: boolean
  error?: ExtensionErrorShape
  commands?: readonly ExtensionUiCommand[]
}

export type ExtensionUiEventHandler =
  | ExtensionUiActionRef
  | ExtensionUiStaticCommand
  | readonly ExtensionUiStaticCommand[]
```

第一版支持 `replace`、`refresh` 和受限节点级 `patch`。patch 属于基础协议，不等到补强阶段，但它不是 RFC JSON Patch，也不开放任意 JSON Pointer、数组下标 diff 或自动 diff 引擎。第一版只支持按稳定 `nodeId` 定位的少量操作：合并 props、替换节点、删除节点、替换 children、替换命名 slot。

`ExtensionUiPatchCommand.baseDocumentId` 是前置条件，必须等于当前 session documentId；`documentId` 是应用 patch 后的新 documentId。host 在返回 patch 前必须先在 session 内把 patch 应用到当前 normalized document，并重新生成 action map 与 validation 结果；renderer 只负责把已经校验过的 patch 应用到当前 document。patchable node 必须有稳定 `id`；无 id 节点只能通过父节点的 `replaceChildren`/`replaceSlot` 或整段 `replaceNode` 更新。root 节点删除、跨 surface root 约束破坏、目标 nodeId 不存在、插入节点包含函数或非法 action ref 都必须被拒绝。需要替换整个 root 或大段结构时使用 `replace`。

`ui.action(name, handler)` 中的 `name` 只用于日志和诊断，不是 document 中的稳定 identity。每次 normalize 都为 handler 生成 opaque `actionId`，作用域是当前 `sessionId + documentId`；同一 document 内重复 action name 允许存在。没有 handler 的 `ui.action(name)` 不是有效事件 handler；无需扩展代码参与的交互应使用 static command，例如 `ui.command.notify(...)` 或 `ui.command.open(...)`。

renderer dispatch 时只能提交 `sessionId`、`documentId`、`actionId`、`event`、`nodeId`、`value` 和 `values`。`surfaceInput` 不由 renderer 回传，host 必须从 session 记录中读取真实 surface input，避免 renderer 篡改 entity/menu 输入。

事件 props 可以绑定 action，也可以绑定纯声明式 static command。绑定 command 时 renderer 不执行扩展函数，只把 command 交给当前 surface driver 校验和处理；绑定 action 时才会 dispatch 到 extension host。`replace`、`patch` 等 document update command 只能由 host action 返回，不能作为静态事件 handler 直接嵌入 document。

`ui.mount(...)` 只描述要打开的 target，也就是 component identity 和 params。打开位置、生命周期和 surface routing 属于 `open` command：

```ts
ui.command.open(ui.mount(AdvancedSettings, { mode: 'expert' }), {
  outlet: 'dialog'
})
```

`outlet: 'current'` 表示交给当前 surface 处理，例如 settings dialog stack；`outlet: 'dialog'` 表示打开到应用级 Extension UI dialog outlet，适合从 entity menu、popover、toolbar 等短生命周期 surface 打开独立 dialog。省略 `outlet` 时由当前 surface 选择默认策略；公共模板中，从 entity menu 打开 Dialog 应显式传 `outlet: 'dialog'`。

## Authoring API

推荐 API 以 `ui` namespace 暴露：

```ts
import { defineExtension, ui } from '@kisaki/extension-sdk'

interface BangumiSettingsParams {
  title: string
}

const BangumiSettings = ui.defineComponent<BangumiSettingsParams>(
  'bangumi.settings',
  async (ctx, params) => {
    const accessToken = await ctx.storage.get('accessToken', '')

    return ui.dialog({
      title: params.title,
      size: 'md',
      slots: {
        content: ui.form({
          id: 'bangumi-settings-form',
          children: [
            ui.section({
              id: 'api',
              title: 'API',
              children: [
                ui.field({
                  id: 'accessToken',
                  label: 'Access token',
                  description: 'Used for authenticated Bangumi requests.',
                  slots: {
                    control: ui.input({
                      name: 'accessToken',
                      type: 'password',
                      defaultValue: typeof accessToken === 'string' ? accessToken : ''
                    })
                  }
                }),
                ui.notice({
                  id: 'rate-limit',
                  tone: 'info',
                  children: ['Requests are limited to 4 per second.']
                })
              ]
            })
          ],
          onSubmit: ui.action('saveSettings', async (event, ctx) => {
            const token = event.values?.accessToken
            await ctx.storage.set('accessToken', typeof token === 'string' ? token.trim() : '')
            return ui.result.closeAll({ message: 'Settings saved.' })
          })
        }),
        footer: ui.dialog.footer({
          children: [
            ui.button({
              variant: 'outline',
              children: ['Cancel'],
              onClick: ui.action('cancel', () => ui.result.closeCurrent())
            }),
            ui.button({
              type: 'submit',
              form: 'bangumi-settings-form',
              children: ['Save']
            })
          ]
        })
      }
    })
  }
)

export default defineExtension({
  activate(context) {
    context.contributes.settings.register({
      id: 'settings',
      title: 'Bangumi',
      view: ui.mount(BangumiSettings, { title: 'Bangumi' })
    })
  }
})
```

这里 `BangumiSettings` 是预先写好的 UI，registration 只传 `view` 和参数。

## 组件复用与参数传递

组件定义可以同步或异步 render，可以被 settings、entity menu 或其他组件复用。

```ts
interface ProviderStatusParams {
  providerName: string
  connected: boolean
}

const ProviderStatus = ui.defineComponent<ProviderStatusParams>(
  'shared.provider-status',
  (_ctx, params) =>
    ui.inline({
      gap: 'sm',
      align: 'center',
      children: [
        ui.badge({
          tone: params.connected ? 'success' : 'warning',
          children: [params.connected ? 'Ready' : 'Offline']
        }),
        ui.text({ tone: 'muted', children: [params.providerName] })
      ]
    })
)

const ProviderStatusExample = ui.defineComponent('shared.provider-status-example', () =>
  ui.stack({
    gap: 'md',
    children: [
      ui.component(ProviderStatus, { providerName: 'Bangumi', connected: true }),
      ui.button({
        children: ['Test'],
        onClick: ui.command.notify({
          tone: 'info',
          title: 'Provider status checked.'
        })
      })
    ]
  })
)
```

`ui.mount(...)` 的 params 必须是 `ExtensionUiValue`，因为 mount target 可能跨 session、IPC 和 host registry 传递。`ui.component(...)` 的 params 同样保持可序列化；UI 结构注入通过第三个 slots 参数完成。扩展作者可以使用普通 TypeScript 条件和循环组合 UI，因为这些逻辑在 host 内执行，renderer 仍然只收到结果 DTO。

`ui.component(...)` 不是 document element。host normalizer 必须在 render 阶段递归执行被引用组件并展开为普通 `ExtensionUiNode`。展开规则：

- componentId 必须在当前 extension runtime 的 UI registry 中存在。
- params 和 slots 必须可序列化或可 normalize。
- 组件递归深度有上限，第一版建议 32；超过上限返回 validation error。
- 同一组件可以重复实例化，但不得通过同步递归无限展开。
- action handler 注册到当前 session action map，生成的 actionId 只在该 session/document version 内有效。

组件组合中的命名内容通过 slots 传递。一个完整 dialog 组件如果需要让调用方决定 trigger，可以接收 `trigger` slot：

```ts
interface AdvancedSettingsParams {
  mode: 'normal' | 'expert'
}

const AdvancedSettings = ui.defineComponent<AdvancedSettingsParams>(
  'bangumi.advanced-settings',
  (_ctx, params, slots) =>
    ui.dialog({
      title: 'Advanced Settings',
      slots: {
        trigger: slots.trigger,
        content: ui.form({
          children: [
            ui.notice({
              tone: params.mode === 'expert' ? 'warning' : 'info',
              children: ['Advanced provider controls.']
            })
          ]
        })
      }
    })
)

ui.component(
  AdvancedSettings,
  { mode: 'expert' },
  {
    trigger: ui.button({ children: ['Advanced'] })
  }
)
```

如果要按需挂载同一个组件，使用通用 command open。此时打开动作由当前按钮负责，mount target 只负责返回要显示的 UI：

```ts
ui.button({
  children: ['Advanced'],
  onClick: ui.command.open(ui.mount(AdvancedSettings, { mode: 'expert' }), {
    outlet: 'current'
  })
})
```

## Entity menu API

```ts
const GameMenuContent = ui.defineComponent<{ gameId: string }>(
  'bangumi.game-menu-content',
  (_ctx, params) =>
    ui.fragment({
      children: [
        ui.menu.item({
          id: 'open-bangumi',
          icon: 'icon-[mdi--open-in-new]',
          children: ['Open in Bangumi'],
          onSelect: ui.action('openGame', async () => {
            await openBangumiPage(params.gameId)
            return ui.result.ok()
          })
        }),
        ui.menu.separator(),
        ui.menu.checkboxItem({
          id: 'sync-enabled',
          checked: true,
          children: ['Auto sync'],
          onChange: ui.action('toggleSync', async (event, ctx) => {
            await ctx.storage.set('autoSync', event.value === true)
            return ui.result.refreshCurrent()
          })
        })
      ]
    })
)

context.contributes.entityMenus.register({
  id: 'bangumi-game',
  target: 'game.single',
  order: 100,
  view: ui.mount(GameMenuContent, ({ surfaceInput }) => ({
    gameId: surfaceInput.input.entityId
  }))
})
```

`ui.mount` 的 params 可以是静态 record，也可以是 host-side resolver。resolver 接收 `surfaceInput`，只在 extension host 执行。对于 entity menu contribution，SDK 根据 `target` 把 `surfaceInput` 缩窄为 `ExtensionUiEntityMenuSurfaceInput<TInput>`；`TInput` 是 `EntityMenuResolveInput`，不是 `ExtensionUiMount` 的 surface input 泛型本身。resolver 输出必须是 `ExtensionUiParams`；如果 resolver 抛错或返回不可序列化值，本次 session open 失败并记录 validation diagnostics。

从 entity menu 打开复杂 UI 时，不在 menu content 树里嵌套 `ui.dialog(...)`。菜单项返回 open command，并把 dialog 挂到应用级 dialog outlet；菜单关闭和 menu session 释放不会影响新打开的 dialog session：

```ts
ui.menu.item({
  children: ['Advanced'],
  onSelect: ui.command.open(ui.mount(AdvancedGameDialog, { gameId: params.gameId }), {
    outlet: 'dialog'
  })
})
```

复合组件的附属组件应收在父组件 namespace 下，而不是全部铺到 `ui.*` 顶层。顶层保留通用 primitive，例如 `ui.stack`、`ui.text`、`ui.button`、`ui.input`；强约束子组件使用 `ui.menu.item`、`ui.menu.separator` 这类 scoped helper，后续追加 Tabs/Table 时再提供 `ui.tabs.*`、`ui.table.*`，方便类型提示和 validation 限制父子关系。

### 后续 overlay 扩展

Dialog、Popover、Menu 属于同一类结构化 overlay 组件。第一版 MVP 只公开 `Dialog` 和 entity menu content nodes；`Popover` 与完整 `Menu` overlay 进入后续独立小版本。扩展可以声明这些 overlay 的结构，但不能直接管理 DOM、portal 或 renderer root：

```ts
ui.popover({
  slots: {
    trigger: ui.button({ children: ['Advanced'] }),
    content: ui.stack({
      gap: 'sm',
      children: [ui.text({ children: ['Extra provider controls'] })]
    })
  }
})
```

后续公开的 `ui.menu(...)` 只表示完整菜单 overlay，需要通过 `presentation` 对齐 renderer 的实际菜单组件：

```ts
ui.menu({
  presentation: 'dropdown',
  slots: {
    trigger: ui.button({ children: ['More'] })
  },
  children: [
    ui.menu.item({
      children: ['Refresh'],
      onSelect: ui.command.refresh({ scope: 'current' })
    })
  ]
})
```

`presentation: 'dropdown'` 映射到 `components/ui/dropdown-menu`，`presentation: 'context'` 映射到 `components/ui/context-menu`。entity menu contribution 不使用完整 `ui.menu(...)`，因为注册环境已经是主应用菜单的 content 区域；它应该直接返回 `ui.menu.item(...)`、`ui.menu.group(...)`、`ui.menu.separator(...)` 等内容节点，或返回包含这些节点的 `ui.fragment(...)`。

后续开放完整菜单 overlay 时，SDK 不额外提供 `ui.menu.dropdown(...)`、`ui.menu.context(...)` 或 `ui.menu.content(...)` 这类 helper，避免菜单 API 分裂。完整菜单统一使用 `ui.menu({ presentation, slots, children })`；菜单内容节点统一使用 `ui.menu.*` scoped helpers。

## 组件目录第一版 MVP

### Layout

- `Stack`: `direction`、`gap`、`align`、`justify`、`wrap`。
- `Inline`: compact inline flow。
- `Grid`: `columns`、`minColumnWidth`、`gap`。
- `ScrollArea`: `maxHeight`、`orientation`。
- `Section`: `title`、`description`、`density`。
- `Group`: related controls。
- `Toolbar`: compact command row。

### Text and display

- `Text`、`Heading`、`Badge`、`Icon`、`Notice`、`Status`、`Separator`、`Spinner`。

### Form

- `Form`、`Field`、`FieldSet`、`Input`、`Textarea`、`Select`、`Checkbox`、`Switch`、`RadioGroup`、`Slider`、`SegmentedControl`、`ButtonGroup`。
- `Input` 统一承载文本、数字、密码、邮箱、URL、搜索、电话等输入场景，通过 `type`、`inputMode`、`min`、`max`、`step` 等 props 表达，不单独暴露 `TextInput` 或 `NumberInput`。

### Navigation and overlay

- `Dialog`: `title`、`description`、`size`、`onOpenChange`，slots 包括 `trigger`、`content`、`footer`。附属 helper 收在 `ui.dialog.*` 下，例如 `ui.dialog.footer(...)`。
- renderer adapter 统一负责 overlay 的 portal、focus trap、定位、层级和关闭行为，扩展只声明结构。

### Menu

- `MenuGroup`、`MenuItem`、`MenuCheckboxItem`、`MenuRadioGroup`、`MenuRadioItem`、`MenuSub`、`MenuSeparator`、`MenuLabel`。
- SDK helper 使用 `ui.menu.*` namespace，例如 `ui.menu.item(...)`、`ui.menu.group(...)`、`ui.menu.sub(...)`。

第一版 MVP 的目标是跑通 settings dialog、entity menu content、action dispatch 和 dialog outlet。以下组件不进入第一版 public helper，后续按实际 surface 需求追加：`Split`、`Panel`、`Image`、`Markdown`、`Progress`、`Empty`、`Tabs`、`Collapsible`、`Tooltip`、`Popover`、完整 `Menu` overlay、复杂 `Table`、`VirtualList`、图表和 markdown editor。

如果 renderer 已有这些 Vue 组件，也不要在 Phase 1 一次性写入公共 schema；公共 Extension UI props 一旦发布就会形成兼容负担。

## Props 设计规则

- 使用 semantic variants，不开放 arbitrary class。
- 尺寸使用 `xs | sm | md | lg` 或 surface-specific density。
- icon 第一版使用 Kisaki 维护的公共 icon id 或构建期 safelist 内的 Iconify class；不能让扩展运行时传入任意 `icon-[...]`，否则 Tailwind/Iconify 可能没有生成对应 CSS。
- 图片 URL 只允许 `https:`、`data:` 安全子集、extension asset URL 或 app-provided file URL。
- markdown 禁止 raw HTML，renderer 继续使用安全 markdown renderer。
- action props 命名贴近项目和 DOM 语义：按钮使用 `onClick`，表单使用 `onSubmit`，值控件使用 `onChange`，菜单项使用 `onSelect`，受控展开状态使用 `onOpenChange`。
- 表单控件使用 `name` 表示 form value key，`id` 表示 node identity。两者可以相同，但语义分开。
- 第一版表单控件同时支持 `defaultValue` 和受控 `value`，但同一个控件不能同时声明两者。
- `defaultValue` 表示非受控模式：renderer 用它初始化本地 draft，用户编辑只更新本地 draft，submit 时发送当前 form values；显式声明 `onChange` 时才额外 dispatch。
- `value` 表示受控模式：document value 是 source of truth，用户编辑必须通过 `onChange` dispatch 到 host；action 应返回 `refresh`、`replace` 或 `patch` 产生新 document value 来提交新值。没有 `onChange` 的受控控件按 read-only 渲染。
- refresh/replace/patch document 会用新 `defaultValue` 或 `value` 重新同步对应 form scope；非受控控件的普通 change action 不会自动覆盖正在编辑的本地 draft，受控控件则始终以最新 document value 为准。

## MVP Contract Invariants

- Document 中不存在函数、component definition、slot function、params resolver 或 raw class。
- `documentId` 每次 render/refresh/replace/patch 都变化；旧 document 的 action dispatch 必须返回 `stale_document`。
- `actionId` 只在当前 `sessionId + documentId` 内有效，renderer 不能跨 session 复用。
- renderer 不回传 `surfaceInput`；host 从 session 读取真实 surface input。
- settings/dialog outlet root 必须是 `Dialog`；entity menu contribution root 只能是 `Menu*` 内容节点或其 fragment。
- 表单控件的 `defaultValue` 与 `value` 互斥；`value` 属于第一版 public contract。
- static event handler 只能包含 static command；document update command 只能来自 host action result。
- patch 只支持第一版定义的节点级操作；复杂 diff helper、自动 patch 生成和可视化诊断属于后续减少重复劳动的 SDK/tooling。
- 完整 `Menu` overlay、`Popover`、`Table`、`VirtualList` 不属于第一版 public contract。

## Validation

公共验证器必须覆盖：

- document shape 和 `schemaVersion`。
- component type 白名单。
- props 与 component type 匹配。
- normalized document 中不得出现 function、component reference、params resolver 或非白名单 component name。
- `id` 在同一 document 内唯一，允许无 id 的纯布局节点。
- `name` 在同一 form scope 内唯一。
- params、props、values 全部可序列化。
- action ref 必须存在于当前 session action map。
- static event handler 只能包含 static command；`replace`、`patch` 等 document update command 只能来自 action result。
- patch command 的 `baseDocumentId` 必须匹配当前 session document，`documentId` 必须是新的 document version；目标 nodeId 必须存在且唯一，root 删除不允许，插入或替换的节点必须通过完整 document node validation。
- slots 名称必须是 component 支持的 slot，并满足父子关系约束。
- surface root 约束：settings/dialog outlet 必须返回 `Dialog` root；entity menu contribution 只能返回 `Menu*` 内容节点或其 fragment。
- form control value mode：`defaultValue` 和 `value` 不能同时出现；受控 `value` 控件必须有 `onChange` 或显式 read-only 语义。
- children 深度、节点数量、字符串长度有上限，防止扩展生成过大 UI。
- component 展开深度和节点总数有上限；normalizer 必须在超限时返回可诊断错误。
- componentId 在同一 extension runtime 内唯一，跨 extension 不能引用。
- validation error 必须包含稳定 `code`、简短 message 和 path；dev mode 可以展示详细 diagnostics，production renderer 只展示可读摘要。
