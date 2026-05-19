# 02 Extension System Integration

## 现有宿主能力

Bangumi 第一版需要的宿主能力已经存在，不再作为本设计的前置重构项：

| 需求              | 当前入口                                               | 用法                                                              |
| ----------------- | ------------------------------------------------------ | ----------------------------------------------------------------- |
| 持久设置          | `context.storage`                                      | 保存非敏感 settings、sync fingerprint                             |
| 敏感凭据          | `context.secrets`                                      | 保存用户 access token、refresh token、expiresAt                   |
| 网络请求          | `kisaki.network.request`                               | 调用 Bangumi API 和 OAuth Relay                                   |
| 打开浏览器        | `kisaki.runtime.openExternal`                          | 打开 relay 返回的授权 URL                                         |
| Deeplink callback | `context.contributions.deeplinkRoutes.register`        | 注册 `/oauth-callback`                                            |
| 设置 UI           | `context.contributions.settingsPanels.register`        | 渲染 Bangumi settings panel                                       |
| Scraper provider  | `context.contributions.scraperProviders.game.register` | 注册 Bangumi game provider                                        |
| Host event        | `kisaki.events.on`                                     | 订阅 `library.game.created` / `library.game.updated`              |
| Scraper profile   | `kisaki.scrapers.profiles.list/get`                    | 导入时选择 game profile                                           |
| Ingest            | `kisaki.ingest.games.addFromScraper`                   | 按 profile 创建或定位游戏                                         |
| Library write     | `kisaki.library.*`                                     | 为本次新建游戏写游玩状态/评分、创建 tag/collection、建立 relation |
| Command 注册      | `context.contributions.commands.register`              | 注册同步、导入、刷新等长任务                                      |
| Command 执行      | `kisaki.commands.start/wait/cancel/getProgress`        | settings panel 启动和控制一次 job                                 |
| Background task   | `kisaki.backgroundTasks`                               | 创建本扩展推荐 task 配置                                          |

## 运行时边界

必须遵守当前扩展系统的边界：

- 扩展运行在 shared extension host process。
- Renderer 不 import `extensions/bangumi` 源码，也不执行扩展 entry。
- Renderer 只渲染 settings panel 和贡献快照 DTO。
- Bangumi 扩展只 import `@kisaki/extension-sdk`，不得 import `apps/desktop/src/main/**`、Drizzle schema、Electron API 或 renderer component。
- 所有宿主交互通过 `context.*` 和 `kisaki.*`。
- 所有 public contract 以 `packages/extension-api` 为准，不在扩展内复制主应用内部类型。

## Built-In Extension Pipeline

`extensions/bangumi` 是标准内置扩展项目：

- dev: `apps/desktop/scripts/prepare-builtin-extensions.ts watch` 调用 `kisx output` 写入 `apps/desktop/out/extensions`。
- build: `prepare-builtin-extensions.ts build --target=resources` 写入 `apps/desktop/resources/extensions`。
- manifest entry 继续指向 `./dist/index.mjs`。
- 目标 manifest categories 为 `["scraper", "integration"]`。
- package scripts 保持 `kisx build`、`kisx validate`、`kisx pack`、`tsc --noEmit`。

实施时扩展项目仍要能独立通过：

```powershell
pnpm --filter @kisaki/builtin-bangumi typecheck
pnpm --filter @kisaki/builtin-bangumi build
pnpm --filter @kisaki/builtin-bangumi validate
```

## Deeplink 接入

注册：

```ts
const callback = context.contributions.deeplinkRoutes.register({
  id: 'oauth-callback',
  path: '/oauth-callback',
  async handle(event) {
    return oauthFlow.completeFromDeeplink(event)
  }
})
```

当前 public handle 字段是 `urlPattern`，形态为：

```text
kisaki://ext/builtin.bangumi/oauth-callback
```

规则：

- `path` 是 extension-local path，必须以 `/` 开头。
- path 不包含 `/ext`、extension id、query 或 hash。
- Relay 创建 session 时使用 `callback.urlPattern` 作为 desktop callback URL。
- handler 只解析 `event.query.sessionId` 和 `event.query.state`，不解析 host namespace。
- `kisaki://bangumi/...` 不是 extension deeplink 入口。

## Event 接入

DB event projector 已投影以下事件：

- `library.game.created`
- `library.game.updated`
- `library.game.deleted`
- 其他实体的 created/updated/deleted

Bangumi 自动同步只订阅：

- `library.game.created`
- `library.game.updated`

当前 public `LibraryGameUpdatedEvent` 包含 `changes`，不包含可依赖的 source 字段。防循环策略必须由 Bangumi 扩展自己完成：

- 基于同步 payload 计算 fingerprint。
- 记录最近成功 fingerprint。
- 本扩展主动写入本地游玩状态/评分后维护 fingerprint suppress；导入流程对 ingest 返回的 gameId 维护短期 import suppress，避免导入事件立刻回写 Bangumi。
- 对同一 `gameId` debounce/coalesce。
- source 不作为跳过同步的必要条件。

## Settings Callback 约束

settings panel 的 resolve、submit、button、commit 回调走 main/host RPC，适合轻量读取和启动动作，不适合直接执行长任务。Bangumi 设置面板必须遵守：

- 登录发起可以在按钮回调中创建 relay session 并打开浏览器，但不得等待用户完成授权。
- 全量同步、收藏导入、目录导入必须启动 command 后立即返回。
- settings panel 的手动执行只对应 job；取消动作只调用 `kisaki.commands.cancel(executionId)`。
- task 创建只写入 BackgroundTaskService；settings panel 不调用 task run/cancel，也不展示 task history。

## Job 与 Task 关系

Bangumi 的 `job` 是一次业务执行，宿主形态是 command execution。Bangumi 扩展通过 contribution 注册 job command：

```ts
context.contributions.commands.register({
  id: 'bangumi.sync.full',
  title: 'Bangumi Full Sync',
  cancelable: true,
  async execute(args, event) {
    return jobs.runFullSync(args, event)
  }
})
```

Bangumi 的 `task` 是主应用 BackgroundTaskService 中的持久自动化配置。task 只保存要调用的 command、参数、schedule、failurePolicy 和运行历史；真正运行时仍由主应用触发对应 job command。

Background task 只能绑定本扩展拥有的 command。宿主会校验：

- `ownerExtensionId === builtin.bangumi`
- task command 必须由 `builtin.bangumi` 注册
- 扩展只能访问自己拥有的 task

因此任务配置和运行历史不需要另存一份到 Bangumi storage。settings panel 只保存用户偏好与 Bangumi 业务状态；实际 schedule、enabled、failurePolicy、run/cancel 和 history 以主应用 task 能力为准。Bangumi 设置页只提供推荐 task 的创建入口和“已创建”状态提示，不充当 task 面板。

## Library 写入策略

导入和同步可用的 public 写入口：

- `kisaki.library.games.get/list/update`
- `kisaki.library.collections.get/list/create/update`
- `kisaki.library.tags.get/list/create/update`
- `kisaki.library.relations.list/create/update/remove`
- `kisaki.ingest.games.addFromScraper`

规则：

- 创建游戏优先走 ingest。
- 导入不得修改资料元数据。默认只创建缺失游戏；用户显式开启 patch existing 后，才可按 Bangumi subject ID 补写已有游戏的 status、score、tag 和目标本地合集。
- tag 和 collection membership 通过 relation capability 建立。
- 扩展不直接写 DB、不推断内部表结构、不持久化主应用内部 id 以外的不可序列化对象。
