# 03 Main Process Architecture

## Service

新增主进程服务：

```text
apps/desktop/src/main/services/task-run/
  service.ts
  ipc.ts
  runs/
    index.ts
    manager.ts
    context.ts
    controls.ts
    transitions.ts
    types.ts
  history/store.ts
  history/retention.ts
  notifications.ts
  rate.ts
  index.ts
```

`task-run/` 是一个 coupled module。`service.ts` 是 composition root，`runs/` 拥有 active run 运行态、上下文、控制请求和状态机，`history/store.ts` 拥有持久读写，`history/retention.ts` 拥有统一历史保留策略。

`runs/` 是真实子模块，因为它内部有多种强耦合职责：

- `manager.ts`: active run 生命周期、snapshot 更新、executor 包装。
- `context.ts`: `TaskRunContext`、checkpoint、取消/暂停等待。
- `controls.ts`: cancel/pause/resume 请求和控制能力变更。
- `transitions.ts`: 状态流转规则。
- `types.ts`: runs 子模块内部类型。
- `index.ts`: runs 子模块公共入口。

外部模块只通过 `service.runs` 使用 runs 子模块，不 import runs 内部文件。

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
service.runs.wait(runId)
service.runs.report(runId, update)
service.runs.updateControls(runId, controls)
service.runs.complete(runId, result)
service.runs.fail(runId, error)
service.runs.cancel(runId)
service.runs.pause(runId)
service.runs.resume(runId)

service.history.list(query)
service.history.clearCompleted()
service.history.prune()
```

避免把所有方法平铺在 `service.ts` 上。`service.ts` 只负责 init、dispose、IPC wiring 和子模块组合。

`service.runs` 是 runs 子模块 public API。取消、暂停、继续和 `updateControls` 都属于 active run 状态机，不暴露为 service 根级方法。

## Runs

`runs/manager.ts` 拥有 active runs，并通过 `context.ts`、`controls.ts` 和 `transitions.ts` 维护运行态。

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
- 调用 history store 写入关键快照。
- 推送 IPC。
- 响应 cancel/pause/resume。
- dispose 时取消所有 active runs。

不负责：

- 调用 scanner/ingest/extension 业务。
- 解释 output 的业务含义。
- 读取 command registry。
- 清理各业务模块自己的队列或锁。

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
- 不可中断阶段不等于不可取消。cancel 请求应把 run 标记为 `cancelling` 并触发 abort signal。
- 业务代码继续完成当前不可中断阶段，然后在下一个安全 checkpoint 抛出取消错误。
- 不要在 commit、DB transaction、文件替换等关键阶段假装已经停止。UI 可以显示“正在取消”，但真正结束必须发生在安全边界。
- `cancelable: false` 只用于完全不接受取消请求的 run 或 point-of-no-return 阶段，不作为普通不可抢占阶段的默认做法。

## Status transitions

允许状态流：

```text
queued -> running
queued -> cancelled

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
- 业务模块把 no-op 调度写成 `skipped` run。没有真正执行就不创建 run。

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

自动化历史、命令历史、扫描历史都从 `task_runs` 查询，不在各自模块复制完整结果。需要更长保留周期时，在 `history/retention.ts` 中按 `initiator`、`category` 或 `operation` 定义策略。

首版不提供 `task_run_events`。状态和完成详情以最新 snapshot 和 result 为准。

## IPC

`ipc.ts` 只注册 thin adapter：

```ts
export function registerTaskRunIpc(service: TaskRunService, ipc: IpcService): void {
  ipc.handle('task-run:list', async (_, query) => wrapIpc(() => service.history.list(query)))
  ipc.handle('task-run:get', async (_, runId) => wrapIpc(() => service.runs.get(runId)))
  ipc.handle('task-run:wait', async (_, runId) => wrapIpc(() => service.runs.wait(runId)))
  ipc.handle('task-run:cancel', async (_, runId) => wrapIpc(() => service.runs.cancel(runId)))
  ipc.handle('task-run:pause', async (_, runId) => wrapIpc(() => service.runs.pause(runId)))
  ipc.handle('task-run:resume', async (_, runId) => wrapIpc(() => service.runs.resume(runId)))
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
- 为 cancelable task 提供明确取消 action。
- 用户关闭 toast 时只关闭展示，不修改 task run。
- dispose 时关闭 active toast。

presentation 由创建 task run 时指定：

```ts
interface TaskRunPresentation {
  notify?: {
    enabled: boolean
    title?: string
    message?: string
    showProgress?: boolean
    showResult?: boolean
    closable?: boolean
  }
}
```

规则：

- renderer 用户显式启动且当前 UI 有明确上下文的动作，可以选择不自动 notify。
- main 启动、自动化、后台运行、窗口失焦流程可以启用 notify。
- loading toast 默认可关闭。
- 关闭 toast 不取消任务。
- cancel 必须是单独 action。
- notify 文案从 task run snapshot 派生，不能反向更新 task run。

旧 `CommandNotificationCoordinator` 的职责迁移到这里，并删除 command 专属通知协调。

## Error boundary

`TaskRunService` 捕获 executor 抛出的错误时：

- `TaskRunCancelledError` -> `cancelled`。
- 其他 error -> `failed`。

no-op、互斥跳过、自动化禁用、没有待处理项等情况不使用 `skipped` 状态。生产者应在创建 TaskRun 前完成判断；如果已经进入批量执行，则用 `completed` 加 `counters.skipped` 或 `warnings` 表达部分跳过。

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
6. 关闭 active notifications。

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

## Contract boundary

TaskRunService 面向主应用内部业务服务，输入默认是 trusted input，不建立独立 `validation.ts`。

规则：

- IPC handler 保持 thin adapter，不做 runtime shape parsing。
- `runs/` 内只保留维护状态机正确性所必需的断言，例如非法状态流转、final run 再写入 progress、非 pausable run 进入 paused。
- `history/store.ts` 负责持久化边界的大小限制，例如 result output 过大时摘要化或拒绝写入。
- 如果未来把 TaskRun 创建能力开放给扩展，应在 extension capability/provider 边界解析和校验扩展输入，再调用 TaskRunService。
- subject 不包含 renderer route；跳转由 renderer 根据 `subject.type + subject.id` 推导。
