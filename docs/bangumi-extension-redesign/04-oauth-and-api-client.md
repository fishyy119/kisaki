# 04 OAuth And API Client

## OAuth Relay Flow

生产版使用 Kisaki 官方 Bangumi 应用和 Kisaki 官方 OAuth Relay。Relay 部署方案见 [09-oauth-relay-deployment.md](09-oauth-relay-deployment.md)。

Kisaki 官方应用的 `client_secret` 只存在于服务器环境变量，例如 `BANGUMI_CLIENT_SECRET`，不写入 repo、桌面主应用、内置扩展、manifest、extension storage 或用户本机 secrets。Bangumi 开发者平台中的回调 URL 使用服务器 HTTPS 地址。第一版使用偏临时的域名路径，例如 `https://kisaki.me/_tmp/bangumi-oauth/callback`，后续产品化时再迁移到正式路径。

桌面端只保存用户自己的 access token、refresh token、expires_at。

## 扩展自组 OAuth

不新增主应用 OAuth service。Bangumi OAuth 是 Bangumi 扩展自己的业务流程，扩展通过通用能力和 context API 自己组合：

- `kisaki.network.request`: 调用 Kisaki OAuth Relay。
- `context.contributions.deeplinkRoutes.register`: 注册扩展自己的局部 callback path，由主应用生成 `kisaki://ext/<extensionId>/...` 回跳。
- `kisaki.runtime.openExternal`: 打开系统浏览器。
- `context.secrets`: 保存用户 token。

推荐流程：

1. 扩展发起登录，生成 state，并通过 `network.request` 创建 relay auth session。
2. Relay 返回 `sessionId`、`state`、`authorizeUrl`。
3. 扩展调用 `runtime.openExternal(authorizeUrl)`。
4. Bangumi redirect 到 Kisaki 服务器的 HTTPS callback。
5. Relay 在服务器端使用 `client_secret` exchange token，并把结果保存在短 TTL 一次性 session 中。
6. 浏览器通过 `kisaki://...` 唤醒桌面端，或扩展轮询 session 状态。
7. 扩展调用 relay complete endpoint 取回 token 并写入 `context.secrets`。

当前 Bangumi 内置扩展 id 是 `builtin.bangumi`。扩展只声明自己的局部 callback path，例如 `oauth-callback`；主应用根据扩展 id 归一化为内部路由 `ext/builtin.bangumi/oauth-callback`，并提供或生成 canonical 桌面回跳 URL `kisaki://ext/builtin.bangumi/oauth-callback`。`kisaki://bangumi/oauth-callback` 不会进入 extension deeplink handler。

扩展内的 `OAuthRelayClient` 需要保证：

- 生成 state。
- 校验 state/sessionId。
- 打开系统浏览器访问 authorize URL。
- 调用 Kisaki 官方 OAuth Relay 的 session/complete endpoint。
- refresh token 时同样走 relay，因为 Bangumi refresh 文档也要求 `client_secret`。
- 失败、取消、超时都返回结构化错误。

Relay 不长期落库用户 token。登录 flow 中可以把 exchange 结果保存在短 TTL 一次性 session 中，等待桌面端通过 sessionId 取回；取回或超时后立即清理。

## Relay Endpoint

Kisaki OAuth Relay endpoint 建议：

- `POST /_tmp/bangumi-oauth/sessions`: 创建登录 session，返回 `sessionId`、`state`、`authorizeUrl`。
- `GET /_tmp/bangumi-oauth/callback`: Bangumi redirect 落点；服务端校验 state，携带官方 `client_id/client_secret` 请求 `https://bgm.tv/oauth/access_token`，把 token 暂存到短 TTL session，然后返回可唤醒 Kisaki 的页面。
- `POST /_tmp/bangumi-oauth/sessions/{sessionId}/complete`: 桌面端取回一次性 token 结果；成功后服务端清理 session。
- `POST /_tmp/bangumi-oauth/refresh`: 输入 `refresh_token`，服务端携带官方 `client_id/client_secret` 和固定 callback `redirect_uri` 刷新 token。
- `POST /_tmp/bangumi-oauth/token-status`: 可选，用于诊断 token 状态。

## Account Screen

设置项：

- 凭据来源：Kisaki 官方应用。开发模式可提供用户自定义 Bangumi 应用 override，但生产默认不暴露。
- Kisaki OAuth Relay endpoint。
- redirect URI 展示和诊断。
- User-Agent 展示和诊断；默认使用 Kisaki 官方应用 UA。
- 登录状态：未登录、已登录、token 将过期、刷新失败。
- 操作：登录、刷新 token、验证 token、退出登录、清除凭据。

登录成功后立即调用 `/v0/me`，保存账号快照，用于后续 `/v0/users/{username}/collections`。

## Bangumi Client

`BangumiClient` 是所有 Bangumi API 请求的唯一入口：

- 自动注入 User-Agent。
- 自动注入 Bearer token。
- API 请求前检查 token 过期，必要时通过 relay refresh。
- 统一处理 401、429、5xx、网络错误、超时、取消。
- 统一分页 helper。
- 统一 provider-level rate limiter。

## Provider Rate Limit

设置项：

- Bangumi provider client requests per second。
- Bangumi provider client burst。
- 单次 API 调用失败重试次数。
- 5xx/network error backoff 起始和最大值。
- job 失败后是否自动暂停。

默认值建议：

- Bangumi API: 2 req/s，burst 2。
- 重试：网络/5xx 最多 3 次；401 先 refresh token；400/404 不重试。

实现要求：

- 批量导入保持并行调度，沿用主应用当前 scraper/ingest 并发模型。
- 用户设置的速率限制只控制 Bangumi provider client 发往 Bangumi API 的请求节奏。
- 所有 Bangumi API 请求都必须经过同一个 `BangumiClient` limiter，包括 scraper search/resolve/session、用户收藏拉取、目录拉取、同步写入、token 诊断。
- 并行导入多个条目时，可以同时执行多个 ingest item；其中触达 `api.bgm.tv` 的步骤会被 `BangumiClient` 统一限速。
- 设置改动只影响新 job；运行中的 job 显示当前使用的快照配置。
