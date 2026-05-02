# 02 Extension Architecture

扩展内部采用明确的 domain 分层。旧实现只作为需要替换的现状参考，不沿用旧模块边界。

```text
extensions/bangumi/src/
  index.ts
  api/
    bangumi-client.ts
    bangumi-types.ts
    rate-limiter.ts
    user-agent.ts
  auth/
    oauth-relay-client.ts
    oauth-flow.ts
    token-service.ts
    account-service.ts
  config/
    defaults.ts
    schema.ts
    settings-store.ts
  identity/
    bangumi-id.ts
    resolver.ts
  sync/
    status-mapping.ts
    score-mapping.ts
    sync-engine.ts
    event-sync.ts
    full-sync.ts
  import/
    user-collection-importer.ts
    index-importer.ts
    import-planner.ts
    field-mapping.ts
  jobs/
    command-registration.ts
    job-runner.ts
    job-state.ts
    retry-policy.ts
  scraper/
    provider.ts
    format.ts
    session.ts
  ui/
    settings.ts
    account-screen.ts
    sync-screen.ts
    import-screen.ts
    advanced-screen.ts
```

## 核心对象

- `BangumiClient`: 对官方 API 的唯一访问入口，统一 User-Agent、Bearer token、provider-level rate limit、429/5xx/backoff、分页、错误转换。
- `OAuthRelayClient`: 调用 Kisaki 官方 OAuth Relay，用服务器上的 Kisaki 官方 Bangumi 应用 secret 完成 token exchange 与 refresh。
- `TokenService`: 管理 OAuth relay session、refresh、token_status、过期判断；桌面端只保存用户 token，不保存 Kisaki 官方 `client_secret`。
- `AccountService`: 通过 `/v0/me` 获取当前用户，缓存 username、nickname、avatar、user id。
- `SettingsStore`: 管理非敏感设置、mapping 表、Bangumi provider client rate limit、job 偏好。
- `IdentityResolver`: 使用 Kisaki external id `{ source: "bangumi", id: "<subject_id>" }` 绑定本地游戏与 Bangumi subject。
- `SyncEngine`: 把 Kisaki 游戏状态/评分转换为 Bangumi `UserSubjectCollectionModifyPayload` 并调用 `POST /v0/users/-/collections/{subject_id}`。
- `ImportPlanner`: 先生成 dry-run 计划，明确新增、更新、跳过、冲突、错误。
- `JobRunner`: 串接分页、并行 scraper ingest、library patch、进度事件、取消和重试。
- `CommandRegistration`: 注册 `bangumi.sync.full`、`bangumi.import.my-collections` 等 command，并作为设置按钮和后台 task 的共同执行入口。
- `BangumiProvider`: 仍注册为 game scraper provider，但重写为只围绕官方 API 和新的 client/session 抽象。

## 身份与绑定

- Bangumi subject ID 是唯一稳定外部身份。
- Kisaki external id 使用 `{ source: "bangumi", id: String(subjectId) }`。
- 自动同步和导入都先通过 external id 找本地游戏。
- 未绑定的本地游戏默认跳过；可选使用指定 Bangumi scraper profile 尝试 resolve。

## Scraper Provider

Bangumi provider 必须做到：

- `resolve(lookup)` 优先识别 `lookup.knownIds` 中的 Bangumi subject ID。
- `search(query)` 使用 `/v0/search/subjects`，过滤 `type=[4]`。
- `openSession(target)` 使用 `/v0/subjects/{subject_id}`。
- 所有 API 请求经过同一个 `BangumiClient`，不得绕过 rate limiter。
- 输出 Kisaki game metadata，并稳定携带 Bangumi external id。
