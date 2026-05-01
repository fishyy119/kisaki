# 07 Implementation Phases

每个 phase 都应能独立合并、独立 typecheck，并留下清晰的验收标准。虽然不考虑旧 API 兼容，但实现顺序仍要保持仓库可编译。

## Phase 0: Contract hardening

目标：在动代码前把 MVP public contract 的不变量钉牢，避免 Phase 1 反复改类型。

主要修改：

- 固化 `ExtensionUiValue = SerializableValue`、`ExtensionUiParams`、surface input type alias。
- 固化 `surfaceInput` 与 mount `params` 的边界：surface input 只描述宿主上下文，组件 params 只来自 `ui.mount(...)`。
- 固化 `ExtensionUiMount<TParams, TSurfaceInput>` 泛型顺序，entity menu 使用 `ExtensionUiEntityMenuSurfaceInput<TInput>`。
- 固化 action 规则：action name 只用于诊断，`actionId` 只在 `sessionId + documentId` 内有效，action handler 返回 authoring result，host 输出 normalized dispatch result，renderer 不回传 `surfaceInput`。
- 固化第一版只暴露 `value`，由 `Form` scope 管本地 draft；不引入 `defaultValue`/controlled 双模式。
- 固化 main-generated `uiContributionId`、active session owner table、无 session TTL 的确定性 cleanup、component registry lifecycle 和 public icon-id 映射规则。
- 固化 form draft dirty 语义：普通 refresh/patch 不覆盖 dirty 字段，除非 `Form.resetKey` 变化或字段被移除。

验收：

- `docs/extension-ui/03-public-api-and-schema.md`、`04-runtime-protocol-and-host.md`、`05-renderer-and-components.md`、`06-contribution-integration.md` 术语一致。

## Phase 1: Public Extension UI contracts

目标：在 `@kisaki/extension-api` 建立 MVP Extension UI 公共 contract 和验证器，明确 authoring definition 与 renderer document 的分层。

主要修改：

- 新增 `packages/extension-api/src/ui/`。
- 定义 `ExtensionUiValue`、authoring definition 类型、`ExtensionUiNode`、`ExtensionUiDocument`、MVP component props、action/event/command、surface types。
- 为每个 MVP component 固化 props、slots、children 和 event handler schema，不只保留组件名称列表。
- command 拆成 static command 与 document update command；第一版 public union 包含 `replace` 和受限节点级 `patch`。
- action handler result 与 normalized dispatch result 分层；static open、replace、patch 中的 component reference、params resolver 和 authoring node 必须由 host normalize 后才能进入 wire command。
- 新增 `ExtensionUiContributionRegistration`、`ExtensionUiSession*`、`ExtensionUiMountSession*`、`ExtensionUiDispatch*` RPC 类型。
- 更新 `packages/extension-api/src/rpc/contributions.ts`，加入 `ui.*` RPC。
- 更新 package exports。

验收：

- `pnpm --filter @kisaki/extension-api typecheck`
- `pnpm --filter @kisaki/extension-api build`
- validation 覆盖无效 component、不可序列化值、重复 id、重复 componentId、非法 action ref、非法 patch target、action result normalization、静态 command 中非法 document update、过深树、surface root 约束、entity menu allowlist。

## Phase 2: SDK authoring API

目标：让扩展作者可以用 `ui` namespace 定义组件、mount view、绑定 action。

主要修改：

- 新增 `packages/extension-sdk/src/ui/`。
- 从 `packages/extension-sdk/src/index.ts` 导出 `ui`。
- 实现 `defineComponent`、`mount`、component builder helpers、result helpers。
- 更新 SDK README，补 settings 和 entity menu 示例。

验收：

- `pnpm --filter @kisaki/extension-sdk typecheck`
- `pnpm build:extension-contracts`
- 新增一个仅类型层面的 sample，证明 params 推导、entity menu surface input resolver、action event values、static command handler 可用。

## Phase 3: Extension host Extension UI runtime

目标：host 能注册 Extension UI contribution、打开 contribution session 和 mount session、render document、执行 action。旧 host settings/entity menu domain 在本阶段保留，保证现有 built-ins 仍可运行。

主要修改：

- 新增 `apps/desktop/src/main/services/extension/runtime/host/ui/`。
- 在 `ExtensionHostSdkBridge` 中创建 `HostExtensionUiContributions`，注册 `ui.*` RPC handlers。
- `createSettingsRegistrar` 和 `createEntityMenuRegistrar` 支持新 contribution shape 并委托 Extension UI domain；旧 contribution shape 暂时仍走旧 domain。
- host registry 保存 Extension UI registrations。
- 实现 runtime component registry：捕获 contribution view、nested component、static open command 和 action result 中引用的 component definition。
- 实现 authoring tree normalizer：展开 `ui.component(...)`、注册 action map、生成 documentId、校验 surface root。
- 实现受限节点级 patch：host 先应用到 session 当前 document、重新生成 action map 并 validation，再把 normalized patch command 返回给 main/renderer。
- 实现 `ui.command.open` 所需的 mount target lookup，限制 target component 来自同一 extension runtime。

验收：

- `pnpm --filter kisaki typecheck:node`
- host 可加载一个测试扩展并返回 Extension UI document。
- host 可从已有 session 打开同 extension mount target。
- 旧 documentId dispatch 返回 `stale_document`，跨 extension componentId open 被拒绝。
- runtime unload/reload 会释放 session 和 action map。
- 旧 Bangumi settings 在本阶段仍不被破坏。

## Phase 4: Main contribution host and IPC

目标：main 新增统一 Extension UI host 和 IPC。旧 settings/entity menu 专用 host 暂时并行，直到 Phase 6 删除。

主要修改：

- 新增 `apps/desktop/src/main/services/extension/ui/`。
- 更新 `ExtensionContributionRegistry`，加入 `ui` host；保留旧 `settings` 和 `entityMenus` host 作为迁移期兼容路径。
- 更新 `ExtensionService` methods。
- 更新 `apps/desktop/src/shared/extension.ts`，新增 `ExtensionUiContributionInfo` 和 Extension UI session 类型；最终 snapshot 形态是 `ui` list，迁移期可以保留旧字段。
- 更新 `apps/desktop/src/shared/ipc.ts` 与 `apps/desktop/src/main/services/extension/ipc.ts`。
- 新增 active session owner table。
- 新增 main-generated `uiContributionId`，renderer open contribution session 时使用该 opaque key。
- 新增 `openExtensionUiMountSession`，根据 source session 或 main 已验证 owner 找到 runtime。
- dispatch/refresh/release 不信任 renderer 自报 owner 或 surfaceInput。
- dispatch 返回 replace/patch 后，main 更新 active session record 的当前 `documentId`。
- main 对 host 返回的 document、patch 和 command 做轻量 schema validation，失败时返回稳定 UI error code。

验收：

- `pnpm --filter kisaki typecheck:node`
- main 能返回 Extension UI contribution snapshot。
- entity menu aggregation 可以并发打开多个 Extension UI menu session。
- dialog outlet 可以通过 mount session 打开目标 Dialog document。
- renderer 使用 `uiContributionId` 打开 contribution session，并且 dispatch 只传 session/document/action ids 时，main 可以正确路由；伪造 owner、过期 document、已释放 session 都返回结构化错误。
- host 返回 invalid document/patch 时，main 不转发给 renderer，并返回 `invalid_document` 或 `invalid_patch`。
- 所有 IPC handler 仍返回 `IpcResult`。
- 旧 renderer settings/entity menu 调用点仍可工作。

## Phase 5: Renderer Extension UI engine and UI layout components

目标：renderer 可以渲染 MVP Extension UI document，并为新 settings/entity menu 提供 surface adapter。旧 shared extension renderer 组件暂时保留。

主要修改：

- 新增 `apps/desktop/src/renderer/src/core/extensions/ui/`。
- 重组 `apps/desktop/src/renderer/src/components/shared/extension/`，直接新增 `renderer/`、`surfaces/`、`adapters/`。
- 新增 MVP `apps/desktop/src/renderer/src/components/ui/layout/`：Stack、Inline、Grid、ScrollArea、Section、Group、Toolbar。
- 新增应用级 Extension UI dialog outlet，支持 `ui.command.open(target, { outlet: 'dialog' })`。
- 新增 Extension UI settings dialog stack 和 entity menu items；旧组件可到 Phase 6 再删除。
- 调整 extension installed card、game/character/company/person/collection/tag menu 调用点，使其能消费新 `ui` contribution。
- 实现 renderer patch applier，只应用 host 已校验的节点级 patch，失败时自动 refresh 一次。
- 实现 form draft 的 `value` 初始化、dirty/pristine 同步、`Form.resetKey` 和 public icon-id 映射。

验收：

- `pnpm --filter kisaki typecheck:web`
- settings dialog 可打开、提交、刷新、打开第二层 dialog、关闭。
- 带 `onChange` 的 input/select/switch change 会在更新本地 draft 后 dispatch 到 host，并通过 refresh/replace/patch 后的新 document value 对齐 pristine 字段。
- patch 后当前 documentId 更新，旧 documentId dispatch 返回 `stale_document`。
- entity menu 可 resolve、多 contribution 分组、执行 action、刷新。
- entity menu action 可通过 `outlet: 'dialog'` 打开独立 dialog，menu 关闭后 dialog 不被卸载。
- unknown component 和 action error 有安全 UI。
- settings/dialog 长时间打开不会因时间流逝误释放；entity menu close/input change/unmount 会主动 release，release 后旧 action 返回 `stale_session`。
- 旧 settings/entity menu renderer 组件仍未删除，仓库保持可编译。

## Phase 6: Convert built-ins, scaffold, and remove old contracts

目标：仓库内所有扩展示例和模板改用新 Extension UI，旧 UI API 完全删除。

主要修改：

- 改写 `extensions/bangumi/src/index.ts`。
- 改写 `packages/create-kisaki-extension/templates/default/src/index.ts`。
- 删除旧 settings/entity menu contracts、validation、renderer helpers 和 host/main contribution files。
- 删除迁移期 snapshot 旧字段和旧 IPC channels。
- 更新 `packages/extension-api/README.md`、`packages/extension-sdk/README.md`。
- 更新 manifest schema 不一定需要变化，除非要声明 Extension UI capability。

验收：

- `pnpm build:extension-contracts`
- `pnpm --filter create-kisaki-extension typecheck`
- `pnpm --filter @kisaki/extension-cli typecheck`
- `pnpm --filter kisaki typecheck`
- `pnpm --filter @kisaki/extension-cli build` 后 built-in extension 能被 desktop prepare script 消费。

## Phase 7: Repetitive tooling and diagnostics

目标：补强重复性工作、性能和调试体验，而不是补基础协议或追加新 UI 能力。

主要修改：

- 增加 SDK patch convenience helpers 或简单 diff helpers，减少手写重复 patch 的成本；基础 patch 协议已在 Phase 1/3 固化。
- 增加 document size metrics、render duration logs、action duration logs。
- 给开发模式增加 Extension UI validation diagnostics。
- 增加 virtual list/table 的大数据限制和提示。
- 增加 extension dev tooling 中的 Extension UI schema validation。

非 MVP 组件不作为补强内容处理。Tabs、Popover、完整 Menu overlay、Table、Image、Markdown、Progress、Empty、VirtualList、图表等能力应按独立产品需求进入后续小版本，各自带 public contract、renderer adapter 和验收场景。

验收：

- `pnpm typecheck`
- `pnpm lint`
- 手动验证 dev extension reload 后 session 清理。
- 手动验证 host crash/restart 后 renderer surface 显示可恢复错误。

## 风险与处理

- Contract 过大：Phase 1 只定义 MVP 组件、layout 和受限节点级 patch；图表、markdown editor、复杂 table、popover、完整 menu overlay 都后续追加。
- Renderer adapter 爆炸：每个组件必须通过 registry 单点接入，禁止业务组件绕开 registry。
- Params resolver 滥用：resolver 只在 host 执行，必须 timeout，并且输出必须是 `ExtensionUiValue`。
- Session owner 混乱：main 维护 active session owner table，renderer dispatch 不传 runtime owner 或 surfaceInput。
- Runtime icon 不可见：第一版 public props 只允许公共 icon id；构建期 safelist 作为 renderer 内部映射实现，不暴露给扩展运行时。
- Form refresh 覆盖编辑内容：form draft 使用 dirty/pristine 跟踪，普通 refresh/patch 不覆盖 dirty 字段；需要重置时由 `Form.resetKey` 或 surface lifecycle 明确表达。
- Entity menu content surface 复杂度失控：entity menu surface 使用 allowlist，复杂交互引导到 settings/dialog surface；后续完整 `Menu` overlay 只在普通 Extension UI 中通过 `presentation` 使用。
- 旧代码残留：Phase 6 必须删除旧 settings/entity menu UI 类型和 renderer 组件，避免双系统并存。

## 最小端到端验收场景

- Bangumi settings 打开后显示 token 输入框和 notice，保存后写入 extension storage 并关闭 dialog。
- 默认模板扩展可以打开 settings，点击测试通知按钮，打开可复用 dialog component。
- 一个测试 entity menu 能读取 `game.single` input，把 `entityId` 作为 params 传给预写 menu content component，点击 action 后通知、刷新菜单，并能通过 dialog outlet 打开独立 dialog。
- 禁用扩展时 active Extension UI session 被释放，renderer 不再能 dispatch 旧 action。
- refresh/replace/patch 后旧 `documentId` 的 action dispatch 被拒绝并触发一次可恢复刷新。
