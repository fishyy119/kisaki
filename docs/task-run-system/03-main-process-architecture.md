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

- `manager.ts`: active run 生命周期和 snapshot 更新。
- `context.ts`: `TaskRunContext`、checkpoint、取消/暂停等待。
- `controls.ts`: cancel/pause/resume 请求和控制能力变更。
- `transitions.ts`: 状态流转规则。
- `types.ts`: `TaskRunHandle` 和 runs 子模块内部类型。
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

注册顺序上，`TaskRunService` 应在所有会创建 task run 的 handler、use case 和 service 启动前可用。`CommandService` 本体不依赖 `TaskRunService`；只有被 command handler 调用的真实 producer 或 scoped extension task-run API 需要它。

## Public service API

`TaskRunService` 对业务服务暴露 namespace：

```ts
service.runs.create(input)
service.runs.list(query)
service.runs.get(runId)
service.runs.wait(runId)
service.runs.cancel(runId)
service.runs.pause(runId)
service.runs.resume(runId)

service.history.get(runId)
service.history.list(query)
service.history.clearCompleted()
service.history.prune()
```

避免把所有方法平铺在 `service.ts` 上。`service.ts` 只负责 init、dispose、IPC wiring 和子模块组合。

`service.runs` 是 runs 子模块 public API。取消、暂停、继续、list/get/wait 和 `updateControls` 都属于 active run 状态机的读写入口，不暴露为 service 根级方法。

`service.runs.list(query)` 只读取 active map，并按 query 过滤、排序和 limit。它是 `task-run:list-active`、任务中心进行中 tab 和 scanner 页面 active 状态投影的读取入口，不读取 `task_run_history`。

`service.history.list(query)` 只返回 persisted final rows，并按 query 过滤、排序和 limit。它是 `task-run:list-history`、任务中心已完成 tab 和 scanner 历史的读取入口，不返回 active runs。

`service.runs.get(runId)` 只读取 active run。`service.history.get(runId)` 只读取 completed/final history。服务层不提供跨 active/history 的 `snapshots` facade。

`service.runs.wait(runId)` 只等待 active run 的 final snapshot。若 run 已经不在 active map，调用方应读取 `service.history.get(runId)`。未知 run 抛出稳定英文错误。

`TaskRunService` 不提供 `run(input, executor)` 作为公共 API。它不接收业务 executor，不调度业务流程，也不替生产者包 try/catch。业务函数显式创建 run、上报进度、调用 checkpoint 并提交最终结果。

推荐调用形态：

```ts
const run = taskRun.runs.create(input)
const context = run.context

try {
  run.start()
  context.report({ phase: 'searching', indeterminate: true })

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

`create()` 返回的 `TaskRunHandle` 是创建者持有的生命周期 owner；`run.context` 是传给业务执行代码的执行期 capability。契约定义见 `02-domain-model-and-contracts.md`，本文件只描述主进程实现结构。

## Runs

`runs/manager.ts` 拥有 active runs，并通过 `context.ts`、`controls.ts` 和 `transitions.ts` 维护运行态。

```ts
interface ActiveTaskRunRecord {
  run: TaskRun
  controller: AbortController
  pause: TaskPauseController
  waiters: TaskRunWaiter[]
  notify?: TaskRunNotifyState
}
```

职责：

- 创建 run id。
- 保存 active snapshot。
- 执行 status transition。
- 调用 rate calculator。
- final snapshot 写入 history store。
- 合并和推送 IPC snapshot。
- 响应 cancel/pause/resume。
- `get`、`wait` 和 `list` 读取 active map。
- dispose 时取消所有 active runs。

不负责：

- 调用 scanner/ingest/extension 业务。
- 解释 output 的业务含义。
- 读取 command registry。
- 清理各业务模块自己的队列或锁。
- 包装业务 executor。

## Context

业务代码拿到的上下文是 `TaskRunContext`，契约定义见 `02-domain-model-and-contracts.md`。`TaskRunContext` 暴露 report、checkpoint 和 cancel signal，不暴露 complete/fail。

`checkpoint()` 语义：

1. 如果 `signal.aborted`，抛出 `TaskRunCancellation`。
2. 如果 run 处于 pause requested，状态变为 `paused`，等待 resume 或 cancel。
3. resume 后状态回到 `running`。
4. cancel 时从等待中释放并抛出取消信号。

使用规则：

- 长循环每次迭代或每批处理后调用。
- 文件写入、DB transaction、package commit 这种不可安全暂停的阶段不要调用 pause checkpoint。
- 不可中断阶段不等于不可取消。cancel 请求应把 run 标记为 `cancelling` 并触发 abort signal。
- 业务代码继续完成当前不可中断阶段，然后在下一个安全 checkpoint 收到取消信号。
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

## IPC snapshot coalescing

`task-run:changed` 每次对 renderer 可见的 payload 都是完整 snapshot，但 high-frequency progress report 必须在 main process 内合并和节流。

规则：

- `queued`、`running` start、pause/resume/cancel request、controls change、final snapshot 必须立即 flush。
- progress-only updates 使用每个 run 独立的 latest-snapshot buffer，默认每 100ms flush 一次。
- 如果 progress update 距上次 flush 超过 250ms，立即 flush，避免长时间没有 UI 反馈。
- final snapshot flush 前必须先清空该 run 的 pending progress buffer，保证 renderer 不会在 final 之后收到旧 progress。
- `task-run:wait` 和 `task-run:get-active` 读取当前内存 snapshot，不等待 IPC 节流。
- DB 写入策略不受 IPC 节流影响；只有 final snapshot 进入 history store。

## Rate calculator

新增 `rate.ts`。

计算规则：

- 只对 `current` 递增的 progress 计算速度。
- 使用滑动窗口，默认 10 秒。
- `percent = current / total * 100`，无 total 时 undefined。
- `etaMs = (total - current) / rate * 1000`，无 total 或 rate <= 0 时 undefined。
- byte unit 的显示格式由 renderer utils 负责，main 只提供数值。
- 当 `phase` 或 `unit` 改变、`current` 回退、`total` 明显变化时重置窗口。
- `counters` 和 `warnings` 只随 snapshot 传递，不参与速度、百分比和 ETA 计算。

不要在业务服务里手写速度和 ETA。

## History store

`TaskRunHistoryStore` 负责 SQLite completed history 读写。active TaskRun 不写入 DB，active snapshot 的唯一事实源是 `runs/manager.ts` 内存状态。

初始化：

- `TaskRunService.init()` 初始化空 active map，再开放 IPC 和 producer 创建入口。
- 不做 `markStaleActiveRuns()`，因为 DB 不保存 active rows。
- 上一进程异常退出时，未完成的 in-memory active runs 直接消失，不生成 synthetic failed history。
- 因为 DB 只保存 final rows，重启后不会从 DB 恢复出 `queued`、`running`、`pausing`、`paused` 或 `cancelling` 假状态。

写入策略：

- 创建、start、pause/resume/cancel request 和 progress report 不写 DB。
- finish 时写入最终 snapshot 和 result。
- graceful shutdown 时可以 best-effort 取消 active runs 并写入 final `cancelled` history；如果进程异常退出或 flush 失败，不补写历史。

原因：

- 任务中心 active 状态由 `runs.list/get/wait`、main 内存和 IPC 保证。
- DB 是完成历史，不是运行态恢复日志，也不是高频 progress pipeline。
- 若未来需要 crash audit，应单独设计 process/session diagnostic，不把 active TaskRun 写入 `task_run_history`。
- 允许 `task_run_history` 参与现有 SQLite `db.*` trigger 事件。这些通用 DB 事件不是 TaskRun lifecycle/progress contract，任务中心和 task-run store 不订阅它们作为状态源。

`TaskRunHistoryStore` 只保存 TaskRun final history。自动化历史由 AutomationService 的 `automation_run_history` 保存 command invocation 级别记录，不保存 run id，也不链接 TaskRun；CommandService 不保存历史；scanner 等真实长任务历史仍从 `task_run_history` 查询。需要更长保留周期时，在各自 owner 的 retention policy 中配置。

首版不提供 `task_run_events`。状态和完成详情以最新 snapshot 和 result 为准。

## IPC

`ipc.ts` 只注册 thin adapter：

```ts
export function registerTaskRunIpc(service: TaskRunService, ipc: IpcService): void {
  ipc.handle('task-run:list-active', async (_, query) => wrapIpc(() => service.runs.list(query)))
  ipc.handle('task-run:list-history', async (_, query) =>
    wrapIpc(() => service.history.list(query))
  )
  ipc.handle('task-run:get-active', async (_, runId) => wrapIpc(() => service.runs.get(runId)))
  ipc.handle('task-run:get-history', async (_, runId) => wrapIpc(() => service.history.get(runId)))
  ipc.handle('task-run:wait', async (_, runId) => wrapIpc(() => service.runs.wait(runId)))
  ipc.handle('task-run:cancel', async (_, runId) => wrapIpc(() => service.runs.cancel(runId)))
  ipc.handle('task-run:pause', async (_, runId) => wrapIpc(() => service.runs.pause(runId)))
  ipc.handle('task-run:resume', async (_, runId) => wrapIpc(() => service.runs.resume(runId)))
  ipc.handle('task-run:clear-completed', async () =>
    wrapIpcVoid(() => service.history.clearCompleted())
  )
}
```

IPC 中不做 runtime shape parsing、业务分支、跨 active/history 合并查询或通知。

## Notifications

新增 `TaskRunNotificationCoordinator`。

职责：

- 根据 task run presentation 创建 loading toast。
- 根据 progress 更新 toast message。
- 根据 final result 更新为 success/warning/error/info。
- 为 cancelable task 提供明确取消 action。
- 用户关闭 toast 时只关闭展示，不修改 task run。
- 记录用户关闭过的 run id，后续 progress update 不重新创建 loading toast。
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
- 如果 `showResult === true`，final result 可以在用户关闭 loading toast 后再次展示一次结果 toast；否则尊重关闭状态。
- Notify contract 增加 `NotifyOptions.closable?: boolean`，loading toast 默认 `closable: true`。
- NotifyService `show/update` 接收 callback bag：`{ actions?: NotifyActionHandlers; onClose?: () => void }`。
- renderer 在用户点击 close button 或手动 dismiss toast 时发送 `notify:closed`，payload 为 `{ toastId, reason: 'user' }`。main 调用对应 `onClose`。
- main 通过 `notify:dismiss` 程序化关闭 toast 时不回发 `notify:closed`，避免 close callback 被 dispose/final update 误触发。
- close callback 必须只更新 notification coordinator 的 presentation 状态，不触发 task cancel。

旧 `CommandNotificationCoordinator` 的职责迁移到这里，并删除 command 专属通知协调。

## Error mapping

`TaskRunService` 不捕获业务 executor 抛出的错误，因为它不执行业务 executor。

生产者 catch 错误后必须显式区分取消和失败：

- `TaskRunCancellation` -> `cancelled`。
- 其他 error -> `failed`。

`TaskRunCancellation` 是运行时控制流 sentinel，不是 task run error。它只用于从深层业务调用栈退出；最终 snapshot 写 `status: 'cancelled'`，不写 `result.error`，也不作为失败日志记录。

推荐形态：

```ts
try {
  await doBusinessWork(context)
  run.complete(result)
} catch (error) {
  if (isTaskRunCancellation(error)) {
    run.cancel()
  } else {
    run.fail(error)
  }
}
```

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

异常退出恢复不在 `dispose()` 中完成。DB 不保存 active rows，因此下一次启动不会从 DB 恢复 running/paused 假状态；未完成的内存任务没有 final history。

## Bootstrap

主进程注册顺序目标：

```text
IpcService
EventService
WindowService
NotifyService
DbService
NetworkService
TaskRunService
UpdaterService
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
- `history/store.ts` 负责持久化边界保护，例如拒绝写入无法安全序列化或明显超限的 result output；具体上限是 store/serializer 私有实现常量，不进入 shared contract。
- 扩展通过 `kisaki.taskRuns` scoped capability 创建自己的 task run；extension capability/provider 边界解析和校验扩展输入，再调用 TaskRunService。
- extension task-run provider 的文件、RPC、SDK bridge、owner scoping、extension-local operation name 校验、内部 operation 映射、initiator 派生和 Bangumi 迁移见 [07-extension-api-and-bangumi-refactor.md](07-extension-api-and-bangumi-refactor.md)。
- subject 不包含 renderer route；跳转由 renderer 根据 `subject.type + subject.id` 推导。
