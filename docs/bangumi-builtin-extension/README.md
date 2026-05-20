# Bangumi 内置扩展设计与实施文档

本文档集定义 `extensions/bangumi` 的目标形态和实施路线。Kisaki 是多媒体管理软件；Bangumi 扩展是 media scope 集成，支持 Bangumi 四类 subject，并通过现有公共 extension API 接入宿主。

支持范围只包含 Bangumi 四类媒体：

- `book`: Bangumi `SubjectType = 1`
- `game`: Bangumi `SubjectType = 4`
- `anime`: Bangumi `SubjectType = 2`
- `music`: Bangumi `SubjectType = 3`

不支持三次元，也不为未知媒体类型提前做抽象。现阶段 Kisaki 宿主只有游戏本地库写入、游戏 scraper provider、`library.game.*` event 和 `kisaki.ingest.games.addFromScraper`，因此 Bangumi 扩展采用以下结构：

- Bangumi 扩展内部使用 media scope 架构。
- `game` scope 拥有完整本地 adapter，继续支持 scraper、自动同步、全量同步、收藏导入和目录导入。
- `book` / `anime` / `music` scope 进入共享模型、API client、settings UI 和命令参数体系，但不伪装成游戏写入本地库；需要本地写入时必须等宿主未来提供对应媒体能力后新增 adapter。
- extension API 不新增、不重命名、不兼容包装。所有隔离都在 Bangumi 扩展内部完成。

兼容性决策：应用未上线，不提供历史数据兼容迁移；现有 storage/secrets/sync queue key 原地承载当前格式，不新增新 key。

## 文档结构

- [01-scope-and-api-facts.md](01-scope-and-api-facts.md): 支持范围、Bangumi API 事实、四类 media scope 与非目标。
- [02-extension-system-integration.md](02-extension-system-integration.md): 在不修改 extension API 的前提下接入现有宿主能力。
- [03-extension-architecture.md](03-extension-architecture.md): 新的 media scope 架构、目录结构、状态模型和依赖方向。
- [04-auth-and-client.md](04-auth-and-client.md): OAuth Relay、token 管理、BangumiClient 和通用 subject API。
- [05-sync-and-import.md](05-sync-and-import.md): media-scoped 同步、导入、planner、game local adapter 边界。
- [06-settings-commands-and-tasks.md](06-settings-commands-and-tasks.md): settings panel、command job、background task 与 UI 范围。
- [07-implementation-plan.md](07-implementation-plan.md): Phase 5.5 到 Phase 9 的实施计划、验收场景和验证命令。
- [08-media-scope-refactor.md](08-media-scope-refactor.md): Phase 5.5 的文件级方案、命名规则和验收搜索。

## 核心决策

- 扩展身份保持 `builtin.bangumi`，项目位于 `extensions/bangumi`，通过现有 built-in extension pipeline 打包进桌面端。
- manifest categories 继续使用 `["scraper", "integration"]`。
- extension API 保持现状。Bangumi 扩展继续使用 `context.contributions.scraperProviders.game.register`、`kisaki.ingest.games.addFromScraper`、`kisaki.library.games.*`、`kisaki.events.on('library.game.*')` 等现有入口。
- 当前宿主的 game library、ingest、event 和 scraper API 只能出现在 `media/game` adapter 内，不允许散落在 `api`、`sync`、`import`、`jobs`、`ui` 的通用层。
- Bangumi 官方 API、OpenAPI 和 OAuth 文档是 Bangumi 侧唯一事实源；本文在 2026-05-17 核对到 OpenAPI `info.version = 2026-05-2`。
- 生产登录使用已部署的 Kisaki OAuth Relay。桌面端和扩展永不保存 Kisaki 官方 Bangumi 应用的 `client_secret`。
- 所有 `https://api.bgm.tv/v0/**` 请求都必须经过扩展内唯一 `BangumiClient`。
- 长流程统一注册为 extension command；settings panel 只启动 job，不直接执行长时间同步或导入。
- `game` 是当前唯一 local-capable scope；`book` / `anime` / `music` 不做本地写入，不映射到游戏实体，不创建假的本地数据。

## 当前项目事实

- 扩展公共 API 位于 `packages/extension-api/src`，SDK 位于 `packages/extension-sdk/src`。
- 主进程 extension service 位于 `apps/desktop/src/main/services/extension`。
- `context.secrets` 已由 Electron `safeStorage` 支撑，按 extension dataPath 隔离。
- `kisaki.runtime.openExternal`、`kisaki.scrapers.profiles`、`kisaki.ingest.games.addFromScraper`、`kisaki.commands`、`kisaki.backgroundTasks` 已存在。
- 命令注册是 contribution：`context.contributions.commands.register(...)`。命令执行是 capability：`kisaki.commands.start/execute/wait/cancel(...)`。
- Deeplink contribution 返回 `urlPattern`，扩展局部 path 会被宿主归一化为 `kisaki://ext/<extensionId>/<path>`。
- DB event projector 已基于 SQLite trigger 的 OLD/NEW row snapshot 投影 `library.game.updated` 等 typed host event。
- 实施顺序以 [07-implementation-plan.md](07-implementation-plan.md) 为准：Phase 5.5、Phase 6、Phase 7、Phase 8、Phase 9。

## 参考资料

- Bangumi API: <https://bangumi.github.io/api/>
- Bangumi OpenAPI JSON: <https://bangumi.github.io/api/dist.json>
- Bangumi OAuth 文档: <https://github.com/bangumi/api/blob/master/docs-raw/How-to-Auth.md>
- Bangumi User-Agent 建议: <https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md>
- Kisaki extension system guide: `.codex/skills/kisaki/references/extension-system.md`
- Kisaki extension API guide: `.codex/skills/kisaki/references/extension-api.md`
