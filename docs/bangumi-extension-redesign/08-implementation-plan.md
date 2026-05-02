# 08 Implementation Plan

## Phase 0: 固化 API 事实源与类型生成

- 把本文档集作为实施入口。
- 增加 Bangumi OpenAPI 类型生成或手写 DTO 校验策略，类型文件标注来源 URL 和 OpenAPI version。
- 删除旧 Bangumi 扩展内部 client/provider 假设。

## Phase 1A: 实现/修改主应用 service

- 新增或修改主应用内部 service：CommandService、BackgroundTaskService、DB event projector、scraper profile 查询、ingest from scraper application service。
- 主应用 service 实现只依赖 app/main 内部 domain types、repository、IPC/service contracts，不 import `@kisaki/extension-api` 或 `@kisaki/extension-sdk`。
- 如果主应用 service 与扩展 public API 需要共享形状，由 host bridge/adapter 做显式转换；不要把 API 包类型混入 service 实现。
- 新增 `runtime.openExternal` 的主应用执行入口；Bangumi 扩展自行组合 network、deeplink、`context.secrets`、openExternal 完成 OAuth Relay flow。
- 在现有 scraper 服务中补齐 profile list/get 能力，例如 `listScraperProfiles({ mediaType: "game" })`。
- 在主应用 ingest/service 层新增最小 ingest from scraper 能力；第一版不实现或暴露 `updateGameFromScraper`。
- 在 DbService 中新增 typed event projector 子模块，基于 SQLite trigger 聚合 raw DB event 并发出实体级 library domain event。
- 增强 SQLite trigger raw payload，提供可供 projector 使用的 OLD/NEW row snapshot。

## Phase 1B: 暴露 extension context/API/SDK/host bridge

- 新增 `context.secrets` API，不作为 extension capability/权限点，也不作为主应用 service；它与 extension storage 同类，是按 extension 隔离的 secure key-value storage。
- 新增 `kisaki.runtime.openExternal` public API。
- 重构 deeplink contribution API：`DeeplinkContribution.route` 改为 extension-local `path`，`register()` 返回 canonical `kisaki://ext/<extensionId>/<path>` URL handle，host 负责内部路由归一化。
- 在现有 scraper capability 下新增 profile list/get 能力，例如 `kisaki.scrapers.profiles.list({ mediaType: "game" })`。
- 新增最小 ingest from scraper capability：`kisaki.ingest.games.addFromScraper(profileId, lookup, options)`；第一版不暴露 `updateGameFromScraper`。
- 暴露 command 注册 API，并允许扩展注册可执行 command。
- 暴露 background task API，并允许扩展创建/删除自己拥有的 task，允许用户把 command 配置成启动时/定时后台任务。
- host bridge 调用 Phase 1A 的主应用 service，并负责 public API DTO 与主应用内部类型之间的转换。

## Phase 2: 实现并部署 Kisaki OAuth Relay

- 新增独立 relay 服务代码，建议路径 `services/bangumi-oauth-relay/`。
- 提供可直接部署的 `docker-compose.yml`、`Dockerfile`、`.env.example`、`tsconfig.json` 和 `src/server.ts`，见 [09-oauth-relay-deployment.md](09-oauth-relay-deployment.md)。
- Relay Docker 服务加入外部 Docker network `nginx-manager-proxy`，由 Nginx Proxy Manager 暴露到临时域名路径 `https://kisaki.me/_tmp/bangumi-oauth/*`。
- Bangumi 开发者平台配置回调 URL：`https://kisaki.me/_tmp/bangumi-oauth/callback`。
- 确认 Kisaki 官方 `client_secret` 只存在服务器环境变量，不进入桌面端。

## Phase 3: 重建 Bangumi API client 与扩展 OAuth flow

- 实现 `BangumiClient`、`OAuthRelayClient`、`TokenService`、`AccountService`、`RateLimiter`。
- 在 Bangumi 扩展内实现 relay session 登录、deeplink callback、relay refresh、token_status、`/v0/me`。
- 设置面板 Account screen 可完成登录、验证、退出。

## Phase 4: 重写 Bangumi game scraper provider

- 使用新 `BangumiClient`。
- `resolve(knownIds)` 优先识别 `source="bangumi"` 的 subject ID。
- `search` 使用 `/v0/search/subjects`，过滤游戏。
- `openSession` 使用 `/v0/subjects/{subject_id}`。
- 输出 Kisaki game metadata，并稳定写入 Bangumi external id。

## Phase 5: 实现同步引擎

- 实现 status/rating mapping。
- 实现 `SyncEngine.syncGame` 和 `FullSyncJob`。
- 监听 DB event projector 聚合后的 `library.game.created` / `library.game.updated` event，按 `changes[].facet` 与设置自动同步。
- 优先使用 `changes[].after` 中的类型安全新值，缺失时 fallback 到 library capability 查询。
- 注册 `bangumi.sync.changed-games` 和 `bangumi.sync.full` command。
- 设置面板 Sync screen 提供 dry run 和执行全量同步。

## Phase 6: 实现用户数据库导入

- 分页拉取 `/v0/users/{username}/collections`。
- 按收藏类型过滤。
- 通过指定 scraper profile 并行批量 ingest，Bangumi API 请求由 provider client 统一限速。
- 根据字段映射 patch Kisaki status/score/tags/comment metadata。
- 注册 `bangumi.import.my-collections` command。
- 提供 dry run、进度、取消、结果摘要。

## Phase 7: 实现目录导入

- 解析目录 ID/URL。
- 拉取 `/v0/indices/{index_id}` 和 `/v0/indices/{index_id}/subjects?type=4`。
- 通过指定 scraper profile 并行批量 ingest，Bangumi API 请求由 provider client 统一限速。
- 支持选择/创建目标合集。
- 注册 `bangumi.import.index` command。
- 提供 dry run、进度、取消、结果摘要。

## Phase 8: 完善设置、诊断和文档

- 补齐 Advanced screen。
- 补齐 Index screen，展示账号摘要、最近任务、常用操作入口。
- 增加 job history 和错误详情。
- Bangumi 设置面板提供创建/删除常用后台 task 的按钮；主应用后台任务面板展示和调整这些 task。
- 更新 `extensions/bangumi/README.md`。
- 删除旧 storage key 文档和旧 access token 手动输入说明。

## Phase 9: 验证与发布

- `pnpm build:extension-contracts`
- `pnpm --filter @kisaki/builtin-bangumi typecheck`
- `pnpm --filter @kisaki/builtin-bangumi build`
- `pnpm --filter @kisaki/extension-cli validate extensions/bangumi`
- 桌面端 dev 模式加载 built-in extension，手动验证 OAuth Relay、scraper、自动同步、全量同步、用户数据库导入、目录导入、后台任务。

## 验收场景

- 用户通过 Kisaki 官方应用完成 OAuth 登录，设置面板显示当前 Bangumi 账号。
- Kisaki 官方 Bangumi 应用 `client_secret` 不出现在桌面端包、扩展源码或 extension storage 中。
- Kisaki OAuth Relay 可通过 Docker Compose 启动，并能经 Nginx Proxy Manager 从 `https://kisaki.me/healthz` 或 `https://kisaki.me/_tmp/bangumi-oauth/healthz` 访问健康检查。
- access token 过期时，扩展能通过 Kisaki OAuth Relay 使用 refresh token 自动续期。
- Bangumi OAuth 登录 flow 由扩展组合 `network`、`deeplink`、`context.secrets`、`runtime.openExternal` 完成，不要求主应用新增 OAuth-specific service。
- 直接 Drizzle 写入 `games.score` 后，DB event projector 发出 `library.game.updated`，`changes` 包含 `facet: "score"`，并带类型安全的 `before.score` 和 `after.score`。
- 直接 Drizzle 写入 `games.status` 后，DB event projector 发出 `library.game.updated`，`changes` 包含 `facet: "status"`，并带类型安全的 `before.status` 和 `after.status`。
- 直接 Drizzle 写入 `game_external_ids` 后，DB event projector 发出对应 `library.game.updated`，`changes` 包含 `facet: "identity"`，并带类型安全的 `before.externalIds` 和 `after.externalIds`。
- 本地游戏有 Bangumi external id，修改 Kisaki 状态后，自动同步能更新 Bangumi 收藏类型。
- 本地游戏有评分，修改评分后，自动同步能更新 Bangumi `rate`。
- 用户关闭自动状态同步但保留自动评分同步时，只写 `rate`。
- 手动全量同步 dry run 能列出将写入的 subject 数量和跳过原因。
- 用户选择“在玩”和“玩过”后，只导入这些 Bangumi 收藏类型。
- 用户数据库导入通过指定 scraper profile 创建/更新 Kisaki 游戏，并可把 Bangumi 评分映射进 Kisaki。
- 用户输入目录 URL 后，扩展能解析 index id，预览目录标题和游戏数量，并导入到目标合集。
- 用户把 Bangumi provider client 限制为 2 req/s 时，批量导入仍可并行调度，但所有 `api.bgm.tv` 请求按该限制执行。
- 用户可以把 `bangumi.sync.full` 配置为启动时或每日后台任务，并在主应用后台任务面板查看运行历史、立即运行或禁用。
- 未登录、token 失效、subject 404、API 400、网络失败都能在 job summary 中给出可操作错误。

## 风险与处理

- Bangumi OAuth 对桌面应用要求 `client_secret`：生产版通过 Kisaki OAuth Relay 持有官方 secret；桌面端只保存用户 token。
- Kisaki OAuth Relay 不可用会影响登录和 token refresh：普通 API 请求不经 relay，但 token 过期后需要 relay 恢复；UI 必须给出明确错误和重试入口。
- 当前 extension storage 非加密：必须先提供与 extension storage 同类的 `context.secrets` secure storage API，再保存用户 access/refresh token。
- DB event projector 的 facet 映射必须稳定：表结构可以调整，但对外 facet 语义不能随意变化；`fields` 只用于诊断，不给扩展做强兼容承诺。
- 旧值/新值的公共快照必须是领域类型，不是 DB row dump；tracked 字段和关系都应通过 raw old/next 构造 `before` / `after`，只有显式声明的派生 facet 才能省略 `before`。
- 批量导入需要调用 app ingest：必须通过公共 ingest capability 暴露，不直接 import app internals。
- 批量导入并行时可能集中触发 provider 请求：所有 Bangumi API 调用必须经过共享 `BangumiClient` limiter，禁止绕过 client 直接请求。
- Bangumi `updated_at` 不可靠：冲突判断使用用户选择策略和本地/远端字段快照，不依赖该字段。
- `ep_status`/`vol_status` 不适合游戏：不做游戏进度细粒度同步。
- 未绑定 Bangumi ID 的本地游戏无法可靠同步：默认跳过，并在全量同步摘要中列出。
