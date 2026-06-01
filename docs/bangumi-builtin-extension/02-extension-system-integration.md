# 02 Extension System Integration

## 现有宿主能力

| 需求              | 当前入口                                               | Bangumi 内部归属                                       |
| ----------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| 持久设置          | `context.storage`                                      | 通用层，保存 settings、sync state、queue               |
| 敏感凭据          | `context.secrets`                                      | 通用层，保存 token、pending session                    |
| 网络请求          | `kisaki.network.request`                               | `api/BangumiClient` 与 `auth/OAuthRelayClient`         |
| 打开浏览器        | `kisaki.runtime.openExternal`                          | `auth/OAuthFlow`                                       |
| Deeplink callback | `context.contributions.deeplinkRoutes.register`        | `auth/OAuthFlow`                                       |
| 设置 UI           | `context.contributions.settingsPanels.register`        | `ui/settings`                                          |
| Scraper provider  | `context.contributions.scraperProviders.game.register` | `media/game/scraper`                                   |
| Host event        | `kisaki.events.on`                                     | `media/game/adapter` 订阅 `game.*`                     |
| Scraper profile   | `kisaki.scrapers.profiles.list/get`                    | `media/game/adapter` 只读取 game profile               |
| Ingest            | `kisaki.ingest.game.add.fromScraper`                   | `media/game/adapter` 创建或定位游戏                    |
| Library write     | `kisaki.library.*`                                     | `media/game/adapter` 写游戏状态、评分、tag、collection |
| Command 注册      | `context.contributions.commands.register`              | `jobs/commands`                                        |
| Command 执行      | `kisaki.commands.start/wait`                           | settings panel 启动一次 job                            |
| TaskRun           | `kisaki.taskRuns`                                      | command handler 创建、上报、等待本扩展 run             |
| Automation        | `kisaki.automations`                                   | `automations/templates` 与 settings automation tab     |

## Media Adapter Boundary

通用层只认识这个概念，不认识 `kisaki.library.games`：

```ts
interface LocalMediaAdapter {
  readonly scope: BangumiMediaScope
  readonly localMediaType: string
  readonly supportsScraperProfile: boolean
  readonly supportsAutoSync: boolean
  readonly supportsImportWrite: boolean
  registerRuntime(): Promise<Disposable>
  listLocalItems(query: LocalMediaListQuery): Promise<readonly LocalMediaItem[]>
  getLocalItem(id: string): Promise<LocalMediaItem | null>
  findBySubjectIds(subjectIds: readonly string[]): Promise<ReadonlyMap<string, LocalMediaItem>>
  addFromScraper(input: LocalMediaAddFromScraperInput): Promise<LocalMediaAddResult>
  patchUserFields(id: string, patch: LocalMediaUserPatch): Promise<LocalMediaItem>
  ensureTag(id: string, tagName: string): Promise<void>
  ensureInCollection(id: string, target: LocalCollectionTarget): Promise<void>
}
```

当前只实现：

```text
media/game/adapter.ts
```

`book` / `anime` / `music` scope 注册为 remote-only descriptor，不实现 `LocalMediaAdapter`。通用 import/sync 逻辑如果遇到没有 adapter 的 scope，必须返回稳定的 unsupported result，而不是降级写游戏表。

## Runtime Boundaries

必须遵守当前扩展系统边界：

- 扩展运行在 shared extension host process。
- Renderer 不 import `extensions/bangumi` 源码，也不执行扩展 entry。
- Renderer 只渲染 settings panel 和贡献快照 DTO。
- Bangumi 扩展只 import `@kisaki/extension-sdk`，不得 import `apps/desktop/src/main/**`、Drizzle schema、Electron API 或 renderer component。
- 所有宿主交互通过 `context.*` 和 `kisaki.*`。
- 所有 public contract 以 `packages/extension-api` 为准，不在扩展内复制主应用内部类型。

## Built-In Extension Pipeline

`extensions/bangumi` 是标准内置扩展项目：

- dev: `apps/desktop/scripts/prepare-builtin-extensions.ts watch` 调用 `kisx output` 写入 `apps/desktop/out/extensions`。
- build: `prepare-builtin-extensions.ts build --target=resources` 写入 `apps/desktop/resources/extensions`。
- manifest entry 继续指向 `./dist/index.mjs`。
- manifest categories 保持 `["scraper", "integration"]`。
- package scripts 保持 `kisx build`、`kisx validate`、`kisx pack`、`tsc --noEmit`。

验证命令：

```powershell
pnpm --filter @kisaki/builtin-bangumi typecheck
pnpm --filter @kisaki/builtin-bangumi build
pnpm --filter @kisaki/builtin-bangumi validate
```

## Deeplink 接入

注册：

```ts
const callback = context.contributions.deeplinkRoutes.register({
  id: 'oauth-callback',
  path: '/oauth-callback',
  async handle(event) {
    return oauthFlow.completeFromDeeplink(event)
  }
})
```

当前 public handle 字段是 `urlPattern`，形态为：

```text
kisaki://ext/builtin.bangumi/oauth-callback
```

规则：

- `path` 是 extension-local path，必须以 `/` 开头。
- path 不包含 `/ext`、extension id、query 或 hash。
- Relay 创建 session 时使用 `callback.urlPattern` 作为 desktop callback URL。
- handler 只解析 `event.query.sessionId` 和 `event.query.state`，不解析 host namespace。
- `kisaki://bangumi/...` 不是 extension deeplink 入口。

## Event 接入

DB event projector 已投影以下事件：

- `game.created`
- `game.updated`
- `game.deleted`
- 其他实体的 created/updated/deleted

Bangumi 自动同步不直接在通用层订阅这些 topic。订阅由 local adapter 暴露：

```ts
gameAdapter.subscribeLocalChanges((event) => syncQueue.enqueue(event))
```

`media/game/adapter` 内部才可以调用：

- `kisaki.events.on('game.created', ...)`
- `kisaki.events.on('game.updated', ...)`

当前 public `LibraryGameUpdatedEvent` 包含 `changes`，不包含可依赖的 source 字段。防循环策略必须由 Bangumi 扩展自己完成：

- 基于同步 payload 计算 fingerprint。
- 记录最近成功 fingerprint。
- 本扩展主动写入本地游玩状态/评分后维护 fingerprint suppress。
- 导入流程对 ingest 返回的 local item id 维护短期 import suppress。
- 对同一 `{ scope, localId }` debounce/coalesce。
- source 不作为跳过同步的必要条件。

## Settings Callback 约束

settings panel 的 resolve、submit、button、commit 回调走 main/host RPC，适合轻量读取和启动动作，不适合直接执行长任务。Bangumi 设置面板必须遵守：

- 登录发起可以在按钮回调中创建 relay session 并打开浏览器，但不得等待用户完成授权。
- 全量同步、收藏导入、目录导入必须启动 command 后立即返回。
- settings panel 的手动执行只对应 job；取消、进度和完成结果由 command handler 创建的 TaskRun 与主应用任务中心承载。
- automation 创建只写入 AutomationService；settings panel 不调用 automation run/cancel，也不展示 execution history。

## Job 与 Automation 关系

Bangumi 的 `job` 是一次业务执行。宿主调用 command handler，handler 创建 scoped TaskRun 后立即返回 `runId`：

```ts
context.contributions.commands.register({
  id: 'bangumi.sync.full',
  title: 'Bangumi Full Sync',
  async execute(args) {
    return jobs.runFullSync(args)
  }
})
```

`jobs.runFullSync()` 通过 `kisaki.taskRuns.create()` 创建 run，通过 returned handle 上报 progress/checkpoint/complete/fail。CommandService 不提供 command progress，也不负责取消 TaskRun。

Bangumi 的 `automation` 是主应用 AutomationService 中的持久自动化配置。automation 保存要调用的 command、参数、trigger、failurePolicy 和 enabled 状态；主应用触发对应 job command，并把每次 command invocation 写入 `automation_run_history`。如果 handler 创建 TaskRun，该 run 只进入任务中心的 TaskRun active/history 流，不回写 automation history。

Automation 只能绑定本扩展拥有的 command。宿主会校验：

- `ownerExtensionId === builtin.bangumi`
- automation command 必须由 `builtin.bangumi` 注册
- 扩展只能访问自己拥有的 automation

因此 automation 配置、automation invocation history 和 TaskRun completed history 都不需要另存到 Bangumi storage。settings panel 只保存用户偏好与 Bangumi 业务状态；automation 的启停、手动运行、schedule、failurePolicy 和 invocation history 归主应用 AutomationService，已创建 TaskRun 的进度、取消、结果和任务中心历史由任务中心通过 TaskRunService 展示和控制。

## Library 写入策略

通用规则：

- 通用层不直接调用 `kisaki.library.games.*`。
- 本地写入先由 `MediaRegistry.requireLocalAdapter(scope)` 判断能力。
- 没有 adapter 的 scope 返回 unsupported result，UI 不展示执行入口。
- 创建本地条目优先走 adapter 的 `addFromScraper`。
- 导入不得修改资料元数据。
- 默认只创建缺失条目；用户显式开启 patch existing 后，才可按 Bangumi subject ID 补写已有条目的用户态字段。

当前 game adapter 可使用：

- `kisaki.library.games.get/list/update`
- `kisaki.library.collections.get/list/create/update`
- `kisaki.library.tags.get/list/create/update`
- `kisaki.library.relations.list/create/update/remove`
- `kisaki.ingest.game.add.fromScraper`
