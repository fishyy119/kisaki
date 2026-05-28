# 04 Producer Adapters

## 总规则

接入任务中心的模块都遵循同一模式：

```ts
await taskRun.runs.run(input, async (context) => {
  await doBusinessWork(context)
  return result
})
```

或者在需要更精细控制时：

```ts
const run = taskRun.runs.create(input)
try {
  await doBusinessWork(run.context)
  run.complete(result)
} catch (error) {
  run.finishFromError(error)
}
```

生产者只负责：

- 提供 title、category、operation、initiator、subject、controls。
- 在安全边界 report/checkpoint。
- 生成业务结果。

生产者不负责：

- 计算速度和 ETA。
- 推送 renderer IPC。
- 持久化 task run 表。
- 管理 task center UI。
- 直接更新 toast。
- 为自己的历史复制完整 task result。

## CommandService

### 目标

Command execution 由 `TaskRunService` 承载运行态。

命令仍然负责：

- registry。
- descriptor。
- args merge。
- command source。
- extension-owned command access control。

TaskRun 负责：

- execution id。
- progress。
- cancel/pause state。
- result。
- notify presentation。
- history。

### Contract 调整

无向后兼容时可以把 command execution types 收敛为 task run backed shape：

```ts
export interface CommandExecutionStartResult {
  commandId: string
  executionId: string // equals TaskRun.id
  runId: string
  startedAt: number
  cancelable: boolean
  state: TaskRunStatus
}
```

`CommandExecutionContext` 变为：

```ts
export interface CommandExecutionContext {
  commandId: string
  executionId: string
  source: CommandExecutionSource
  signal: AbortSignal
  reportProgress(progress: TaskRunProgressUpdate): void
  checkpoint(): Promise<void>
}
```

### Implementation

`CommandExecutions.start()`：

1. require command。
2. merge default args。
3. create task run:
   - `category: 'command'`
   - `operation: 'command.execute'`
   - `title: command.descriptor.title`
   - `initiator` from request source。
   - `subject: { type: 'command', id: command.id, labelSnapshot: command.title }`
   - controls from descriptor。
4. execute command with task run context。
5. map output to command result and task run result。

`CommandExecutions.cancel(executionId)` delegates to `taskRun.runs.cancel(executionId)`。

`getProgress(executionId)` reads task run progress。

旧 `CommandNotificationCoordinator` 删除，由 `TaskRunNotificationCoordinator` 处理 `presentation.notify`。

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
kisaki.automations.cancel()
```

不保留 `backgroundTasks` alias。

### Role

Automation 是持久配置，不是运行实例，也不是 task run category。

它保存：

- name。
- commandId。
- args。
- enabled。
- triggers。
- failurePolicy。
- ownerExtensionId。

运行时：

- 手动、startup、cron 都启动 command。
- command execution 产生 task run。
- task run 的 `initiator` 记录 automation id、nameSnapshot、trigger 和 attempt。
- automation 页面从 `task_runs` 查询历史。

### History

不建立独立 `AutomationRunRecord` 结果表。

自动化历史查询：

```ts
taskRun.history.list({
  initiatorTypes: ['automation'],
  automationId
})
```

这样自动化历史和 task center 使用同一个事实源：

- 不复制 command output。
- 不复制 error/result/counters。
- 不会出现 automation history 指向已清理 task result 的悬空记录。
- 如果自动化历史需要保留更久，在 `TaskRunStore` retention 中配置 automation-initiated 策略。

调度器遇到 disabled、互斥、条件不满足、no-op 时，不创建 task run。必要时写 main log 或 automation 调度诊断，不写 `skipped` task run。

### Runner

`AutomationRunner` 不维护自己的 progress。它只维护 automationId -> runId，用于 active cancellation。

取消：

```text
automation:cancel -> taskRun.runs.cancel(runId)
```

重试：

- 每次 retry 都创建新的 task run。
- `initiator.automation.attempt` 从 1 递增。
- automation 页面按 startedAt 聚合显示即可，不需要独立 attempt row。

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
  initiator: { type: 'user' }, // or { type: 'system', reason: 'maintenance' }
  subject: { type: 'scanner', id: scanner.id, labelSnapshot: scanner.name },
  controls: { cancelable: true, pausable: true, retryable: true }
}
```

### Coordinator

`ScannerHandlerCoordinator` 改为不持有 `activeScanProgress`。它持有：

- scan queue。
- controller map。
- scannerId -> runId map。

`ScannerRunSession` 使用 `TaskRunContext`：

- `setTotal()` -> `context.report({ current, total, unit: 'entity' })`
- `recordEntityResult()` -> 更新 counters 并 report。
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
  initiator: { type: 'user' },
  subject: { type: 'game', labelSnapshot: request.title },
  controls: { cancelable: true, pausable: false, retryable: true }
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

单项 ingest 操作默认创建自己的 TaskRun，但必须支持在批量流程中关闭 task run 包装。

规则：

- 用户直接触发单项 ingest 时，`taskRun` 默认启用，单项操作创建 `ingest.game.add` 等 TaskRun。
- 用户触发批量 ingest 时，只创建一个 batch TaskRun。
- batch 内部调用同一个单项 ingest 操作，但传入 `{ taskRun: false }`。
- `taskRun: false` 表示单项操作不创建 run、不调用 TaskRunService、不 report task progress。
- batch 不把父 run runtime 传给单项操作。
- batch 只在每个 item 开始前或结束后调用自己的 `checkpoint()`；取消粒度是 item 级。
- 父 batch use case 独占父 run 的 aggregate progress，也就是 `current`、`total`、`unit`、counters、warnings 和 result output。

推荐函数签名：

```ts
function ingestGame(
  request: IngestGameRequest,
  options?: { taskRun?: boolean }
): Promise<IngestGameResult>
```

用户直接触发单项：

```ts
await ingestGame(request)
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
    unit: 'entity'
  })

  const result = await ingestGame(item, {
    taskRun: false
  })

  recordItemResult(result)

  context.report({
    phase: 'updating',
    current: index + 1,
    total: items.length,
    unit: 'entity'
  })
}
```

规则重点：

- 单项操作在 `taskRun: false` 时不创建 run。
- 单项操作在 `taskRun: false` 时不 report task progress。
- 单项操作在 `taskRun: false` 时不感知父 batch run。
- 父批量循环负责每个 item 完成后的计数推进。
- 父批量循环负责在 item 边界响应取消；当前 item 执行中不会被父 run checkpoint 打断。
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
  initiator: { type: 'user' },
  subject: { type: 'extension', id: manifest.id, labelSnapshot: manifest.displayName },
  controls: { cancelable: true, pausable: false, retryable: true }
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

- `updater:check-for-updates` 若可能耗时，创建 `category: 'updater'`、`operation: 'updater.check'` task run。
- `updater:download-update` 必须创建 `category: 'updater'`、`operation: 'updater.download'` task run，并用 byte progress。
- `quit-and-install` 不作为普通 task run，因为它会结束进程。

## Extension commands

扩展 command contribution 继续使用 `event.reportProgress()`。

增加：

```ts
event.checkpoint(): Promise<void>
```

扩展作者长循环应调用：

```ts
await event.checkpoint()
event.reportProgress({ phase: 'syncing', current, total })
```

如果 command 没有 checkpoint，它仍可取消 signal，但不应声明 `pausable`。

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
- 命令执行进度。

规则：

- renderer-initiated but long-running: renderer starts task, TaskRun handles progress presentation。
- main-initiated: main may enable task notify presentation。
- loading toast 应该可关闭。
- 关闭 toast 只影响展示，不取消 task run。
- cancel 必须是明确 action。
- `notify.loading` 不再作为长流程唯一状态源。
