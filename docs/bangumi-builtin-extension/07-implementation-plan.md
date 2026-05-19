# 07 Implementation Plan

## Phase 0: 文档与基线

- 以本文档集作为新的实施入口。
- 删除旧 `docs/bangumi-extension-redesign`。
- 确认当前 `extensions/bangumi` 仍可 typecheck，记录旧 scraper 行为作为回归基线。
- 确认 OAuth Relay 生产 endpoint、健康检查 URL 和 Bangumi 开发者平台 callback 配置。

## Phase 1: 项目结构与状态层

- 更新 `extensions/bangumi/manifest.json` categories 和 description。
- 重建 `src/` 目录结构。
- 实现 `SettingsStore`、默认设置、schema normalization。
- 实现 `TokenStore` 和 secrets schema。
- 明确 job 不保存 history；持久 task history 只属于主应用 BackgroundTaskService。
- 删除旧设置入口。
- 不设旧版本兼容层；旧数据一律作废。

验收：

- 新 settings schema 初次启动可创建默认值。
- 旧数据不会影响新实现。
- `context.secrets` 中只出现新 keys。

## Phase 2: OAuth 与 BangumiClient

- 实现 `OAuthRelayClient`。
- 实现 deeplink callback 注册与 `OAuthFlow`。
- 实现 `TokenService` refresh、token status 验证和 401 retry；token status 走 relay，不进入 `BangumiClient`。
- 实现 `BangumiClient`、limiter、retry、pagination、error normalization。
- 实现 `AccountService`。
- Account settings tab 支持登录、检查登录结果、验证、刷新、退出。

验收：

- 用户可通过系统浏览器完成登录。
- 登录后 settings panel 显示 `/v0/me` 账号摘要。
- refresh token 走 relay；桌面端无 `client_secret`。
- relay 不可用时 UI 提示清晰，未过期 token 的普通 API 请求仍可执行。

## Phase 3: Scraper Provider

- 将现有 Bangumi provider 改为使用新 `BangumiClient`。
- 保持 `search`、`resolve`、`openSession` contract。
- 保留或重整 format helper，移除旧 token/storage/硬编码限速。
- 确保所有 subject/person/character/image 请求走共享 limiter。

验收：

- 搜索游戏只返回 `type=4`。
- knownIds 中有 Bangumi subject ID 时不再搜索，直接 resolve。
- ingest 通过 Bangumi provider 能创建带 Bangumi external id 的游戏。

## Phase 4: Commands 与 JobRunner

- 注册 `bangumi.auth.refresh`。
- 注册 `bangumi.sync.changed-games`。
- 注册 `bangumi.sync.full`。
- 注册 `bangumi.import.my-collections`。
- 注册 `bangumi.import.index`。
- 实现 args normalization、progress、summary、cancel，并由 CommandService 统一提供 notify 进度和 running 状态。
- settings panel 长流程按钮全部改为启动 job command。

验收：

- settings callback 不执行超过 15 秒的任务。
- command 可被 `kisaki.commands.start/wait/cancel` 控制。
- 运行中的 command 会通过 command notify 展示当前阶段和计数，并在 notify 上提供取消入口。
- settings panel 刷新后只根据 command `running` 状态禁用重复入口，不展示额外 progress/status field。
- job 不写 history；需要持久历史时由主应用 task 触发并在主应用 task 面板查看。

## Phase 5: 同步引擎

- 实现 play status/score mapping。
- 实现 fingerprint 和 suppressor。
- 实现 `SyncEngine.syncGame`。
- 实现 `SyncSubscription` 订阅 `library.game.created/updated`。
- 实现 full sync dry run 和 execute。

验收：

- 修改本地已绑定游戏状态后，自动同步写 Bangumi type。
- 修改本地评分后，自动同步写 Bangumi rate。
- 关闭状态同步但保留评分同步时只写 rate。
- 空评分默认不清除远端评分。
- 重复事件不会重复写相同 payload。
- 导入期间由 ingest 或新建游戏用户态字段写入产生的事件不会立刻回写 Bangumi。

## Phase 6: 收藏导入

- 实现用户收藏分页拉取。
- 实现 collection import planner。
- 实现按 scraper profile ingest。
- 实现 play status/score/tag/collection mapping，并确保导入永远不修改已有游戏。
- 实现 dry run 和 execute。

验收：

- 用户选择“在玩”和“玩过”时只导入对应 Bangumi type。
- 已有 Bangumi external id 的本地游戏不重复创建。
- 已有 Bangumi external id 的本地游戏不会被导入命令修改；单次导入 args 显式启用 `fields.score` 后，本次新建游戏可写入 Kisaki score。
- target collection 可正确建立 membership。
- 导入新建游戏时，即使自动同步开启，也不会立即把导入产生的本地游玩状态/评分写回 Bangumi。

## Phase 7: 目录导入

- 实现 index ID/URL parser。
- 实现 index 预览。
- 实现 index subjects 分页拉取。
- 复用 import planner、ingest 和 target collection 逻辑。

验收：

- 输入 Bangumi 目录 URL 能解析 ID 并预览标题。
- 只导入游戏条目。
- 按目录标题创建/复用目标合集时不产生重复合集。

## Phase 8: Settings 与 Automation

- 完成 Account、Sync、Import、Automation、Advanced tabs。
- 实现 relay health check。
- 实现推荐 task 创建入口和已创建状态摘要。
- 实现清理凭据、清理同步状态、恢复默认设置。
- 更新 `extensions/bangumi/README.md`。

验收：

- 用户可以创建每日全量同步任务。
- Bangumi 设置不运行、不取消、不展示 task history。
- 主应用 task 面板负责 task 启停、运行、取消和历史展示。
- Advanced 不泄露 token 或本机敏感路径。

## Phase 9: 验证与发布

运行：

```powershell
pnpm build:extension-contracts
pnpm --filter @kisaki/builtin-bangumi typecheck
pnpm --filter @kisaki/builtin-bangumi build
pnpm --filter @kisaki/builtin-bangumi validate
pnpm --filter kisaki typecheck
```

手动验证：

- dev 模式 built-in extension 加载成功。
- OAuth Relay 登录和 refresh 成功。
- Bangumi scraper 搜索、resolve、openSession 成功。
- 自动同步、全量同步、收藏导入、目录导入和推荐 task 创建流程成功。
- 未登录、token 失效、subject 404、API 400、429、5xx、网络失败、用户取消都给出可操作错误。

## 风险与处理

- Relay 不可用：登录和 refresh 失败，但未过期 token 的普通 API 请求可继续；UI 提供 health check 和重试。
- Bangumi API 限速未知：默认保守限速，用户可调整；429 必须 backoff。
- 长任务 settings callback 超时：settings 只启动 job command；需要持久历史时通过主应用 task。
- DB event 无 source：防循环使用 fingerprint、debounce 和 suppressor。
- `updated_at` 不可靠：导入不得依赖它判断是否改写本地用户态字段。
- Bangumi 用户收藏 tag 与 Kisaki tag 语义不完全等价：默认不导入 tag，用户显式启用后才创建/关联 Kisaki tag。
- 旧实现数据：一律作废。

## 最小完成标准

第一版可发布必须满足：

- OAuth 登录、refresh、退出。
- Bangumi scraper provider 正常工作。
- 自动同步 play status/score。
- 全量同步 dry run + execute。
- 我的收藏导入 dry run + execute。
- 目录导入 dry run + execute。
- settings panel 可配置核心项。
- job command 可执行全量同步；主应用 task 可调度同一个 command。
- 所有验证命令通过。
