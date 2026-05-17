# Bangumi 内置扩展设计与实施文档

本文档集定义 `extensions/bangumi` 的目标形态和实施路线。当前扩展系统已经完成重构，Bangumi 所需的宿主能力已经进入公共 extension API；Kisaki OAuth Relay 也已完成部署。因此本文不再描述“宿主能力待补齐”的旧方案，而是基于当前仓库中的 extension runtime、capability、contribution、command、background task、DB event projector 和 built-in extension 打包流程，重新设计 Bangumi 内置扩展本身。

旧实现只保留需求价值，不作为新设计约束。

兼容性决策：重写版本不设兼容层，旧数据一律作废。

无须考虑任何向后兼容，要求干净清晰彻底。

## 文档结构

- [01-scope-and-api-facts.md](01-scope-and-api-facts.md): 功能范围、非目标、Bangumi 官方 API 事实源。
- [02-extension-system-integration.md](02-extension-system-integration.md): 当前 Kisaki 扩展系统能力、边界和 Bangumi 接入方式。
- [03-extension-architecture.md](03-extension-architecture.md): Bangumi 扩展内部模块、核心对象、状态模型。
- [04-auth-and-client.md](04-auth-and-client.md): OAuth Relay 登录、token 管理、Bangumi API client、限速和错误模型。
- [05-sync-and-import.md](05-sync-and-import.md): 自动同步、全量同步、用户收藏导入、目录导入和可选用户态字段写入。
- [06-settings-commands-and-tasks.md](06-settings-commands-and-tasks.md): structured settings panel、job command、task 创建、storage/secrets。
- [07-implementation-plan.md](07-implementation-plan.md): 分阶段实施、验收场景、验证命令和风险处理。

## 核心决策

- 扩展身份保持 `builtin.bangumi`，项目位于 `extensions/bangumi`，通过现有 built-in extension pipeline 打包进桌面端。
- manifest 目标类别应从纯 `scraper` 扩展扩展为 `scraper` + `integration`，但运行时代码仍只通过公共 extension API 接入宿主。
- Bangumi 官方 API、OpenAPI 和 OAuth 文档是 Bangumi 侧唯一事实源；本文在 2026-05-17 核对到 OpenAPI `info.version = 2026-05-2`。
- 生产登录使用已部署的 Kisaki OAuth Relay。桌面端和扩展永不保存 Kisaki 官方 Bangumi 应用的 `client_secret`。
- OAuth flow 由扩展组合 `kisaki.network.request`、`kisaki.runtime.openExternal`、`context.contributions.deeplinkRoutes` 和 `context.secrets` 完成；不新增主应用 OAuth service。
- 所有 `https://api.bgm.tv/v0/**` 请求都必须经过扩展内唯一 `BangumiClient`，统一 User-Agent、Bearer token、refresh、限速、重试、分页和错误转换；OAuth relay、refresh 和 token status 只经过 `OAuthRelayClient` / `TokenService`。
- 自动同步只面向游戏收藏状态和评分。不同步章节、书籍进度，也不删除 Bangumi 远端收藏。
- 导入用户收藏和目录时，创建游戏必须走 `kisaki.ingest.games.addFromScraper` 和用户选择的 game scraper profile；扩展不得绕过 ingest 直接写完整 metadata，也不得修改已有游戏的资料元数据。
- 导入永远不改已有游戏。profile、目标合集、status、score、tag 和 collection membership 都是单次 command args；只有本次新建的游戏才会按这些 args 写入用户态字段。
- 设置 UI 使用当前 structured settings panel，复杂操作通过 dialog、tab、table、status、button 和后台 command 组织，不引入第二套 UI 框架。
- 长流程统一注册为 extension command；settings panel 手动触发的是一次 job，避免在 settings callback 中执行长时间导入或同步。
- background task 是主应用持久自动化配置；Bangumi 只提供推荐 task 创建入口，task 的运行、取消、历史和后续面板展示都归主应用。
- 重写版本不设兼容层，旧数据一律作废。

## 当前项目事实

- 扩展公共 API 位于 `packages/extension-api/src`，SDK 位于 `packages/extension-sdk/src`。
- 主进程 extension service 位于 `apps/desktop/src/main/services/extension`。
- `context.secrets` 已由 Electron `safeStorage` 支撑，按 extension dataPath 隔离。
- `kisaki.runtime.openExternal`、`kisaki.scrapers.profiles`、`kisaki.ingest.games.addFromScraper`、`kisaki.commands`、`kisaki.backgroundTasks` 已存在。
- 命令注册是 contribution：`context.contributions.commands.register(...)`。命令执行是 capability：`kisaki.commands.start/execute/wait/cancel(...)`。
- Deeplink contribution 返回 `urlPattern`，扩展局部 path 会被宿主归一化为 `kisaki://ext/<extensionId>/<path>`。
- DB event projector 已基于 SQLite trigger 的 OLD/NEW row snapshot 投影 `library.game.updated` 等 typed host event。
- 当前 `extensions/bangumi` 仍是旧 scraper 形态；实施阶段要替换为本文档的完整设计。

## 参考资料

- Bangumi API: <https://bangumi.github.io/api/>
- Bangumi OpenAPI JSON: <https://bangumi.github.io/api/dist.json>
- Bangumi OAuth 文档: <https://github.com/bangumi/api/blob/master/docs-raw/How-to-Auth.md>
- Bangumi User-Agent 建议: <https://github.com/bangumi/api/blob/master/docs-raw/user%20agent.md>
- Kisaki extension system guide: `.codex/skills/kisaki/references/extension-system.md`
- Kisaki extension API guide: `.codex/skills/kisaki/references/extension-api.md`
