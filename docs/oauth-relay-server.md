# OAuth Relay Server(oauth-relay.ximu.dev)

跨项目通用的持密 OAuth 代理,按**租户(app)× 上游(provider)**二维命名空间组织。
它不是 token 存储、不是 API 代理、不是用户系统。职责只有一个:替客户端应用保管
client secret,完成授权码换取,然后把 token 一次性交还客户端。

Kisaki 是第一个租户,服务其**上游强制要求 client secret** 的数据源:
**Bangumi、AniList、Google Books**。支持公共客户端的源(MAL)由桌面应用
直连 PKCE,不经 relay——MAL 已确认接受 `kisaki://` 自定义 scheme redirect。
上游 OAuth 应用天然逐产品注册(授权同意屏显示产品名),因此凭据与回调 scheme
白名单均按租户隔离;新项目接入 = 新增租户 env 配置 + 上游注册,零代码改动。

本文件同时是扩展侧 SDK relay 客户端(`@kisaki3/extension-sdk` 的 `oauth-relay`)
的线协议事实标准。改协议先改这里。

---

## 1. 安全不变量(实现必须满足)

1. **永不持久化 token**。授权码在回调时暂存于会话,`/complete` 时才向上游换取
   token 并直接返回给客户端,随后立即丢弃会话。token 至多在一次请求的内存中存在。
2. **会话短时、单次、绑定 state**。pending 会话 TTL ≤ 10 分钟,`state` 为
   ≥ 128 位随机值,`/complete` 校验 (sessionId, state) 后即销毁会话,重放返回 404。
3. **`desktopCallbackUrl` 逐租户白名单**。`POST /sessions` 收到的回调地址必须
   匹配该租户配置的 scheme 前缀(kisaki 租户为 `kisaki://`),否则拒绝(400)
   ——防止 relay 沦为开放重定向器,也防止租户间互相冒用回调。
4. **日志卫生**。`/callback` 的 query(含授权码)与一切 token 值不得进入日志;
   反向代理层对本站点直接关闭 access log(nginx 默认会记录完整请求行,含
   `?code=...`),观测依赖应用层结构化日志(其本身不含 token)。
5. **secrets 只经环境变量注入**,不进镜像、不进仓库。
6. **仅 HTTPS**(由反向代理终结 TLS + HSTS),无 CORS(没有浏览器 XHR 消费方),
   `POST /sessions` 按 IP 限流。

relay 宕机的影响面 = 仅新登录与 token 续期不可用;已授权客户端的既有 token
不受影响。

---

## 2. 线协议(所有租户与 provider 同形,路径二维前缀区分)

路由形态:`/{app}/{provider}/...`。kisaki 租户的 provider 前缀:
`/kisaki/bangumi`、`/kisaki/anilist`、`/kisaki/google-books`。
客户端(SDK relay 客户端)持有的 base URL 已含完整二维前缀,例如
`https://oauth-relay.ximu.dev/kisaki/bangumi`,在其后追加下述相对路径。
所有 JSON 字段 canonical 形态为 camelCase;时间戳为 epoch 毫秒。
以下以 `/{provider}` 简写 `/{app}/{provider}`。

### POST /{provider}/sessions

请求:`{ "desktopCallbackUrl": "kisaki://..." }`

响应 200:

```json
{
  "sessionId": "随机 id",
  "state": "≥128 位随机值",
  "authorizeUrl": "拼好参数的上游授权页 URL",
  "expiresAt": 1735000000000
}
```

`desktopCallbackUrl` 不合白名单 → 400。

### GET /{provider}/callback?code=...&state=...

上游浏览器回跳。按 state 找到会话,暂存 code,302 跳转到该会话的
`desktopCallbackUrl`,并追加 query:`?sessionId=...&state=...`
(回调 URL 自带 query 时用 `&` 追加)。

失败路径(state 未知/会话过期/上游返回 error)→ 302 到 `desktopCallbackUrl`
追加 `?error=...`;无法定位会话时返回一个简单的 HTML 错误页。

### POST /{provider}/sessions/{sessionId}/complete

请求:`{ "state": "..." }`

行为:校验会话与 state → 用暂存的 code + client secret 向上游换 token →
销毁会话 → 返回 token。会话未知/过期/已消费 → 404。

响应 200(字段按上游能力可缺省):

```json
{
  "accessToken": "...",
  "refreshToken": "...",
  "tokenType": "Bearer",
  "scope": null,
  "expiresAt": 1735000000000,
  "userId": 123456
}
```

### POST /{provider}/refresh

请求:`{ "refreshToken": "..." }` → 响应 200 同 token 形态。
上游不支持刷新(AniList)→ 501。刷新被上游拒绝 → 401 透传语义
`{ "error": "..." }`(不透传上游原文中的敏感值)。

### POST /{provider}/token-status

请求:`{ "accessToken": "..." }` → 响应 200:

```json
{ "active": true, "expiresAt": 1735000000000, "userId": 123456, "scope": null }
```

实现方式按 provider 矩阵(§3);不可探测的 provider 可返回
`{ "active": true }` 加注释说明为乐观响应。

### GET /{provider}/healthz 与 GET /healthz

`{ "ok": true }`。仅探活,不触达上游。

---

## 3. Provider 矩阵(上游注册与怪癖)

正式域名:`oauth-relay.ximu.dev`。Kisaki 租户的 redirect URI 一律注册为:
`https://oauth-relay.ximu.dev/kisaki/{provider}/callback`

域名与租户前缀会被烙进上游应用注册与扩展默认常量,视为**永久不可更名**;更名
意味着三家上游控制台重注册 redirect URI 并让扩展发版更新默认值。

### Bangumi

- 注册:`https://bgm.tv/dev/app` 创建应用
- authorize:`https://bgm.tv/oauth/authorize?client_id=...&response_type=code&redirect_uri=...&state=...`
- token / refresh:`POST https://bgm.tv/oauth/access_token`(refresh 支持,
  `grant_type=refresh_token`)
- token-status:`POST https://bgm.tv/oauth/token_status`
- 响应含 `user_id`,映射到 `userId`

### AniList

- 注册:`https://anilist.co/settings/developer` 创建 client
- authorize:`https://anilist.co/api/v2/oauth/authorize?client_id=...&redirect_uri=...&response_type=code`
  (AniList 不接受 state 参数则由 relay 只在本地会话校验;实测支持透传时照常拼接)
- token:`POST https://anilist.co/api/v2/oauth/token`(JSON body:
  grant_type=authorization_code + client_id + client_secret + redirect_uri + code)
- **无 refresh token**:`/anilist/refresh` 返回 501;access token 有效期约 1 年
- token-status:用 token 调 GraphQL `query { Viewer { id } }`,成功即 active,
  `Viewer.id` 映射 `userId`

### Google Books

- 注册:`https://console.cloud.google.com` → 新建项目 → 启用 **Books API** →
  OAuth 同意屏(External;scope `https://www.googleapis.com/auth/books`;
  **发布状态必须设为"正式版/In production"**,停留在"测试中"会导致 refresh
  token 七天过期)→ 凭据:OAuth 客户端,类型 **Web application**
- authorize:`https://accounts.google.com/o/oauth2/v2/auth` 必须携带
  `access_type=offline&prompt=consent`(否则不发 refresh token)、
  `scope=https://www.googleapis.com/auth/books`、`state`
- token / refresh:`POST https://oauth2.googleapis.com/token`
- token-status:`GET https://oauth2.googleapis.com/tokeninfo?access_token=...`
- 首次授权用户会看到"未验证应用"警告页(可继续);正式对外可走 Google 验证流程

---

## 4. 参考实现骨架

完整实现见 `.local/oauth-relay/`(§5);本节保留语言无关的语义示意,
供协议演进时对照(非逐行实现):

```ts
type Session = {
  app: string             // 租户,如 'kisaki'
  provider: string
  state: string
  desktopCallbackUrl: string
  code?: string
  expiresAt: number
}

const sessions = new Map<string, Session>() // 或 Redis,TTL 驱逐

app.post('/:app/:provider/sessions', ipRateLimit, (c) => {
  const tenant = requireTenant(c.req.param('app'), c.req.param('provider')) // 未配置 → 404
  const { desktopCallbackUrl } = await c.req.json()
  if (!tenant.allowsCallback(desktopCallbackUrl)) return c.json({ error: 'bad callback' }, 400)
  const s = createSession(tenant, desktopCallbackUrl)
  return c.json({ sessionId: s.id, state: s.state, authorizeUrl: buildAuthorizeUrl(s), expiresAt: s.expiresAt })
})

app.get('/:app/:provider/callback', (c) => {
  const s = findByState(c.req.query('state'))
  if (!s || expired(s)) return c.html(errorPage(), 400)
  s.code = c.req.query('code')
  return c.redirect(appendQuery(s.desktopCallbackUrl, { sessionId: s.id, state: s.state }))
})

app.post('/:app/:provider/sessions/:id/complete', async (c) => {
  const s = take(c.req.param('id'), (await c.req.json()).state) // 校验并原子移除
  if (!s?.code) return c.json({ error: 'unknown session' }, 404)
  return c.json(await exchangeCode(s)) // 换 token,直接返回,不落盘
})

app.post('/:app/:provider/refresh', ...)      // 上游无刷新 → 501
app.post('/:app/:provider/token-status', ...) // 见 §3 各 provider 探测方式
app.get('/:app/:provider/healthz', (c) => c.json({ ok: true }))
```

---

## 5. Docker 部署(Nginx Proxy Manager 前置)

**完整可部署实现位于仓库 `.local/oauth-relay/`(gitignore 覆盖,不入库)**:
Node 24 + TypeScript(strict)+ Hono,多阶段 Docker 构建、非 root 运行、
内置 HEALTHCHECK;部署细节与验证命令见该目录 `README.md`。本节只记不变的
部署形态。

TLS 与反向代理由既有的 Nginx Proxy Manager(NPM)承担;relay 容器
(`container_name: oauth-relay`)仅加入 NPM 栈的 external 网络
`nginx-proxy-manager`,不向宿主机暴露端口。配置全部经 `.env`
(模板见实现目录 `.env.example`,键名形态 `{APP}_{PROVIDER}_*`,
新增租户即新增一组键;某 provider 键留空即禁用该路由)。

部署步骤:复制 `.local/oauth-relay/` 至服务器 → `cp .env.example .env`
填入凭据 → `docker compose up -d --build` →
`curl https://oauth-relay.ximu.dev/healthz` 验证。

NPM Proxy Host 配置(手动):

- **Details**:Domain `oauth-relay.ximu.dev`;Scheme `http`;Forward Host
  `oauth-relay`(共享网络按容器名寻址);Forward Port `8080`;
  Block Common Exploits 开;Websockets 不需要
- **SSL**:申请 Let's Encrypt 证书,开启 Force SSL、HTTP/2、HSTS
- **Advanced**(自定义配置,落实日志卫生不变量 §1.4):

```nginx
access_log off;
```

---

## 6. 运维清单

- **轮换**:上游控制台重发 secret → 更新 `.env` → `docker compose up -d`;
  客户端无感(client id 不变)。
- **监控**:探活 `/healthz`;`/sessions` 429 比例;上游换取失败率。
- **故障面**:relay 不可用仅阻断新登录与续期;既有 token 在客户端继续有效。
- **升级协议**:先改本文件 §2,再同步 SDK `oauth-relay` 与本服务,后部署。
