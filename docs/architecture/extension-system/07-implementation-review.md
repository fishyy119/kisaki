# Extension 系统实现评估报告

评估日期：2026-04-25

范围：`apps/desktop/src/main/services/extension/**`、`apps/desktop/src/shared/extension.ts`、`apps/desktop/src/shared/ipc.ts`、`apps/desktop/src/renderer/src/core/extensions/**`、`apps/desktop/src/renderer/src/features/extension/**`、`apps/desktop/src/renderer/src/components/shared/extension/**`、`packages/extension-api/**`、`packages/extension-sdk/**`、`packages/extension-cli/**`、`packages/create-kisaki-extension/**`。

未评估测试覆盖；只做架构、组织、冗余、契约一致性和代码 bug 审查。静态检查已通过：

```text
pnpm --filter @kisaki/extension-api typecheck
pnpm --filter @kisaki/extension-sdk typecheck
pnpm --filter @kisaki/extension-cli typecheck
pnpm --filter create-kisaki-extension typecheck
pnpm --filter kisaki typecheck:node
pnpm --filter kisaki typecheck:web
```

## 总体结论

当前 extension 系统的方向是正确的，并且已经基本摆脱旧 plugin 系统的宿主内部对象直出模式。主进程实现收敛在 `services/extension/**`，公开契约前置到 `packages/extension-api`，SDK 是薄入口，renderer 只通过 `extension:*` IPC 消费结构化 DTO；这些都符合项目文档里“进程边界清楚、公开契约前置、renderer 不执行扩展代码”的目标。

但它还没有达到“干净清晰简洁统一”的完成态。主要问题不是大方向，而是运行时错误隔离、安装原子性、状态持久化并发、UI callback session 生命周期、manifest/schema 规则重复、以及少量渲染层状态/分页细节。这些问题里有几个会直接影响真实用户：一个坏扩展可能让应用启动失败，安装/更新失败可能破坏已安装包，反复打开菜单/设置面板会积累 host 内 callback session。

综合判断：

- 架构方向：良好。
- 职责边界：总体良好，少数入口文件偏大。
- 代码组织：清晰，可维护性中上。
- 统一性：公开契约统一度高，manifest/tooling 校验仍有重复。
- 冗余/兼容代码：没有发现 active runtime 中保留旧 plugin 兼容层。
- bug 风险：存在 5 个需要优先处理的高风险问题。

## 正向评价

### 1. 新旧系统切换干净

运行时代码搜索未发现 active `PluginService`、`window.kisaki`、`globalThis.kisaki`、`--dev-plugin` 或旧 renderer plugin loader 残留。旧 plugin 语义主要只存在于架构历史文档和一条迁移 SQL 中，例如 `apps/desktop/drizzle/0004_wide_swordsman.sql` 的 `DROP TABLE IF EXISTS plugin_data`，这不构成运行时代码兼容层。

### 2. 主进程边界收敛正确

`ExtensionService` 是唯一主入口，目录下按 `catalog.ts`、`installer.ts`、`manifest.ts`、`state.ts`、`sources/`、`runtime/`、`contributions/`、`capabilities/` 分域，和项目约定一致：

- `apps/desktop/src/main/services/extension/service.ts:52`
- `apps/desktop/src/main/services/extension/catalog.ts`
- `apps/desktop/src/main/services/extension/installer.ts`
- `apps/desktop/src/main/services/extension/runtime/manager.ts:65`
- `apps/desktop/src/main/services/extension/contributions/registry.ts:11`
- `apps/desktop/src/main/services/extension/capabilities/index.ts:26`

这比旧 plugin 体系的 main/renderer 双入口和宿主内部对象直出干净得多。

### 3. Renderer 边界健康

renderer extension 核心层集中在 `apps/desktop/src/renderer/src/core/extensions/**`。`ipc.ts` 只封装 `extension:*` IPC 调用，`store.ts` 只维护 contribution snapshot，`themes.ts` 只把 theme DTO 编译成 theme manager 可消费的定义。UI 组件 `ExtensionSettingsPanelDialog` 和 `ExtensionEntityMenuItems` 都通过 main IPC resolve/invoke，不直接 import 扩展入口：

- `apps/desktop/src/renderer/src/core/extensions/ipc.ts:38`
- `apps/desktop/src/renderer/src/core/extensions/store.ts:34`
- `apps/desktop/src/renderer/src/components/shared/extension/settings-panel-dialog.vue:3`
- `apps/desktop/src/renderer/src/components/shared/extension/entity-menu-items.vue:3`

这一点符合 `extension-system.md` 中“renderer never imports extension entry code”的约束。

### 4. Public API/SDK 分层简洁

`@kisaki/extension-api` 定义 manifest、context、capability、contribution、RPC 协议；`@kisaki/extension-sdk` 只导出 `defineExtension`、`kisaki`，并转发公开契约：

- `packages/extension-sdk/src/index.ts:4`
- `packages/extension-sdk/src/index.ts:6`
- `packages/extension-sdk/src/index.ts:10`

SDK 没有重新镜像 main/renderer，也没有把 host 运行时实现塞进公开包，整体是现代、克制的。

## 高风险问题

### P0. 一个坏扩展可能让应用启动失败，并且安装失败后仍会留下 enabled 包

`ExtensionService.init()` 在启动时直接 `await this.applyRuntimeState({ cause: 'startup' })`；`applyRuntimeState()` 又直接等待 `runtime.reconcile()`：

- `apps/desktop/src/main/services/extension/service.ts:127`
- `apps/desktop/src/main/services/extension/service.ts:576`
- `apps/desktop/src/main/services/extension/service.ts:581`

`RuntimeManager.reconcileLocked()` 逐个加载 desired extension，但对单个扩展的 load/reload 错误没有隔离：

- `apps/desktop/src/main/services/extension/runtime/manager.ts:188`
- `apps/desktop/src/main/services/extension/runtime/manager.ts:192`
- `apps/desktop/src/main/services/extension/runtime/manager.ts:197`

`loadIntoHostLocked()` 出错后释放 handle 并重新 throw：

- `apps/desktop/src/main/services/extension/runtime/manager.ts:211`
- `apps/desktop/src/main/services/extension/runtime/manager.ts:218`
- `apps/desktop/src/main/services/extension/runtime/manager.ts:222`

影响：

- 启动时任意 enabled 扩展 `activate()` 抛错，`ExtensionService.init()` 会失败，容器初始化回滚，应用 ready bootstrap 失败。
- 安装时 `ExtensionInstaller` 已经写入 package 和 state，随后 `applyRuntimeState({ cause: 'install' })` 失败会让 IPC 返回“安装失败”，但包已经留在 `state.json`，默认 enabled。下次启动会再次触发同样问题。
- 多个 enabled 扩展中，一个坏扩展会阻塞后续扩展加载。

建议：

- `RuntimeManager.reconcileLocked()` 应该对每个 extension load/reload 做 per-extension try/catch，记录运行态错误，但继续处理其他扩展。
- `ExtensionService` 应维护 runtime 状态，例如 `running | failed | disabled | crashed` 和 `lastRuntimeError`，并映射到 catalog/renderer。
- 安装流程中，如果运行时激活失败，应明确决定：要么安装成功但 runtime failed，要么自动 disable 并向用户报告；不要留下“安装失败但 enabled 且破坏下次启动”的状态。
- 启动路径不能因为第三方扩展激活失败而阻断应用主进程初始化。

### P0. 安装/更新不是原子操作，失败可能破坏已有安装

`ExtensionInstaller.installArchive()` 在写入新包前直接删除目标目录，然后移动 staging 目录：

- `apps/desktop/src/main/services/extension/installer.ts:160`
- `apps/desktop/src/main/services/extension/installer.ts:161`

随后才写入 state：

- `apps/desktop/src/main/services/extension/installer.ts:164`

影响：

- 更新时如果 `fse.move(prepared.stageDir, targetDir)` 失败，旧版本目录已经被删除。
- 如果 move 成功但 state 写入失败，磁盘包和 `state.json` 可能不一致。
- `ExtensionService.update()` 在安装前先 unload 旧扩展，再进入更新流程；失败时用户可能同时失去运行态和磁盘包一致性。

建议：

- 使用 backup/rollback 流程：`targetDir -> backupDir`，`stageDir -> targetDir`，state 写成功后删除 backup；任一步失败则回滚 backup。
- state 写入和文件替换至少要做到故障后可恢复：启动 catalog 能识别 backup/staged 残留并收敛。
- 更新失败时应尽量恢复旧版本并重新 reconcile，而不是只把错误传回 IPC。

### P1. UI contribution session 没有关闭协议，会泄漏 callback/session 状态

host 侧 entity menu resolve 会创建 session 并放入 `sessions`：

- `apps/desktop/src/main/services/extension/runtime/host/contributions/entity-menus.ts:141`
- `apps/desktop/src/main/services/extension/runtime/host/contributions/entity-menus.ts:151`

settings panel resolve 也一样：

- `apps/desktop/src/main/services/extension/runtime/host/contributions/settings-panels.ts:140`
- `apps/desktop/src/main/services/extension/runtime/host/contributions/settings-panels.ts:149`

两者只在 abort signal、runtime release 或 unregister 时清理：

- `apps/desktop/src/main/services/extension/runtime/host/contributions/entity-menus.ts:152`
- `apps/desktop/src/main/services/extension/runtime/host/contributions/settings-panels.ts:150`
- `apps/desktop/src/main/services/extension/runtime/host/contributions/entity-menus.ts:184`
- `apps/desktop/src/main/services/extension/runtime/host/contributions/settings-panels.ts:219`

但是 resolve RPC 正常完成后 signal 不会自动 abort，renderer 也没有 `close/release session` IPC。搜索只发现 scraper session 有 close 协议，entity menu/settings panel 没有对应释放通道。

影响：

- 用户反复打开实体菜单或设置面板，会在 extension host 进程内持续累积 session 和 callback 闭包。
- callbackId 在 session 生命周期内一直有效，旧 UI surface 关闭后也没有明确失效。
- 长时间运行后内存和 callback registry 可能增长。

建议：

- 增加 `extension:release-entity-menu-session` 和 `extension:release-settings-panel-session`，renderer 在菜单 unmount/dialog close 时调用。
- 同时增加 TTL/LRU 兜底，例如 5-10 分钟未使用自动释放。
- refresh 后复用 sessionId 时应替换旧 session，并清理旧 callback map。

### P1. `state.json` 读改写没有串行化，并发操作可能丢状态或损坏临时文件

`ExtensionStateStore` 的 `set/remove/setEnabled` 都是 read-modify-write，但没有 mutex：

- `apps/desktop/src/main/services/extension/state.ts:55`
- `apps/desktop/src/main/services/extension/state.ts:61`
- `apps/desktop/src/main/services/extension/state.ts:67`

写入使用固定临时文件：

- `apps/desktop/src/main/services/extension/state.ts:40`
- `apps/desktop/src/main/services/extension/state.ts:41`
- `apps/desktop/src/main/services/extension/state.ts:42`

`ExtensionService` 的安装、卸载、更新、启用、禁用都可能从 IPC 并发进入：

- `apps/desktop/src/main/services/extension/service.ts:156`
- `apps/desktop/src/main/services/extension/service.ts:170`
- `apps/desktop/src/main/services/extension/service.ts:178`
- `apps/desktop/src/main/services/extension/service.ts:199`
- `apps/desktop/src/main/services/extension/service.ts:207`

影响：

- 两个操作同时读旧 document，然后分别写回，会发生 lost update。
- 两个写操作同时使用 `state.json.tmp`，可能互相覆盖、move 失败或写入非预期内容。
- runtime manager 内部有 mutex，但它保护不了 state store。

建议：

- 给 `ExtensionStateStore` 加一个 `Mutex`，所有 read-modify-write 在 `runExclusive` 内执行。
- 临时文件使用唯一名称，或在锁内保留固定 temp。
- `ExtensionService` 也可以增加操作级队列，避免 install/update/uninstall/enable/disable 交错。

### P1. scaffold 生成的扩展默认要求 Kisaki `>=0.1.0`，但当前 app 版本是 `0.0.3`

当前桌面应用版本：

- `apps/desktop/package.json:3`

模板 manifest：

- `packages/create-kisaki-extension/templates/default/manifest.json:10`
- `packages/create-kisaki-extension/templates/default/manifest.json:11`

安装时 `ExtensionInstaller.prepareArchive()` 会检查 `manifest.engines.kisaki` 是否满足当前 `app.getVersion()`：

- `apps/desktop/src/main/services/extension/installer.ts:197`

影响：

- 用当前官方脚手架创建的默认扩展，在当前应用版本下会被安装器拒绝。
- 这会让新扩展作者路径从第一步就断掉。

建议：

- 要么把 app/package 版本提升到 `0.1.0` 及以上。
- 要么模板默认使用 `>=0.0.3` 或暂时不生成 `engines.kisaki`，等平台版本稳定后再收紧。
- CLI validate 可以在本地提示“模板目标 app 版本”和当前开发 app 版本不匹配。

## 中风险问题

### P2. theme token 只校验非空字符串，renderer 直接拼接成 CSS

theme token validation 只要求每个 token 是非空字符串：

- `packages/extension-api/src/contributions/themes/validation.ts:11`
- `packages/extension-api/src/contributions/themes/validation.ts:17`

renderer 直接把 token 拼进 CSS declaration：

- `apps/desktop/src/renderer/src/core/extensions/themes.ts:66`
- `apps/desktop/src/renderer/src/core/extensions/themes.ts:72`

影响：

- 扩展可以提交非颜色值，破坏主题语义。
- CSS custom property 的值非常宽松，带 `;` 等内容可能造成额外 CSS declaration 注入，跨过“renderer 只渲染结构化 DTO”的精神边界。

建议：

- 将 theme token 契约收窄为颜色 token，支持 hex/rgb/hsl/oklch 等明确格式。
- 或在 renderer 编译前使用 `CSS.supports('color', value)` 类似逻辑校验颜色值；主进程/host 侧也应做独立字符串约束。
- 对 token 值拒绝 `;`, `{`, `}` 等会逃逸 declaration 的字符。

### P2. manifest/schema/路径校验存在重复实现，后续容易漂移

当前有三层规则：

- `packages/extension-api/src/manifest.ts:52` 定义 manifest shape。
- `packages/extension-api/schemas/extension-manifest.schema.json:3` 手写 JSON Schema。
- `apps/desktop/src/main/services/extension/manifest.ts:11` 做 main 侧 semver/path/package 校验。
- `packages/extension-cli/src/manifest.ts:21` 做 CLI 侧 semver/path/project 校验。

CLI 与 main 的 semver/path 规则相似但不共享：

- `apps/desktop/src/main/services/extension/manifest.ts:20`
- `apps/desktop/src/main/services/extension/manifest.ts:27`
- `apps/desktop/src/main/services/extension/manifest.ts:120`
- `packages/extension-cli/src/manifest.ts:48`
- `packages/extension-cli/src/manifest.ts:56`
- `packages/extension-cli/src/manifest.ts:130`

影响：

- 后续新增 manifest 字段或路径规则时，容易出现 CLI 通过但 app 拒绝，或 schema 提示和运行时不一致。
- 文档里强调 `kisx validate/build/pack` 和 app 安装使用同一份 schema；实现上现在是“共享 shape helper + 多处补充规则”，不是完全单源。

建议：

- 在 `extension-api` 中导出 `parseExtensionManifest`、`normalizeManifestPackagePath`、`validateManifestSemver` 等纯 helper。
- JSON Schema 尽量由 TS 契约生成，或至少增加一个校验脚本确保 schema keys/categories 与 `manifest.ts` 同步。
- main 与 CLI 只组合不同上下文检查，例如“entry 是否存在”“project files 是否存在”，不要重复基础规则。

### P2. IPC handler 错误返回没有主进程日志

`ExtensionService.setupIpcHandlers()` 每个 handler 都 catch 并返回 `toErrorMessage(error)`，但绝大多数没有 `log.error/log.warn`：

- `apps/desktop/src/main/services/extension/service.ts:301`
- `apps/desktop/src/main/services/extension/service.ts:307`
- `apps/desktop/src/main/services/extension/service.ts:333`
- `apps/desktop/src/main/services/extension/service.ts:371`
- `apps/desktop/src/main/services/extension/service.ts:677`

影响：

- renderer 能看到用户可读错误，但 main log 缺少完整堆栈。
- 违反项目约定中“IPC 边界记录详细错误，返回可读摘要”的原则。

建议：

- 抽一个 `handleExtensionIpc(channel, action)` helper，统一 try/catch、log、IpcResult。
- 对预期 validation/not-found 错误用 `warn`，未知错误用 `error`。
- renderer 继续只显示摘要。

### P2. ExtensionService 和 RuntimeManager 偏大，局部复杂度继续上升会影响维护

当前几个核心文件行数偏高：

- `service.ts`：679 行。
- `runtime/manager.ts`：839 行。
- main 侧 `contributions/scrapers.ts`：767 行。
- host 侧 `runtime/host/contributions/scrapers.ts`：586 行。
- `runtime/host/sdk-bridge/bridge.ts`：565 行。
- `capabilities/library/relations.ts`：511 行。

这不是立即的架构错误，因为这些文件仍有清楚职责；但有两个趋势值得控制：

- `ExtensionService.setupIpcHandlers()` 把大量匿名 handler 堆在 service 中，后续新增 IPC 会让入口越来越难扫。
- scraper 四个 media domain 的 adapter 在 main/host 两侧重复度较高，后续新增 slot 或 media type 时改动面偏大。

建议：

- 把 extension IPC facade 拆成 `ipc-handlers.ts` 或 `handlers/ipc.ts`，service 只负责组装依赖。
- scraper adapter 可以抽 domain descriptor/table-driven helper，保留类型边界但减少四份重复。
- `RuntimeManager` 可保持单文件，但建议提取 storage document host handlers 或 lifecycle error policy，降低单文件认知负担。

### P2. host 侧 SDK bridge 对 deeplink/theme 的清理接口不对称

`ExtensionHostSdkBridge` 构造了 `deeplinks` 和 `themes`：

- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/bridge.ts:105`
- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/bridge.ts:106`

但 `dispose()` 和 `releaseRuntime()` 只显式释放 entity menus、settings panels、scrapers：

- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/bridge.ts:118`
- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/bridge.ts:119`
- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/bridge.ts:120`
- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/bridge.ts:207`
- `apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/bridge.ts:210`

当前 deeplink/theme 的注册清理主要依赖 `runtime.subscriptions.clear()`，而 main 侧 registry 的 `releaseRuntime/releaseAll` 是完整的：

- `apps/desktop/src/main/services/extension/contributions/registry.ts:145`
- `apps/desktop/src/main/services/extension/contributions/registry.ts:157`

这不一定造成即时泄漏，但实现风格不统一，后续 deeplink/theme 一旦增加 session 或缓存，很容易漏清理。

建议：

- 给 `HostDeeplinkContributions`、`HostThemeContributions` 增加空实现或真实 `releaseRuntime/releaseAll`，在 bridge 中统一调用。
- 把“注册清理由 subscriptions 负责”和“域内 runtime 状态由 releaseRuntime 负责”这两个边界写进代码注释或类型。

## 低风险问题和体验瑕疵

### P3. 发现页排序和分页状态不完全一致

发现页请求第一页时把 `sortField` 映射为 source `sortBy`：

- `apps/desktop/src/renderer/src/features/extension/components/discover-panel/discover-panel.vue:21`
- `apps/desktop/src/renderer/src/features/extension/components/discover-panel/discover-panel.vue:27`

但 `useAsyncData` 只 watch `searchTrigger` 和 `selectedRegistry`，不 watch `sortField/sortDirection/selectedCategory`：

- `apps/desktop/src/renderer/src/features/extension/components/discover-panel/discover-panel.vue:43`
- `apps/desktop/src/renderer/src/features/extension/components/discover-panel/discover-panel.vue:48`

页面又在客户端对当前已加载结果排序：

- `apps/desktop/src/renderer/src/features/extension/components/discover-panel/discover-panel.vue:77`

影响：

- 切换排序后，当前页只是本地重排，后续 load more 可能和初始 source 排序语义不一致。
- 分类过滤是本地过滤，会出现当前页无结果但远端仍有更多页的情况。

建议：

- sort/category 改变时清空分页并重新请求。
- 如果 source 不支持 category/direction，也应在 UI 中明确“本地筛选当前结果”，或者 source API 扩展为完整查询。

### P3. 已安装卡片可能显示 `vnull`

`ExtensionCatalogInfo.version` 是 `string | null`，但卡片直接渲染：

- `apps/desktop/src/renderer/src/features/extension/components/installed-panel/installed-panel-card.vue:147`

对 `missing-package/orphaned/invalid` 等 catalog 状态，可能出现 `vnull`。

建议：

- version 为空时显示 `未知版本` 或隐藏版本 badge。
- 同时把 `status/issues` 更显式地展示出来，避免 invalid 扩展看起来只是普通 disabled。

### P3. enable/disable 对 invalid package 的 UX 不够明确

`buildDesiredRuntimeMap()` 会跳过 `!entry.enabled || entry.status !== 'ready' || !entry.manifest`：

- `apps/desktop/src/main/services/extension/service.ts:598`

但 renderer 已安装卡片的 switch 只看 `extension.enabled`：

- `apps/desktop/src/renderer/src/features/extension/components/installed-panel/installed-panel-card.vue:75`
- `apps/desktop/src/renderer/src/features/extension/components/installed-panel/installed-panel-card.vue:171`

影响：

- 用户可以把 invalid/missing package 标为 enabled，但它不会运行。
- catalog 状态和 runtime 状态没有在 UI 中清楚区分。

建议：

- invalid/missing/orphaned 扩展禁用 switch，或启用后明确显示“已启用但未运行：包无效/缺失”。
- 增加 runtime status 字段后，UI 以 runtime status 为准展示“运行中/加载失败/未运行”。

## 架构清洁度评估

### 系统是否干净清晰简洁统一现代化

整体是清晰且现代化的。它已经具备：

- 单一 extension service 边界。
- 独立 shared extension host process。
- typed RPC protocol。
- `runtimeHandle` 授权。
- DTO-only renderer consumption。
- public API/package-first 设计。
- `.kisx` + `kisx` tooling。

不够简洁的部分主要在实现细节：

- IPC handlers 重复 try/catch。
- scraper 四域适配重复。
- manifest 校验多处重复。
- UI session 生命周期没有闭环。

这些不是推翻架构的问题，属于需要收口的工程债。

### 架构是否职责分明无重复

职责基本分明：

- catalog 负责扫描聚合。
- installer 负责 `.kisx` 安装/更新/卸载。
- state store 负责持久化。
- runtime manager 负责 host 生命周期和 reconcile。
- host loader 负责 activate/deactivate。
- host contribution domain 负责作者态函数和 callback session。
- main contribution domain 负责把结构化注册接入 scraper/deeplink/theme/renderer snapshot。
- renderer core 负责 IPC facade 和 snapshot/theme sync。

重复主要集中在：

- manifest/path/semver 校验重复。
- scraper 四域 RPC/adapter 重复。
- main service IPC handler 重复。
- library capability 的 entity RPC handler 重复。

重复程度可控，但如果继续增加扩展点，需要优先抽 table-driven/domain helper。

### 代码和文件夹组织是否易维护、易扩展、符合项目风格

符合项目风格。目录基本遵守 `docs/architecture/extension-system/README.md` 中的“根级单文件 + 多模块子域升目录”原则。`packages/extension-api`、`extension-sdk`、`extension-cli`、`create-kisaki-extension` 也没有回到旧的 main/renderer/types 镜像结构。

需要注意：

- `capabilities/library/entities/` 已经比最初文档设想更深，但它拆出了 configs/filter/dto/external-ids/host，属于复杂度真实增长，不是坏拆分。
- `RuntimeManager` 和 `ExtensionService` 仍是高认知负担文件，应避免再往里加匿名流程。
- `runtime/host/sdk-bridge/bridge.ts` 是关键风险文件，后续新增 capability 时要防止它变成第二个 service container。

### 是否无冗余代码或兼容性代码

active runtime 中没有发现旧 plugin 兼容层，结论是干净的。

仍可视为冗余/可压缩的代码：

- IPC handler try/catch 样板。
- scraper 四域 adapter 样板。
- manifest 校验样板。
- renderer installed/discover filter/sort 代码可以更抽象，但目前不急。

## 建议整改顺序

1. 先修运行时错误隔离：per-extension load failure 不阻断启动；安装失败状态明确化；catalog 增加 runtime status/error。
2. 修安装/更新原子性：staging + backup + rollback；更新失败恢复旧版本。
3. 给 `ExtensionStateStore` 和 extension mutating operations 加串行化。
4. 给 entity menu/settings panel 增加 session release/TTL。
5. 修脚手架 engines 版本。
6. 收紧 theme token 校验，避免 raw CSS injection。
7. 收敛 manifest/schema 校验单源。
8. 优化 scraper/library handler 重复。
9. 修 renderer 发现页分页排序和 `vnull` 等 UI 小问题。

## 最终判断

extension 系统已经完成了从旧 plugin 思维到新 extension 平台的关键架构迁移：边界、契约、运行时、工具链和 renderer 消费模型都站在正确位置。它现在最需要补的是“失败时也保持系统可用”的工程韧性。把 activation failure、安装原子性、state 并发、UI session 生命周期这四块补上后，这套系统会明显接近一个干净、统一、可扩展的现代扩展平台。
