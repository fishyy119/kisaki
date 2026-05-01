# 04 Runtime Protocol And Host

Extension UI 协议把现有 settings/entity menus 专用 RPC 合并成通用 session、render、dispatch、release。extension host 仍是唯一执行扩展代码的进程，main 只是 owner-aware proxy。

## RPC 分层

### Host to main registration

新增 host -> main bridge RPC：

```ts
'bridge.ui.register': {
  runtimeHandle: ExtensionRuntimeHandle
  contribution: ExtensionUiContributionRegistration
}

'bridge.ui.unregister': {
  runtimeHandle: ExtensionRuntimeHandle
  contributionId: string
}
```

`ExtensionUiContributionRegistration` 只包含 renderer/main 需要展示和路由的 metadata：

```ts
export interface ExtensionUiContributionRegistration {
  id: string
  surface: ExtensionUiContributionSurfaceKind
  title?: string
  description?: string
  order?: number
  target?: EntityMenuTarget
  capabilities?: readonly ExtensionUiSurfaceCapability[]
}
```

真正的 component definition、params resolver、action handler 留在 host registry。

### Main to host session RPC

新增 main -> host RPC：

```ts
'ui.session.open'
'ui.session.refresh'
'ui.dispatch'
'ui.session.release'
```

请求结构。session open 分两类：打开注册 contribution，或从已有 session/action 打开同一 extension 的 mount target：

```ts
export interface ExtensionUiContributionSessionOpenRequest extends ContributionScopedRpcParams {
  kind: 'contribution'
  sessionId: string
  surface: ExtensionUiContributionSurfaceKind
  surfaceInput?: ExtensionUiSurfaceInput
  params?: Record<string, ExtensionUiValue>
}

export interface ExtensionUiMountSessionOpenRequest extends ExtensionScopedRpcParams {
  kind: 'mount'
  sessionId: string
  sourceSessionId?: string
  surface: ExtensionUiSurfaceKind
  surfaceInput?: ExtensionUiSurfaceInput
  target: ExtensionUiMountTarget
}

export type ExtensionUiSessionOpenRequest =
  | ExtensionUiContributionSessionOpenRequest
  | ExtensionUiMountSessionOpenRequest

export interface ExtensionUiDispatchRequest extends ExtensionScopedRpcParams {
  contributionId?: string
  sessionId: string
  documentId: string
  event: ExtensionUiEvent
}
```

`kind: 'mount'` 解决 `ui.command.open(ui.mount(...))` 的归属问题。main 根据当前 session 或 command 所属 contribution 找到 runtime owner，再请求同一 runtime 渲染 target component。host 必须拒绝跨 extension/runtime 的 componentId，避免一个扩展打开另一个扩展的私有组件。

响应结构：

```ts
export interface ExtensionUiSessionResult {
  sessionId: string
  document: ExtensionUiDocument
}

export interface ExtensionUiDispatchResponse {
  result: ExtensionUiDispatchResult
  document?: ExtensionUiDocument
}
```

## Main IPC

renderer 只和 main IPC 交互：

```ts
'extension:open-ui-session'
'extension:open-ui-mount-session'
'extension:refresh-ui-session'
'extension:dispatch-ui-event'
'extension:release-ui-session'
'extension:get-ui-contributions'
```

settings 和 entity menu 可以保留语义化 facade 函数，但底层 IPC 统一：

- `openExtensionSettingsSession()` 调 `extension:open-ui-session`，surface 为 `settings`。
- `resolveExtensionEntityMenu()` 调 `extension:open-ui-session`，surface 为 `entity-menu`。
- surface driver 处理 `open` command 时调 `extension:open-ui-mount-session`，传 `sourceSessionId`、目标 `mount` 和目标 surface/outlet。

这样 renderer 调用点可以逐步干净改名，但不需要保留旧 Extension UI 数据模型。

## Host session 管理

host session 记录：

```ts
interface ExtensionUiSession {
  runtimeHandle: string
  extensionId: string
  contributionId?: string
  sourceSessionId?: string
  sessionId: string
  surface: ExtensionUiSurfaceKind
  surfaceInput: ExtensionUiSurfaceInput | undefined
  params: Record<string, ExtensionUiValue>
  mount: ExtensionUiMountTarget
  documentId: string
  actions: Map<string, ExtensionUiActionRecord>
  ttlTimer: ReturnType<typeof setTimeout> | null
}
```

render 流程：

1. 根据 open kind 选择 mount：contribution session 从 contribution registry 取注册 view；mount session 从 target componentId 取同 runtime component definition。
2. 解析静态 params 或执行 params resolver，resolver 接收统一 `surfaceInput`。
3. 创建 `ExtensionUiRenderContext`，包含 extension scope、surfaceInput、params、storage、capabilities、abort signal。
4. 执行 component render，得到 authoring tree。
5. normalize authoring tree：递归展开 `ui.component(...)`，解析 slots，替换 action handler 为 actionId，生成 `ExtensionUiDocument`。
6. 运行 validation，包括 component whitelist、surface root、actionId 存在性、静态 command 合法性。
7. 保存 session action map 和 document version。

每次 refresh 默认重新 render 并替换 action map。旧 documentId 失效，renderer 对过期 document dispatch 时应收到 `stale_document` 并刷新。

## Action 执行

action record：

```ts
interface ExtensionUiActionRecord {
  nodeId?: string
  event: ExtensionUiEventName
  invoke(
    event: ExtensionUiEvent,
    context: ExtensionUiActionContext
  ): Promise<ExtensionUiDispatchResult>
}
```

执行规则：

- action 总是在 extension execution scope 中运行。
- action receives `AbortSignal`，runtime unload、session release、RPC timeout 时 abort。
- action result 必须经 `validateExtensionUiDispatchResult`。
- action result 可以返回 document update command，例如 `replace`；静态 event handler 不允许直接包含 document update command。
- 抛错会转换为 `{ success: false, error }`，main 记录详细日志，renderer 只展示可读错误。
- action 可返回 commands，例如 refresh、replace、close、notify。

## Surface input

```ts
export type ExtensionUiContributionSurfaceKind = 'settings' | 'entity-menu'
export type ExtensionUiSurfaceKind = ExtensionUiContributionSurfaceKind | 'dialog'

export type ExtensionUiSurfaceInput =
  | { surface: 'settings'; frameId?: string; params?: Record<string, ExtensionUiValue> }
  | { surface: 'entity-menu'; input: EntityMenuResolveInput }
  | {
      surface: 'dialog'
      opener?: ExtensionUiDialogOpenerInfo
      params?: Record<string, ExtensionUiValue>
    }
```

`ExtensionUiCommand.open` 使用 `ExtensionUiMountTarget` 按需挂载扩展组件。`mount` target 是纯目标描述，不携带 outlet、stack、presentation 这类打开策略：

```ts
export interface ExtensionUiMountTarget {
  componentId: string
  params?: Record<string, ExtensionUiValue>
  title?: string
}

export type ExtensionUiOpenOutlet = 'current' | 'dialog'

export interface ExtensionUiOpenCommand {
  type: 'open'
  target: ExtensionUiMountTarget
  outlet?: ExtensionUiOpenOutlet
}
```

host 可以要求 target component 必须来自同一 extension runtime，避免跨扩展执行。

`outlet` 由 main/renderer surface driver 解释：

- `current`: 在当前 surface 内打开，例如 settings dialog stack 中再 push 一个 dialog frame。
- `dialog`: 打开到应用级 Extension UI dialog outlet，创建独立 dialog session，不挂在当前 menu/popover/session 的渲染子树下。

entity menu surface 处理 `outlet: 'dialog'` 时，应先请求 main 打开新的 mount session，目标 surface 为 `dialog`，再允许当前 menu 正常关闭和释放。这样 menu close 不会卸载被打开的 dialog。`outlet: 'dialog'` 的 target render 后必须返回 `Dialog` root；如果返回其他 root，host/main 应按 invalid document 处理。

## Main-side contribution host

main 新增 `ExtensionUiContributionHost`，替换：

- `ExtensionSettingsContributionHost`
- `ExtensionEntityMenuContributionHost`

它负责：

- registration owner lookup。
- public contribution id uniqueness。
- snapshot sorting。
- session open/refresh/dispatch/release forwarding。
- mount session open：根据 source session 或 explicit owner 找到 runtime，并要求 target component 属于同一 extension。
- surface-specific aggregation，例如 entity menu 按 target resolve 多个 contribution。

entity menu 聚合仍可并发请求多个 contribution，但每个 contribution 返回同一种 Extension UI document，document root 受 entity menu surface 限制为 `MenuNode` 或 `Fragment<MenuNode>`。renderer surface adapter 可以把多个 menu content document group 合并进主应用已有菜单。

## Cleanup

需要在以下场景释放 session：

- renderer dialog/menu close。
- entity menu input 变化。
- extension unload/reload。
- host crash/recycle。
- session TTL 到期。
- stale request 被 renderer 丢弃。

TTL 继续使用当前 10 分钟默认值，entity menu 可以更短，例如 2 分钟。TTL 过期只释放 callback/action map，不应影响 contribution registration。

## 性能策略

- document node 数量第一版限制为 500，entity menu surface 限制为 100。
- action dispatch 默认 15 秒 timeout，release 默认 5 秒。
- renderer 递归渲染使用 component registry，避免动态 import 扩展代码。
- 大列表必须使用 Extension UI `VirtualList` 或 app-owned picker，不允许扩展生成几千个普通节点。
- document replace 是第一版唯一公开的 document update 方式，patch 在后续优化阶段开启。

## 安全策略

- 不允许 raw HTML、script、style、custom class。
- 不允许扩展传 Vue component、render function 或 slot function 到 renderer。
- asset URL 通过 main/host 生成安全 URL 或显式校验。
- actionId 随 session 生成，renderer 不能伪造其他 session 的 action。
- main 在所有 IPC handler 校验 extensionId、contributionId、sessionId、documentId。
- renderer 对 unknown component 显示安全错误占位，不崩溃整个 app。
