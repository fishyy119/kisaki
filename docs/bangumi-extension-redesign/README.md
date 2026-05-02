# Bangumi 内置扩展重写方案

本文档集定义 `extensions/bangumi` 的重新设计方案。目标是把现有 Bangumi metadata scraper 重写为完整的综合性内置扩展：通过 Kisaki 官方 Bangumi 应用和 Kisaki OAuth Relay 登录用户自己的 Bangumi 账号，支持 Kisaki 与 Bangumi 的游戏收藏状态/评分同步、Bangumi 用户数据库导入、Bangumi 目录导入、可配置 Bangumi provider client 速率限制，以及完整的设置、命令和后台任务能力。

旧实现只作为需要替换的现状参考，不作为架构约束；实现完成后不承诺兼容旧 storage key、旧设置项或旧内部模块。

## 文档结构

- [01-facts-and-scope.md](01-facts-and-scope.md): 官方事实源、Bangumi API 能力边界、项目范围。
- [02-extension-architecture.md](02-extension-architecture.md): Bangumi 扩展内部模块与核心对象。
- [03-host-capabilities.md](03-host-capabilities.md): Kisaki 需要补齐的扩展能力，包括 secrets、openExternal、ingest、command、background task、DB event projector。
- [04-oauth-and-api-client.md](04-oauth-and-api-client.md): Kisaki OAuth Relay、扩展自组 OAuth flow、Bangumi API client 和速率限制。
- [05-library-events.md](05-library-events.md): 基于 SQLite trigger 的 typed event projector，以及实体级 `changes` 判别联合事件契约。
- [06-sync-and-import.md](06-sync-and-import.md): 自动同步、手动全量同步、用户数据库导入、Bangumi 目录导入。
- [07-settings-storage-and-tasks.md](07-settings-storage-and-tasks.md): 设置面板、storage/secrets、command 与后台 task。
- [08-implementation-plan.md](08-implementation-plan.md): 分阶段实施、验收场景、风险处理。
- [09-oauth-relay-deployment.md](09-oauth-relay-deployment.md): 可直接部署的 Kisaki OAuth Relay Docker Compose 和 TypeScript 服务端代码草案。

## 关键决策

- 以 Bangumi 官方 API、OpenAPI 和开发者文档为唯一事实源。
- 不新增主应用 OAuth service；Bangumi OAuth 是扩展业务流程，由扩展组合通用能力完成。
- Kisaki 官方 `client_secret` 不进入桌面端、扩展源码、manifest、extension storage 或本机 secrets。
- Kisaki OAuth Relay 作为独立 Docker 服务部署到服务器，默认通过 `https://kisaki.me/_tmp/bangumi-oauth/*` 这类临时域名路径暴露。
- 批量导入保持并行；所有触达 `api.bgm.tv` 的请求都经过共享 `BangumiClient` limiter。
- scraper profile 查询属于现有 scraper capability；不新增顶级 `scraperProfiles` capability。
- 公共 library 事件按实体拆分，例如 `library.game.updated`；实体内部变化使用 `changes` 判别联合表达。
- `changes[].facet` 是稳定公共契约，并决定 `before` / `after` 的类型；`fields` 只作为 best-effort 诊断信息。
- updated event 对 tracked 字段/关系必须携带类型安全的新旧公共值；直接字段由 raw trigger 提供，关系聚合由 DB event projector 基于 raw old/next 重建。
- 设置面板沿用当前 structured settings panel 设计方向，不引入另一套 UI 系统。
