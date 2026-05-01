# 02 Target Architecture

Extension UI 的目标架构是一个统一、类型安全、可组合、可参数化的扩展 UI 运行时。扩展作者写声明式 TypeScript UI，extension host 执行 render 和 action，renderer 只渲染序列化后的白名单组件。

## 设计原则

- 单一 UI 模型：所有扩展 UI surface 使用 `ExtensionUiDocument`。
- 双层 UI contract：扩展作者写 authoring definition，host normalize 成 renderer document；函数、组件引用和 params resolver 不得出现在 document 中。
- 分层清晰：contract 在 `extension-api`，authoring sugar 在 `extension-sdk`，执行在 extension host，转发和聚合在 main，实际渲染在 renderer。
- 安全默认：不暴露 Vue 组件、DOM、CSS、Electron、renderer store 或 main service 给扩展。
- 复杂 UI 通过组合实现：组件、children、slots、参数、条件、循环、局部 action、surface command 都是一等概念。
- 公共 API 稳定：Extension UI props 是 Kisaki 公共契约，不能直接复用 renderer Vue props 类型。
- 不兼容旧系统：最终删除旧 settings/entity menu UI contract；实现阶段必须保持可 typecheck，旧系统只在内置扩展和模板迁移后删除。

## 模块职责

### extension-api

新增 `packages/extension-api/src/ui/`：

- `values.ts`: Extension UI 可序列化值、record、params。
- `definition.ts`: component definition、mount target、params resolver context、authoring event handler 类型。
- `node.ts`: `ExtensionUiNode`、`ExtensionUiElement`、`ExtensionUiText`、children、slots。
- `components.ts`: 公共组件类型、props、variant union。
- `actions.ts`: action reference、event payload、dispatch result、commands。
- `document.ts`: `ExtensionUiDocument`、document metadata、schema version。
- `surfaces.ts`: settings、entity menu 等 surface contract。
- `validation/`: shape validation、id uniqueness、component whitelist、serializable value validation。

`packages/extension-api/src/contributions/settings` 和 `entity-menus` 只保留贡献点元数据与 surface input 类型，或直接迁移到 `src/ui/surfaces/` 后由 `contributions` re-export。

### extension-sdk

新增 `packages/extension-sdk/src/ui/`：

- `ui`: author-facing builder namespace。
- `ui.defineComponent<Props>()`: 定义可复用组件。
- `ui.mount(Component, params)`: 生成纯 mount target，仅包含 component identity 和 params。
- `ui.action(name, options?)`: 绑定 action。
- `ui.fragment(...)`、`ui.slot(name)` 与 `ui.children(...)`: 支持 fragment、slots、children composition。
- component helpers：`ui.button(...)`、`ui.stack(...)`、`ui.field(...)` 等。

SDK 不拥有 runtime 状态，只负责构造类型安全的 Extension UI definition。实际 scope、storage、capabilities 仍由 extension host bridge 注入。

### extension host

新增 `apps/desktop/src/main/services/extension/runtime/host/ui/`：

- `registry.ts`: 保存每个 runtime 的 Extension UI contribution 与 component definitions。
- `renderer.ts`: 在 extension execution scope 内执行 component render。
- `session.ts`: 管理 UI session、document version、callback/action map、TTL。
- `actions.ts`: 处理 dispatch、运行 action、第一版返回 replace document；patch 留到 hardening 阶段。
- `normalizer.ts`: 校验 document，替换函数引用，生成 action id。

host 是唯一执行扩展 UI 代码的地方。

### main process

新增 `apps/desktop/src/main/services/extension/ui/`：

- `contribution-host.ts`: 统一 settings/entity menu/future surfaces 的 main-side contribution registry。
- `session-host.ts`: 打开、刷新、dispatch、release Extension UI session。
- `ipc.ts`: renderer IPC adapter。
- `types.ts`: main 内部 owner、registration、surface context 类型。

main 不理解每个 UI 组件怎么渲染，只理解 surface、session、document、event、command。

### renderer

新增 `apps/desktop/src/renderer/src/core/extensions/ui/`：

- `ipc.ts`: Extension UI IPC facade。
- `store.ts`: contribution snapshot 和 active session 辅助状态。
- `draft.ts`: 表单 draft、value binding、dirty state。
- `events.ts`: 把组件事件转成 dispatch request。

新增/重组 `apps/desktop/src/renderer/src/components/shared/extension/`：

- `renderer/document-renderer.vue`: 渲染 `ExtensionUiDocument` root。
- `renderer/node-renderer.vue`: 递归渲染 `ExtensionUiNode`。
- `renderer/component-registry.ts`: Extension UI component type 到 Vue component adapter 的映射。
- `renderer/value-binding.ts`: model binding 和事件提交。
- `renderer/fallback-node.vue`: invalid document、unknown component、action failure 的局部 fallback UI。
- `surfaces/settings/`: settings dialog stack adapter。
- `surfaces/entity-menu/`: dropdown/context menu adapter。

`components/shared/extension/` 是 renderer 侧扩展组件的公共边界，外部调用方只通过该目录的 `index.ts` 导入。迁移完成后，旧 settings/entity menu 直连组件会拆解到新的 renderer、surface 和 adapter 职责模块中。

renderer 是唯一能渲染 Vue 组件的地方，但不会执行扩展函数。

## Extension UI 核心模型

Extension UI 有四个层次：

- Definition：扩展作者定义的组件、contribution mount 和 mount target，保存在 extension host。
- Authoring tree：SDK builder 生成的中间 UI 树，可以包含组件引用、action handler 和 params resolver，只在 host 内部存在。
- Document：某次 render 经过 host normalize 后生成的序列化 UI 树，发送到 renderer。
- Session：围绕某个 surface/input 打开的交互会话，保存 action map、document version、surface commands。

Document 树由 node 组成，且必须完全可序列化：

- `element`: 白名单组件，例如 `Button`、`Stack`、`Field`、`Select`。
- `text`: 纯文本节点。
- `fragment`: 多节点组合。

`ui.component(...)`、action 函数、slot 函数和 params resolver 都不是 Document node。host render 时必须递归展开组件引用、解析 slots、注册 action handler、生成 action id，然后只把 normalized document 发给 main/renderer。renderer 收到的 document 中不存在扩展函数，也不存在可由扩展指定的任意 component name。

目标态下 Dialog、Popover、Menu 都是一等 `element`。第一版 MVP 只公开 Dialog 和 entity menu content nodes；Popover 和完整 Menu overlay 后续追加。它们不是扩展可任意创建 DOM root 的逃生口，而是结构化 overlay 组件：扩展声明 header/content/footer、trigger/content、menu presentation、menu group/item/submenu 等语义结构，renderer adapter 负责真正的 portal、focus trap、定位、层级、关闭行为和宿主样式。

所有 interactivity 都走标准 event handler。简单行为可以直接声明 command；需要扩展代码参与时使用 action：

- renderer 触发 `click`、`change`、`submit`、`open`、`select` 等 UI event。
- 静态 command 由 surface driver 校验并执行，例如 close、open mount、refresh、notify。
- 文档更新 command 只允许由 host action 返回，例如 replace document；第一版不公开 patch helper。
- `open` command 的 `outlet` 决定打开位置；`mount` target 只描述 component 和 params。
- action event 携带 `actionId`、`value`、`formValues`、`surfaceInput` 和 `nodeId`。
- host 执行 action 后返回 `ExtensionUiDispatchResponse`。
- response 可以返回 notification、close/open/refresh、replace document、surface-specific result；patch document 留到 hardening 阶段。

## Surface driver

Surface driver 把通用 Extension UI 放进具体宿主场景。

### Settings surface

settings surface 负责：

- 打开 settings dialog session。
- 提供 settings contribution title/description/order。
- 管理 dialog stack。
- 处理 `ui.command.close`、`ui.command.open`、`ui.command.refresh`。
- 提供 `surface.params` 和 frame params。

settings surface 严格期望根节点是 `Dialog`。settings 在产品形态上就是 dialog，而不是抽象 screen；Dialog 的 header、body、footer、尺寸、关闭行为和堆叠样式都由同一套结构化组件表达。

settings 不再拥有 `SettingsScreen`、`SettingsNode`、`submit` 专用协议。

### Dialog outlet

应用级 Extension UI dialog outlet 是 renderer 预定义的 dialog 挂载点，不是扩展可指定的任意 DOM mount point。`ui.command.open(target, { outlet: 'dialog' })` 会创建独立 dialog session，并把 target render 得到的 `Dialog` root 挂到这个 outlet。短生命周期 surface，例如 entity menu 和 popover，可以用它打开复杂 UI；当前 surface 关闭或释放时，不会卸载已经转移到 dialog outlet 的 session。

### Entity menu surface

entity menu surface 负责：

- 根据 `EntityMenuResolveInput` 打开短生命周期 session。
- 把扩展贡献的 menu content document 合并到主应用已有的 entity menu surface 中。
- 为 contribution 提供 target input 和宿主 menu component set；扩展只声明要追加到主应用 entity menu 的 `MenuItem`、`MenuGroup`、`MenuSeparator` 等内容节点。
- 处理 action 后 refresh 或 close menu。
- 处理 `ui.command.open(..., { outlet: 'dialog' })`，把复杂 UI 转交给应用级 dialog outlet。
- 提供 `surface.input` 给组件 params。

`Menu` 是普通 Extension UI 中的完整菜单 overlay。它通过 `presentation: 'dropdown' | 'context'` 显式声明映射到 renderer 的 dropdown menu 还是 context menu，并通过 `trigger` slot 声明触发区域。entity menu contribution 不返回完整 `Menu`，因为主应用已经拥有 entity menu trigger、root、content、定位和分组容器；贡献点只返回 menu content 节点集合。entity menu 不再拥有 `EntityMenuNode` 和专用 builder。

### Surface input

所有 surface 都把宿主输入放在统一字段 `surfaceInput` 中。`surfaceInput.surface` 标识场景，具体输入在该对象内：

- settings: `{ surface: 'settings', frameId?: string, params?: Record<string, ExtensionUiValue> }`
- entity menu: `{ surface: 'entity-menu', input: EntityMenuResolveInput }`
- dialog outlet: `{ surface: 'dialog', opener?: ExtensionUiDialogOpenerInfo, params?: Record<string, ExtensionUiValue> }`

SDK 的 params resolver 接收 `{ surfaceInput, extension, contributionId? }`，示例和协议都使用 `surfaceInput` 命名，避免 `input.input` 或 `menu` 这类 surface-specific 参数泄漏到通用 API。

## 生命周期

1. 扩展 activate 时注册 Extension UI contribution，registration 只包含 metadata、surface、mount reference 和默认 params resolver。
2. host 同步轻量 registration metadata 到 main。
3. renderer 打开某个 contribution surface，或 surface driver 因 `open` command 打开一个 mount target，main 创建 session 并请求 host render。
4. host 在 extension scope 内解析 mount params，执行 component render，展开 authoring tree，生成 normalized `ExtensionUiDocument`。
5. main 返回 document 给 renderer。
6. renderer 根据 registry 渲染白名单组件。
7. 用户交互触发 dispatch，main 转发给 host。
8. host 执行 action，返回 commands 和 document update。
9. session 在关闭、释放、runtime unload 或 TTL 到期时清理。

## 与现有架构的关系

Extension UI 复用现有 RuntimeManager、ExtensionHostRpcClient/Server、ExtensionContributionRegistry 的整体模式。实现阶段可以先新增统一 UI host，与旧 settings/entity menu host 短期并行；当 built-ins、scaffold 和 renderer 调用点迁移完成后，再删除旧专用 contribution host。`ExtensionService` 仍然是 main process 入口，`extension:contributions-changed` 仍然可以作为 snapshot 变更事件，但最终 snapshot 内结构改为 surface-based Extension UI contribution。
