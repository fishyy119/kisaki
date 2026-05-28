# 04 Producer Adapters

## 总规则

接入任务中心的模块都遵循同一模式：

```ts
const run = taskRun.runs.create(input)
try {
  await doBusinessWork(run.context)
  run.complete(result)
} catch (error) {
  run.finishFromError(error)
}
```

或者使用 helper：

```ts
await taskRun.runs.run(input, async (context) => {
  await doBusinessWork(context)
  return result
})
```

生产者只负责：

- 提供 title、kind、origin、target、controls。
- 在安全边界 report/checkpoint。
- 生成业务结果。

生产者不负责：

- 计算速度和 ETA。
- 推送 renderer IPC。
- 持久化 task run 表。
- 管理 task center UI。
- 直接更新 toast。

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
   - `kind: 'command'`
   - `title: command.descriptor.title`
   - `origin` from request source。
   - `target: { type: 'command', id: command.id, label: command.title }`
   - controls from descriptor。
4. execute command with task run context。
5. map output to command result and task run result。

`CommandExecutions.cancel(executionId)` delegates to `taskRun.controls.cancel(executionId)`。

`getProgress(executionId)` reads task run progress.

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
AutomationRunRecord
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

Automation 是持久配置，不是运行实例。

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
- automation history 只保留 automation attempt 与 linked `runId`。

### Run record

```ts
export interface AutomationRunRecord {
  id: string
  automationId: string
  runId: string
  commandId: string
  startedAt: number
  finishedAt: number
  status: 'success' | 'failed' | 'cancelled' | 'skipped'
  attempt: number
  trigger: 'manual' | 'startup' | 'cron'
  error?: string
}
```

不要复制 command output 到 automation history。完整结果在 task run result 中。

### Runner

`AutomationRunner` 不维护自己的 progress。它只维护 automationId -> runId，用于取消。

取消：

```text
automation:cancel -> taskRun.controls.cancel(runId)
```

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
  kind: 'scanner',
  title: `扫描 ${scanner.name}`,
  origin: { kind: 'user' | 'system' },
  target: { type: 'scanner', id: scanner.id, label: scanner.name, route: '/scanner' },
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

Scanner 列表根据 `target.type === 'scanner' && target.id === scanner.id` 查找 active task run。

跳过和失败明细：

- active 时从 task run result draft 或 scanner-specific output 获取。
- completed 后从 task run result 查看。

若明细很大，不放进 progress；完成时保存有限摘要和失败列表上限。

## Ingest batch flows

### 目标

批量元数据更新、批量添加、批量删除等长流程迁到 main process use case。

Renderer 不再：

- 循环调用 search/update IPC。
- 手写 `notify.loading`。
- 在组件中保存失败列表。

Renderer 改为：

1. 收集用户参数。
2. 调用 main IPC 启动 batch task。
3. 关闭 dialog 或保持轻量 pending UI。
4. 任务中心展示进度和结果。

### IPC examples

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

| 当前 phase     | TaskRun phase | 可取消 |
| -------------- | ------------- | ------ |
| `queued`       | `queued`      | yes    |
| `waiting-lock` | `waitingLock` | yes    |
| `download`     | `download`    | yes    |
| `verify`       | `verify`      | yes    |
| `extract`      | `extract`     | yes    |
| `commit`       | `commit`      | no     |
| `finished`     | final status  | no     |

进入 commit 阶段后：

- `controls.cancelable` 更新为 false。
- UI 取消按钮禁用或显示“提交阶段无法取消”。

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

- `updater:check-for-updates` 若可能耗时，创建 `kind: 'updater'` task run。
- `updater:download-update` 必须创建 task run，并用 byte progress。
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

## Notify migration

保留 notify API 用于短反馈：

- 保存成功。
- 删除失败。
- 用户确认结果。
- 非长时的一次性提示。

迁移到 task run：

- 批量元数据更新 loading toast。
- 添加/识别长流程 loading toast。
- 扫描进度。
- 扩展安装/更新 loading 状态。
- 自动化运行中状态。
- 命令执行进度。

规则：

- renderer-initiated but long-running: renderer starts task, TaskRun handles progress presentation。
- main-initiated: main may enable task notify presentation。
- `notify.loading` 不再作为长流程唯一状态源。
