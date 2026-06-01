# 07 Implementation Plan

当前 `extensions/bangumi` 已完成 Phase 5，OAuth、BangumiClient、game scraper、commands 和 sync engine 已进入可回归状态。后续实施从 Phase 5.5 开始。

Phase 5.5 是唯一处理当前代码迁移的阶段，具体迁移清单见 [08-media-scope-refactor.md](08-media-scope-refactor.md)。Phase 6 之后默认建立在 Phase 5.5 已完成的 media scope 架构上。

## 实施顺序

| 阶段      | 目标                   |
| --------- | ---------------------- |
| Phase 5.5 | Media Scope Refactor   |
| Phase 6   | Media-scoped 收藏导入  |
| Phase 7   | Media-scoped 目录导入  |
| Phase 8   | Settings 与 Automation |
| Phase 9   | 验证与发布             |

## 已完成基线

Phase 0-5 作为回归基线，不作为后续开发阶段重复执行：

- OAuth 登录、refresh、退出。
- `BangumiClient`、limiter、retry、pagination、error normalization。
- game scraper provider 的 search、resolve、openSession。
- command 注册、args normalization、scoped TaskRun wrapper、summary、cancel。
- settings callback 只启动 command job，不直接跑长任务。
- game 自动同步 play status/score。
- sync fingerprint、suppressor、queue、full sync dry run/execute。

验收：

- 运行当前验证命令，确认 Phase 5 基线仍可通过。
- game scraper、game full sync、game auto sync 行为不得退化。
- `rg -n "\breal\b|三次元" extensions/bangumi/src` 不应把三次元作为支持项暴露。

## Phase 5.5: Media Scope Refactor

执行 [08-media-scope-refactor.md](08-media-scope-refactor.md)。

目标：

- 不新增 media-specific extension API；长流程使用目标 `kisaki.taskRuns`，自动化使用目标 `kisaki.automations`。
- 建立 `book`、`game`、`anime`、`music` 四类 scope。
- `game` 成为唯一 local-capable scope。
- `book` / `anime` / `music` 成为 remote-only descriptor，不写入 Kisaki games。
- 当前宿主的 game library、ingest、event 和 scraper API 只能出现在 `media/game`。
- 通用层只依赖扩展内部 adapter interface。
- 原地复用当前 storage/secrets keys，不新增 `.v2` key。
- 将 `game` 泛指命名收敛为 `scope`、`subjectRef`、`item`、`localId`。

验收：

- `08` 中所有验收搜索通过。
- game scraper、game sync 与 Phase 5 行为等价。
- `book` / `anime` / `music` 不会通过任何 command 写入本地游戏库。

## Phase 6: Media-scoped 收藏导入

在 Phase 5.5 完成后，实现四类 scope 共享的收藏导入流程。

- 拆分 `CollectionReader`，按 scope 注入 Bangumi `subject_type` / `type`。
- `ImportPlanner` 输出 media-scoped plan。
- `ImportExecutor` 只通过 `MediaRegistry.requireLocalAdapter(scope)` 执行本地写入。
- `bangumi.import.my-collections` 直接替换为 `bangumi.import.collections`。
- `BangumiImportCollectionsArgs` 必须包含 `scope: 'book' | 'game' | 'anime' | 'music'`。
- game scope 支持 dry run 和 execute。
- book/anime/music 支持远端读取和 dry run summary，不展示也不执行本地写入。

验收：

- 用户选择 game scope 时，收藏导入行为与 Phase 5.5 后的 game adapter 能力一致。
- 已有 Bangumi external id 的本地游戏不重复创建。
- `patchExisting=false` 时，已有 Bangumi external id 的本地游戏不会被导入命令修改。
- `patchExisting=true` 且单次导入 args 显式启用 `fields.score` 后，已有游戏和本次新建游戏都可写入 Kisaki score。
- 用户选择的 target collection 可正确建立 membership，用户收藏导入不按 Bangumi 收藏类型自动派生本地合集。
- 导入新建游戏时，即使自动同步开启，也不会立即把导入产生的本地游玩状态/评分写回 Bangumi。
- book/anime/music execute 返回清晰 unsupported summary，不调用 game ingest。

## Phase 7: Media-scoped 目录导入

实现四类 scope 共享的目录预览、读取和导入计划。

- 实现 index ID/URL parser。
- 实现 index 预览。
- 实现 index subjects 分页拉取。
- index subjects 进入 media-scoped planner。
- game scope 可选择现有目标合集，或按目录标题创建/复用目标合集。
- book/anime/music 只做远端预览和 dry run summary，不写入本地库。

验收：

- 输入 Bangumi 目录 URL 能解析 ID 并预览标题。
- game scope 只导入游戏条目。
- 可选择现有目标合集，或按目录标题创建/复用目标合集。
- `patchExisting=true` 时已存在游戏也会加入目标合集。
- book/anime/music 本地写入入口不可见；直接 execute 也返回 unsupported summary。

## Phase 8: Settings 与 Automation

设置页体现 Bangumi 是多媒体集成，但本地自动化只暴露当前 local-capable 的 game scope。

- 设置页标题从“Bangumi 游戏集成”改为“Bangumi 集成”。
- 设置页主 tabs 只包含 Account、Sync、Import、Automation、Advanced。
- Account tab 不分 scope。
- Sync tab 只对 local-capable scope 展示本地同步入口；当前为 game。
- Import dialogs 带 media selector，只出现 `book`、`game`、`anime`、`music`。
- game scope 展示 profile、target collection、field mapping。
- book/anime/music 只展示远端预览能力，不展示本地执行写入入口。
- Automation tab 只创建 game 本地写入类 automation。
- Advanced tab 显示四个 scope 的 subject type 和 local capability。
- 实现 relay health check、清理凭据、清理同步状态、恢复默认设置。
- 更新 `extensions/bangumi/README.md`。

验收：

- 用户可以创建每日 game 全量同步自动化。
- Bangumi 设置不运行、不取消、不展示 task run history。
- 主应用自动化页面负责 automation 启停、手动运行和 invocation history；任务中心负责已创建 TaskRun 的进度、取消和历史展示。
- Advanced 不泄露 token 或本机敏感路径。
- 导入 dialog 的 media selector 只出现书籍、游戏、动漫、音乐四类 scope。
- settings panel 刷新后根据 `kisaki.taskRuns.listOwn({ status: 'active' })` 禁用重复入口，不展示额外 progress/status field。

## Phase 9: 验证与发布

运行：

```powershell
pnpm build:extension-tooling
pnpm --filter @kisaki/builtin-bangumi typecheck
pnpm --filter @kisaki/builtin-bangumi build
pnpm --filter @kisaki/builtin-bangumi validate
pnpm --filter kisaki typecheck
```

手动验证：

- dev 模式 built-in extension 加载成功。
- OAuth Relay 登录和 refresh 成功。
- Bangumi game scraper 搜索、resolve、openSession 成功。
- game 自动同步、全量同步、收藏导入、目录导入和推荐 automation 创建流程成功。
- book/anime/music 远端收藏读取和目录预览请求使用正确 subject type。
- book/anime/music 本地写入入口不可见；直接执行也返回 unsupported summary。
- 未登录、token 失效、subject 404、API 400、429、5xx、网络失败、用户取消都给出可操作错误。

## 风险与处理

- Relay 不可用：登录和 refresh 失败，但未过期 token 的普通 API 请求可继续；UI 提供 health check 和重试。
- Bangumi API 限速未知：默认保守限速，用户可调整；429 必须 backoff。
- 长任务 settings callback 超时：settings 只启动 job command；持久运行状态和历史通过主应用 TaskRun。
- DB event 无 source：防循环使用 fingerprint、debounce 和 suppressor。
- book/anime/music 无本地库 adapter：UI 不展示本地执行入口，job 层返回 unsupported，绝不写入 games。
- `updated_at` 不可靠：导入不得依赖它判断是否改写本地用户态字段。
- Bangumi 用户收藏 tag 与 Kisaki tag 语义不完全等价：默认不导入 tag，用户显式启用后才创建/关联 Kisaki tag。
- 开发期历史数据一律作废。

## 最小完成标准

第一版可发布必须满足：

- OAuth 登录、refresh、退出。
- Bangumi game scraper provider 正常工作。
- game 自动同步 play status/score。
- game 全量同步 dry run + execute。
- game 我的收藏导入 dry run + execute。
- game 目录导入 dry run + execute。
- settings panel 可展示 book/game/anime/music scope。
- book/anime/music 不写本地库，但远端读取路径和 UI 空间存在。
- job command 可执行全量同步；主应用 automation 可调度同一个 command。
- 所有验证命令通过。
