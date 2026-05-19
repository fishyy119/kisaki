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
  config/
    defaults.ts
    schema.ts
    store.ts
  api/
    client.ts
    errors.ts
    limiter.ts
    pagination.ts
    types.ts
    user-agent.ts
  auth/
    account.ts
    oauth-flow.ts
    relay-client.ts
    token-store.ts
  scraper/
    provider.ts
    session.ts
    format.ts
    types.ts
  identity/
    external-id.ts
    resolver.ts
  sync/
    engine.ts
    fingerprint.ts
    mapping.ts
    subscription.ts
    suppressor.ts
  import/
    collection-importer.ts
    index-importer.ts
    planner.ts
    field-mapping.ts
  jobs/
    commands.ts
    runner.ts
    summary.ts
  tasks/
    templates.ts
  ui/
    settings.ts
    account.ts
    sync.ts
    import-collections.ts
    import-index.ts
    automation.ts
    advanced.ts
```

文件命名遵循项目偏好：用职责名而不是重复目录名；`index.ts` 仅作为入口或显式 re-export。模块之间通过 public 对象协作，不跨目录读取私有 helper。

## Activation Composition

`index.ts` 是扩展 composition root：

1. 创建 `SettingsStore`、`TokenStore`、`OAuthRelayClient`、`TokenService`、`BangumiClient`。
2. 创建 `AccountService`、`IdentityResolver`、`SyncEngine`、importers、`JobRunner`。
3. 注册 Bangumi game scraper provider。
4. 注册 settings panel。
5. 注册 deeplink route `/oauth-callback`。
6. 注册 commands。
7. 订阅 `library.game.created` / `library.game.updated`。
8. 在 `context.subscriptions` 中统一挂载 disposable。

`activate` 内只做装配，不塞业务流程。业务对象接收最小依赖，方便单测。

## 核心对象

- `SettingsStore`: 读写非敏感 settings，负责默认值、schema normalization 和版本升级。
- `TokenStore`: 通过 `context.secrets` 读写用户 token；不接触 `client_secret`。
- `OAuthFlow`: 组合 relay session、deeplink callback、openExternal、complete/polling 和取消/超时。
- `OAuthRelayClient`: 对已部署 relay 的唯一访问入口，负责 session、complete、refresh、token status 和 health check。
- `BangumiClient`: 对 Bangumi API 的唯一访问入口。
- `AccountService`: 读取 `/v0/me`，保存账号快照，提供登录状态。
- `BangumiProvider`: game scraper provider，使用 `BangumiClient`。
- `IdentityResolver`: 统一 external id 读取、解析和绑定策略。
- `SyncEngine`: 计算游玩状态/评分 payload、fingerprint、远端写入策略并写 Bangumi 收藏。
- `SyncSubscription`: 订阅 host library event，做 debounce、过滤和 suppress。
- `CollectionImporter`: 导入当前用户 Bangumi 游戏收藏。
- `IndexImporter`: 导入 Bangumi 目录游戏。
- `ImportPlanner`: dry run 计划与执行计划共用，输出新增、更新、跳过和错误。
- `JobRunner`: 管理一次 Bangumi job command execution 的取消、progress 上报和输出摘要；不管理 task 生命周期。
- `TaskTemplates`: 生成推荐 BackgroundTaskService task 创建输入；不运行、不取消、不读取 history。
- `SettingsPanelController`: 组装 structured settings panel models 和 callbacks。

## 依赖方向

```text
ui -> jobs -> sync/import/auth
ui -> tasks -> config
jobs -> config/api/identity
tasks -> config
sync/import/scraper -> api/identity/config
auth -> api? no, auth uses relay-client and token-store
api -> config/token-store/network
shared -> no project dependencies
```

规则：

- `api` 不依赖 `ui`、`jobs`、`sync`、`import`。
- `scraper` 不读取 settings UI 状态，只接收 `BangumiClient`。
- `sync` 和 `import` 不直接调用 `kisaki.network`，只调用 `BangumiClient`。
- `ui` 不拼业务 payload；它把用户输入转成 command args 或 settings patch。
- `jobs` 是 command 编排和输出摘要层，不承载 Bangumi API 细节，也不持久化运行历史。
- settings panel 不维护独立 job registry；运行态以 CommandService 的 command `running` 状态为唯一来源，进度显示由 command notify 负责。
- `tasks` 只定义推荐 task 模板和创建输入，不调用 task run/cancel，不展示 task history。

## Settings Schema

新版本从 `settings.v1` 开始；旧数据一律作废，不为历史内部字段保留兼容迁移：

```ts
interface BangumiSettingsV1 {
  version: 1
  auth: {
    loginTimeoutMs: number
  }
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

- `loginTimeoutMs`: `10 * 60 * 1000`。
- `autoSync.enabled`: `false`。
- `autoSync.syncOnCreate`: `false`。
- `autoSync.playStatusEnabled`: `true`。
- `autoSync.scoreEnabled`: `true`。
- `autoSync.clearRemoteScoreWhenEmpty`: `false`。
- `autoSync.statusToBangumi`: 使用 [01-scope-and-api-facts.md](01-scope-and-api-facts.md) 中的默认 Kisaki -> Bangumi 映射。
- `autoSync.debounceMs`: `3000`。
- `autoSync.notifyErrors`: `true`。
- `rateLimit.maxRequests`: `120`。
- `rateLimit.windowMs`: `60000`。
- `timeoutMs`: `30000`。
- `retryCount`: `3`。

导入相关 profile、字段写入和目标合集不进入 `settings.v1`。它们是单次 command args；如果用户创建导入类 background task，则这些值作为 task args 由主应用 BackgroundTaskService 持久化。

## Import Command Args

导入命令使用单次 JSON serializable args，不写入 extension storage：

```ts
interface BangumiImportWriteFields {
  status: boolean
  score: boolean
  tags: boolean
}

type BangumiImportTargetCollection =
  | { kind: 'none' }
  | { kind: 'existing'; collectionId: string }
  | { kind: 'byCollectionType' }
  | { kind: 'byIndexTitle' }
```

默认值：

- `fields.status`、`fields.score`、`fields.tags`: `false`。
- `targetCollection.kind`: `none`。

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

非敏感账号快照存 storage：

- `auth.account`
- `sync.state`
- `sync.queue`

task schedule、运行记录、输出和错误历史属于主应用 BackgroundTaskService。Bangumi extension storage 不保存 `jobs.history`、通用 `lastResult`、active execution id 或导入/同步命令结果副本；Bangumi settings panel 也不复制或展示 task history。

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
- `profile_missing`
- `ingest_failed`
- `library_update_failed`
- `job_cancelled`

对外显示时转换成 settings panel notice、command result error 和 notify 文案。日志使用 `context.logger`，不得记录 token、authorization code、refresh token、完整 HTTP body 或 secrets value。

## Scraper Provider 目标

`BangumiProvider` 保持 `externalIdSource = "bangumi"`，能力：

- `search`: `/v0/search/subjects`，过滤游戏。
- `resolve`: 优先识别 `lookup.knownIds` 中的 Bangumi subject ID。
- `openSession`: `/v0/subjects/{id}`，按 slot 延迟加载 persons、characters、relations、images。
- 输出 game metadata 时稳定包含 Bangumi external id。
- 所有请求通过共享 `BangumiClient` 和同一个 limiter。

当前 `scraper/format.ts` 中纯 mapping 逻辑可以保留或拆分，但新实现不能继续沿用旧机制或硬编码限速。
