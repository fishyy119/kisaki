# 06 Settings Commands And Tasks

## Settings Panel

注册一个 settings panel：

```text
id: settings
title: Bangumi
```

Root 使用 tabs，复杂流程使用 dialogs：

- Account: 登录状态、账号摘要、relay 状态、登录/验证/刷新/退出。
- Sync: 自动同步开关、状态/评分开关、mapping 表、手动全量同步入口。
- Import: 我的收藏导入、目录导入、任务入口。
- Automation: 常用 task 创建入口和已创建状态摘要。
- Advanced: rate limit、retry、诊断、清理 storage/secrets。

UI 规则：

- 控件使用 structured settings nodes，不写自定义 renderer。
- 长流程按钮只启动 job command 并返回。
- job 运行状态用 `status`、`table`、`notice` 展示。
- Automation 不运行、不取消、不展示 task history；task 执行与历史属于主应用 task 面板。
- 所有 destructive 操作使用 danger tone，并要求明确按钮文案，例如“清除 Bangumi 凭据”。

## Job 与 Task 角色

Bangumi 扩展内必须明确区分 `job` 和 `task`：

- `job`: Bangumi 扩展的一次业务执行，由 settings panel 手动触发，落到 CommandService 的一次 command execution。
- `task`: 主应用 BackgroundTaskService 的持久自动化配置，保存 commandId、args、schedule、failurePolicy 和 history。

边界：

- settings panel 的“立即同步”“导入”“刷新账号”触发 job。
- job 负责 args normalization、progress、cancel、summary 和错误整理。
- job 不持久化 history，不保存 schedule，不拥有 task 生命周期。
- task 可以调度同一个 Bangumi job command，但 task 的运行、取消、重试、历史和后续 task 面板展示都归主应用。
- Bangumi 扩展只提供推荐 task 的创建入口；创建后不接管 task 的运行控制。

## Job Commands

Bangumi 注册以下 command 作为 job 入口：

| Command ID                      | 用途                     | cancelable | task template |
| ------------------------------- | ------------------------ | ---------- | ------------- |
| `bangumi.auth.refresh`          | 刷新 token 并验证账号    | true       | yes           |
| `bangumi.sync.changed-games`    | 同步最近事件队列中的游戏 | true       | yes           |
| `bangumi.sync.full`             | 手动或定时全量同步       | true       | yes           |
| `bangumi.import.my-collections` | 导入当前用户游戏收藏     | true       | yes           |
| `bangumi.import.index`          | 导入指定 Bangumi 目录    | true       | yes           |

登录 flow 可由 settings panel 直接启动，不作为 task template。

Command args 必须是 JSON serializable record。每个 command 在 `jobs/commands.ts` 中定义：

- descriptor。
- args normalization。
- execution wrapper。
- output schema。

命名规则：

- command id 使用 `bangumi.<domain>.<verb-or-object>`。
- settings node id 与 command id 不强行一致。
- command 自身不定义 history key；持久历史只来自主应用 task 执行记录。

## Command Output

所有长任务输出统一：

```ts
interface BangumiJobSummary {
  version: 1
  commandId: string
  startedAt: number
  finishedAt: number
  status: 'completed' | 'cancelled' | 'failed'
  dryRun: boolean
  counters: Record<string, number>
  errors: Array<{
    subjectId?: string
    gameId?: string
    code: string
    message: string
  }>
}
```

输出可进入：

- command execution result。
- task history，当 command 由 BackgroundTaskService 触发时；Bangumi 设置页不复制或展示这份 history。

错误 message 必须适合展示，详细 Error object 只写 logger。

## Execution State

CommandService 提供运行期 progress snapshot。Bangumi 长任务通过 `event.reportProgress()` 上报当前阶段、文案和计数；settings UI 可以读取 `kisaki.commands.getProgress()` 或订阅 `kisaki.events.on('command.progress')` 展示实时状态，但不把 extension storage 当作进度事件总线。

边界：

- CommandService 负责单次 command execution、取消和临时 progress；结果只作为本次调用的返回值。
- BackgroundTaskService 负责持久任务、来自主应用的手动/启动/定时触发和运行历史。
- Bangumi extension storage 不保存 `jobs.active`、`jobs.history`、通用 `lastResult` 或 `lastSummary`。
- settings panel 手动触发只启动 job command，读取 progress/result，不读取 task history。
- task 的运行、取消、重试和历史展示由主应用 task 面板负责。
- 临时预览或轻量操作可以直接执行 job command；结果只反馈给当前 UI，不落 storage。

progress 规则：

- 每次上报都是当前 execution 的完整 snapshot，不持久化到 task history。
- `phase` 用稳定英文枚举值，例如 `fetchingCollections`、`matchingGames`、`writingLibrary`。
- `message` 是可展示中文短句，不包含 token、HTTP body 或用户私密评论全文。
- 有明确总量时填写 `current` / `total`；未知总量时设置 `indeterminate: true`。
- command 完成后以 `BangumiJobSummary` 作为最终输出，UI 不从最后一条 progress 推断结果。

## Task Templates

BackgroundTaskService 当前已经持久化 `history`，每个 task 保留最近 50 条 `BackgroundTaskRunRecord`，记录 `status`、`attempt`、`trigger`、`output` 和 `error`。Bangumi settings panel 不展示这些记录，只提供常用 task 创建入口：

- 启动时刷新 Bangumi token: `bangumi.auth.refresh` + `onStartup`。
- 启动后同步变更队列: `bangumi.sync.changed-games` + `onStartup`。
- 每日全量同步: `bangumi.sync.full` + `daily`。
- 每周导入我的收藏: `bangumi.import.my-collections` + `weekly`。
- 每周导入指定目录: `bangumi.import.index` + `weekly`。

规则：

- 使用 `kisaki.backgroundTasks.create` 创建，宿主自动填充 `ownerExtensionId` 和 `createdBy = "extension"`。
- 创建前可以 list 本扩展 task 用于去重和展示“已创建”状态，但不读取或渲染 `history`。
- 创建后 task 的启停、运行、取消、schedule 修改、failure policy 修改和 history 查看都交给主应用 task 面板。
- Bangumi 不自动覆盖用户在主应用 task 面板里改过的 task；需要变更时创建新的推荐 task 或提示用户去主应用 task 面板调整。
- Bangumi 不调用 `kisaki.backgroundTasks.run` 或 `kisaki.backgroundTasks.cancel`。

默认 failure policy:

```ts
{ type: 'retry', retryCount: 2, retryDelayMs: 60_000 }
```

认证失效类错误建议返回 failed，并在 summary 中提示重新登录；不要无限重试。

## Storage Keys

`context.storage` keys:

- `settings.v1`
- `auth.account`
- `sync.state`
- `sync.queue`
- `diagnostics.lastRelayHealth`

`context.secrets` keys:

- `auth.token`
- `auth.pendingSession`

清理操作：

- “清除凭据”删除 secrets 和 `auth.account`。
- “清除同步状态”删除 `sync.state` 和 `sync.queue`，不删除主应用 tasks。
- “恢复默认设置”重置 `settings.v1`，不删除 token。
- “清除全部 Bangumi 扩展数据”应明确说明会删除 settings、sync state 和 secrets，但不卸载扩展，也不删除主应用 tasks 或 task history。

## Settings Data Loading

settings resolve 应尽量并行读取：

- settings。
- account snapshot。
- scraper profiles。
- owned task summaries，用于判断推荐 task 是否已创建。
- relay health cache。

实时网络检查只在用户点击“检查 relay”或“验证账号”时执行，不在每次 resolve 中自动请求网络。

## UX 文案

统一中文文案：

- `Bangumi 账号`
- `Kisaki OAuth Relay`
- `游戏收藏`
- `想玩`、`玩过`、`在玩`、`搁置`、`抛弃`
- `全量同步`
- `预览`
- `导入我的收藏`
- `导入目录`
- `后台任务`
- `清除凭据`

避免把 `manifest`、`release`、`RPC`、`payload` 暴露给普通用户。诊断区域可以显示 endpoint、HTTP status、OpenAPI version、User-Agent 和 extension version。
