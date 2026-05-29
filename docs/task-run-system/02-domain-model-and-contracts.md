# 02 Domain Model And Contracts

## 术语

| 术语           | 含义                                                      |
| -------------- | --------------------------------------------------------- |
| `TaskRun`      | 一次长时执行实例，也是进度、结果和完成历史的唯一事实源。  |
| `Category`     | 任务所属的大类，用于 UI 分组、筛选和图标。                |
| `Operation`    | 稳定的操作标识，描述这次任务具体在做什么。                |
| `Initiator`    | 谁启动了任务，例如 user、automation、extension、system。  |
| `Subject`      | 任务主要关联的业务对象，用于展示、过滤和跳转。            |
| `Progress`     | 当前阶段和度量快照。                                      |
| `Result`       | 完成后的输出、摘要、错误和计数。                          |
| `Control`      | 取消、暂停、继续、重试等用户可操作能力。                  |
| `Checkpoint`   | 任务代码可安全响应取消或暂停的协作式边界。                |
| `Presentation` | 由 TaskRun 派生出的可选展示，例如 toast，不拥有任务状态。 |

## Shared contract 文件

新增：

```text
apps/desktop/src/shared/task-run.ts
```

此文件只包含跨进程共享的纯类型、常量和小型纯 helper。不要 import main、renderer、Electron、Drizzle 或 logger。

放入 shared：

- `TaskRun`
- `TaskRunProgress`
- `TaskRunProgressUpdate`
- `TaskRunResult`
- `TaskRunControls`
- `TaskRunPresentation`
- `TaskRunStartResult`
- `TaskRunListQuery`

不放入 shared：

- `TaskRunHandle`
- `TaskRunContext`
- `TaskRunCancellation`
- active run、pause controller、waiter 等 main 内部运行态类型

## Category and operation

`category` 只表达任务所属大类。它不是执行语义，不承载自动化来源，也不区分具体 use case。

```ts
export type TaskRunCategory = 'command' | 'scanner' | 'ingest' | 'extension' | 'updater' | 'system'
```

`operation` 是稳定的点分操作标识，描述这次任务具体做什么。它必须覆盖所有进入任务中心的长流程，避免不同 producer 私造相近字符串。

```ts
export type TaskRunContentEntity = 'game' | 'person' | 'company' | 'character'

export type TaskRunOperation =
  | 'command.execute'
  | 'scanner.scan'
  | `ingest.${TaskRunContentEntity}.add`
  | `ingest.${TaskRunContentEntity}.update`
  | `ingest.${TaskRunContentEntity}.batchAdd`
  | `ingest.${TaskRunContentEntity}.batchUpdate`
  | `ingest.${TaskRunContentEntity}.batchDelete`
  | 'extension.package.install'
  | 'extension.package.update'
  | 'extension.package.import'
  | 'extension.package.uninstall'
  | 'extension.repository.refresh'
  | 'extension.repository.refreshAll'
  | 'updater.check'
  | 'updater.download'
  | 'system.maintenance'
```

规则：

- `automation` 不是 category，也不是 operation。自动化是启动来源，写入 `initiator`。
- UI 图标、分组和过滤优先使用 `category`。
- 业务结果解释优先使用 `operation`。
- 新 use case 增加新的 operation，不复用模糊字符串。
- operation 使用稳定英文标识，不使用展示文案。
- ingest operation 使用实体维度和动作维度组合；单项、批量添加、批量更新、批量删除都必须能被明确区分。
- 扩展仓库刷新和扩展包安装更新不是同一个 operation。

## Status

```ts
export type TaskRunStatus =
  | 'queued'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type TaskRunFinalStatus = 'completed' | 'failed' | 'cancelled'
```

规则：

- 不提供 `skipped` 作为 TaskRun 状态。
- 调度器发现自动化禁用、互斥、条件不满足时，不创建 TaskRun。
- 批量任务内部跳过项目时，用 `result.counters.skipped` 或 `warnings` 表达。
- 已创建的 TaskRun 必须进入 `completed`、`failed` 或 `cancelled` 之一。

## Initiator

`initiator` 描述谁启动了任务。它是自动化历史、扩展归属和权限边界的来源。

```ts
export type TaskRunAutomationTrigger = 'manual' | 'startup' | 'cron'

export type TaskRunSystemReason = 'startup' | 'maintenance' | 'update' | 'shutdown'

export type TaskRunInitiator =
  | {
      type: 'user'
    }
  | {
      type: 'automation'
      automation: {
        id: string
        nameSnapshot: string
        trigger: TaskRunAutomationTrigger
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
      reason?: TaskRunSystemReason
    }
```

规则：

- 使用 discriminated union，不把 automation、extension、command 相关字段平铺在顶层。
- 自动化运行历史不使用独立结果表；它是 `task_runs` 中 `initiator.type === 'automation'` 的查询视图。
- `automation.nameSnapshot` 是展示快照，自动化改名后旧 run 不回写。
- `automation.attempt` 只用于同一次自动化触发的重试序号。
- `commandId` 不属于 initiator。执行哪个 command 由 `operation: 'command.execute'` 和 `subject` 表达。
- 用户点击扩展贡献的 command 时，initiator 仍然是 `user`；只有扩展运行时主动启动的任务才使用 `type: 'extension'`。

## Subject

`subject` 是任务主要关联的业务对象。它用于任务中心显示、搜索、过滤和跳转。

```ts
export type TaskRunSubjectType =
  | 'command'
  | 'automation'
  | 'scanner'
  | 'game'
  | 'person'
  | 'company'
  | 'character'
  | 'extension'
  | 'repository'
  | 'app'

export interface TaskRunSubject {
  type: TaskRunSubjectType
  id?: string
  labelSnapshot?: string
}
```

规则：

- `subject` 是可选字段。没有明确主对象的任务可以不填。
- `id` 是业务 id，不是展示文案。
- `labelSnapshot` 是快照文案，可能过期，只用于任务中心显示和搜索。
- 不提供 `route`。renderer 根据 `subject.type + subject.id` 推导跳转，避免 shared contract 绑定 renderer route。
- 不在 `subject` 中放完整实体对象、批量实体列表或结果明细。
- 批量任务的多实体明细进入 `result.output` 的有限摘要。

## Progress

```ts
export interface TaskRunWarning {
  code?: string
  message: string
}

export type TaskRunProgressUnit =
  | 'item'
  | 'file'
  | 'byte'
  | 'entity'
  | 'step'
  | 'package'
  | 'request'

export interface TaskRunProgressUpdate {
  phase?: string
  message?: string
  current?: number
  total?: number
  unit?: TaskRunProgressUnit
  indeterminate?: boolean
  counters?: Record<string, number>
  warnings?: readonly TaskRunWarning[]
}

export interface TaskRunProgress extends TaskRunProgressUpdate {
  updatedAt: number
  rate?: number
  rateWindowMs?: number
  etaMs?: number
  percent?: number
}
```

规则：

- `phase` 使用稳定英文枚举值，例如 `searching`、`writing`、`download`、`commit`。
- `message` 是短展示文案，可以是中文。
- `current` 和 `total` 必须是非负有限数。
- `current > total` 时 service 可以保留原值，但 `percent` 上限为 100。
- `rate`、`etaMs`、`percent` 由 `TaskRunService` 计算，生产者不直接写。
- 不知道总量时设置 `indeterminate: true`。
- `unit` 用于 UI 显示速度，例如 `12 items/s`、`3.4 MB/s`。
- `counters` 是 active run 的有限汇总，例如 `succeeded`、`failed`、`skipped`、`warnings`，用于 scanner、batch ingest、extension install 等 live summary。
- `warnings` 是 active run 的有限展示摘要，不是完整错误明细；service 必须按条数和序列化大小限制。
- 完成后的权威摘要仍然写入 `result.counters` 和 `result.warnings`。最后一条 progress 不能被当作 result。
- 不把逐项明细、大失败列表或完整业务对象放进 progress；这些内容只进入 result 的有限摘要或 main logger。
- 当 `phase` 或 `unit` 改变、`current` 回退、`total` 明显变化时，rate calculator 必须重置窗口，避免跨阶段速度污染。

## Result

```ts
export interface TaskRunResult {
  status: TaskRunFinalStatus
  title?: string
  summary?: string
  output?: unknown
  error?: string
  counters?: Record<string, number>
  warnings?: readonly TaskRunWarning[]
}
```

规则：

- 对 final snapshot，`TaskRun.status` 与 `TaskRun.result.status` 必须一致。
- producer 不通过 lifecycle API 传入 result status；最终 status 由 `complete()`、`fail()` 或 `cancel()` 写入，避免 status 双写冲突。
- `error` 必须是安全、适合展示的摘要。
- 详细错误对象只写 main logger。
- `output` 必须 JSON serializable。
- 大输出需要摘要化；默认存储大小上限由 `TaskRunStore` 控制。
- `warnings` 用于部分成功、跳过、降级等情况。
- `counters.skipped` 可以表达批量任务内部跳过数量，但不改变 run final status。

## Controls

```ts
export interface TaskRunControls {
  cancelable: boolean
  pausable: boolean
  retryable: boolean
}
```

显示规则：

- `cancelable && active` 显示取消。
- `pausable && status === 'running'` 显示暂停。
- `pausable && status === 'paused'` 显示继续。
- `retryable && final` 可以显示重跑，但重跑由生产者 adapter 决定。

语义规则：

- `cancelable` 表示 run 接受取消请求，不表示当前代码能被立即抢占。
- cancel 请求会让 run 进入 `cancelling` 并触发 abort signal。
- 业务代码在下一个安全 checkpoint 收到取消信号，最终进入 `cancelled`。
- 暂停/继续是能力声明，不是强制保证。任务代码必须在 checkpoint 响应暂停。

## Producer contracts

以下类型是主进程内部生产者契约，不属于 renderer IPC contract。它们由
`apps/desktop/src/main/services/task-run/runs/` 实现，供 scanner、ingest、extension package、
updater、command handler 等业务代码使用。

目标文件：

```text
apps/desktop/src/main/services/task-run/runs/context.ts
apps/desktop/src/main/services/task-run/runs/errors.ts
apps/desktop/src/main/services/task-run/runs/types.ts
apps/desktop/src/main/services/task-run/runs/index.ts
```

```ts
export interface TaskRunContext {
  readonly runId: string
  readonly signal: AbortSignal
  report(update: TaskRunProgressUpdate): void
  checkpoint(): Promise<void>
  throwIfCancelled(): void
}

export class TaskRunCancellation extends Error {
  readonly name = 'TaskRunCancellation'
}

export function isTaskRunCancellation(error: unknown): error is TaskRunCancellation

export interface TaskRunHandle {
  readonly id: string
  readonly createdAt: number
  readonly context: TaskRunContext
  start(): void
  updateControls(controls: Partial<TaskRunControls>): void
  complete(result?: Omit<TaskRunResult, 'status' | 'error'>): void
  fail(error: unknown, result?: Omit<TaskRunResult, 'status' | 'error'>): void
  cancel(result?: Omit<TaskRunResult, 'status'>): void
}
```

规则：

- `TaskRunHandle` 是创建者持有的生命周期 owner，用于 start、controls、complete、fail 和 cancel。
- `TaskRunService` 不接收业务 executor，因此不会把 handle 注入回调；生产者通过 `runs.create(input)` 显式取得 handle。
- `TaskRunContext` 是执行期 capability，用于 report、checkpoint、abort signal 和取消检查。
- 下游业务函数优先只接收 `TaskRunContext`，避免获得 complete/fail run 的能力。
- `report` 只存在于 `TaskRunContext`，不在 `TaskRunHandle` 顶层重复暴露。
- renderer 和 IPC 不暴露 `TaskRunHandle`。
- extension public API 不暴露 main 内部 `TaskRunHandle`，只暴露受作用域限制的 facade，见 Extension API Policy。
- `complete()` 只能产生 `completed`，不能接收 `failed` 或 `cancelled` result。
- `fail()` 只能产生 `failed`，并由 service 把 `error` 规范化为安全摘要。
- `cancel()` 只能产生 `cancelled`，用于 producer 已确认取消后的显式收尾。
- 不提供 generic `finish(result)`。如果 adapter 已经拥有 final status，必须显式 switch 到 `complete()`、`fail()` 或 `cancel()`。
- 不提供 `finishFromError()`。producer 的 catch 边界必须显式判断 `isTaskRunCancellation(error)`，取消信号调用 `cancel()`，真正错误调用 `fail()`。
- `TaskRunCancellation` 是协作式取消的控制流 sentinel，不是业务错误，不写入 `result.error`，也不按 failure 记录日志。

## Presentation

notify 是 TaskRun 的可选展示层，不是状态源。

```ts
export interface TaskRunPresentation {
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

- loading toast 默认应可关闭。
- 关闭 toast 只关闭展示，不取消任务。
- 取消任务必须通过明确的 cancel action。
- toast 文案从 TaskRun snapshot 派生，不能反向更新 TaskRun。

## Snapshot

```ts
export interface TaskRun {
  id: string
  category: TaskRunCategory
  operation: TaskRunOperation
  title: string
  description?: string
  status: TaskRunStatus
  initiator: TaskRunInitiator
  subject?: TaskRunSubject
  controls: TaskRunControls
  progress?: TaskRunProgress
  result?: TaskRunResult
  createdAt: number
  startedAt?: number
  updatedAt: number
  finishedAt?: number
}
```

规则：

- `id` 由 main 生成，renderer 不生成 task run id。
- `title` 是短文本，不含动态大段内容。
- `description` 用于任务详情，不用于每帧变化。
- 不提供 `dismissedAt`。忽略、已读、红点等 UI 状态不进入核心运行模型。
- `updatedAt` 每次 snapshot 更新都变化。
- final snapshot 必须同时拥有 `finishedAt` 和 `result`。
- final snapshot 的 `status` 必须等于 `result.status`。

## Start result

启动长时流程的 IPC 不应等待任务完成，默认只返回 run id。

```ts
export interface TaskRunStartResult {
  runId: string
  createdAt: number
}
```

如果调用方确实需要等待完成，应使用 `task-run:wait`。普通 UI workflow 优先使用 task center 观察状态。

规则：

- `TaskRunStartResult` 不返回 `startedAt`，因为 run 可能刚创建仍处于 `queued`。
- 需要展示开始时间时，renderer 从 `task-run:changed` 或 `task-run:get` 的 snapshot 读取 `startedAt`。

## History model

`task_runs` 是唯一持久历史表。

自动化历史、命令历史、扫描完成记录和扩展包操作历史都应该从 `task_runs` 查询或投影，不复制完整 output 到各自模块。

规则：

- 自动化历史查询 `initiator.type === 'automation'` 和 `initiator.automation.id`。
- 命令历史查询 `category === 'command'` 或 `subject.type === 'command'`。
- 扫描历史查询 `operation === 'scanner.scan'` 和 `subject.type === 'scanner'`。
- task run 被 retention 删除后，对应历史记录也不再存在；不会出现 automation history 指向已删除 result 的悬空状态。
- 如果某类历史需要更长保留周期，通过 `TaskRunStore` retention policy 配置，不新增第二份结果事实源。

首版不建立 `task_run_events` 表。完成详情展示当前 snapshot、result、counters、warnings 和 error。若后续需要时间线，再单独设计低频 timeline 表，但 timeline 不能成为状态事实源。

## DB Schema

新增表：

```text
task_runs
```

建议字段：

```ts
export const taskRuns = sqliteTable('task_runs', {
  id: text('id').primaryKey(),
  category: taskRunCategory('category').notNull(),
  operation: taskRunOperation('operation').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: taskRunStatus('status').notNull(),
  initiator: taskRunInitiator('initiator').notNull(),
  subject: taskRunSubject('subject'),
  controls: taskRunControls('controls').notNull(),
  progress: taskRunProgress('progress'),
  result: taskRunResult('result'),
  createdAt: integer('created_at').notNull(),
  startedAt: integer('started_at'),
  updatedAt: integer('updated_at').notNull(),
  finishedAt: integer('finished_at')
})
```

Indexes:

```text
idx_task_runs_status_updated_at
idx_task_runs_category_updated_at
idx_task_runs_operation_updated_at
idx_task_runs_finished_at
```

JSON 字段索引按实际查询成本再加，不在首版预设复杂 expression index。

Retention:

- active runs 永不裁剪。
- 默认 completed runs 保留最近 500 条或 30 天，取较宽者。
- automation-initiated runs 可以配置更长策略，例如每个 automation 最近 50 条或 90 天。
- 清理历史必须走 `TaskRunStore` retention，不允许各业务模块自行删除 task run。
- 删除 task run 就是删除对应历史事实，不保留孤立 history row。

不需要 SQLite trigger 投影 AppEvents；任务中心 store 使用专用 IPC 初始化和订阅。

## IPC Contracts

在 `apps/desktop/src/shared/ipc.ts` 中新增：

```ts
interface IpcMainHandlers {
  'task-run:list': (query?: TaskRunListQuery) => IpcResult<TaskRun[]>
  'task-run:get': (runId: string) => IpcResult<TaskRun | null>
  'task-run:wait': (runId: string) => IpcResult<TaskRun>
  'task-run:cancel': (runId: string) => IpcResult<boolean>
  'task-run:pause': (runId: string) => IpcResult<boolean>
  'task-run:resume': (runId: string) => IpcResult<boolean>
  'task-run:clear-completed': () => IpcVoidResult
}

interface IpcRendererEvents {
  'task-run:changed': [run: TaskRun]
  'task-run:deleted': [{ runId: string }]
}
```

`task-run:changed` 每次发送完整 snapshot。renderer store 用 `run.id` 替换。

List query:

```ts
export interface TaskRunListQuery {
  status?: 'active' | 'completed' | 'all'
  categories?: TaskRunCategory[]
  operations?: TaskRunOperation[]
  initiatorTypes?: TaskRunInitiator['type'][]
  automationId?: string
  extensionId?: string
  subject?: {
    type: TaskRunSubjectType
    id?: string
  }
  limit?: number
}
```

`automationId` 只匹配 `initiator.type === 'automation'`，`extensionId` 只匹配 `initiator.type === 'extension'`。

## AppEvents Policy

不为高频进度增加 AppEvents。

可以选择增加低频 lifecycle event：

```ts
'taskRun.started': [TaskRun]
'taskRun.finished': [TaskRun]
```

但只有出现真实非 UI 消费者时才添加。任务中心 UI 不需要这些 AppEvents。

## Extension API Policy

扩展不应获得全局任务中心读权限。

目标：

- command invocation context 不再转发 task progress。
- command invocation id 不等于 task run id。
- `kisaki.automations` 只管理本扩展拥有的自动化配置。
- 扩展不能 list 所有 app task runs。
- 扩展可以通过 scoped task-run API 创建和维护自己拥有的长时 run。

无向后兼容时，公共 extension API 必须把 `backgroundTasks` 重命名为 `automations`，不保留 alias。

public API、RPC、host provider、SDK bridge 和现有 Bangumi 扩展重构的完整设计见 [07-extension-api-and-bangumi-refactor.md](07-extension-api-and-bangumi-refactor.md)。本文件只定义 TaskRun 共享模型和主进程内部 producer 合同。
