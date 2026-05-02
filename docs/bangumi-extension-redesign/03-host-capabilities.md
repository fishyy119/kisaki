# 03 Host Capabilities

现有扩展 API 已有 `settingsPanels`、`scrapers`、`library`、`events`、`network`、`runtime.delay`。本需求还需要以下宿主能力与 context API，否则 Bangumi 扩展会被迫触碰 app internals。

## Context Secrets API

新增 `context.secrets`：

- `get(key)`
- `set(key, value)`
- `delete(key)`
- `listKeys(prefix?)`

`secrets` 不作为 extension capability/权限点，也不放在 `kisaki.*` capability namespace 中；它是 `ExtensionContext` 提供的通用 API。它与 extension storage 同类，是按 extension 隔离的 key-value storage，只是敏感值必须走安全存储后端；不要把它建模成独立主应用 service。

用于保存用户的 `access_token`、`refresh_token`、`expires_at` 等 token 数据。Kisaki 官方 Bangumi 应用的 `client_secret` 只保存在 Kisaki 服务器环境变量中，绝不进入桌面安装包、扩展源码、manifest、extension storage 或用户本机 secrets。

## Runtime Open External

新增 `kisaki.runtime.openExternal(url)`。

Bangumi OAuth 不新增主应用 OAuth service。扩展自己组合：

- `kisaki.network.request`: 调用 Kisaki OAuth Relay 的 session、complete、refresh endpoint。
- `context.contributes.deeplinks.register`: 注册 Bangumi 扩展自己的 deeplink callback handler。
- `kisaki.runtime.openExternal`: 打开系统浏览器访问 relay 返回的 authorize URL。
- `context.secrets`: 保存用户 token。

主应用只提供通用 primitive；Bangumi 扩展负责 state/session、relay complete、token refresh、取消、超时和错误处理。

## Deeplink Contribution API

本次重构调整 deeplink 注册点公共契约，不保留旧的完整 `route` 注册语义。扩展只声明自己拥有的局部 `path`，主应用根据 extension id 生成内部路由和 canonical 桌面 URL：

```ts
const callback = context.contributes.deeplinks.register({
  id: 'oauth-callback',
  path: 'oauth-callback',
  async handle(input) {
    return { success: true, status: 'handled' }
  }
})

callback.url
// kisaki://ext/<extensionId>/oauth-callback
```

公共 API 语义：

- `DeeplinkContribution.path`: extension-local path，不包含 `ext/` 或 extension id。
- `register()` 返回的 handle 包含 canonical `url`，供扩展传给 relay、设置页诊断或外部调用方。
- 主应用内部把 `<extensionId>` 和 `path` 归一化为 `ext/<extensionId>/<path>`。
- `DeeplinkRequest` 应携带匹配到的局部 `path`、`params` 和原始 `rawUrl`；扩展不需要解析主应用命名空间。
- `kisaki://ext/<extensionId>/<path>` 是扩展 deeplink 的唯一外显 URL 形态；`kisaki://<extensionId>/...` 不作为扩展入口。

## Scraper Capability Additions

scraper profile 查询应放在现有 scraper capability 下，不新增顶级 `scraperProfiles` capability。

新增扩展可调用的 profile 查询 API：

- `kisaki.scrapers.profiles.list({ mediaType: "game" })`
- 可选：`kisaki.scrapers.profiles.get(profileId)`
- 可选：返回 profile 的公开摘要字段，例如 `id`、`name`、`mediaType`、`providerSlots`、`defaultLocale`；不暴露内部 DB row 或不可序列化配置。

Bangumi 设置面板、导入命令和后台 task 只保存 profile id。执行时由 ingest/scraper service 重新解析 profile，避免长期缓存过期 profile 配置。

## Ingest Capability

新增扩展可调用的最小 ingest API：

- `kisaki.ingest.games.addFromScraper(profileId, lookup, options)`

`lookup.knownIds` 支持传入 `{ source: "bangumi", id: subjectId }`。导入用户数据库和目录时必须通过用户指定的 scraper profile 进入 Kisaki 数据库，而不是扩展直接写完整游戏对象。

第一版不把 `updateGameFromScraper(request)` 暴露为 public extension API。理由：

- 当前 Bangumi 导入只需要“按指定 profile 创建游戏，或通过 Bangumi external id 返回已存在游戏”的能力。
- Bangumi 收藏类型、评分、标签、评价等用户数据库字段不是 scraper metadata，应由 Bangumi 扩展在 ingest 返回 `gameId` 后通过 `kisaki.library.games.update`、tag/relation capability 或专用 mapping capability 写入。
- 完整 metadata refresh 的覆盖策略、可写字段、媒体资源替换和关系覆盖风险更高，适合以后作为单独 capability 设计，而不是顺手暴露 app 内部 update IPC。

## Command Service

新增主应用 `CommandService`，扩展可以注册结构化 command：

- `id`
- `title`
- `description`
- `argsSchema`
- `defaultArgs`
- `dangerLevel`
- `cancelable`
- `execute(args, context)`

Command 是“能做什么”的公共抽象，可被设置面板按钮、命令面板、sidebar action、后台任务和其他扩展入口复用。Bangumi 扩展注册：

- `bangumi.auth.refresh`
- `bangumi.sync.changed-games`
- `bangumi.sync.full`
- `bangumi.import.my-collections`
- `bangumi.import.index`

## Background Task Service

新增主应用 `BackgroundTaskService`，用于创建、删除和调度 command task：

- 扩展可以调用 API 创建 task，例如用户点击 Bangumi 设置面板中的“启用每日同步”后创建 `bangumi.sync.full` task。
- 扩展可以删除自己创建/拥有的 task，例如用户在 Bangumi 设置面板关闭该自动化后删除对应 task。
- 用户也可以在主应用后台任务面板中创建、修改、禁用或删除 task。
- 支持手动运行、应用启动时运行、固定间隔运行、每日/每周等 calendar schedule。
- 支持失败重试、禁用、取消、运行历史、下次运行时间。

Task 必须保存：

- `ownerExtensionId`
- `createdBy`: `user` 或 `extension`
- `commandId`
- `args`
- `enabled`
- `schedule`
- `failurePolicy`
- `history`

扩展只能静默管理自己拥有的 task；用户从后台任务面板手动修改过的 task 仍可被扩展识别，但删除/覆盖应来自明确的用户操作。

## DB Event Projector

在 `DbService` 中新增 typed event projector 子模块，作为重构后的 events 领域事件生产层：

- 底层继续使用 SQLite trigger 捕获 `db:inserted`、`db:updated`、`db:deleted`。
- DB event projector 订阅 raw DB event，按 table/id debounce/coalesce。
- DB event projector 把 raw DB change 映射为实体级 library events。
- 扩展事件 capability 订阅聚合后的领域事件，而不是自己直接把 `db:*` 映射成 library event。
- 公共事件至少按实体类型拆分：`library.game.updated`、`library.person.updated`、`library.company.updated`、`library.character.updated`、`library.collection.updated`、`library.tag.updated`。
- updated payload 使用 `changes` 判别联合，见 [05-library-events.md](05-library-events.md)。

## Event Source

自动同步第一版不依赖 origin/source 判断是否跳过；主要依赖 sync fingerprint、debounce 和短期 suppress set。

聚合后的 library event 可以保留可选 `source` 作为诊断信息和 job history 归因，例如区分用户操作、scanner、extension command、background task。由于直接 Drizzle 写入无法天然携带 source，`source.kind = "unknown"` 必须是合法情况，扩展不能把 source 当作兼容性或防循环的硬条件。
