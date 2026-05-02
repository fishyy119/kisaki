# 09 OAuth Relay Deployment

## 目标

Kisaki 官方 Bangumi 应用的 `client_secret` 只放在服务器。桌面端和扩展只拿到用户自己的 access token / refresh token。

生产部署形态：

- Relay 服务独立 Docker 部署。
- Docker 服务加入外部网络 `nginx-manager-proxy`。
- Nginx Proxy Manager 对外暴露偏临时的域名路径 `https://kisaki.me/_tmp/bangumi-oauth/*`。
- Bangumi 开发者平台回调 URL 配置为 `https://kisaki.me/_tmp/bangumi-oauth/callback`。

建议落地路径：

```text
services/bangumi-oauth-relay/
  docker-compose.yml
  Dockerfile
  package.json
  tsconfig.json
  .env.example
  src/
    server.ts
```

## docker-compose.yml

```yaml
services:
  bangumi-oauth-relay:
    build: .
    image: kisaki/bangumi-oauth-relay:latest
    container_name: kisaki-bangumi-oauth-relay
    restart: unless-stopped
    env_file:
      - .env
    expose:
      - '3000'
    networks:
      - nginx-manager-proxy
    healthcheck:
      test:
        [
          'CMD',
          'node',
          '-e',
          "fetch('http://127.0.0.1:3000/healthz').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
        ]
      interval: 30s
      timeout: 5s
      retries: 3
      start_period: 10s

networks:
  nginx-manager-proxy:
    external: true
```

## .env.example

```dotenv
PORT=3000
PUBLIC_BASE_URL=https://kisaki.me
PUBLIC_RELAY_PATH=/_tmp/bangumi-oauth

BANGUMI_CLIENT_ID=
BANGUMI_CLIENT_SECRET=

DESKTOP_CALLBACK_URL=kisaki://ext/builtin.bangumi/oauth-callback
SESSION_TTL_MS=600000
SERVER_USER_AGENT=your-bangumi-user-id KisakiOAuthRelay/1.0 https://kisaki.me
```

`SERVER_USER_AGENT` 按 Bangumi API User-Agent 建议填写开发者个人 ID、应用名、版本号和项目主页。

## package.json

```json
{
  "name": "kisaki-bangumi-oauth-relay",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "tsc -p tsconfig.json",
    "start": "node dist/server.js",
    "dev": "tsx watch src/server.ts"
  },
  "engines": {
    "node": ">=22"
  },
  "devDependencies": {
    "@types/node": "^22.15.0",
    "tsx": "^4.19.4",
    "typescript": "^5.8.3"
  }
}
```

## tsconfig.json

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "lib": ["ES2022"],
    "types": ["node"],
    "rootDir": "src",
    "outDir": "dist",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts"]
}
```

## Dockerfile

```dockerfile
FROM node:22-alpine AS build

WORKDIR /app

COPY package.json tsconfig.json ./
RUN npm install

COPY src ./src
RUN npm run build

FROM node:22-alpine

WORKDIR /app
ENV NODE_ENV=production

COPY package.json ./
COPY --from=build /app/dist ./dist

USER node
EXPOSE 3000

CMD ["node", "dist/server.js"]
```

## src/server.ts

```ts
import { createServer } from 'node:http'
import type { IncomingMessage, ServerResponse } from 'node:http'
import { randomBytes, timingSafeEqual } from 'node:crypto'

const PORT = Number(process.env.PORT ?? 3000)
const PUBLIC_BASE_URL = requireEnv('PUBLIC_BASE_URL').replace(/\/+$/, '')
const PUBLIC_RELAY_PATH = normalizePath(process.env.PUBLIC_RELAY_PATH ?? '/_tmp/bangumi-oauth')
const BANGUMI_CLIENT_ID = requireEnv('BANGUMI_CLIENT_ID')
const BANGUMI_CLIENT_SECRET = requireEnv('BANGUMI_CLIENT_SECRET')
const DESKTOP_CALLBACK_URL =
  process.env.DESKTOP_CALLBACK_URL ?? 'kisaki://ext/builtin.bangumi/oauth-callback'
const SESSION_TTL_MS = Number(process.env.SESSION_TTL_MS ?? 10 * 60 * 1000)
const SERVER_USER_AGENT =
  process.env.SERVER_USER_AGENT ?? 'KisakiOAuthRelay/0.1.0 https://kisaki.me'

type SessionStatus = 'pending' | 'ready' | 'error'

interface RelaySession {
  id: string
  state: string
  status: SessionStatus
  desktopCallbackUrl: string
  expiresAt: number
  token: RelayToken | null
  error: string | null
}

interface RelayToken {
  access_token: string
  refresh_token?: string
  token_type?: string
  scope: string | null
  user_id?: number
  expires_in: number
  expires_at: number | null
}

interface BangumiTokenResponse {
  access_token: string
  refresh_token?: string
  token_type?: string
  scope?: string
  user_id?: number
  expires_in?: number
}

interface RelayError extends Error {
  status?: number
  data?: unknown
}

const sessionsById = new Map<string, RelaySession>()
const sessionIdByState = new Map<string, string>()

const callbackUrl = `${PUBLIC_BASE_URL}${relayPath('/callback')}`

function requireEnv(name: string): string {
  const value = process.env[name]
  if (!value) throw new Error(`Missing required env: ${name}`)
  return value
}

function normalizePath(value: string): string {
  const trimmed = value.trim()
  const withLeadingSlash = trimmed.startsWith('/') ? trimmed : `/${trimmed}`
  const normalized = withLeadingSlash.replace(/\/+$/, '')
  return normalized || '/'
}

function relayPath(suffix: string): string {
  if (PUBLIC_RELAY_PATH === '/') {
    return suffix.startsWith('/') ? suffix : `/${suffix}`
  }

  return `${PUBLIC_RELAY_PATH}${suffix.startsWith('/') ? suffix : `/${suffix}`}`
}

function matchCompletePath(pathname: string): string | null {
  const prefix = relayPath('/sessions/')
  const suffix = '/complete'
  if (!pathname.startsWith(prefix) || !pathname.endsWith(suffix)) return null

  const sessionId = pathname.slice(prefix.length, pathname.length - suffix.length)
  return sessionId ? decodeURIComponent(sessionId) : null
}

function randomToken(bytes = 32): string {
  return randomBytes(bytes).toString('base64url')
}

function safeEqual(a: unknown, b: unknown): boolean {
  const left = Buffer.from(String(a))
  const right = Buffer.from(String(b))
  return left.length === right.length && timingSafeEqual(left, right)
}

function cleanupExpiredSessions(): void {
  const now = Date.now()
  for (const [sessionId, session] of sessionsById.entries()) {
    if (session.expiresAt <= now) {
      sessionsById.delete(sessionId)
      sessionIdByState.delete(session.state)
    }
  }
}

function sendJson(res: ServerResponse, status: number, data: unknown): void {
  const body = JSON.stringify(data)
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  })
  res.end(body)
}

function sendHtml(res: ServerResponse, status: number, html: string): void {
  res.writeHead(status, {
    'content-type': 'text/html; charset=utf-8',
    'cache-control': 'no-store'
  })
  res.end(html)
}

function readJson(req: IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    let body = ''
    req.setEncoding('utf8')
    req.on('data', (chunk) => {
      body += chunk
      if (body.length > 32 * 1024) {
        reject(new Error('Request body too large'))
        req.destroy()
      }
    })
    req.on('end', () => {
      if (!body.trim()) {
        resolve({})
        return
      }
      try {
        resolve(JSON.parse(body))
      } catch {
        reject(new Error('Invalid JSON body'))
      }
    })
    req.on('error', reject)
  })
}

function normalizeTokenResponse(value: BangumiTokenResponse): RelayToken {
  const expiresIn = Number(value.expires_in ?? 0)
  const token: RelayToken = {
    access_token: value.access_token,
    scope: value.scope ?? null,
    expires_in: expiresIn,
    expires_at: expiresIn > 0 ? Date.now() + expiresIn * 1000 : null
  }

  if (value.refresh_token) token.refresh_token = value.refresh_token
  if (value.token_type) token.token_type = value.token_type
  if (value.user_id !== undefined) token.user_id = value.user_id

  return token
}

async function postBangumiOAuthForm(
  path: string,
  form: URLSearchParams
): Promise<BangumiTokenResponse | Record<string, unknown>> {
  const response = await fetch(`https://bgm.tv${path}`, {
    method: 'POST',
    headers: {
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': SERVER_USER_AGENT
    },
    body: form
  })

  const text = await response.text()
  let data = null
  try {
    data = text ? JSON.parse(text) : null
  } catch {
    data = { raw: text }
  }

  if (!response.ok) {
    const message = data?.error_description || data?.error || response.statusText
    const error: RelayError = new Error(`Bangumi OAuth request failed: ${message}`)
    error.status = response.status
    error.data = data
    throw error
  }

  return data
}

async function createSession(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const input = await readJson(req)
  const sessionId = randomToken()
  const state = randomToken()
  const expiresAt = Date.now() + SESSION_TTL_MS
  const desktopCallbackUrl =
    typeof input.desktopCallbackUrl === 'string' ? input.desktopCallbackUrl : DESKTOP_CALLBACK_URL

  sessionsById.set(sessionId, {
    id: sessionId,
    state,
    status: 'pending',
    desktopCallbackUrl,
    expiresAt,
    token: null,
    error: null
  })
  sessionIdByState.set(state, sessionId)

  const authorizeUrl = new URL('https://bgm.tv/oauth/authorize')
  authorizeUrl.searchParams.set('client_id', BANGUMI_CLIENT_ID)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('redirect_uri', callbackUrl)
  authorizeUrl.searchParams.set('state', state)

  sendJson(res, 201, {
    sessionId,
    state,
    authorizeUrl: authorizeUrl.toString(),
    expiresAt
  })
}

async function handleCallback(req: IncomingMessage, res: ServerResponse, url: URL): Promise<void> {
  const code = url.searchParams.get('code')
  const state = url.searchParams.get('state')
  const oauthError = url.searchParams.get('error')

  if (!state) {
    sendHtml(res, 400, renderPage('Bangumi authorization failed', 'Missing state.'))
    return
  }

  const sessionId = sessionIdByState.get(state)
  const session = sessionId ? sessionsById.get(sessionId) : null
  if (!session || !safeEqual(session.state, state) || session.expiresAt <= Date.now()) {
    sendHtml(res, 400, renderPage('Bangumi authorization failed', 'Session expired or invalid.'))
    return
  }

  if (oauthError || !code) {
    session.status = 'error'
    session.error = oauthError || 'Missing authorization code.'
    sendHtml(res, 400, renderPage('Bangumi authorization failed', session.error))
    return
  }

  try {
    const form = new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: BANGUMI_CLIENT_ID,
      client_secret: BANGUMI_CLIENT_SECRET,
      code,
      redirect_uri: callbackUrl,
      state
    })
    const token = (await postBangumiOAuthForm('/oauth/access_token', form)) as BangumiTokenResponse
    session.status = 'ready'
    session.token = normalizeTokenResponse(token)

    const desktopUrl = new URL(session.desktopCallbackUrl)
    desktopUrl.searchParams.set('sessionId', session.id)
    desktopUrl.searchParams.set('state', state)

    sendHtml(
      res,
      200,
      renderPage('Bangumi authorization complete', 'You can return to Kisaki.', desktopUrl)
    )
  } catch (error) {
    session.status = 'error'
    session.error = toErrorMessage(error)
    sendHtml(res, 502, renderPage('Bangumi authorization failed', session.error))
  }
}

async function completeSession(
  req: IncomingMessage,
  res: ServerResponse,
  sessionId: string
): Promise<void> {
  const input = await readJson(req)
  const session = sessionsById.get(sessionId)

  if (!session || session.expiresAt <= Date.now()) {
    sendJson(res, 404, { error: 'session_not_found' })
    return
  }

  if (!input.state || !safeEqual(session.state, input.state)) {
    sendJson(res, 403, { error: 'invalid_state' })
    return
  }

  if (session.status === 'pending') {
    sendJson(res, 202, { status: 'pending' })
    return
  }

  if (session.status === 'error') {
    sessionsById.delete(sessionId)
    sessionIdByState.delete(session.state)
    sendJson(res, 409, { status: 'error', error: session.error })
    return
  }

  sessionsById.delete(sessionId)
  sessionIdByState.delete(session.state)
  sendJson(res, 200, { status: 'ready', token: session.token })
}

async function refreshToken(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const input = await readJson(req)
  const refreshToken =
    typeof input.refresh_token === 'string'
      ? input.refresh_token
      : typeof input.refreshToken === 'string'
        ? input.refreshToken
        : null
  if (!refreshToken) {
    sendJson(res, 400, { error: 'refresh_token_required' })
    return
  }

  const form = new URLSearchParams({
    grant_type: 'refresh_token',
    client_id: BANGUMI_CLIENT_ID,
    client_secret: BANGUMI_CLIENT_SECRET,
    refresh_token: refreshToken,
    redirect_uri: callbackUrl
  })
  const token = (await postBangumiOAuthForm('/oauth/access_token', form)) as BangumiTokenResponse
  sendJson(res, 200, { token: normalizeTokenResponse(token) })
}

async function tokenStatus(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const input = await readJson(req)
  const accessToken =
    typeof input.access_token === 'string'
      ? input.access_token
      : typeof input.accessToken === 'string'
        ? input.accessToken
        : null
  if (!accessToken) {
    sendJson(res, 400, { error: 'access_token_required' })
    return
  }

  const form = new URLSearchParams({ access_token: accessToken })
  const status = await postBangumiOAuthForm('/oauth/token_status', form)
  sendJson(res, 200, { status })
}

function renderPage(title: string, message: string, desktopUrl?: URL): string {
  const safeTitle = escapeHtml(title)
  const safeMessage = escapeHtml(message)
  const link = desktopUrl ? desktopUrl.toString() : null
  const safeLink = link ? escapeHtml(link) : null
  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    ${safeLink ? `<meta http-equiv="refresh" content="0; url=${safeLink}" />` : ''}
    <title>${safeTitle}</title>
    <style>
      body { font-family: system-ui, sans-serif; margin: 3rem; line-height: 1.5; }
      a { color: #2563eb; }
    </style>
  </head>
  <body>
    <h1>${safeTitle}</h1>
    <p>${safeMessage}</p>
    ${safeLink ? `<p><a href="${safeLink}">Open Kisaki</a></p>` : ''}
  </body>
</html>`
}

function escapeHtml(value: unknown): string {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

const server = createServer(async (req, res) => {
  cleanupExpiredSessions()

  try {
    const url = new URL(req.url ?? '/', `http://${req.headers.host ?? 'localhost'}`)

    if (
      req.method === 'GET' &&
      (url.pathname === '/healthz' || url.pathname === relayPath('/healthz'))
    ) {
      sendJson(res, 200, { ok: true })
      return
    }

    if (req.method === 'POST' && url.pathname === relayPath('/sessions')) {
      await createSession(req, res)
      return
    }

    if (req.method === 'GET' && url.pathname === relayPath('/callback')) {
      await handleCallback(req, res, url)
      return
    }

    const completeSessionId = matchCompletePath(url.pathname)
    if (req.method === 'POST' && completeSessionId) {
      await completeSession(req, res, completeSessionId)
      return
    }

    if (req.method === 'POST' && url.pathname === relayPath('/refresh')) {
      await refreshToken(req, res)
      return
    }

    if (req.method === 'POST' && url.pathname === relayPath('/token-status')) {
      await tokenStatus(req, res)
      return
    }

    sendJson(res, 404, { error: 'not_found' })
  } catch (error) {
    const relayError = error as RelayError
    sendJson(res, relayError.status || 500, {
      error: 'relay_error',
      message: toErrorMessage(error),
      details: relayError.data
    })
  }
})

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Bangumi OAuth Relay listening on :${PORT}`)
})

function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error)
}
```

## Nginx Proxy Manager

## Desktop Deeplink Callback

当前 Bangumi 内置扩展 manifest id 是 `builtin.bangumi`。扩展 deeplink contribution 只注册扩展自己的局部 callback path：

```ts
context.contributes.deeplinks.register({
  id: 'oauth-callback',
  path: 'oauth-callback',
  async handle(input) {
    // input.params.sessionId / input.params.state
    return { success: true, status: 'handled' }
  }
})
```

主应用基于 manifest id 自动归一化为内部路由 `ext/builtin.bangumi/oauth-callback`，并提供或生成对应桌面回跳 URL：

```text
kisaki://ext/builtin.bangumi/oauth-callback
```

Kisaki deeplink parser 使用 `kisaki://action/resource` 结构。`action=ext` 时，extension contribution host 应把 resource 映射到对应扩展的局部 path，因此 `kisaki://ext/builtin.bangumi/oauth-callback` 会命中 `builtin.bangumi` 扩展注册的 `oauth-callback` handler。`kisaki://bangumi/oauth-callback` 不会命中扩展 handler。

如果 `kisaki.me` 只用于 relay：

- Domain Names: `kisaki.me`
- Scheme: `http`
- Forward Hostname/IP: `kisaki-bangumi-oauth-relay`
- Forward Port: `3000`
- SSL: 申请 Let's Encrypt 证书，启用 Force SSL

如果 `kisaki.me` 根路径已有其他服务，则在现有 Proxy Host 中添加 Custom Location：

- Location: `/_tmp/bangumi-oauth`
- Scheme: `http`
- Forward Hostname/IP: `kisaki-bangumi-oauth-relay`
- Forward Port: `3000`

健康检查可以访问：

```text
https://kisaki.me/healthz
https://kisaki.me/_tmp/bangumi-oauth/healthz
```

如果只把 `/_tmp/bangumi-oauth` 转发给 relay，而 `/healthz` 不转发，则 Docker 内部 healthcheck 仍然有效，外部健康检查使用 `/_tmp/bangumi-oauth/healthz`。

## 安全约束

- Relay 不长期保存用户 token；登录 token 只在内存 session 中短 TTL 暂存，complete 成功或过期后清理。
- token 不放入 deeplink URL，只通过桌面端 `complete` 请求取回。
- 生产环境必须使用 HTTPS。
- 日志不得输出 access token、refresh token、authorization code 或 `client_secret`。
- 如果未来需要多副本部署，应把 session store 换成 Redis，并保持 session 一次性消费语义。
