# 02 Domain Model And Contracts

## 术语

| 术语         | 含义                                          |
| ------------ | --------------------------------------------- |
| `TaskRun`    | 一次长时执行实例。                            |
| `TaskKind`   | 执行业务类型，例如 command、scanner、ingest。 |
| `Origin`     | 谁触发了任务，例如 user、automation、system。 |
| `Target`     | 任务关联的业务对象，例如 scanner、extension。 |
| `Progress`   | 当前阶段和度量快照。                          |
| `Result`     | 完成后的输出、摘要、错误和计数。              |
| `Control`    | 取消、暂停、继续、重试等用户可操作能力。      |
| `Checkpoint` | 任务代码可安全响应取消或暂停的协作式边界。    |

## Shared contract 文件

新增：

```text
apps/desktop/src/shared/task-run.ts
```

此文件只包含纯类型、常量和小型纯 helper。不要 import main、renderer、Electron、Drizzle 或 logger。

## 基础类型

```ts
export type TaskRunKind =
  | 'command'
  | 'automation'
  | 'scanner'
  | 'ingest'
  | 'extensionPackage'
  | 'extensionUpdate'
  | 'updater'
  | 'system'

export type TaskRunStatus =
  | 'queued'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'
  | 'skipped'

export type TaskRunFinalStatus = 'completed' | 'failed' | 'cancelled' | 'skipped'

export type TaskRunOriginKind = 'user' | 'automation' | 'extension' | 'system'

export interface TaskRunOrigin {
  kind: TaskRunOriginKind
  extensionId?: string
  automationId?: string
  commandId?: string
}
```

`TaskRunKind` 描述正在做什么，`TaskRunOrigin` 描述谁触发了它。不要把两者合并。

## Target

`target` 用于 UI 跳转、过滤和结果定位。

```ts
export type TaskRunTargetType =
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

export interface TaskRunTarget {
  type: TaskRunTargetType
  id?: string
  label?: string
  route?: string
}
```

规则：

- `id` 是业务 id，不是展示文案。
- `label` 可以是快照文案，可能过期，只用于任务中心显示。
- `route` 是 renderer route path，不包含 hash 前缀。
- 不在 `target` 中放完整实体对象。

## Progress

```ts
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

- `phase` 使用稳定英文枚举值，例如 `searching`, `writing`, `download`, `commit`。
- `message` 是短展示文案，可以是中文。
- `current` 和 `total` 必须是非负有限数。
- `current > total` 时 service 可以保留原值，但 `percent` 上限为 100。
- `rate`、`etaMs`、`percent` 由 `TaskRunService` 计算，生产者不直接写。
- 不知道总量时设置 `indeterminate: true`。
- `unit` 用于 UI 显示速度，例如 `12 items/s`、`3.4 MB/s`。

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

export interface TaskRunWarning {
  code?: string
  message: string
}
```

规则：

- `error` 必须是安全、适合展示的摘要。
- 详细错误对象只写 main logger。
- `output` 必须 JSON serializable。
- 大输出需要摘要化；默认存储大小上限由 `TaskRunStore` 控制。
- `warnings` 用于部分成功、跳过、降级等情况。

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

暂停/继续是能力声明，不是强制保证。任务代码必须在 checkpoint 响应暂停。

## Snapshot

```ts
export interface TaskRun {
  id: string
  kind: TaskRunKind
  title: string
  description?: string
  status: TaskRunStatus
  origin: TaskRunOrigin
  target?: TaskRunTarget
  controls: TaskRunControls
  progress?: TaskRunProgress
  result?: TaskRunResult
  createdAt: number
  startedAt?: number
  updatedAt: number
  finishedAt?: number
  dismissedAt?: number
}
```

规则：

- `id` 由 main 生成，renderer 不生成 task run id。
- `title` 是短文本，不含动态大段内容。
- `description` 用于任务详情，不用于每帧变化。
- `dismissedAt` 只影响任务中心显示，不删除记录。
- `updatedAt` 每次 snapshot 更新都变化。

## Start result

启动长时流程的 IPC 不应等待任务完成，默认只返回 run id。

```ts
export interface TaskRunStartResult {
  runId: string
  startedAt: number
}
```

如果调用方确实需要等待完成，应使用 `task-run:wait` 或继续使用原业务同步 IPC。普通 UI workflow 优先使用 task center 观察状态。

## Event timeline

完成详情需要有限 timeline，但不能把所有 progress 写入 DB。

```ts
export type TaskRunEventType =
  | 'created'
  | 'started'
  | 'phaseChanged'
  | 'paused'
  | 'resumed'
  | 'cancelling'
  | 'finished'
  | 'warning'

export interface TaskRunEvent {
  id: string
  runId: string
  type: TaskRunEventType
  phase?: string
  message?: string
  occurredAt: number
}
```

记录规则：

- phase 变化时记录 `phaseChanged`。
- pause/resume/cancelling/finished 必须记录。
- 高频 current 变化不记录 event。
- 每个 run 默认最多保留 100 条 event。

## DB Schema

新增表：

```text
task_runs
task_run_events
```

建议字段：

```ts
export const taskRuns = sqliteTable('task_runs', {
  id: text('id').primaryKey(),
  kind: taskRunKind('kind').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: taskRunStatus('status').notNull(),
  origin: taskRunOrigin('origin').notNull(),
  target: taskRunTarget('target'),
  controls: taskRunControls('controls').notNull(),
  progress: taskRunProgress('progress'),
  result: taskRunResult('result'),
  createdAt: integer('created_at').notNull(),
  startedAt: integer('started_at'),
  updatedAt: integer('updated_at').notNull(),
  finishedAt: integer('finished_at'),
  dismissedAt: integer('dismissed_at')
})

export const taskRunEvents = sqliteTable('task_run_events', {
  id: text('id').primaryKey(),
  runId: text('run_id')
    .notNull()
    .references(() => taskRuns.id, { onDelete: 'cascade' }),
  type: taskRunEventType('type').notNull(),
  phase: text('phase'),
  message: text('message'),
  occurredAt: integer('occurred_at').notNull()
})
```

Indexes:

```text
idx_task_runs_status_updated_at
idx_task_runs_kind_updated_at
idx_task_runs_finished_at
idx_task_run_events_run_id_occurred_at
```

Retention:

- active runs 永不裁剪。
- completed runs 默认保留最近 500 条或 30 天，取较宽者。
- dismissed runs 可优先裁剪。
- event rows 跟随 task run 删除。

不需要 SQLite trigger 投影 AppEvents；任务中心 store 使用专用 IPC 初始化和订阅。

## IPC Contracts

在 `apps/desktop/src/shared/ipc.ts` 中新增：

```ts
interface IpcMainHandlers {
  'task-run:list': (query?: TaskRunListQuery) => IpcResult<TaskRun[]>
  'task-run:get': (runId: string) => IpcResult<TaskRun | null>
  'task-run:list-events': (runId: string) => IpcResult<TaskRunEvent[]>
  'task-run:wait': (runId: string) => IpcResult<TaskRun>
  'task-run:cancel': (runId: string) => IpcResult<boolean>
  'task-run:pause': (runId: string) => IpcResult<boolean>
  'task-run:resume': (runId: string) => IpcResult<boolean>
  'task-run:dismiss': (runId: string) => IpcVoidResult
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
  kinds?: TaskRunKind[]
  includeDismissed?: boolean
  limit?: number
}
```

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

- extension command 仍通过 command execution context 上报进度。
- command execution id 等于 task run id。
- `kisaki.automations` 只管理本扩展拥有的自动化配置。
- 扩展不能 list 所有 app task runs。
- 若未来需要扩展读取自己命令的 run history，单独设计 scoped API。

无向后兼容时，公共 extension API 可以把 `backgroundTasks` 重命名为 `automations`。
