# 02 Domain Model And Contracts

## 术语

| 术语           | 含义                                                           |
| -------------- | -------------------------------------------------------------- |
| `TaskRun`      | 一次长时执行实例，也是长任务进度、结果和完成历史的唯一事实源。 |
| `Category`     | 任务所属的大类，用于 UI 分组、筛选和图标。                     |
| `Operation`    | 稳定的操作标识，描述这次任务具体在做什么。                     |
| `Initiator`    | 谁启动了任务，例如 user、automation、extension、system。       |
| `Owner`        | 谁拥有这条运行记录和读取权限，例如 app 或 extension。          |
| `Subject`      | 任务主要关联的业务对象，用于展示、过滤和跳转。                 |
| `Progress`     | 当前阶段和度量快照。                                           |
| `Result`       | 完成后的输出、摘要、错误和计数。                               |
| `Control`      | 取消、暂停和继续等用户可操作能力。                             |
| `Checkpoint`   | 任务代码可安全响应取消或暂停的协作式边界。                     |
| `Presentation` | 由 TaskRun 派生出的可选展示，例如 toast，不拥有任务状态。      |

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
- `TaskRunOwner`
- `TaskRunControls`
- `TaskRunPresentation`
- `TaskRunStartResult`
- `TaskRunActiveListQuery`
- `TaskRunHistoryListQuery`

不放入 shared：

- `TaskRunHandle`
- `TaskRunContext`
- `TaskRunCancellation`
- active run、pause controller、waiter 等 main 内部运行态类型

## Category and operation

`category` 只表达任务所属大类。它不是执行语义，不承载自动化来源，也不区分具体 use case。Command 只是可调用入口注册项，不是 TaskRun category。

```ts
export type TaskRunCategory = 'scanner' | 'ingest' | 'extension' | 'updater' | 'system'
```

`operation` 是稳定的点分操作标识，描述这次任务具体做什么。它必须覆盖所有进入任务中心的长流程，避免不同 producer 私造相近字符串。

```ts
export type TaskRunContentEntity = 'game' | 'person' | 'company' | 'character'

export type TaskRunOperation =
  | 'scanner.scan'
  | `ingest.${TaskRunContentEntity}.add`
  | `ingest.${TaskRunContentEntity}.update`
  | `ingest.${TaskRunContentEntity}.batchAdd`
  | `ingest.${TaskRunContentEntity}.batchUpdate`
  | `ingest.${TaskRunContentEntity}.batchDelete`
  | `extension.task.${string}.${string}`
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
- `command` 不是 category，也不提供通用 `command.execute` operation。Command 只作为 registry entry；由 command 触发的长时任务必须使用真实业务 operation，并可用 `subject.type === 'command'` 记录入口。
- UI 图标、分组和过滤优先使用 `category`。
- 业务结果解释优先使用 `operation`。
- 新 use case 增加新的 operation，不复用模糊字符串。
- operation 使用稳定英文标识，不使用展示文案。
- ingest operation 使用实体维度和动作维度组合；单项、批量添加、批量更新、批量删除都必须能被明确区分。
- `extension.task.<extensionId>.<operation>` 只用于 extension-owned task run。扩展通过 public API 提供 extension-local operation name，例如 `fullSync` 或 `import.collections`；host 根据 runtime extension id 映射成内部 operation。
- extension-owned TaskRun 的权限不从 operation 解析，仍然只看 `owner`。operation 内包含 extension id 是为了主应用任务中心、筛选和历史查询有稳定全局命名空间。
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

export type TaskRunFinalStatus = Extract<TaskRunStatus, 'completed' | 'failed' | 'cancelled'>
```

规则：

- `TaskRunFinalStatus` 只是 `TaskRunStatus` 的类型级子集，不是第二套状态模型。
- shared contract 保留 `TaskRunFinalStatus`，用于 `TaskRunResult.status`、final history row 和持久化边界，避免 active status 写入 result 或 history。
- DB custom type 只需要 `taskRunFinalStatus`；除非未来真的持久化 active status，否则不需要 `taskRunStatus` column type。
- 不提供 `skipped` 作为 TaskRun 状态。
- 调度器发现自动化禁用、互斥、条件不满足时，不创建 TaskRun。
- 批量任务内部跳过项目时，用 `result.counters.skipped` 或 `warnings` 表达。
- 已创建的 TaskRun 必须进入 `completed`、`failed` 或 `cancelled` 之一。

## Initiator

`initiator` 描述谁启动了 TaskRun。它用于任务中心来源展示和过滤，不是自动化历史的事实源。

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
- 自动化运行历史由 `AutomationService` 的 `automation_run_history` 持久化；`initiator.automation` 只描述某个 TaskRun 是由哪个 automation 触发。
- `automation.nameSnapshot` 是展示快照，自动化改名后旧 run 不回写。
- `automation.attempt` 只用于同一次自动化触发的重试序号。
- `commandId` 不属于 initiator。若任务由 command 入口触发，使用 `subject.type === 'command'` 和 `subject.id` 表达入口；`operation` 必须仍然是真实业务操作。
- 用户点击扩展贡献的 command 时，initiator 仍然是 `user`；只有扩展运行时主动启动的任务才使用 `type: 'extension'`。

## Owner

`owner` 描述谁拥有这条 TaskRun 记录。它是扩展作用域读取、取消权限和 host dispose 清理的唯一依据，不表达启动来源。

```ts
export type TaskRunOwner =
  | {
      type: 'app'
    }
  | {
      type: 'extension'
      extension: {
        id: string
        nameSnapshot?: string
      }
    }
```

规则：

- app 内部长流程、扩展包安装/更新、scanner、ingest、updater 和 system maintenance 使用 `{ type: 'app' }`。
- 扩展通过 `kisaki.taskRuns` 创建的 run 必须使用 `{ type: 'extension' }`，即使它是由用户点击扩展 command 或 automation 触发。
- `owner` 和 `initiator` 不能互相推断。用户点击扩展 command 时 `owner.type === 'extension'` 且 `initiator.type === 'user'`。
- AutomationService 调度扩展 command 时 `owner.type === 'extension'` 且 `initiator.type === 'automation'`。
- extension runtime 自发创建的 run 使用同一个 extension owner，同时 `initiator.type === 'extension'`。
- 扩展 `listActiveOwn/listHistoryOwn/getActiveOwn/getHistoryOwn/waitOwn` 只按 `owner.type === 'extension'` 和 `owner.extension.id` 授权，不按 `initiator` 授权。
- 扩展输入不能提供或覆盖 `owner`。host provider 必须从 runtime metadata 派生 owner。

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
  ratePeriod?: 'second' | 'minute' | 'hour'
  indeterminate?: boolean
  counters?: Record<string, number>
  warnings?: readonly TaskRunWarning[]
}

export interface TaskRunProgress extends TaskRunProgressUpdate {
  updatedAt: number
  rate?: number
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
- `ratePeriod` 可指定速度展示周期，例如 `second`、`minute` 或 `hour`。
- `counters` 是 active run 的有限汇总，例如 `succeeded`、`failed`、`skipped`、`warnings`，用于 scanner、batch ingest、extension install 等 live summary。
- `warnings` 是 active run 的有限展示摘要，不是完整错误明细；service 必须按条数和序列化大小限制。
- 每次 `report(update)` 都是 producer-writable progress 字段的完整快照替换，不是深度 merge。未出现在 update 中的 `phase`、`message`、`current`、`total`、`unit`、`indeterminate`、`counters` 和 `warnings` 会被清空。
- `counters` 和 `warnings` 由 producer 发送当前 bounded snapshot。Service 只做大小限制和序列化保护，不替 producer 累加。
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
- 大输出需要摘要化；默认存储大小上限由持久化边界控制。
- `warnings` 用于部分成功、跳过、降级等情况。
- `counters.skipped` 可以表达批量任务内部跳过数量，但不改变 run final status。

## Boundary validation

TaskRun shared contract 不导出全局 limits 常量。长度、条数和 JSON 大小上限是边界 validator 的实现细节，放在执行校验的模块附近，避免把内部存储策略变成 public API。

规则：

- extension task-run capability provider 是 `kisaki.taskRuns` 的权威未知边界，负责校验 public DTO shape、字符串长度、warnings/result/progress 大小、extension-local operation name format、subject ownership 和 runtime handle，并把 public operation 映射到内部 `extension.task.<extensionId>.<operation>`。
- renderer IPC query 是未知边界，IPC handler 或 service query parser 负责校验 `statuses`、filters 和 `limit`。
- `fail(error)` 接收 unknown error，TaskRunService 在 lifecycle boundary 将其序列化为安全 `result.error`。
- main 内部 producer 是 trusted caller。TaskRunService 可以用断言保护领域不变量，但不把它当作 public DTO validator。
- TaskRunHistoryStore 是最后一道持久化保护，必须拒绝无法安全序列化或明显超限的 result output。
- SDK 和 renderer 不做 task-run payload 预检；renderer 只展示已通过 main 边界的 snapshot。
- 若多个 main 边界确实需要同一组数值，可以在 main task-run 模块内共享私有 validation constants，但不放入 `apps/desktop/src/shared` 或 `packages/extension-api`。

## Controls

```ts
export interface TaskRunControls {
  cancelable: boolean
  pausable: boolean
}
```

显示规则：

- `cancelable && active` 显示取消。
- `pausable && status === 'running'` 显示暂停。
- `pausable && status === 'paused'` 显示继续。
- 首版不提供 TaskRun 级别的重跑控制。需要再次执行时，用户回到原业务入口重新启动新的 TaskRun。

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
  cancel(result?: Omit<TaskRunResult, 'status' | 'error'>): void
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
- `cancel()` 只能产生 `cancelled`，用于 producer 已确认取消后的显式收尾，不接收 `error`。
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
  owner: TaskRunOwner
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
- `owner` 是权限和归属字段，必须在创建时确定，创建后不可变。
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

如果调用方确实需要等待 active run 结束，应使用 `task-run:wait`。普通 UI workflow 优先使用 task center 观察状态。

规则：

- `TaskRunStartResult` 不返回 `startedAt`，因为 run 可能刚创建仍处于 `queued`。
- 需要展示开始时间时，renderer 从 `task-run:changed`、`task-run:get-active` 或 `task-run:get-history` 的 snapshot 读取 `startedAt`。

## History model

`task_run_history` 是唯一持久 completed TaskRun history 表，只保存 final snapshot。active TaskRun snapshot 的唯一事实源是 `TaskRunService` 内存运行态，并通过 `task-run:*` IPC 推送到 renderer store。

它不是所有上层业务历史的唯一表。AutomationService 拥有独立 `automation_run_history`，记录 automation 触发 command invocation 的事实；CommandService 不保存历史；scanner、extension package operation 等真实长任务完成记录可以从 `task_run_history` 查询。

规则：

- 自动化历史查询 `automation_run_history.automationId`，不通过 TaskRun initiator 查询，也不保存或查询 run id。
- 扩展拥有的运行记录查询 `owner.type === 'extension'` 和 `owner.extension.id`。
- 命令入口触发的任务查询 `subject.type === 'command'`。CommandService 不保存独立执行历史。
- 扫描历史查询 `operation === 'scanner.scan'` 和 `subject.type === 'scanner'`。
- task run final history 被 retention 删除后，只影响任务中心历史；automation invocation record 是否保留由 AutomationService retention 决定。
- 不把 TaskRun id、output、result 或 progress 复制到 automation、command 或 scanner 模块。Automation history 只保存 command invocation 级别的有界信息。

首版不建立 `task_run_events` 表。完成详情展示当前 snapshot、result、counters、warnings 和 error。若后续需要时间线，再单独设计低频 timeline 表，但 timeline 不能成为状态事实源。

## DB Schema

新增表：

```text
task_run_history
```

建议字段：

```ts
export const taskRunHistory = sqliteTable('task_run_history', {
  id: text('id').primaryKey(),
  category: taskRunCategory('category').notNull(),
  operation: taskRunOperation('operation').notNull(),
  title: text('title').notNull(),
  description: text('description'),
  status: taskRunFinalStatus('status').notNull(),
  owner: taskRunOwner('owner').notNull(),
  ownerExtensionId: text('owner_extension_id'),
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
idx_task_run_history_owner_extension_finished_at
idx_task_run_history_category_finished_at
idx_task_run_history_operation_finished_at
idx_task_run_history_finished_at
```

`ownerExtensionId` 是从 `owner` 派生的查询投影：`owner.type === 'extension'` 时等于 `owner.extension.id`，否则为 null。shared `TaskRun` contract 不单独暴露这个投影字段。其他 JSON 字段索引按实际查询成本再加，不在首版预设复杂 expression index。

表语义：

- active run 不插入 `task_run_history`。
- start、pause、resume、cancel request 和 progress report 不写 `task_run_history`。
- `complete()`、`fail()` 或 `cancel()` 生成 final snapshot 时插入 `task_run_history`。
- `TaskRunHistoryStore` 必须拒绝非 final status。
- 如果进程异常退出，内存中的 active run 消失，不生成 synthetic failed history row。
- graceful shutdown 可以 best-effort 取消 active run 并写入 final `cancelled` history；如果进程在 flush 前退出，不补写历史。

Retention:

- 默认 completed runs 保留最近 500 条或 30 天，取较宽者。
- 清理历史必须走 `TaskRunHistoryStore` retention，不允许各业务模块自行删除 task run。
- 删除 task run 就是删除对应历史事实，不保留孤立 history row。

允许 `task_run_history` 参与现有 SQLite `db.*` trigger 事件；这些是通用 DB row change events，不是 TaskRun lifecycle/progress API。任务中心 store 不使用 DB events 作为状态源，只使用专用 `task-run:*` IPC 初始化和订阅。

## IPC Contracts

在 `apps/desktop/src/shared/ipc.ts` 中新增：

```ts
interface IpcMainHandlers {
  'task-run:list-active': (query?: TaskRunActiveListQuery) => IpcResult<TaskRun[]>
  'task-run:list-history': (query?: TaskRunHistoryListQuery) => IpcResult<TaskRun[]>
  'task-run:get-active': (runId: string) => IpcResult<TaskRun | null>
  'task-run:get-history': (runId: string) => IpcResult<TaskRun | null>
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

`task-run:list-active` 只返回 active runs，由 main 内存中的 runs manager 提供，不查询 completed history。active run 的最新 progress 以内存 snapshot 为准。

`task-run:list-history` 只返回 persisted final history，由 `TaskRunHistoryStore` 查询 `task_run_history` 中的记录，不返回 active runs。

任务中心初始化时分别调用这两个 IPC，并在 renderer store 中分别放入 active/completed tab。renderer 可以组合两个列表形成 UI 状态，但不直接访问 SQLite，也不把 history 当作 active run 的来源。

`task-run:get-active` 只读取 active run。`task-run:get-history` 只读取 final history record。没有跨 active/history 的通用 get facade。

`task-run:wait` 只等待 active run，并在该 run 进入 final status 时返回最终 snapshot。若调用时 run 已经不在 active map，调用方应读取 `task-run:get-history`。

Active list query:

```ts
export interface TaskRunActiveListQuery {
  categories?: TaskRunCategory[]
  operations?: TaskRunOperation[]
  ownerTypes?: TaskRunOwner['type'][]
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

History list query:

```ts
export interface TaskRunHistoryListQuery {
  statuses?: TaskRunFinalStatus[]
  categories?: TaskRunCategory[]
  operations?: TaskRunOperation[]
  ownerTypes?: TaskRunOwner['type'][]
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

`automationId` 只匹配 `initiator.type === 'automation'`。`extensionId` 只匹配 `owner.type === 'extension'`，不匹配 `initiator.type === 'extension'`。

## AppEvents Policy

不为高频进度增加 TaskRun AppEvents。

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
- command invocation 没有持久 execution id，也不等于 task run id。
- `kisaki.automations` 只管理本扩展拥有的自动化配置。
- 扩展不能 list 所有 app task runs。
- 扩展可以通过 scoped task-run API 创建和维护 `owner.type === 'extension'` 且 `owner.extension.id` 等于自身 id 的长时 run。

无向后兼容时，公共 extension API 必须把 `backgroundTasks` 重命名为 `automations`，不保留 alias。

public API、RPC、host provider、SDK bridge 和现有 Bangumi 扩展重构的完整设计见 [07-extension-api-and-bangumi-refactor.md](07-extension-api-and-bangumi-refactor.md)。本文件只定义 TaskRun 共享模型和主进程内部 producer 合同。
