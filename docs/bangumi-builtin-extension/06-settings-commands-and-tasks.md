# 06 Settings Commands And Automations

## Settings Panel

注册一个 settings panel：

```text
id: settings
title: Bangumi
```

Root 使用 tabs，复杂流程使用 dialogs：

- Account: 登录状态、账号摘要、登录/验证/刷新/退出。
- Sync: 自动同步开关、游戏状态/评分开关、mapping 表、手动全量同步入口。
- Import: 我的收藏导入、目录导入，以及一次性目标合集和新建条目的可选用户态字段写入参数。
- Automation: 常用自动化创建入口和已创建状态摘要。
- Advanced: 登录超时、API 请求窗口、API timeout、retry、诊断、清理 storage/secrets。

UI 规则：

- 控件使用 structured settings nodes，不写自定义 renderer。
- 长流程按钮只启动 command，并拿到返回的 `runId` 后立即结束 settings callback。
- job 运行状态不在 settings panel 内追加 progress/status field；进度、完成、取消和历史统一由主应用任务中心展示。
- 重复入口禁用来自当前 settings session 的 pending 状态，或 `kisaki.taskRuns.listOwn({ status: 'active', subject })` 的本扩展 active run 查询。
- Automation tab 只创建或展示本扩展拥有的自动化配置摘要，不运行、不取消、不展示执行历史。
- 所有 destructive 操作使用 danger tone，并要求明确按钮文案，例如“清除 Bangumi 凭据”。

## Job 与 Automation 角色

Bangumi 扩展内必须明确区分 `job` 和 `automation`：

- `job`: Bangumi 扩展的一次业务执行，由 command handler 创建一个 scoped TaskRun。
- `automation`: 主应用 AutomationService 的持久配置，保存 commandId、args、trigger、failurePolicy 和 enabled 状态。
- `TaskRun`: 一次实际执行实例，是 progress、cancel、result 和 history 的唯一事实源。

边界：

- settings panel 的“立即同步”“导入”“刷新账号”触发 command。
- command handler 负责 args normalization，并通过 `kisaki.taskRuns.create()` 创建 TaskRun。
- job 不持久化 history，不保存 schedule，不拥有 automation 生命周期。
- automation 可以调度同一个 Bangumi command；运行、取消、重试和历史都归主应用 AutomationService + TaskRunService。
- Bangumi 扩展只提供推荐 automation 的创建入口；创建后不接管运行控制。

## Job Commands

Bangumi 注册以下 command 作为 job 入口：

| Command ID                   | 用途                         | cancelable | automation template |
| ---------------------------- | ---------------------------- | ---------- | ------------------- |
| `bangumi.auth.refresh`       | 刷新 token 并验证当前账号    | true       | yes                 |
| `bangumi.sync.changed-items` | 同步最近事件队列中的本地条目 | true       | yes                 |
| `bangumi.sync.full`          | 手动或定时全量同步           | true       | yes                 |
| `bangumi.import.collections` | 导入当前用户 Bangumi 收藏    | true       | yes                 |
| `bangumi.import.index`       | 导入指定 Bangumi 目录        | true       | yes                 |

登录 flow 可由 settings panel 直接启动，不作为 automation template。

Command args 必须是 JSON serializable record。每个 command 在 `jobs/commands.ts` 中定义：

- descriptor。
- args normalization。
- TaskRun wrapper。
- output schema。

命名规则：

- command id 使用 `bangumi.<domain>.<verb-or-object>`。
- media-scoped command 必须有 `scope` args。
- settings node id 与 command id 不强行一致。
- command 自身不定义 history key；持久历史只来自 TaskRun。
- 导入命令的 profile、目标合集和字段写入选项都是 command args，不保存到 `settings.v1`。

## Command Args

```ts
interface BangumiScopedArgs {
  scope: 'book' | 'game' | 'anime' | 'music'
}

interface BangumiFullSyncArgs extends BangumiScopedArgs {
  dryRun: boolean
  updateExisting: boolean
  batchSize: number
  playStatusEnabled?: boolean
  scoreEnabled?: boolean
  clearRemoteScoreWhenEmpty?: boolean
}

interface BangumiImportCollectionsArgs extends BangumiScopedArgs {
  dryRun: boolean
  profileId?: string
  collectionTypes: readonly BangumiCollectionType[]
  fields: BangumiImportWriteFields
  patchExisting: boolean
  targetCollection: BangumiImportTargetCollection
  concurrency: number
}

interface BangumiImportIndexArgs extends BangumiScopedArgs {
  dryRun: boolean
  profileId?: string
  indexInput: string
  indexId: number
  patchExisting: boolean
  targetCollection: BangumiImportTargetCollection
  concurrency: number
}
```

规则：

- `scope` 只允许四类固定值。
- `profileId` 对 `game` execute 必填。
- `book` / `anime` / `music` 的本地写入 execute 必须返回 unsupported summary。
- `dryRun` 可对四类 scope 拉取远端并生成计划。

## TaskRun Wrapper

扩展 command handler 不使用 command progress，也不通过 CommandService 取消。长流程统一创建 scoped TaskRun：

```ts
export async function runFullSync(args: BangumiFullSyncArgs): Promise<{ runId: string }> {
  const run = await kisaki.taskRuns.create({
    operation: 'command.execute',
    title: 'Bangumi 全量同步',
    subject: { type: 'command', id: 'bangumi.sync.full', labelSnapshot: 'Bangumi 全量同步' },
    controls: { cancelable: true, retryable: true },
    presentation: {
      notify: { enabled: true, showProgress: true, showResult: true, closable: true }
    }
  })

  void executeFullSync(args, run).catch((error) => {
    return run.fail(error).catch(() => undefined)
  })

  return { runId: run.id }
}
```

`executeFullSync()` 规则：

- 开始后立即 `await run.report({ phase, indeterminate: true })`。
- 长循环和批处理边界调用 `await run.checkpoint()`。
- live 汇总写入 `progress.counters` 和有限 `progress.warnings`。
- 成功时调用 `await run.complete({ summary, counters, warnings, output })`。
- 取消由 `run.signal` / `run.checkpoint()` 响应，最终进入 `cancelled`。
- 失败时调用 `await run.fail(error, { counters, warnings, output })`。

宿主根据 command source 派生 initiator：

- settings panel 用户点击：`initiator.type === 'user'`。
- AutomationService 调度：`initiator.type === 'automation'`，包含 automation id、nameSnapshot、trigger 和 attempt。
- extension runtime 自发执行：`initiator.type === 'extension'`。

## TaskRun Output

长任务输出进入 `TaskRunResult.output`：

```ts
interface BangumiJobSummary {
  version: 1
  commandId: string
  scope?: BangumiMediaScope
  dryRun: boolean
  counters: Record<string, number>
  errors: Array<{
    scope?: BangumiMediaScope
    subjectId?: string
    localId?: string
    code: string
    message: string
  }>
}
```

规则：

- final status 来自 `TaskRun.result.status`，不要在 `BangumiJobSummary` 里复制 status。
- startedAt、finishedAt、duration 来自 TaskRun snapshot，不复制到 output。
- `errors` 必须有上限，例如 200 条；完整错误对象只写 extension logger。
- `result.counters` 是任务中心显示的权威计数；`output.counters` 可以作为扩展业务摘要保留同一份有限数据。
- settings panel 不复制或展示 history。

## Progress 规则

- `phase` 用稳定英文枚举值，例如 `fetchingCollections`、`matchingItems`、`writingLibrary`。
- `message` 是可展示中文短句，不包含 token、HTTP body 或用户私密评论全文。
- 有明确总量时填写 `current` / `total`；未知总量时设置 `indeterminate: true`。
- `counters` 使用稳定 key，例如 `fetched`、`matched`、`created`、`updated`、`skipped`、`failed`。
- `warnings` 只放最近有限摘要，不放完整失败列表。
- UI 不从最后一条 progress 推断最终结果。

## Automation Templates

当前只为 `game` 提供本地写入类 automation template：

- 启动时刷新 Bangumi token: `bangumi.auth.refresh` + `startup`。
- 启动后同步变更队列: `bangumi.sync.changed-items` + `startup` + `{ scope: 'game' }`。
- 每日全量同步: `bangumi.sync.full` + `cron daily` + `{ scope: 'game' }`。
- 每周导入我的游戏收藏: `bangumi.import.collections` + `cron weekly` + `{ scope: 'game' }`。
- 每周导入指定游戏目录: `bangumi.import.index` + `cron weekly` + `{ scope: 'game' }`。

规则：

- 使用 `kisaki.automations.create` 创建，宿主自动填充 owner extension id。
- 创建前可以 `kisaki.automations.list()` 本扩展 automation，用于去重和展示“已创建”状态。
- 创建后 automation 的启停、运行、取消、schedule 修改、failure policy 修改和 history 查看都交给主应用自动化页面和任务中心。
- Bangumi 不自动覆盖用户在主应用自动化页面里改过的配置。
- Bangumi settings panel 不调用 `kisaki.automations.run` 或 `kisaki.automations.cancel`。
- automation history 从 `task_runs` 投影，不在 Bangumi storage 保存。

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

`context.secrets` keys:

- `auth.token`
- `auth.pendingSession`

清理操作：

- “清除凭据”删除 secrets 和 `auth.account`。
- “清除同步状态”删除 `sync.state` 和 `sync.queue`，不删除主应用 automations。
- “恢复默认设置”重置 `settings.v1`，不删除 token，也不影响导入 dialog 当前草稿或 automation args。
- “清除全部 Bangumi 扩展数据”应明确说明会删除 settings、sync state 和 secrets，但不卸载扩展，也不删除主应用 automations 或 task run history。

## Settings Data Loading

settings resolve 应尽量并行读取：

- settings。
- account snapshot。
- media descriptors。
- game scraper profiles。
- owned automation summaries，用于判断推荐 automation 是否已创建。
- owned active task runs，用于禁用重复长流程入口。

导入 dialog 的草稿值只存在当前 settings panel session；关闭 dialog 或重新打开时回到命令默认值，除非用户是在创建 automation，此时以 automation args 为准。

导入 dialog 的 media selector 只出现 `book`、`game`、`anime`、`music`。没有 local adapter 的 scope 不展示“写入本地库”“创建自动化”等执行入口；job 层仍要校验 scope 能力，避免绕过 UI。不在 UI 中出现三次元、全部媒体、其他等选项。

实时网络检查只在用户点击“检查 relay”或“验证账号”时执行，不在每次 resolve 中自动请求网络。

## UX 文案

统一中文文案：

- `Bangumi 账号`
- `书籍`
- `游戏`
- `动漫`
- `音乐`
- `收藏`
- `想读`、`读过`、`在读`
- `想玩`、`玩过`、`在玩`
- `想看`、`看过`、`在看`
- `想听`、`听过`、`在听`
- `全量同步`
- `预览`
- `导入我的收藏`
- `导入目录`
- `自动化`
- `任务中心`
- `清除凭据`

避免把 `manifest`、`release`、`RPC`、`payload` 暴露给普通用户。诊断区域可以显示 endpoint、HTTP status、OpenAPI version、User-Agent 和 extension version。
