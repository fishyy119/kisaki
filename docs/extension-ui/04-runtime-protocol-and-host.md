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
  params?: ExtensionUiParams
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

renderer 到 main 的 dispatch request 不携带 `extensionId`、`runtimeHandle` 或 `surfaceInput`。renderer 只提交当前 session/document/action 的 opaque ids 和事件值；main 根据 session owner table 找到 runtime owner，host 根据 session 记录读取真实 `surfaceInput`。

## Main session owner table

main 必须维护 active UI session 表，而不是信任 renderer 传入的 owner 字段：

```ts
interface ExtensionUiMainSessionRecord {
  sessionId: string
  runtimeHandle: ExtensionRuntimeHandle
  extensionId: string
  contributionId?: string
  surface: ExtensionUiSurfaceKind
  sourceSessionId?: string
  documentId: string
  openedAt: number
}
```

open contribution session 时，main 从 contribution registry 找到 owner 并创建 session record。open mount session 时，main 优先通过 `sourceSessionId` 找到 owner；没有 source session 的 internal call 必须显式传入 main 已验证过的 owner，不允许 renderer 自报 owner。dispatch、refresh、release 都先查 session record，再校验 `documentId` 和 surface，最后才转发给 host。session 不存在、document 过期或 owner 不匹配时返回结构化错误，例如 `stale_session`、`stale_document`、`unavailable`。

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
  params: ExtensionUiParams
  mount: ExtensionUiMountTarget
  documentId: string
  document: ExtensionUiDocument
  actions: Map<string, ExtensionUiActionRecord>
}
```

render 流程：

1. 根据 open kind 选择 mount：contribution session 从 contribution registry 取注册 view；mount session 从 target componentId 取同 runtime component definition。
2. 解析静态 params 或执行 params resolver，resolver 接收统一 `surfaceInput`。
3. 创建 `ExtensionUiRenderContext`，包含 extension scope、surfaceInput、params、storage、capabilities、abort signal。
4. 执行 component render，得到 authoring tree。
5. normalize authoring tree：递归展开 `ui.component(...)`，解析 slots，替换 action handler 为 actionId，生成 `ExtensionUiDocument`。
6. 运行 validation，包括 component whitelist、surface root、actionId 存在性、静态 command 合法性。
7. 保存 session 当前 document、action map 和 document version。

每次 refresh 默认重新 render 并替换当前 document 与 action map。旧 documentId 失效，renderer 对过期 document dispatch 时应收到 `stale_document` 并刷新。

## Action 执行

action record：

```ts
interface ExtensionUiActionRecord {
  actionLabel: string
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
- action context 从 host session 读取 `surfaceInput`、params、storage、logger、kisaki API；renderer event 不包含也不能覆盖这些字段。
- action result 必须经 `validateExtensionUiDispatchResult`。
- action result 可以返回 document update command，例如 `replace` 或受限节点级 `patch`；静态 event handler 不允许直接包含 document update command。
- 抛错会转换为 `{ success: false, error }`，main 记录详细日志，renderer 只展示可读错误。
- action 可返回 commands，例如 refresh、replace、patch、close、notify。

### Document update command

`replace` 和 `patch` 都只能来自 host action result。host 处理 document update 时必须先更新自己的 session 当前 document 和 action map，再把 normalized command 返回给 main/renderer。main 根据返回的新 documentId 更新 active session owner table；renderer 只接受当前 documentId 匹配的 update。

`patch` 是第一版基础设施，但只做节点级小集合：

- 不实现完整 JSON Patch、JSON Pointer、数组下标 diff 或自动 diff 引擎。
- patch 以 `baseDocumentId` 作为前置条件，应用成功后产生新的 `documentId`。
- patch target 通过稳定 `nodeId` 定位；目标 nodeId 必须存在且唯一。
- 支持 `mergeProps`、`replaceNode`、`removeNode`、`replaceChildren`、`replaceSlot`。
- 插入或替换的节点必须经过 normalizer 和 validation，不能包含函数、component definition、slot function、非法 action ref 或非白名单 component。
- root 节点删除不允许；替换整个 root 或跨越 surface root 约束的更新应使用 `replace`。
- patch 后被删除节点的 action 失效；未变更节点的 action 可以复用，但 dispatch 仍必须携带新的 `documentId`。
- renderer 应用 patch 失败时触发一次 refresh；仍失败则显示可恢复错误。

## Command 执行边界

static command 是 document 的一部分，但仍需要由 surface driver 和 main session host 校验：

- `close`、当前 surface 内的 `refresh` 可以由 renderer surface driver 发起对应 IPC，最终由 main 校验 session 后执行。
- `open` 必须经过 main `openExtensionUiMountSession`，由 main 基于 source session 绑定 runtime owner，host 再校验 target component 属于同一 runtime。
- `notify` 第一版可以作为 static command，但 renderer 只负责把命令交给 main 或应用级通知 facade；main 应按当前 session owner 记录日志和审计。扩展需要更复杂的通知生命周期时继续使用 `kisaki.notify` capability。
- `replace`、`patch` 只能来自 host action result，不能出现在 static event handler 里。

## Surface input

```ts
export type ExtensionUiContributionSurfaceKind = 'settings' | 'entity-menu'
export type ExtensionUiSurfaceKind = ExtensionUiContributionSurfaceKind | 'dialog'

export type ExtensionUiSurfaceInput =
  | ExtensionUiSettingsSurfaceInput
  | ExtensionUiEntityMenuSurfaceInput
  | ExtensionUiDialogSurfaceInput
```

`ExtensionUiCommand.open` 使用 `ExtensionUiMountTarget` 按需挂载扩展组件。`mount` target 是纯目标描述，不携带 outlet、stack、presentation 这类打开策略：

```ts
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
- active session owner table。
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
- app shutdown。
- renderer webContents destroyed、窗口关闭或 renderer 主动 release。
- stale request 被 renderer 丢弃。

第一版不使用 session TTL。settings/dialog 可能长时间编辑，不能因为时间流逝丢失 action map；entity menu 虽然短生命周期，也应由菜单关闭、input 变化或组件卸载主动 release。TTL 不作为正确性机制，避免隐藏 renderer lifecycle bug。若需要防泄漏，开发模式可以记录 session age、owner、surface、last documentId，并对长时间未 release 的 session 打 warning；production cleanup 仍以确定性 lifecycle 为准。已释放、runtime 已卸载或 host 已重启后的旧 dispatch 返回 `stale_session`。

## 性能策略

- document node 数量第一版限制为 500，entity menu surface 限制为 100。
- action dispatch 默认 15 秒 timeout，release 默认 5 秒。
- renderer 递归渲染使用 component registry，避免动态 import 扩展代码。
- 大列表必须使用 Extension UI `VirtualList` 或 app-owned picker，不允许扩展生成几千个普通节点。
- 第一版公开 `replace` 和受限节点级 `patch` 两种 document update。小范围属性或局部 children/slot 变化优先使用 patch；整棵树或 root 语义变化使用 replace。

## 安全策略

- 不允许 raw HTML、script、style、custom class。
- 不允许扩展传 Vue component、render function 或 slot function 到 renderer。
- asset URL 通过 main/host 生成安全 URL 或显式校验。
- actionId 随 session 生成，renderer 不能伪造其他 session 的 action。
- main 在所有 IPC handler 通过 session owner table 校验 sessionId、documentId、surface 和 owner；renderer 不能自报 runtime owner 或 surfaceInput。
- renderer 对 unknown component 显示安全错误占位，不崩溃整个 app。
