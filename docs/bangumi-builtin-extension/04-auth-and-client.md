# 04 Auth And Client

## Relay 事实

Kisaki OAuth Relay 已部署。扩展只需要把 relay 当成生产外部服务调用，不在本仓库新增部署文档或服务端草案。

默认生产 endpoint:

```text
https://kisaki.me/_tmp/bangumi-oauth
```

扩展内部使用该生产 endpoint；settings panel 不暴露 relay URL 配置。

约定 endpoint:

- `POST /sessions`
- `POST /sessions/{sessionId}/complete`
- `POST /refresh`
- `POST /token-status`
- `GET /healthz`

Bangumi redirect callback 由 relay 服务持有；桌面端 callback 使用 extension deeplink：

```text
kisaki://ext/builtin.bangumi/oauth-callback
```

## OAuth Flow

登录流程：

1. 扩展启动时注册 `/oauth-callback` deeplink，并保存返回的 `urlPattern`。
2. 用户在 settings panel 点击登录。
3. `OAuthFlow` 调用 relay `POST /sessions`，请求体包含 `desktopCallbackUrl = urlPattern`。
4. Relay 返回 `sessionId`、`state`、`authorizeUrl`、`expiresAt`；扩展以 relay 返回的 `state` 为校验事实，可额外保存本地 nonce 做恢复诊断。
5. 扩展把 pending session 写入 `context.secrets`，调用 `kisaki.runtime.openExternal(authorizeUrl)`。
6. 浏览器完成 Bangumi 授权后，relay 使用服务器端 `client_secret` exchange token，并通过 `kisaki://ext/builtin.bangumi/oauth-callback?sessionId=...&state=...` 唤醒桌面端。
7. Deeplink handler 校验 `sessionId` 和 `state`，调用 `POST /sessions/{sessionId}/complete`。
8. 成功后写入 `auth.token`，删除 pending session，调用 `/v0/me` 保存账号快照，刷新 settings panel。

兜底：

- 如果 deeplink 未唤醒，settings panel 可以提供“检查登录结果”按钮，调用 complete endpoint。
- pending session 过期后必须删除 secrets 并提示用户重新登录。
- 用户取消时删除 pending session，不删除已有可用 token。

退出登录：

- 删除 `auth.token`、`auth.pendingSession`、`auth.account`。
- 不删除 `sync.state`、主应用 task 或 task history；task 管理和历史清理应走主应用 task 能力。

## Token Refresh

`TokenService` 在每次需要 Bearer token 前执行：

1. 从 `context.secrets.get('auth.token')` 读取 token。
2. 如果没有 token，返回 auth required。
3. 如果 `expiresAt` 距当前时间大于安全窗口，直接返回 access token。
4. 如果将过期或已过期，调用 relay `POST /refresh`，请求体只包含用户 refresh token。
5. 成功后原子写回 `auth.token`。
6. 失败时保留既有 token 和错误状态，settings panel 显示可重试操作。

安全窗口建议 `5 * 60 * 1000` ms。

401 处理：

- 普通 API 请求遇到 401 时允许强制 refresh 一次，然后重试原请求一次。
- 第二次 401 视为认证失效，要求用户重新登录。

## Token Status

token status 不属于 `BangumiClient`。

规则：

- `OAuthRelayClient` 负责调用 relay `POST /token-status`。
- `TokenService` 暴露验证当前 token 的业务方法，用于 settings panel 的“验证账号”和 `bangumi.auth.refresh` job。
- 扩展不得直接调用 `https://bgm.tv/oauth/token_status`，也不得把该 endpoint 放进 `BangumiClient`。
- `BangumiClient` 只访问 `https://api.bgm.tv/v0/**`。

## BangumiClient

`BangumiClient` 是唯一 Bangumi API 出口：

```text
BangumiClient
  -> TokenService.getAccessToken()
  -> RateLimiter.acquire()
  -> kisaki.network.request()
  -> response/error normalization
```

职责：

- 注入 `Accept: application/json`。
- 注入 `Content-Type: application/json`。
- 注入 User-Agent。
- 需要认证的请求注入 Bearer token。
- 统一 timeout。
- 统一 429、5xx、network error retry。
- 统一分页 helper。
- 统一把 Bangumi API error 转成内部错误 code。
- 统一处理 `BangumiMediaScope` 到 `SubjectType` 的转换。

禁止：

- 任何模块绕过 `BangumiClient` 直接请求 `api.bgm.tv`。
- 任何模块绕过 `OAuthRelayClient` 直接请求 relay 或 `bgm.tv/oauth/*`。
- scraper provider 创建自己的 limiter。
- settings panel 或 jobs 直接拼 OAuth、relay 或 Bangumi HTTP 请求。

## User-Agent

User-Agent 生成由 `api/user-agent.ts` 负责：

```text
<developer-id>/Kisaki-Bangumi/<extension-version> (<homepage>)
```

运行时可通过 `kisaki.runtime.getInfo()` 读取 appVersion/apiVersion，在诊断 UI 中展示：

- app version
- extension version
- API base URL
- relay base URL
- User-Agent

User-Agent 中不得包含用户 token、username 或本机路径。

## Rate Limiter

限速是 Bangumi client 级别的共享限制，不是 job 并发限制：

- 默认每 `60` 秒最多 `120` 次请求。
- 用户可在 Advanced 调整窗口请求数和窗口长度。
- 设置修改影响后续进入 `BangumiClient` 队列的新请求。
- 批量导入仍可并行执行本地 ingest item；只有触达 Bangumi API 的步骤排队。

实现建议：

- 使用 sliding window。
- `acquire(signal)` 支持取消。
- 429 使用响应头可用信息优先，否则按 backoff 策略等待。
- 5xx/network error 按指数 backoff 重试。
- 400/403/404 不重试。
- 401 交给 TokenService refresh 后重试一次。

## API Surface

第一版 `BangumiClient` 暴露 media-scoped 方法：

- `getMe()`
- `searchSubjects(scope, payload, page)`
- `getSubject(ref)`
- `getSubjectPersons(ref)`
- `getSubjectCharacters(ref)`
- `getSubjectRelations(ref)`
- `getSubjectImageUrl(ref, type)`
- `getUserCollections(username, query)`
- `getUserCollection(username, ref)`
- `upsertMyCollection(ref, payload)`
- `patchMyCollection(ref, payload)`
- `getIndex(indexId)`
- `getIndexSubjects(indexId, query)`

其中：

```ts
interface BangumiSubjectRef {
  scope: BangumiMediaScope
  subjectType: 1 | 2 | 3 | 4
  subjectId: number
}

interface BangumiUserCollectionsQuery {
  scope: BangumiMediaScope
  collectionTypes?: readonly BangumiCollectionType[]
  limit?: number
  offset?: number
}

interface BangumiIndexSubjectsQuery {
  scope: BangumiMediaScope
  limit?: number
  offset?: number
}
```

分页统一返回：

```ts
interface Page<T> {
  items: readonly T[]
  total?: number
  limit: number
  offset: number
  hasMore: boolean
}
```

## Collection Payload

同步只写允许字段：

```ts
interface BangumiCollectionPatch {
  type?: 1 | 2 | 3 | 4 | 5
  rate?: number
  tags?: readonly string[]
}
```

规则：

- 自动同步只写 `type` 和/或 `rate`。
- 导入不会写远端。
- `ep_status` / `vol_status` 不进入同步范围。
- 空 payload 不发请求。
- 写远端 collection 前必须持有 `BangumiSubjectRef`，不得只传裸 subject id。

## Relay Failure Handling

Relay 不可用时：

- 未登录用户无法完成登录。
- token 过期用户无法 refresh。
- 已有未过期 access token 的普通 Bangumi API 请求不受影响。

UI 要显示：

- relay URL。
- 最近一次 relay health check 结果。
- 登录 session 是否 pending/expired。
- refresh 错误和重试按钮。

日志只记录错误 code、HTTP status、endpoint path 和 request id；不得记录 token、code、state 或 secret。
