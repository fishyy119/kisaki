# 04 Producer Adapters

## 总规则

接入任务中心的模块都遵循同一模式：

```ts
const run = taskRun.runs.create(input)
const context = run.context

try {
  run.start()
  context.report({ phase: 'preparing', indeterminate: true })

  await doBusinessWork(context)

  run.complete({ summary: 'Done' })
} catch (error) {
  if (isTaskRunCancellation(error)) {
    run.cancel()
  } else {
    run.fail(error)
  }
}
```

如果入口 IPC 的语义是“启动长时任务并立即返回 runId”，则入口只创建 run 并启动本地后台函数：

```ts
const run = taskRun.runs.create(input)
void executeBusinessRun(run, request).catch((error) => {
  if (isTaskRunCancellation(error)) {
    run.cancel()
  } else {
    run.fail(error)
  }
})
return { runId: run.id, createdAt: run.createdAt }
```

`executeBusinessRun` 由业务模块自己实现 try/catch，并在内部调用 `run.start()`、`run.context.report()`、`run.complete()`、`run.cancel()` 或 `run.fail()`。

生产者只负责：

- 提供 title、category、operation、owner、initiator、subject、controls。
- 在安全边界通过 `TaskRunContext` report/checkpoint。
- 生成业务结果。
- catch 业务错误并结束 run。

生产者不负责：

- 计算速度和 ETA。
- 推送 renderer IPC。
- 持久化 task run 表。
- 管理 task center UI。
- 直接更新 toast。
- 为自己的历史复制完整 task result。
- 把业务 executor 交给 TaskRunService 调度。

## CommandService

### 目标

CommandService 在新设计中只相当于 command registry 加薄调用路由。

命令仍然负责：

- registry。
- descriptor。
- args merge。
- command source。
- extension-owned command access control。
- 调用已注册 command handler，并把 handler 返回值包装成 command invocation result。

CommandService 不负责：

- 创建 execution id。
- 保存 running/cancelling state。
- 判断一个 command 是否长时任务。
- 自动创建 task run。
- 提供 command progress。
- 提供 command cancel/pause/resume。
- 保存 command result/history。
- 将 command progress 转发到 task run。
- 将 command result 复制到 task run result。
- 拥有 notify loading presentation。

长时 command handler 只能调用实际业务 use case 或 scoped task-run API 创建 TaskRun，并返回 `runId`。TaskRun 的 `category` 和 `operation` 必须描述真实业务，不使用通用 command category 或 `command.execute` operation。Command 入口可以写入 `subject.type === 'command'`。

### Contract 调整

无向后兼容时，Command invocation 合同不再携带 execution id、progress、wait、cancel 或 command history 状态。

Command IPC 目标：

```ts
interface IpcMainHandlers {
  'command:list': () => IpcResult<CommandListItem[]>
  'command:get': (commandId: string) => IpcResult<CommandDescriptor | null>
  'command:invoke': (request: CommandInvocationRequest) => IpcResult<CommandInvocationResult>
}
```

command handler 可以返回普通业务结果，也可以返回自己创建的 task run id：

```ts
export interface CommandInvocationRequest {
  commandId: string
  args?: Record<string, unknown>
  source?: CommandInvocationSource
}

export interface CommandInvocationResult {
  commandId: string
  output?: unknown
  runId?: string
}
```

`CommandInvocationContext` 只保留 command 语义：

```ts
export type CommandInvocationSource =
  | {
      type: 'user'
    }
  | {
      type: 'automation'
      automation: {
        id: string
        nameSnapshot: string
        trigger: 'manual' | 'startup' | 'cron'
        attempt: number
      }
    }
  | {
      type: 'extension'
      extension: {
        id: string
        nameSnapshot?: string
      }
    }
  | {
      type: 'system'
      reason?: 'startup' | 'maintenance' | 'update' | 'shutdown'
    }

export interface CommandInvocationContext {
  commandId: string
  source: CommandInvocationSource
}
```

`CommandInvocationSource` 只表达谁启动了这次 command invocation。它不表达 command 的拥有者，也不表达 TaskRun owner。扩展 command 的 owner 由 command registration runtime metadata 派生。

如果某个 app command 需要取消、暂停、进度和任务中心结果，它的 handler 调用真实业务 use case，由该 use case 创建 TaskRun：

```ts
async function runLongCommand(args, context, services) {
  const start = services.domainUseCases.startLongRun({
    args,
    initiator: commandInvocationSourceToTaskRunInitiator(context.source),
    subject: {
      type: 'command',
      id: context.commandId,
      labelSnapshot: '同步数据'
    }
  })

  return { runId: start.runId }
}
```

真实业务 use case 仍然使用 TaskRun producer 模式：

```ts
async function executeDomainRun(run, args) {
  try {
    run.start()
    const context = run.context

    await doDomainWork(args, context)
    run.complete({ summary: '完成' })
  } catch (error) {
    if (isTaskRunCancellation(error)) {
      run.cancel()
    } else {
      run.fail(error)
    }
  }
}
```

删除旧 `CommandExecutions` 和 `CommandNotificationCoordinator`。命令本身不再有 notify progress；长时 command handler 返回的 TaskRun 可以启用 task run notification presentation。

扩展贡献的长时 command 不通过 invocation context 上报 progress。新增 scoped extension task-run API 和现有 Bangumi 迁移见 [07-extension-api-and-bangumi-refactor.md](07-extension-api-and-bangumi-refactor.md)。

## AutomationService

### Rename

删除旧 `BackgroundTaskService` 命名，新增：

```text
apps/desktop/src/main/services/automation/
```

公共概念：

```ts
Automation
AutomationTrigger
AutomationFailurePolicy
```

Extension API：

```ts
kisaki.automations.list()
kisaki.automations.create()
kisaki.automations.update()
kisaki.automations.run()
```

不保留 `backgroundTasks` alias。

### Role

Automation 是持久配置和触发历史 owner，不是 TaskRun 运行实例，也不是 task run category。

它保存：

- name。
- commandId。
- args。
- enabled。
- triggers。
- failurePolicy。
- owner。app 创建的 automation 为 `{ type: 'app' }`，扩展通过 `kisaki.automations` 创建的 automation 为 `{ type: 'extension', extension: { id, nameSnapshot? } }`。

运行时：

- 手动、startup、cron 都 invoke command。
- AutomationRunner 调用 command 时必须传入 `CommandInvocationSource.type === 'automation'`，包含 automation id、nameSnapshot、trigger 和 attempt。
- command handler 若是长时流程，调用真实 producer 或 scoped task-run API 创建 task run，并返回 `runId`。
- 自动化触发的 task run 由实际 handler 写入 `initiator`，记录 automation id、nameSnapshot、trigger 和 attempt。
- 如果 automation 触发的是扩展 command，TaskRun `owner` 仍是该 extension，`initiator` 是 automation。
- automation 页面只从 `automation_run_history` 查询触发历史，不读取 TaskRun API。

### History

建立独立 `automation_run_history`。它记录 automation 触发一次 command invocation 的事实，不记录 TaskRun progress，也不复制 TaskRun result。

建议 contract：

```ts
export type AutomationCommandInvocationStatus = 'completed' | 'failed'

export interface AutomationRunHistoryRecord {
  id: string
  automationId: string
  automationNameSnapshot: string
  owner: AutomationOwner
  trigger: AutomationTrigger
  attempt: number
  commandId: string
  commandTitleSnapshot?: string
  startedAt: number
  finishedAt: number
  invocationStatus: AutomationCommandInvocationStatus
  error?: {
    message: string
    code?: string
  }
}

export interface AutomationRunHistoryListQuery {
  automationId?: string
  ownerTypes?: AutomationOwner['type'][]
  extensionId?: string
  commandIds?: string[]
  triggers?: AutomationTrigger[]
  invocationStatuses?: AutomationCommandInvocationStatus[]
  limit?: number
}
```

建议表：

```text
automation_run_history
```

建议字段：

```ts
export const automationRunHistory = sqliteTable('automation_run_history', {
  id: text('id').primaryKey(),
  automationId: text('automation_id').notNull(),
  automationNameSnapshot: text('automation_name_snapshot').notNull(),
  owner: automationOwner('owner').notNull(),
  ownerExtensionId: text('owner_extension_id'),
  trigger: automationTrigger('trigger').notNull(),
  attempt: integer('attempt').notNull(),
  commandId: text('command_id').notNull(),
  commandTitleSnapshot: text('command_title_snapshot'),
  startedAt: integer('started_at').notNull(),
  finishedAt: integer('finished_at').notNull(),
  invocationStatus: automationCommandInvocationStatus('invocation_status').notNull(),
  error: automationInvocationError('error')
})
```

Indexes:

```text
idx_automation_run_history_automation_finished_at
idx_automation_run_history_command_finished_at
idx_automation_run_history_owner_extension_finished_at
idx_automation_run_history_finished_at
```

表内不增加 `task_run_id`、`run_id`、foreign key 或 TaskRun JSON snapshot。

写入规则：

- 每次实际 command invocation 完成或失败后写入一条 `AutomationRunHistoryRecord`。
- `invocationStatus` 只表达 command handler 调用边界的完成/失败。
- 若 command handler 返回 `{ runId }`，`invocationStatus` 是 `completed`，但 `automation_run_history` 不保存该 run id。
- handler 创建的 TaskRun 可以随后独立进入 `completed`、`failed` 或 `cancelled`，这些状态只属于任务中心和 TaskRun history。
- command handler 不创建 TaskRun 时，automation history 仍然完整存在。
- 不保存完整 command args、完整 command output、run id、TaskRun result、progress 或大对象。需要展示参数时只保存有界、脱敏后的 summary。
- disabled、互斥、条件不满足、调度层 no-op 不属于 command invocation history；必要时写 main log 或 automation scheduler diagnostics。
- `automation_run_history` 使用自己的 retention policy；清理 automation history 只删除 invocation record，不影响 TaskRun history。

automation 页面读取：

```ts
automation.history.list({
  automationId
})
```

这样职责边界清晰：

- AutomationService 负责“规则被触发并调用了哪个 command，调用是否成功”。
- TaskRunService 负责“某个 handler 自愿创建的长时运行实例如何进展和结束”。
- CommandService 只负责 registry 和薄 invocation，不保存 execution/history。
- TaskRun 被 retention 清理后不影响 automation history，因为两者没有引用关系。

### Runner

`AutomationRunner` 不维护自己的 progress，不保存 command 返回的 `runId`，也不维护 automationId -> runId 映射。若 command handler 创建 TaskRun，TaskRun 只进入任务中心自己的 active/history 流。

Automation 不提供 task center 级别的进度和取消。若用户要取消 handler 创建的长任务，只能在任务中心或 TaskRun API 中取消该 TaskRun。

重试：

- 每次 retry 都重新调用 command。
- 若 command handler 创建 task run，每次 retry 都应创建新的 task run。
- 每次 retry 都写入自己的 `automation_run_history` row。
- `AutomationRunHistoryRecord.attempt` 从 1 递增；若创建 TaskRun，`initiator.automation.attempt` 使用同一个 attempt。

## ScannerService

### 目标

Scanner 保留业务队列、扫描规则、pause/resume/abort 语义，但进度展示迁移到 TaskRun。

删除：

```text
scanner:scan-progress
scanner:get-active-scans
renderer scanner store 的 active progress source
```

保留 scanner domain lifecycle event：

```text
scanner.started
scanner.finished
```

这些事件是低频领域事件，不承载 progress。

### Run input

扫描单个 scanner 创建：

```ts
{
  category: 'scanner',
  operation: 'scanner.scan',
  title: `扫描 ${scanner.name}`,
  owner: { type: 'app' },
  initiator: { type: 'user' }, // or { type: 'system', reason: 'maintenance' }
  subject: { type: 'scanner', id: scanner.id, labelSnapshot: scanner.name },
  controls: { cancelable: true, pausable: true }
}
```

### Coordinator

`ScannerHandlerCoordinator` 改为不持有 `activeScanProgress`。它持有：

- scan queue。
- controller map。
- scannerId -> runId map。

`ScannerRunSession` 使用 `TaskRunContext`。因为 `report(update)` 是完整快照替换，每次 report 都必须携带需要继续显示的 phase、current、total、unit、counters 和 warnings：

- `setTotal()` -> `context.report({ phase, current, total, unit: 'entity', counters, warnings })`
- `recordEntityResult()` -> 更新 bounded counters/warnings，并随同 current/total/unit 一起 report。
- `processItemsWithConcurrency()` 在调度边界调用 `await context.checkpoint()`。

Scanner-specific result 进入 `TaskRunResult.counters` 和 `TaskRunResult.output` 的摘要。

### Scanner page

Scanner 列表根据 `subject.type === 'scanner' && subject.id === scanner.id` 查找 active task run。

跳过和失败明细：

- active 时从 scanner run session 的有限摘要或当前 run snapshot 获取。
- completed 后从 task run result 查看。

若明细很大，不放进 progress；完成时保存有限摘要和失败列表上限。

## Ingest flows

### 目标

批量元数据更新、批量添加、批量删除等长流程迁到 main process use case。

renderer 不再：

- 循环调用 search/update IPC。
- 手写 `notify.loading`。
- 在组件中保存失败列表。

renderer 改为：

1. 收集用户参数。
2. 调用 main IPC 启动 task。
3. 关闭 dialog 或保持轻量 pending UI。
4. 任务中心展示进度和结果。

### Single operation

单个 ingest 操作只要包含抓取、下载、解析、图片处理、多阶段写入或明显可能耗时，也应创建 TaskRun。

例如单个游戏添加：

```ts
{
  category: 'ingest',
  operation: 'ingest.game.add',
  title: '添加游戏',
  owner: { type: 'app' },
  initiator: { type: 'user' },
  subject: { type: 'game', labelSnapshot: request.title },
  controls: { cancelable: true, pausable: false }
}
```

完成后：

```ts
result.output = {
  gameId
}
```

如果当前 UI 需要立刻跳转到新增实体，可以启动 run 后调用 `task-run:wait(runId)`。普通本地快速表单保存不需要 TaskRun。

### Batch and single reuse

单项 ingest 操作和 TaskRun 包装保持分离；需要后台进度时由显式的 `WithTaskRun`
入口创建 run。

规则：

- 用户直接触发单项 ingest 时，IPC 调用 `startAddFromScraper`、`startUpdateFromScraper` 等启动入口，创建 `ingest.game.add` 等 TaskRun。
- 用户触发批量 ingest 时，只创建一个 batch TaskRun。
- batch 内部调用纯单项 ingest 操作，如 `addFromScraper`、`updateFromScraper`，不创建子 run。
- 纯单项操作不调用 TaskRunService、不 report task progress。
- batch 不把父 run runtime 传给单项操作，但可以传入父 run 的 `AbortSignal` 作为取消信号。
- batch 只在每个 item 开始前或结束后调用自己的 `checkpoint()`；取消粒度是 item 级。
- 当前 item 内部的网络、下载、图片处理和资产写入应尽量接收 `signal`，在安全边界提前停止。
- 父 batch use case 独占父 run 的 aggregate progress，也就是 `current`、`total`、`unit`、counters、warnings 和 result output。

推荐函数签名：

```ts
function ingestGame(
  request: IngestGameRequest,
  options?: { signal?: AbortSignal }
): Promise<IngestGameResult>
```

用户直接触发单项：

```ts
await startIngestGame(request)
```

批量调用单项：

```ts
for (const [index, item] of items.entries()) {
  await context.checkpoint()

  context.report({
    phase: 'updating',
    message: item.name,
    current: index,
    total: items.length,
    unit: 'entity',
    counters: getAggregateCounters(),
    warnings: getBoundedWarnings()
  })

  const result = await ingestGame(item, {
    signal: context.signal
  })

  recordItemResult(result)

  context.report({
    phase: 'updating',
    current: index + 1,
    total: items.length,
    unit: 'entity',
    counters: getAggregateCounters(),
    warnings: getBoundedWarnings()
  })
}
```

规则重点：

- 纯单项操作不创建 run。
- 纯单项操作不 report task progress。
- 纯单项操作不感知父 batch run，不接收父 `TaskRunContext`、父 progress API 或父 lifecycle handle。
- 单项操作可以接收 `AbortSignal`，但这个 signal 只能用于取消网络、下载、文件处理和安全边界检查，不能用于上报 progress 或结束父 run。
- 父批量循环负责每个 item 完成后的计数推进。
- 父批量循环负责在 item 边界调用 `checkpoint()`；当前 item 内部可以通过传入的 `AbortSignal` 尽早停止可取消子步骤。
- 失败、跳过、警告由父批量循环收集并写入最终 result。

不推荐传入完整 TaskRunContext：

```ts
await ingestGame(request, { taskRunContext: context })
```

不推荐：

```ts
for (const item of items) {
  await ingestGame(item) // would create one task run per item
}
```

### Batch IPC examples

```ts
'ingest:batch-update-game-from-scraper': (
  request: GameBatchUpdateRequest
) => IpcResult<TaskRunStartResult>
```

返回 `runId`，不等待完整执行。

如果需要同步等待：

```ts
'task-run:wait': (runId: string) => IpcResult<TaskRun>
```

但普通 UI 不应阻塞等待。

### Batch result

```ts
interface IngestBatchResult {
  total: number
  succeeded: number
  failed: number
  skipped: number
  failures: Array<{
    entityId?: string
    name?: string
    error: string
  }>
}
```

失败列表必须有上限，例如 200 条。完整详细日志写 main log。

## Extension package operations

### 目标

扩展安装、更新、本地导入、卸载包操作进入 TaskRun。

旧 package operation registry 可以缩减为 package operation 的 cancel guard，或完全由 TaskRun active record 替代。

### Operation mapping

| 当前 phase     | TaskRun phase | 取消语义                       |
| -------------- | ------------- | ------------------------------ |
| `queued`       | `queued`      | immediate                      |
| `waiting-lock` | `waitingLock` | immediate                      |
| `download`     | `download`    | at next checkpoint             |
| `verify`       | `verify`      | at next checkpoint             |
| `extract`      | `extract`     | at next checkpoint             |
| `commit`       | `commit`      | deferred or point-of-no-return |
| `finished`     | final status  | no                             |

安装扩展创建：

```ts
{
  category: 'extension',
  operation: 'extension.package.install',
  title: `安装扩展 ${manifest.displayName}`,
  owner: { type: 'app' },
  initiator: { type: 'user' },
  subject: { type: 'extension', id: manifest.id, labelSnapshot: manifest.displayName },
  controls: { cancelable: true, pausable: false }
}
```

进入 commit 阶段后：

- 不在 commit 内调用 checkpoint，不中断原子提交。
- 如果 commit 后仍有安全停止边界，取消请求进入 `cancelling`，并在 commit 后的 checkpoint 生效。
- 如果 commit 已经是无法回滚且无法停止的 point-of-no-return，可以在进入该阶段前将 `cancelable` 设为 false。

### Renderer operation id

renderer 不再生成 extension operation id。

新流程：

```text
renderer confirms plan
main creates task run
main creates internal operation id from run id or derived id
renderer receives runId
task center shows progress
```

## UpdaterService

应用更新检查、下载、安装可以纳入 TaskRun。

建议：

- `updater:check-for-updates` 若可能耗时，创建 `category: 'updater'`、`operation: 'updater.check'` task run，并返回 `TaskRunStartResult`。
- `updater:download-update` 必须创建 `category: 'updater'`、`operation: 'updater.download'` task run，返回 `TaskRunStartResult`，并用 byte progress。
- `quit-and-install` 不作为普通 task run，因为它会结束进程。
- updater store 可以继续保存当前可安装版本、下载完成状态和 changelog cache，但下载运行态、速度和结果以 TaskRun 为准。

## Extension repository refresh

扩展仓库刷新也进入 TaskRun，避免 repository panel、startup refresh 和 automatic update refresh 维护另一套 running state。

单个仓库刷新：

```ts
{
  category: 'extension',
  operation: 'extension.repository.refresh',
  title: `刷新仓库 ${repository.name}`,
  owner: { type: 'app' },
  initiator: { type: 'user' },
  subject: { type: 'repository', id: repository.id, labelSnapshot: repository.name },
  controls: { cancelable: true, pausable: false }
}
```

全部仓库刷新：

```ts
{
  category: 'extension',
  operation: 'extension.repository.refreshAll',
  title: '刷新全部扩展仓库',
  owner: { type: 'app' },
  initiator: { type: 'user' },
  subject: { type: 'repository', labelSnapshot: '全部扩展仓库' },
  controls: { cancelable: true, pausable: false }
}
```

规则：

- `extension:refresh-repository` 和 `extension:refresh-repositories` 返回 `TaskRunStartResult`。
- repository manager 仍然拥有 fetch、snapshot persistence、catalog rebuild 和 URL policy。
- TaskRun 只承载刷新运行态、progress、结果摘要和取消信号。
- automatic update 触发的 repository refresh 使用 `initiator.type === 'system'` 或对应 automatic update run 的 producer policy，不伪装成 user。
- 结果摘要保存成功、not-modified、failed 数量和有限失败列表；完整错误写 main log。

## TaskRun notification presentation

保留 notify API 用于短反馈：

- 保存成功。
- 删除失败。
- 用户确认结果。
- 非长时的一次性提示。

迁移到 TaskRun：

- 批量元数据更新 loading toast。
- 添加/识别长流程 loading toast。
- 扫描进度。
- 扩展安装/更新 loading 状态。
- 自动化运行中状态。
- 长时 command handler 返回的 task run 进度。

规则：

- renderer-initiated but long-running: renderer starts task, TaskRun handles progress presentation。
- main-initiated: main may enable task notify presentation。
- loading toast 应该可关闭。
- 关闭 toast 只影响展示，不取消 task run。
- cancel 必须是明确 action。
- `notify.loading` 不再作为长流程唯一状态源。
