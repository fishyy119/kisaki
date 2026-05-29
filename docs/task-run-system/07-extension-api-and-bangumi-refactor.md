# 07 Extension API And Bangumi Refactor

本文是 `kisaki.taskRuns` public extension API 和现有 Bangumi 内置扩展重构的唯一细化文档。其他 task-run 文档只描述边界和引用本文，避免 extension API、SDK bridge、RPC、Bangumi 迁移散落在多个阶段里。

旧 `docs/bangumi-builtin-extension/*` 可以后续再统一清理；实现 task-run 集成时以本文为准。

## 目标

- 删除 extension command progress API。
- 新增 scoped `kisaki.taskRuns` capability，让扩展只能创建和读取自己拥有的 TaskRun。
- `CommandService` 继续只负责 command invocation，不创建、不转发、不拥有 TaskRun。
- Bangumi 长时 command handler 改为创建 `kisaki.taskRuns` run，并返回 `runId`。
- Bangumi 推荐自动化改用 `kisaki.automations`，不再使用 `backgroundTasks`。

## 非目标

- 不开放全局 task center list/read 权限给扩展。
- 不允许扩展伪造 `initiator`、`owner`、`category` 或 app 内部 run id。
- 不把 desktop app 内部 `TaskRunHandle` 暴露给 extension API。
- 不在 `packages/extension-api` 中 import `apps/desktop/src/shared/task-run.ts`。
- 不为旧 `backgroundTasks`、command progress、`reportProgress` 保留 alias。

## Public Extension Contract

`packages/extension-api` 是独立 public contract，不能依赖 desktop app 的 shared 文件。extension API 使用自己的 DTO，host provider 负责与 app 内部 `TaskRun` 映射。

新增：

```text
packages/extension-api/src/capabilities/task-runs.ts
```

接入：

```text
packages/extension-api/src/kisaki.ts
packages/extension-api/src/rpc/capabilities.ts
packages/extension-sdk/src/index.ts
apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/kisaki-api.ts
apps/desktop/src/main/services/extension/capabilities/task-runs.ts
apps/desktop/src/main/services/extension/capabilities/gateway.ts
```

Public DTO：

```ts
export type ExtensionTaskRunOperation = 'command.execute'

export type ExtensionTaskRunStatus =
  | 'queued'
  | 'running'
  | 'pausing'
  | 'paused'
  | 'cancelling'
  | 'completed'
  | 'failed'
  | 'cancelled'

export type ExtensionTaskRunFinalStatus = 'completed' | 'failed' | 'cancelled'

export type ExtensionTaskRunProgressUnit =
  | 'item'
  | 'file'
  | 'byte'
  | 'entity'
  | 'step'
  | 'package'
  | 'request'

export interface ExtensionTaskRunWarning {
  code?: string
  message: string
}

export interface ExtensionTaskRunProgressUpdate {
  phase?: string
  message?: string
  current?: number
  total?: number
  unit?: ExtensionTaskRunProgressUnit
  indeterminate?: boolean
  counters?: Record<string, number>
  warnings?: readonly ExtensionTaskRunWarning[]
}

export interface ExtensionTaskRunProgress extends ExtensionTaskRunProgressUpdate {
  updatedAt: number
  rate?: number
  rateWindowMs?: number
  etaMs?: number
  percent?: number
}

export interface ExtensionTaskRunResult {
  status: ExtensionTaskRunFinalStatus
  title?: string
  summary?: string
  output?: unknown
  error?: string
  counters?: Record<string, number>
  warnings?: readonly ExtensionTaskRunWarning[]
}

export type ExtensionTaskRunSubjectType = 'command' | 'extension'

export interface ExtensionTaskRunSubject {
  type: ExtensionTaskRunSubjectType
  id?: string
  labelSnapshot?: string
}

export interface ExtensionTaskRunControls {
  cancelable?: boolean
  pausable?: boolean
  retryable?: boolean
}

export interface ExtensionTaskRunPresentation {
  notify?: {
    enabled: boolean
    title?: string
    message?: string
    showProgress?: boolean
    showResult?: boolean
    closable?: boolean
  }
}

export interface ExtensionTaskRunSnapshot {
  id: string
  operation: ExtensionTaskRunOperation
  title: string
  description?: string
  status: ExtensionTaskRunStatus
  subject?: ExtensionTaskRunSubject
  controls: Required<ExtensionTaskRunControls>
  progress?: ExtensionTaskRunProgress
  result?: ExtensionTaskRunResult
  createdAt: number
  startedAt?: number
  updatedAt: number
  finishedAt?: number
}

export interface ExtensionTaskRunCreateInput {
  operation: ExtensionTaskRunOperation
  title: string
  description?: string
  subject?: ExtensionTaskRunSubject
  controls?: ExtensionTaskRunControls
  presentation?: ExtensionTaskRunPresentation
}

export interface ExtensionTaskRunListQuery {
  status?: 'active' | 'completed' | 'all'
  operations?: readonly ExtensionTaskRunOperation[]
  subject?: {
    type: ExtensionTaskRunSubjectType
    id?: string
  }
  limit?: number
}

export class ExtensionTaskRunCancellation extends Error {
  readonly name = 'ExtensionTaskRunCancellation'
}

export function isExtensionTaskRunCancellation(
  error: unknown
): error is ExtensionTaskRunCancellation
```

Handle：

```ts
export interface ExtensionTaskRunHandle {
  readonly id: string
  readonly signal: AbortSignal
  report(update: ExtensionTaskRunProgressUpdate): Promise<void>
  checkpoint(): Promise<void>
  complete(result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>): Promise<void>
  fail(error: unknown, result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>): Promise<void>
  cancel(result?: Omit<ExtensionTaskRunResult, 'status' | 'error'>): Promise<void>
}
```

规则：

- 不提供 `finish(result)`。producer 已有 final status 时必须显式调用 `complete()`、`fail()` 或 `cancel()`。
- 不提供 `finishFromError()`。扩展 catch 边界必须显式判断 `isExtensionTaskRunCancellation(error)`，取消信号调用 `cancel()`，真正错误调用 `fail()`。
- `ExtensionTaskRunCancellation` 是 SDK 控制流 sentinel，不是 task run error，不写入 `result.error`。
- `complete()` 不接收 `status` 或 `error`。
- `fail()` 接收 unknown error，由 SDK bridge 和 host provider 规范化为安全展示摘要。
- `cancel()` 只用于扩展代码已确认取消后的显式收尾，不接收 `error`。
- 每次 `report(update)` 是 progress 字段完整快照替换，不做深度 merge。扩展若要保留 `current/total/counters/warnings` 等字段，必须在下一次 report 中继续发送。
- extension API 不导出 task-run limits 常量，SDK 不做 payload 预检。host provider 是权威未知边界，负责校验 title、description、subject label、progress、warnings、result 和 list limit。

Capability：

```ts
export interface ExtensionTaskRunsCapability {
  create(input: ExtensionTaskRunCreateInput): Promise<ExtensionTaskRunHandle>
  listOwn(query?: ExtensionTaskRunListQuery): Promise<readonly ExtensionTaskRunSnapshot[]>
  getOwn(runId: string): Promise<ExtensionTaskRunSnapshot | null>
  waitOwn(runId: string): Promise<ExtensionTaskRunSnapshot>
}

export interface KisakiApi {
  readonly taskRuns: ExtensionTaskRunsCapability
}
```

## RPC And Host Provider

新增 RPC methods：

```text
capabilities.taskRuns.create
capabilities.taskRuns.report
capabilities.taskRuns.checkpoint
capabilities.taskRuns.complete
capabilities.taskRuns.fail
capabilities.taskRuns.cancel
capabilities.taskRuns.listOwn
capabilities.taskRuns.getOwn
capabilities.taskRuns.waitOwn
```

新增 main -> host RPC event：

```text
capabilities.taskRuns.cancelRequested
```

事件 payload：

```ts
export interface ExtensionTaskRunCancelRequestedEvent {
  runtimeHandle: string
  runId: string
}
```

Host provider：

```text
apps/desktop/src/main/services/extension/capabilities/task-runs.ts
```

职责：

- 校验 runtime handle 和 extension owner。
- 校验 public DTO shape、字符串长度、result/output/progress 大小上限；上限定义在 provider validation module，不从 extension-api 导出。
- 将 `ExtensionTaskRun*` DTO 映射到 app 内部 `TaskRun*` contract。
- 强制 `category: 'command'`，首版只允许 `operation: 'command.execute'`。
- 从 runtime metadata 派生 `owner: { type: 'extension', extension: { id, nameSnapshot } }`，扩展输入不能覆盖。
- 从 execution-local command source 派生 `initiator`，扩展输入不能覆盖。
- 校验 `subject.type === 'command'` 时 `subject.id` 属于当前 extension 注册的 command。
- `listOwn/getOwn/waitOwn` 只返回 `owner.type === 'extension' && owner.extension.id === runtime extension id` 的 run。
- 将 `presentation.notify` 映射为 TaskRun presentation。
- 监听 TaskRun cancel，向 extension host 发送 `capabilities.taskRuns.cancelRequested`。
- extension host dispose 时取消该 runtime owner 的 active runs。

SDK bridge：

- `create()` 返回 local handle，handle 内部保存 `runId` 和 local `AbortController`。
- host 收到 `capabilities.taskRuns.cancelRequested` 时，根据 `runId` abort 对应 local signal。
- `checkpoint()` 先检查 local signal，再请求 main checkpoint；任一侧取消都抛出 SDK cancellation error。
- `fail()` 必须序列化 unknown error，不透传 Error object、stack 或 raw library message。

## Command Contribution Rewrite

删除 command invocation progress：

```text
CommandExecutionProgress
CommandExecutionProgressUpdate
command:get-progress
command:progress
command.progressed
event.reportProgress(...)
event.checkpoint(...)
contributions.commands.reportProgress
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

Extension command handler 如需长时运行，必须自己创建 TaskRun：

```ts
context.contributions.commands.register({
  id: 'bangumi.sync.full',
  title: 'Bangumi Full Sync',
  async execute(args) {
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
      if (isExtensionTaskRunCancellation(error)) {
        return run.cancel().catch(() => undefined)
      }

      return run.fail(error).catch(() => undefined)
    })

    return { runId: run.id }
  }
})
```

## Initiator Mapping

扩展不能提供 owner 或 initiator。host 根据 runtime metadata 派生 owner，根据 command source 和 runtime context 派生 initiator：

| Source                         | TaskRun owner                                            | TaskRun initiator                                       |
| ------------------------------ | -------------------------------------------------------- | ------------------------------------------------------- |
| 用户点击 extension command     | `{ type: 'extension', extension: { id, nameSnapshot } }` | `{ type: 'user' }`                                      |
| AutomationService 调度 command | `{ type: 'extension', extension: { id, nameSnapshot } }` | `{ type: 'automation', automation: { ...snapshot } }`   |
| extension runtime 自发创建     | `{ type: 'extension', extension: { id, nameSnapshot } }` | `{ type: 'extension', extension: { id, nameSnapshot }}` |

实现上，extension capability gateway 在调用 extension command handler 时建立 execution-local source context；`kisaki.taskRuns.create()` 读取该 context。离开 command handler 后，runtime 自发创建的 run 使用 extension initiator。

## Bangumi Refactor

现有 Bangumi 扩展按代码重构，不要求先清理旧 Bangumi 设计文档。

目标文件：

```text
extensions/bangumi/src/jobs/commands.ts
extensions/bangumi/src/jobs/runner.ts
extensions/bangumi/src/jobs/summary.ts
extensions/bangumi/src/ui/settings/**
extensions/bangumi/src/tasks/**
```

若 AutomationService 已完成 rename，则将 `tasks/` 同步改为：

```text
extensions/bangumi/src/automations/templates.ts
```

重构规则：

- command handler 创建 `kisaki.taskRuns` run 并立即返回 `{ runId }`。
- `JobRunner` 不再接收 command event，不调用 `event.reportProgress()` 或 `event.checkpoint()`。
- `JobRunner` 接收 `ExtensionTaskRunHandle`，通过 `run.report()`、`run.checkpoint()`、`run.complete()`、`run.cancel()` 和 `run.fail()` 完成生命周期。
- `JobRunner` catch 边界必须使用 `isExtensionTaskRunCancellation(error)` 显式区分取消和失败。
- `run.signal` 贯穿 Bangumi client、limiter、sleep、import executor 和 sync engine。
- summary status 不再复制 final status；final status 来自 TaskRun result。
- settings panel 不展示独立 progress/status field。
- settings panel 禁用重复入口时使用 `kisaki.taskRuns.listOwn({ status: 'active', subject })`。
- 推荐自动化使用 `kisaki.automations.create()`，不使用 `kisaki.backgroundTasks`。
- Bangumi storage 不保存 active run id、execution id、history、last result 或 last summary。

推荐执行流程：

```text
settings button
  -> kisaki.commands.start(commandId, args)
  -> command result returns runId
  -> task center observes task-run:changed

Bangumi command handler
  -> kisaki.taskRuns.create()
  -> start execute job in extension runtime
  -> return { runId }

Bangumi job runner
  -> run.report()
  -> run.checkpoint()
  -> run.complete() / run.cancel() / run.fail()
```

## Verification

负向搜索：

```powershell
rg -n "CommandExecutionProgress|CommandExecutionProgressUpdate|command:progress|command\\.progressed|getProgress|reportProgress|contributions\\.commands\\.reportProgress" packages/extension-api packages/extension-sdk apps/desktop/src/main/services/extension extensions/bangumi/src
rg -n "backgroundTasks|capabilities\\.backgroundTasks|BackgroundTaskService" packages/extension-api packages/extension-sdk apps/desktop/src/main/services/extension extensions/bangumi/src
rg -n "finishFromError|finish\\(result|capabilities\\.taskRuns\\.finish" packages/extension-api packages/extension-sdk apps/desktop/src/main/services/extension extensions/bangumi/src
```

正向搜索：

```powershell
rg -n "kisaki\\.taskRuns|capabilities\\.taskRuns|ExtensionTaskRunHandle|isExtensionTaskRunCancellation" packages/extension-api packages/extension-sdk apps/desktop/src/main/services/extension extensions/bangumi/src
rg -n "kisaki\\.automations|capabilities\\.automations" packages/extension-api packages/extension-sdk apps/desktop/src/main/services/extension extensions/bangumi/src
```

手动验收：

1. 从 Bangumi settings panel 启动全量同步。
2. command 返回 `runId`，settings callback 立即结束。
3. 任务中心显示 `command.execute` run。
4. progress counters/warnings 更新。
5. 点击取消后 extension handle signal abort，job runner 在 checkpoint 进入 cancelled。
6. 成功、失败、取消都只写 TaskRun result/history。
7. 创建 Bangumi 自动化后，主应用 AutomationService 调度同一个 command，TaskRun initiator 为 automation。
