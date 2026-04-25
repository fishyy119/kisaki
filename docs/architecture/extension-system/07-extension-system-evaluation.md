# 07. Extension 系统评估报告

评估日期：2026-04-25

## 评估范围

本次评估覆盖当前仓库中已经实现的 extension 系统，包括：

- `apps/desktop/src/main/services/extension/**`
- `apps/desktop/src/renderer/src/core/extensions/**`
- `apps/desktop/src/renderer/src/components/shared/extension/**`
- `apps/desktop/src/renderer/src/features/extension/**`
- `packages/extension-api/**`
- `packages/extension-sdk/**`
- `packages/extension-cli/**`
- `packages/create-kisaki-extension/**`
- `docs/architecture/extension-system/**`

按要求，本报告不评价测试覆盖，也未运行测试命令。结论基于静态代码阅读、结构扫描和关键路径推演。

## 总体结论

当前 extension 系统整体已经从旧 plugin 模式中干净切出，架构方向是正确的：公开契约、作者 SDK、主进程宿主实现、共享 extension host、renderer 消费层、CLI 与脚手架各自有稳定边界。系统没有明显保留旧 plugin 运行时兼容层，也没有发现 renderer 继续执行扩展代码、向扩展暴露 `ServiceContainer`、`electron`、`drizzle`、Vue app/router/pinia 等旧式高耦合入口。

整体质量评价：

| 维度          | 评价 | 说明                                                                                                              |
| ------------- | ---- | ----------------------------------------------------------------------------------------------------------------- |
| 干净清晰      | 较好 | 主路径命名统一，`extension` 语义收敛；旧 `plugin` 运行时代码基本消失。                                            |
| 简洁现代      | 较好 | contract-first、utility host、typed RPC、受控 contribution、DTO 渲染模型都符合现代扩展系统设计。                  |
| 职责划分      | 较好 | API/SDK/host/main/renderer/tooling 分层清楚，但 `ExtensionService.setupIpcHandlers` 和 scraper adapter 仍偏重复。 |
| 组织可维护性  | 较好 | 目录结构基本符合项目文档；少数实现与文档粒度不一致但不构成大问题。                                                |
| 可扩展性      | 较好 | contribution/capability/sources/runtime 子域扩展点清楚；新增能力路径明确。                                        |
| 冗余/兼容代码 | 较少 | 未发现旧 plugin 兼容运行层；主要冗余来自重复 IPC 包装、scraper 多实体 adapter 和内部 `any`。                      |
| bug 风险      | 中等 | 发现数个确定或高可信问题，尤其 scraper session 执行上下文、storage 并发写、source 临时文件名冲突。                |

一句话结论：系统主干是干净、现代、边界明确的，但还没有完全达到“无重复、无冗余、强类型、无坑位”的状态；建议优先修复本报告列出的确定 bug，再做小范围整理。

## 架构边界评估

### 公开契约层

`packages/extension-api` 的职责比较纯粹：manifest、RPC、capability、contribution 和共享错误/序列化协议都放在公开包中。扫描未发现该包反向导入 `apps/desktop/**`，也未发现 `ServiceContainer`、`electron`、`drizzle`、`window.kisaki`、`globalThis.kisaki` 等宿主内部对象出现在公开包中。

优点：

- `packages/extension-api/src/manifest.ts:18` 定义公开 manifest 形状，`packages/extension-api/schemas/extension-manifest.schema.json:3` 提供 JSON Schema。
- `packages/extension-api/src/rpc.ts:577` 起定义 main/host typed RPC request map，扩展运行时协议没有散落到宿主实现里。
- `apps/desktop/src/main/services/extension/manifest.ts:27` 对 `engines.kisaki` 做 semver range 校验；`apps/desktop/src/main/services/extension/installer.ts:192` 安装时校验当前 app 版本是否满足要求。

需要注意：

- API 层已经相当清楚，不建议继续把实现 helper 或宿主内部 DTO 上提到 `extension-api`。
- 后续新增扩展点时应继续保持“先公开契约，再宿主实现”的方向，否则很容易重新滑向旧 plugin 模式。

### SDK 层

`packages/extension-sdk` 很薄，方向正确：

- `packages/extension-sdk/src/index.ts:4` 统一转发 `@kisaki/extension-api`。
- `packages/extension-sdk/src/index.ts:6` 提供 `defineExtension`。
- `packages/extension-sdk/src/index.ts:10` 起以懒加载 getter 暴露 `kisaki` API。
- `packages/extension-sdk/src/bridge.ts:11` 使用私有 symbol 安装 bridge，不把宿主实现作为公开 API 暴露。

这层没有出现旧 `main/renderer` 双入口模型，也没有为每个 capability 复制一套多余目录。当前简洁度很好。

### 主进程 extension 服务

`apps/desktop/src/main/services/extension` 的根层组织基本合理：

- `service.ts` 承担 DI 接入、生命周期、IPC facade 和 runtime 状态协调。
- `catalog.ts` 负责扫描 package/state 并形成 catalog。
- `installer.ts` 负责安装、更新、卸载、archive 解包和状态写入。
- `manifest.ts` 负责宿主侧 manifest 解析和 package 校验。
- `state.ts` 负责 extension state 文档。
- `sources/` 收敛不同安装来源。
- `runtime/` 收敛 extension host、RPC 和生命周期。
- `contributions/` 与 `capabilities/` 分别收敛宿主侧 contribution 与 capability 适配。

这个组织符合文档中的“主边界先收敛，再按子域拆分”。当前没有看到过度目录化，也没有把单一职责文件拆成难以导航的碎片。

主要不足：

- `apps/desktop/src/main/services/extension/service.ts:301` 起的 `setupIpcHandlers` 很长，大量重复 `try/catch -> IpcResult` 包装，且失败时只返回 `toErrorMessage`，没有按项目边界约定记录详细日志。
- `apps/desktop/src/main/services/extension/sources/manager.ts:13` 的 provider manager 设计清楚，但 `github.ts`、`url.ts`、`local-file.ts` 中临时文件名生成方式存在并发碰撞风险，见后文 bug 列表。
- `apps/desktop/src/main/services/extension/state.ts:55`、`:61`、`:67` 采用 read-modify-write 文档写入模型；如果未来允许高并发管理操作，需要考虑和 storage 同类的写入串行化问题。

### Runtime 与 Extension Host

runtime 层是当前系统最重要也最成功的部分。它已经具备比较现代的扩展平台形态：

- `apps/desktop/src/main/services/extension/runtime/manager.ts:61` 注释明确 runtime 状态由 desired set reconcile。
- `apps/desktop/src/main/services/extension/runtime/manager.ts:66` 使用 `Mutex` 串行化 lifecycle。
- `apps/desktop/src/main/services/extension/runtime/rpc-core.ts:37` 维护 active request abort controller，`:92` 做 request timeout。
- `apps/desktop/src/main/services/extension/runtime/host/extension-loader.ts:81` 起封装 load/unload/reload/shutdown。
- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/bridge.ts:198` 起统一释放 runtime 相关 contribution 和 pending main requests。

优点：

- extension code 不在 renderer 执行，扩展执行环境与 UI 进程解耦。
- host 与 main 通过 typed RPC 通信，生命周期 timeout、crash recovery、desired-state reconcile 都有明确入口。
- Extension host 入口只负责组合 registry、loader、RPC server、SDK bridge，不承担业务 service 职责。

主要不足：

- host scraper session 的执行上下文不完整，属于确定 bug。
- `releaseRuntime` 当前是同步清理接口，但部分清理逻辑天然需要 async dispose。后续需要调整为 async 或引入明确的 best-effort async cleanup 策略。

### Contribution 系统

main 侧 `apps/desktop/src/main/services/extension/contributions/registry.ts:11` 起把 entity menus、settings panels、themes、deeplinks、scrapers 分成独立 host，职责划分清楚。`getSnapshot()` 在 `registry.ts:169` 汇总贡献快照，renderer 只消费结构化 DTO。

host 侧 contribution registrar 也基本符合“注册优于侵入”的原则，扩展只注册受控贡献点，不直接插入 Vue 组件或修改宿主状态树。

不足：

- scraper 是当前最复杂的 contribution，main/host 两侧都有 game/person/company/character 四类适配。host 侧已经抽象出 `ScraperDomain`，但 main 侧 adapter 仍有较多重复。该重复还没有失控，但未来新增 scraper domain 时会扩大维护成本。
- deeplink route 校验允许精确 `ext/<id>`，但错误消息只说必须在 `ext/<id>/...` 下，存在小的文案/契约不一致。

### Capability 系统

capability 体系整体清晰：events、network、notify、runtime、library 均在 `apps/desktop/src/main/services/extension/capabilities/**` 下实现，公开类型来自 `extension-api`。

优点：

- library capability 没有把数据库 schema 直接暴露给扩展，而是通过 DTO 和 command/query 适配。
- events capability 把 host event subscription 归入受控能力，没有让扩展直接碰内部 EventService。
- network/notify/runtime/storage 都通过 RPC request 进入主进程，边界清楚。

不足：

- `apps/desktop/src/main/services/extension/capabilities/library/relations.ts:33` 使用 `table: any` 表达多关系表配置，牺牲了一部分类型安全。
- `apps/desktop/src/main/services/extension/capabilities/library/attachments.ts:161`、`:172`、`:179`、`:197`、`:206`、`:215`、`:229` 有多处 `as any`，主要是适配 attachment service 和 drizzle table id。内部适配层可以接受少量 cast，但当前数量已经值得整理。
- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/kisaki-api.ts:46` 起多处 `as any`，用于把泛型 RPC facade 转成作者侧 API。这里属于边界 adapter 的典型弱类型点，短期可以接受，长期建议用更强的 helper 类型收敛。

### Renderer 消费层

renderer 的方向正确：`apps/desktop/src/renderer/src/core/extensions/ipc.ts:38` 起只通过 IPC 获取 catalog、contribution snapshot、settings panels、menus、themes 等结构化数据。未发现 renderer import 或执行扩展入口。

优点：

- UI 只是消费主进程返回的 DTO，不承载扩展 runtime。
- `apps/desktop/src/shared/ipc.ts:376` 起集中定义 extension IPC handler 类型，`:458` 定义 contribution snapshot event，主渲染协议可追踪。
- settings panel 与 entity menu 使用受控 schema 渲染，符合“不注入任意 Vue 组件”的目标。

不足：

- `apps/desktop/src/renderer/src/components/shared/extension/entity-menu-items.vue:56` 的 watch 在 `enabled=false` 时直接返回，不清理旧 `resolvedMenu`；模板在 `:137` 只判断 `hasContent`，没有同时判断 `enabled`。这会造成 stale menu 风险，见 bug 列表。
- feature 页面有一些解释性注释偏多，尚不影响维护，但后续可以逐步压缩为更自说明的组件/函数命名。

### CLI 与脚手架

`packages/extension-cli` 结构清楚：`cli.ts` 负责参数分发，`commands/` 一条命令一个文件，`manifest.ts`、`project.ts`、`archive.ts` 分别承担复用职责。它没有反向导入宿主实现。

`packages/create-kisaki-extension` 当前实现比文档目标更扁平：实际是 `src/cli.ts` 与 `src/scaffold.ts`，而文档 `docs/architecture/extension-system/README.md:263` 说 `src/cli/` 与 `src/scaffold/`。以当前规模看，扁平文件并不是问题；这属于文档和实现粒度不一致，不建议为了形式拆目录。等 prompts、模板变量、冲突策略明显增长后再拆即可。

## 冗余和兼容性代码检查

### 旧 plugin 兼容层

未发现旧 plugin runtime 仍存在于：

- `apps/desktop/src/main/services/**`
- `apps/desktop/src/renderer/src/core/**`
- `packages/**`

扫描到的旧 plugin 字样只剩：

- `docs/architecture/extension-system/**` 中的历史说明和删除范围。
- `apps/desktop/drizzle/0004_wide_swordsman.sql:1` 的 `DROP TABLE IF EXISTS plugin_data`，这是历史迁移清理语句，不属于运行时兼容代码。

结论：extension 系统没有明显兼容旧 plugin API 的冗余运行层，符合“不保兼容”的目标。

### TODO/FIXME/临时代码

在 extension 相关实现范围内未发现真实 `TODO`、`FIXME`、`compat`、`legacy`、`deprecated`、`workaround`、`eslint-disable`、`@ts-ignore`、`@ts-expect-error`。扫描中 `TEMP` 只命中了 `TEMPLATE_TOKEN_PATTERN`，属于 false positive。

### 重复和可压缩点

建议清理但不必立即大重构的重复：

1. `ExtensionService.setupIpcHandlers`
   - 位置：`apps/desktop/src/main/services/extension/service.ts:301` 起。
   - 问题：大量重复 try/catch/IpcResult 包装，且错误日志缺失。
   - 建议：抽一个本地 `handleResult` / `handleVoid` helper，统一错误日志和返回形状。

2. Scraper main adapter
   - 位置：`apps/desktop/src/main/services/extension/contributions/scrapers.ts`。
   - 问题：game/person/company/character 方法族重复较多。
   - 建议：沿用 host 侧 domain abstraction，逐步将 main 侧 resolve/search/session adapter 泛化。

3. 内部 `any`
   - 位置：`attachments.ts`、`relations.ts`、`runtime/host/sdk-bridge/kisaki-api.ts`、`runtime/host/sdk-bridge/bridge.ts`。
   - 问题：都是边界适配层，但数量偏多。
   - 建议：优先消除 capability/library 的 `any`，SDK bridge 的 cast 可稍后通过 typed RPC helper 收敛。

4. Scaffold 文档粒度差异
   - 位置：文档 `README.md:263`，实现 `packages/create-kisaki-extension/src/cli.ts`、`src/scaffold.ts`。
   - 问题：不是代码 bug，但新维护者可能困惑。
   - 建议：要么更新文档说明“当前规模保持单文件”，要么等代码增长后再按文档拆目录。

## 确定问题与风险清单

### 1. 高：host scraper session 方法没有进入 extension 执行上下文

证据：

- `apps/desktop/src/main/services/extension/runtime/host/contributions/scrapers.ts:383` 的 `provider.search` 被 `runInExtensionContext` 包裹。
- `apps/desktop/src/main/services/extension/runtime/host/contributions/scrapers.ts:405` 的 `provider.resolve` 被包裹。
- `apps/desktop/src/main/services/extension/runtime/host/contributions/scrapers.ts:427` 的 `provider.openSession` 被包裹。
- 但 `apps/desktop/src/main/services/extension/runtime/host/contributions/scrapers.ts:450` 直接执行 `record.session.get(request.slots)`。
- `apps/desktop/src/main/services/extension/runtime/host/contributions/scrapers.ts:517` 直接执行 `record.session.dispose?.()`。
- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/bridge.ts:503` 的 `requireCurrentScope` 要求 capability 使用必须处在 active extension execution scope。

影响：

如果 scraper session 的 `get()` 或 `dispose()` 内调用 `kisaki.*`，会触发 “used outside an active extension execution scope” 类错误。这个问题会集中出现在 session 型 scraper，因为 search/resolve/openSession 正常，只有后续 session 操作失败，定位成本较高。

建议：

- 在 `ScraperSessionRecord` 中保存 `runtimeHandle` 之外的 runtime 或通过 registry 重新取 runtime。
- `getProviderSession` 和 `closeSession` 中用 `this.options.runInExtensionContext(runtime, () => record.session.get(...))` / `dispose?.()` 包裹。
- 同时覆盖 closeProviderSessions 和 releaseRuntime 兜底清理路径。

### 2. 中高：host scraper releaseRuntime 只删除 session，不调用 dispose

证据：

- `apps/desktop/src/main/services/extension/runtime/host/extension-loader.ts:113` 在 unload finally 中调用 `this.sdkBridge.releaseRuntime(runtime.runtimeHandle)`。
- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/bridge.ts:198` 起调用 `this.scrapers.releaseRuntime(runtimeHandle)`。
- `apps/desktop/src/main/services/extension/runtime/host/contributions/scrapers.ts:299` 起的 `releaseRuntime` 调用 `deleteRuntimeSessions`。
- `apps/desktop/src/main/services/extension/runtime/host/contributions/scrapers.ts:532` 的 `deleteRuntimeSessions` 只 `sessions.delete(sessionId)`，没有调用 `dispose`。

影响：

正常卸载时，如果 extension 把 provider disposable 加入了 `context.subscriptions`，大概率会先经 `runtime.subscriptions.clear()` 进入 provider unregister 并清理 session。但 `releaseRuntime` 是 runtime 级兜底路径，不能假设 extension 一定正确登记 subscription，也不能假设前序 cleanup 一定成功。当前实现可能让 session 资源、临时句柄或外部连接跳过 dispose。

建议：

- 将 host `scrapers.releaseRuntime` 改为 async，并对匹配 runtime 的 session 做 best-effort dispose。
- dispose 同样应运行在 extension context 内，和问题 1 一并修复。
- `ExtensionSdkBridge.releaseRuntime` 与 `ExtensionLoader` 对应改为 await，或者提供单独的 async cleanup 阶段。

### 3. 中：extension storage 并发 set/delete 可能丢写

证据：

- `apps/desktop/src/main/services/extension/runtime/manager.ts:395` 处理 `bridge.storage.set`。
- `apps/desktop/src/main/services/extension/runtime/manager.ts:397` 先 `readStorageDocument`。
- `apps/desktop/src/main/services/extension/runtime/manager.ts:399` 再 `writeStorageDocument`。
- `apps/desktop/src/main/services/extension/runtime/manager.ts:408` 和 `:410` 对 delete 也采用同样 read-modify-write。
- RPC request 可以并发进入，storage 操作没有 per-runtime/per-file mutex。

影响：

同一扩展短时间并发执行：

```ts
await Promise.all([kisaki.storage.set('a', 1), kisaki.storage.set('b', 2)])
```

可能出现两个请求都读到旧文档，最后一个写入覆盖另一个写入的结果，造成 silent data loss。

建议：

- 为每个 `runtimeHandle` 或 storage 文件引入串行队列/mutex。
- `storage.set`、`storage.delete`、未来可能的 batch update 都经过同一个 queue。
- 如果希望更现代，可以提供 atomic update helper，但短期 mutex 足够。

### 4. 中：extension source 临时 archive 文件名使用 Date.now，存在并发碰撞

证据：

- `apps/desktop/src/main/services/extension/sources/url.ts:52`
- `apps/desktop/src/main/services/extension/sources/local-file.ts:75`
- `apps/desktop/src/main/services/extension/sources/github.ts:167`

三处都使用 `extension-${Date.now()}.kisx` 作为下载/复制目标名。

影响：

同一毫秒内并发安装或搜索下载可能写入同一个临时文件路径，导致 archive 内容互相覆盖或 cleanup 删除另一个操作正在使用的文件。虽然概率不高，但安装链路属于用户可见关键路径，且修复成本极低。

建议：

- 改为 `randomUUID()` 或每次创建独立 temp directory。
- installer 的 stage dir 已经在 `apps/desktop/src/main/services/extension/installer.ts:217` 使用 `randomUUID()`，source 下载层应保持同等安全性。

### 5. 中：ExtensionService IPC 边界缺少详细错误日志

证据：

- `apps/desktop/src/main/services/extension/service.ts:301` 起注册 extension IPC handlers。
- `apps/desktop/src/main/services/extension/service.ts:307`、`:316`、`:324`、`:333`、`:342`、`:351`、`:362`、`:371`、`:380`、`:392`、`:403`、`:414`、`:425`、`:436`、`:447`、`:458`、`:469`、`:480`、`:491` 多处 catch 后只返回 `toErrorMessage(error)`。
- 该文件其他位置有日志，例如 `service.ts:559` 会记录 dev extension 加载失败。

影响：

renderer 能拿到用户可读错误，但主进程日志缺少 stack 和上下文。安装、更新、菜单 resolve、settings submit、source search 等失败排查会变慢，也不符合项目“边界记录详细错误，返回可读摘要”的风格。

建议：

- 抽统一 helper，例如 `handleExtensionIpc(channel, handler)`。
- catch 中记录 `log.warn` 或 `log.error`，包含 channel、关键参数和原始 error。
- renderer 返回仍保持简洁 `IpcResult`。

### 6. 中：update 路径未校验更新包 manifest id 是否等于被更新 extensionId

证据：

- `apps/desktop/src/main/services/extension/installer.ts:104` 的 `update(extensionId)` 读取当前 extension 的 source。
- `apps/desktop/src/main/services/extension/installer.ts:126` 下载后直接 `installArchive(archivePath, record.source, true)`。
- `apps/desktop/src/main/services/extension/installer.ts:140` 使用 `prepared.manifest.id` 作为安装目标目录。
- `apps/desktop/src/main/services/extension/installer.ts:157` 使用 `prepared.manifest.id` 写 state。
- `apps/desktop/src/main/services/extension/service.ts:178` 起更新前先 unload 原 `extensionId`，更新后用 `result.extensionId` 作为强制 reload id。

影响：

如果 source 返回的 archive manifest id 与原 extension id 不一致，update 会安装另一个 id 的扩展，而不是拒绝更新。旧扩展 state/package 可能仍在，更新语义被破坏，也增加 source 被污染时的完整性风险。

建议：

- `update(extensionId)` 路径在 `prepareArchive` 后断言 `prepared.manifest.id === extensionId`。
- 也可以在 `installArchive` 增加可选 `expectedExtensionId` 参数，install 不传，update 必传。

### 7. 低中：EntityMenuItems disabled 后可能保留旧菜单内容

证据：

- `apps/desktop/src/renderer/src/components/shared/extension/entity-menu-items.vue:56` watch `props.enabled` 和 input key。
- `entity-menu-items.vue:59` 在 `!enabled` 时直接 `return`。
- `entity-menu-items.vue:34` 的 `resolvedMenu` 没有被清空。
- `entity-menu-items.vue:48` 的 `hasContent` 只看旧 groups/loading/error/resolved errors。
- `entity-menu-items.vue:137` 模板只用 `v-if="hasContent"`。

影响：

如果父组件先启用并成功解析了 extension menu，之后把 `enabled` 切成 false，组件可能继续渲染旧的 extension menu。具体是否可见取决于父组件挂载策略，但组件自身语义不完整。

建议：

- 在 `!enabled` 分支清空 `resolvedMenu`、`error`、`loading`、`invokingKey`。
- 或模板最外层改为 `v-if="props.enabled && hasContent"`，但仍建议清状态以避免旧 session id 参与后续操作。

### 8. 低：network 默认 json 响应对 204/空 body 不友好

证据：

- `apps/desktop/src/main/services/extension/capabilities/network.ts:147` 起 `readResponseBody`。
- `network.ts:157` 对默认 `json` responseType 直接 `await response.json()`。

影响：

如果扩展请求返回 204 No Content 或空 body，但未显式设置 `responseType: 'text'`，会在 `response.json()` 抛错。作为 SDK-facing network capability，这种行为可能让作者体验不稳定。

建议：

- 对 204/205 或 `content-length: 0` 返回 `null`。
- 或在错误信息中明确提示设置 `responseType`。

### 9. 低：deeplink route 校验文案与实际允许值不完全一致

证据：

- `apps/desktop/src/main/services/extension/contributions/deeplinks.ts:147` 要求 prefix 为 `ext/${extensionId}/`。
- `deeplinks.ts:148` 同时允许 route 精确等于 `ext/${extensionId}`。
- 错误消息说必须 under `"ext/${extensionId}/..."`。

影响：

功能没有明显错误，但契约文案不够准确。作者调试 route 时可能误解精确根路由是否允许。

建议：

- 如果精确根路由是设计允许的，错误消息改为 `must be "ext/<id>" or under "ext/<id>/..."`。
- 如果不允许根路由，则移除 `route === ext/<id>` 分支。

### 10. 低：生产包也被 reload watcher 监听，语义需要再次确认

证据：

- `apps/desktop/src/main/services/extension/reload-watcher.ts:8` 注释明确监听 active extension package roots，且不是 dev-only flow。
- `apps/desktop/src/main/services/extension/reload-watcher.ts:42` 起对 active package path 建立 chokidar watcher。
- `apps/desktop/src/main/services/extension/service.ts:621` 用 desired runtime metadata 的 `extensionPath` 更新监听目标。

影响：

这可能是设计选择：扩展包被外部修改时自动 reload。但如果用户安装目录位于普通 production package store，任何杀毒软件、同步工具或手动改文件都可能触发 runtime reload。当前注释说明它是 intentional，所以不定为 bug，但建议产品层确认这个行为是否符合预期。

建议：

- 若目标是 dev 热重载，应只监听 dev extension 或显式配置。
- 若目标是安全感知生产包变更，应在日志/状态中说明 reload 原因，并考虑校验 package 完整性。

## 文件夹组织评估

当前组织整体易维护，主要优点是：

- 根级 extension service 文件职责易懂，不需要在深层目录中寻找入口。
- 真正多模块协作的子域已经目录化：`runtime/`、`runtime/host/`、`contributions/`、`capabilities/`、`sources/`。
- renderer 侧 `core/extensions` 是薄 IPC/状态层，feature UI 和 shared extension components 分开，符合 Vue renderer 组织方式。
- packages 层 API/SDK/CLI/scaffold 四个包的依赖方向清楚，未反向依赖 app 内部代码。

需要微调的组织问题：

- `ExtensionService` 的 IPC facade 已经长到值得抽本地 helper，但不建议拆成大 service；保持 facade 但减少重复即可。
- `runtime/host/sdk-bridge/` 作为目录是合理的，因为已经包含 `bridge.ts`、`kisaki-api.ts`、`registrars.ts`、`storage.ts`、`store.ts` 等多文件。文档中若仍称 `sdk-bridge.ts`，应理解为语义名而非必须单文件。
- `create-kisaki-extension` 实现与文档粒度不一致，但当前不必强行拆目录。

## 是否符合项目风格和规范

符合项：

- 主进程 service 使用 DI 注册和 service id 风格。
- extension IPC 统一返回 `IpcResult`，renderer 统一 unwrap。
- main/renderer/shared 的边界清楚，没有把 renderer 组件或 Vue runtime 暴露给扩展。
- manifest/path/archive 校验有明显 zip slip 防护：`apps/desktop/src/main/services/extension/installer.ts:233` 和 `apps/desktop/src/main/services/extension/installer.ts:259` 都检查路径逃逸。
- 错误返回整体面向用户可读。

不完全符合项：

- IPC 边界缺少详细日志，不符合主进程边界错误处理惯例。
- capability/library 和 sdk bridge 里内部 `any` 偏多，不完全符合强类型现代化目标。
- 少数文案/文档与实现细节不同步。

## 推荐修复顺序

1. 修复 host scraper session context：`get()`、`dispose()` 全部进入 `runInExtensionContext`。
2. 修复 host scraper releaseRuntime cleanup：不要只 delete session，必须 best-effort dispose。
3. 给 extension storage set/delete 增加 per-runtime mutex，消除丢写。
4. source download/copy 临时文件名改为 `randomUUID()`。
5. update 路径校验 manifest id 与被更新 id 一致。
6. 抽 `ExtensionService` IPC handler helper，并补日志。
7. 修复 `EntityMenuItems` disabled stale state。
8. 收敛 capability/library 和 sdk bridge 的 `any`。
9. 同步 scaffold 文档粒度和 deeplink 文案。

## 最终判断

extension 系统已经具备一套清晰、现代、可扩展的主架构，和旧 plugin 系统相比边界质量有明显提升。当前没有必要推倒重来，也不建议做大规模重构。真正需要的是几处关键 bug 修复和小型清洁整理：scraper session context、storage 写入串行化、source 临时文件唯一性、update id 完整性、IPC 边界日志，以及少量弱类型 adapter 的收敛。

这些问题修完后，系统会更接近目标中的“干净清晰简洁统一现代化”，也更适合继续扩展新的 contribution point 和 host capability。
