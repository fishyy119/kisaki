# 03 Extension Architecture

## 目标目录

```text
extensions/bangumi/src/
  index.ts
  shared/
    constants.ts
    errors.ts
    ids.ts
    result.ts
  media/
    labels.ts
    registry.ts
    scopes.ts
    types.ts
    book/
      scope.ts
    game/
      adapter.ts
      mapping.ts
      scraper/
        provider.ts
        session.ts
        types.ts
        format/
      sync.ts
      import.ts
    anime/
      scope.ts
    music/
      scope.ts
  config/
    defaults.ts
    schema.ts
    store.ts
  api/
    client.ts
    errors.ts
    limiter.ts
    pagination.ts
    subjects.ts
    types.ts
    user-agent.ts
  auth/
    account.ts
    oauth-flow.ts
    relay-client.ts
    token-service.ts
    token-store.ts
  identity/
    subject-ref.ts
    external-id.ts
    resolver.ts
  sync/
    engine.ts
    fingerprint.ts
    queue.ts
    subscription.ts
    suppressor.ts
  import/
    collection-reader.ts
    index-reader.ts
    planner.ts
    executor.ts
    field-mapping.ts
  jobs/
    args.ts
    auth.ts
    commands.ts
    context.ts
    import/
      runner.ts
      local.ts
      model.ts
      planning.ts
      preview.ts
      progress.ts
    presentation.ts
    runner.ts
    summary.ts
    sync.ts
  automations/
    templates.ts
  ui/
    settings/
      index.ts
      panel.ts
      resources.ts
      tabs.ts
      account/
      sync/
      import/
      automation/
      advanced/
```

文件命名遵循项目偏好：用职责名而不是重复目录名；`index.ts` 仅作为入口或显式 re-export。模块之间通过 public 对象协作，不跨目录读取私有 helper。

## Activation Composition

`index.ts` 是扩展 composition root：

1. 创建 `SettingsStore`、`TokenStore`、`OAuthRelayClient`、`TokenService`、`BangumiClient`。
2. 创建 `MediaRegistry`，注册 `book`、`game`、`anime`、`music` scope descriptor。
3. 为 `game` scope 创建 `GameLocalMediaAdapter` 和 `BangumiGameProvider`。
4. 创建 `AccountService`、`SubjectIdentityResolver`、`SyncEngine` 和 `JobRunner`。
5. 注册 Bangumi game scraper provider。
6. 注册 settings panel。
7. 注册 deeplink route `/oauth-callback`。
8. 注册 commands。
9. 通过 `MediaRegistry` 启动 local-capable adapter 的 event subscription。
10. 在 `context.subscriptions` 中统一挂载 disposable。

`activate` 内只做装配，不塞业务流程。业务对象接收最小依赖，方便单测。

## Media Registry

`MediaRegistry` 是 media scope 架构的核心：

```ts
type BangumiMediaScope = 'book' | 'game' | 'anime' | 'music'

interface BangumiMediaDescriptor {
  scope: BangumiMediaScope
  subjectType: 1 | 2 | 3 | 4
  label: string
  collectionLabels: Record<BangumiCollectionType, string>
  localAdapter?: LocalMediaAdapter
}
```

注册结果：

- `book`: `subjectType=1`，remote-only。
- `game`: `subjectType=4`，有 `GameLocalMediaAdapter`。
- `anime`: `subjectType=2`，remote-only。
- `music`: `subjectType=3`，remote-only。

规则：

- `api`、`auth`、`jobs`、`ui` 可以读取 descriptor。
- `sync`、`import` 需要本地写入时必须通过 `localAdapter`。
- 没有 adapter 的 scope 不允许执行本地写入。
- 新增本地媒体支持时只新增 adapter，不修改通用层流程。

## 核心对象

- `SettingsStore`: 读写非敏感 settings，负责默认值、schema normalization。使用 `settings.v1` storage key，原地写入当前 schema，不新增新 key。
- `TokenStore`: 通过 `context.secrets` 读写用户 token；不接触 `client_secret`。
- `OAuthFlow`: 组合 relay session、deeplink callback、openExternal、complete/polling 和取消/超时。
- `OAuthRelayClient`: 对已部署 relay 的唯一访问入口，负责 session、complete、refresh、token status 和 health check。
- `BangumiClient`: 对 Bangumi API 的唯一访问入口；所有 subject API 都接收 `BangumiSubjectRef` 或 `BangumiMediaScope`。
- `MediaRegistry`: 保存四类 scope descriptor 和可选 local adapter。
- `GameLocalMediaAdapter`: 封装当前宿主的 game library、ingest、event 和 scraper API。
- `BangumiGameProvider`: game scraper provider，使用共享 `BangumiClient`。
- `SubjectIdentityResolver`: 统一 external id 读取、解析和绑定策略。
- `SyncEngine`: 计算本地用户态字段到 Bangumi collection payload 的同步计划。
- `SyncSubscription`: 通过 local adapter 订阅 host library event，做 debounce、过滤和 suppress。
- `CollectionReader`: 按 scope 拉取当前用户 Bangumi 收藏。
- `IndexReader`: 按 scope 拉取 Bangumi 目录条目。
- `ImportPlanner`: 预览计划与执行计划共用，输出新增、更新、跳过和错误。
- `ImportExecutor`: 对有 local adapter 的 scope 执行本地写入。
- `JobRunner`: jobs 门面，分发到 auth、sync、import 三类 job runner。
- `Job context`: 管理一次 Bangumi job 的 TaskRun 生命周期、取消 checkpoint、progress 上报和输出摘要。
- `ImportJobRunner`: 先 collect 远端/本地计划并过滤实际 operations；preview 只渲染 operations，execute 只执行 operations。
- `AutomationTemplates`: 生成推荐 AutomationService 创建输入；不运行、不取消、不读取 history。
- `SettingsPanelController`: 组装 structured settings panel models 和 callbacks。

## 依赖方向

```text
ui -> jobs runner -> auth/sync/import jobs
ui -> media registry -> descriptors
jobs -> media registry -> sync/import
sync/import -> media registry -> local adapter
media/game -> kisaki library/ingest/events/scraper APIs
sync/import/scraper -> api/identity/config
auth -> relay-client/token-store
api -> token-service/network/config
shared -> no project dependencies
```

规则：

- `api` 不依赖 `ui`、`jobs`、`sync`、`import`、`media/game`。
- `auth` 不依赖 `api/client`；token status 走 relay。
- `scraper` 不读取 settings UI 状态，只接收 `BangumiClient`。
- `sync` 和 `import` 不直接调用 `kisaki.network`，只调用 `BangumiClient`。
- `sync` 和 `import` 不直接调用 `kisaki.library.*`，只调用 local adapter。
- `ui` 不拼业务 payload；它把用户输入转成 command args 或 settings patch。
- `jobs` 是 command 编排、TaskRun wrapper 和输出摘要层，不承载 Bangumi API 细节，也不持久化运行历史。
- `automations` 只定义推荐 automation 模板和创建输入，不调用 run/cancel，不展示 task run history。

## Settings Schema

使用当前 `settings.v1` storage key，直接承载 settings schema：

```ts
interface BangumiSettingsV1 {
  version: 1
  auth: {
    loginTimeoutMs: number
  }
  media: Record<
    BangumiMediaScope,
    {
      enabled: boolean
      localSyncEnabled: boolean
    }
  >
  game: {
    autoSync: {
      enabled: boolean
      syncOnCreate: boolean
      playStatusEnabled: boolean
      scoreEnabled: boolean
      clearRemoteScoreWhenEmpty: boolean
      debounceMs: number
      notifyErrors: boolean
      statusToBangumi: Record<LibraryGameStatus, BangumiCollectionType | 'skip'>
    }
  }
  client: {
    rateLimit: {
      maxRequests: number
      windowMs: number
    }
    timeoutMs: number
    retryCount: number
  }
}
```

默认值：

- `media.book.enabled`: `true`。
- `media.game.enabled`: `true`。
- `media.game.localSyncEnabled`: `true`。
- `media.anime.enabled`: `true`。
- `media.music.enabled`: `true`。
- `media.book.localSyncEnabled`: `false`。
- `media.anime.localSyncEnabled`: `false`。
- `media.music.localSyncEnabled`: `false`。
- game auto sync 默认关闭，其余默认使用当前稳定默认值。

导入相关 profile、字段写入和目标合集不进入 `settings.v1`。它们是单次 command args；如果用户创建导入类 automation，则这些值作为 automation args 由主应用 AutomationService 持久化。

## Command Args Model

所有 media-scoped command args 都必须带 `scope`：

```ts
interface BangumiScopedJobArgs {
  scope: BangumiMediaScope
}
```

本地写入类参数只对有 adapter 的 scope 生效：

```ts
interface BangumiImportWriteFields {
  status: boolean
  score: boolean
  tags: boolean
}

interface BangumiImportPatchOptions {
  patchExisting: boolean
  targetCollection: BangumiImportTargetCollection
}
```

规则：

- `book` / `anime` / `music` 预览可以读取远端数据和生成计划；正式 command 执行仍返回 unsupported summary。
- `book` / `anime` / `music` execute 本地写入必须返回 unsupported，UI 默认不展示执行写入入口。
- `byIndexTitle` 只允许用于有 local adapter 的目录导入。

## Secrets Schema

敏感值只存 `context.secrets`：

```ts
interface BangumiTokenSecretV1 {
  version: 1
  accessToken: string
  refreshToken?: string
  tokenType?: string
  scope?: string | null
  userId?: number
  expiresAt?: number | null
}
```

keys:

- `auth.token`
- `auth.pendingSession`，仅用于 OAuth flow 恢复，短期保存

非敏感账号快照和同步状态存 storage：

- `settings.v1`
- `auth.account`
- `sync.state`
- `sync.queue`

automation trigger 和 command invocation 运行记录属于主应用 AutomationService。job 创建 TaskRun 后的进度、输出摘要和错误结果属于该 TaskRun。Bangumi extension storage 不保存 `jobs.history`、通用 `lastResult`、active run id 或导入/同步命令结果副本。

## Error Model

扩展内部统一错误类型：

- `auth_required`
- `auth_cancelled`
- `auth_expired`
- `relay_unavailable`
- `bangumi_rate_limited`
- `bangumi_validation`
- `bangumi_not_found`
- `network_failed`
- `local_media_unsupported`
- `profile_missing`
- `ingest_failed`
- `library_update_failed`
- `job_cancelled`

对外显示时转换成 settings panel notice、command result error 和 notify 文案。日志使用 `context.logger`，不得记录 token、authorization code、refresh token、完整 HTTP body 或 secrets value。

## Scraper Provider 目标

当前只注册 game scraper provider：

- `context.contributions.scraperProviders.game.register(new BangumiGameProvider(client))`
- `externalIdSource = 'bangumi'`
- `search`: `/v0/search/subjects`，过滤 `type=4`
- `resolve`: 优先识别 `lookup.knownIds` 中的 Bangumi subject ID
- `openSession`: `/v0/subjects/{id}`，按 slot 延迟加载 persons、characters、relations、images
- 输出 game metadata 时稳定包含 Bangumi external id
- 所有请求通过共享 `BangumiClient` 和同一个 limiter

不注册 book/anime/music scraper provider，除非未来 extension API 和宿主媒体模型自然提供对应入口。
