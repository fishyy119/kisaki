# 03 Main Process Architecture

## Service

新增主进程服务：

```text
apps/desktop/src/main/services/task-run/
  service.ts
  ipc.ts
  runs/manager.ts
  history/store.ts
  history/retention.ts
  notifications.ts
  rate.ts
  context.ts
  validation.ts
  index.ts
```

`task-run/` 是一个 coupled module。`service.ts` 是 composition root，`runs/manager.ts` 拥有运行态，`history/store.ts` 拥有持久读写。

## Service identity

```ts
export class TaskRunService implements IService {
  readonly id = 'task-run'
  readonly deps = ['db', 'ipc', 'notify'] as const satisfies readonly ServiceName[]
}
```

说明：

- 需要 `db` 持久化完成历史。
- 需要 `ipc` 推送 snapshot 和注册 handler。
- 需要 `notify` 生成可选 toast presentation。
- 默认不依赖 `event`，除非后续确实需要低频 AppEvents。

`ServiceRegistry` 增加：

```ts
'task-run': TaskRunService
```

注册顺序上，`TaskRunService` 应在 `CommandService`、`AutomationService`、`ScannerService`、`ExtensionService` 之前可用。

## Public service API

`TaskRunService` 对业务服务暴露 namespace：

```ts
service.runs.create(input)
service.runs.run(input, executor)
service.runs.get(runId)
service.runs.report(runId, update)
service.runs.complete(runId, result)
service.runs.fail(runId, error)
service.controls.cancel(runId)
service.controls.pause(runId)
service.controls.resume(runId)
service.history.list(query)
```

避免把所有方法平铺在 `service.ts` 上。`service.ts` 只负责 init、dispose、IPC wiring 和子模块组合。

## Run manager

`TaskRunManager` 拥有 active runs 和控制器。

```ts
interface ActiveTaskRunRecord {
  run: TaskRun
  controller: AbortController
  pause: TaskPauseController
  promise?: Promise<TaskRunResult>
  notify?: TaskRunNotifyState
}
```

职责：

- 创建 run id。
- 保存 active snapshot。
- 执行 status transition。
- 调用 rate calculator。
- 通知 store 写入。
- 推送 IPC。
- 响应 cancel/pause/resume。
- dispose 时取消所有 active runs。

不负责：

- 调用 scanner/ingest/extension 业务。
- 解释 output 的业务含义。
- 读取 command registry。

## Context

业务代码拿到的上下文：

```ts
export interface TaskRunContext {
  readonly runId: string
  readonly signal: AbortSignal
  report(update: TaskRunProgressUpdate): void
  checkpoint(): Promise<void>
  throwIfCancelled(): void
}
```

`checkpoint()` 语义：

1. 如果 `signal.aborted`，抛出 `TaskRunCancelledError`。
2. 如果 run 处于 pause requested，状态变为 `paused`，等待 resume 或 cancel。
3. resume 后状态回到 `running`。
4. cancel 时从等待中释放并抛出取消错误。

使用规则：

- 长循环每次迭代或每批处理后调用。
- 文件写入、DB transaction、package commit 这种不可安全暂停的阶段不要调用 pause checkpoint。
- 可以在不可取消阶段继续响应 UI，但 `cancelable` 应根据 phase 调整为 false 或让 cancel 进入 requested 状态。

## Status transitions

允许状态流：

```text
queued -> running
queued -> cancelled
queued -> skipped

running -> pausing -> paused -> running
running -> cancelling -> cancelled
running -> completed
running -> failed

paused -> running
paused -> cancelling -> cancelled
```

禁止：

- final status 再回到 active。
- `failed` 后继续 report progress。
- 非 pausable run 进入 pausing/paused。

状态变更违反规则时，service 抛出稳定英文错误。

## Rate calculator

新增 `rate.ts`。

计算规则：

- 只对 `current` 递增的 progress 计算速度。
- 使用滑动窗口，默认 10 秒。
- `percent = current / total * 100`，无 total 时 undefined。
- `etaMs = (total - current) / rate * 1000`，无 total 或 rate <= 0 时 undefined。
- byte unit 的显示格式由 renderer utils 负责，main 只提供数值。

不要在业务服务里手写速度和 ETA。

## History store

`TaskRunHistoryStore` 负责 SQLite 读写。

写入策略：

- 创建 run 时插入 `task_runs`。
- active progress 高频变化不每次写 DB。
- status、phase、pause/resume/cancel、finish 时写 DB。
- finish 时写最终 snapshot 和 result。
- 应用退出时 best-effort flush active snapshot。

原因：

- 任务中心 active 状态由 main 内存 + IPC 保证。
- DB 是完成历史和恢复后的已知事实，不是高频 progress pipeline。

## IPC

`ipc.ts` 只注册 thin adapter：

```ts
export function registerTaskRunIpc(service: TaskRunService, ipc: IpcService): void {
  ipc.handle('task-run:list', async (_, query) => wrapIpc(() => service.history.list(query)))
  ipc.handle('task-run:get', async (_, runId) => wrapIpc(() => service.runs.get(runId)))
  ipc.handle('task-run:list-events', async (_, runId) =>
    wrapIpc(() => service.history.listEvents(runId))
  )
  ipc.handle('task-run:wait', async (_, runId) => wrapIpc(() => service.runs.wait(runId)))
  ipc.handle('task-run:cancel', async (_, runId) => wrapIpc(() => service.controls.cancel(runId)))
  ipc.handle('task-run:pause', async (_, runId) => wrapIpc(() => service.controls.pause(runId)))
  ipc.handle('task-run:resume', async (_, runId) => wrapIpc(() => service.controls.resume(runId)))
  ipc.handle('task-run:dismiss', async (_, runId) =>
    wrapIpcVoid(() => service.history.dismiss(runId))
  )
  ipc.handle('task-run:clear-completed', async () =>
    wrapIpcVoid(() => service.history.clearCompleted())
  )
}
```

IPC 中不做 runtime shape parsing、业务分支或通知。

## Notifications

新增 `TaskRunNotificationCoordinator`。

职责：

- 根据 task run presentation 创建 loading toast。
- 根据 progress 更新 toast message。
- 根据 final result 更新为 success/warning/error/info。
- 为 cancelable task 提供取消 action。
- dispose 时 dismiss active toast。

presentation 由创建 task run 时指定：

```ts
interface TaskRunPresentation {
  notify?: {
    enabled: boolean
    title?: string
    message?: string
    showProgress?: boolean
    showResult?: boolean
  }
}
```

规则：

- renderer 用户显式启动且当前 UI 有明确上下文的动作，可以选择不自动 notify。
- main 启动、自动化、后台运行、窗口失焦流程可以启用 notify。
- notify 文案从 task run snapshot 派生，不能反向更新 task run。

旧 `CommandNotificationCoordinator` 的职责迁移到这里，并删除 command 专属通知协调。

## Error boundary

`TaskRunService` 捕获 executor 抛出的错误时：

- `TaskRunCancelledError` -> `cancelled`。
- `TaskRunSkippedError` -> `skipped`。
- 其他 error -> `failed`。

错误 message：

- result.error 使用安全英文或业务层提供的安全中文摘要。
- main logger 记录完整 error。
- 不把 raw library error 直接暴露到 IPC 以外的新公共合同中。

## Logging

使用：

```ts
const log = createLogger('TaskRun')
```

记录：

- run created/started/finished。
- cancel/pause/resume request。
- unexpected transition failure。
- persistence failure。
- notification action failure。

不记录：

- 每次 progress。
- 完整 output。
- 用户私密正文、HTTP body、大数组或完整 DB row。

## Disposal

`dispose()` 行为：

1. 标记 service disposing。
2. 对所有 active runs 调用 cancel。
3. 等待短时间 best-effort settle。
4. 将仍未结束的 active runs 标记为 cancelled，error 为 `Application is shutting down.`。
5. flush store。
6. dismiss notifications。

不要让 app quit 被长任务无限阻塞。

## Bootstrap

主进程注册顺序目标：

```text
IpcService
EventService
WindowService
NotifyService
DbService
TaskRunService
UpdaterService
NetworkService
CommandService
AutomationService
...
ScannerService
ExtensionService
```

`TaskRunService` 必须在需要创建 task run 的服务之前初始化。

## Validation

运行时接受来自业务服务的 trusted input，但仍应在 domain layer enforce invariant：

- title trim 后不能为空。
- `current`、`total` 非负有限数。
- `phase` 长度限制。
- `message` 长度限制。
- `output` JSON serializable 且大小受限。
- target.route 必须是 app 内部 route path。

这些检查放在 `task-run/validation.ts` 或 manager 内，不放在 IPC handler。
