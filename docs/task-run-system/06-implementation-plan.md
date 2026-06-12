# 06 Implementation Plan

> 历史设计文档：文中的 `ExtensionTaskRun*` 类型已在 extension-api 中更名为 `TaskRun*`。现状以 `.claude/skills/kisaki/references/extension-system.md` 为准。

本实施计划不考虑向后兼容。允许删除、重命名和迁移现有服务、IPC、DB 表和 extension API。

## Phase 1: Shared contracts and DB schema

新增：

```text
apps/desktop/src/shared/task-run.ts
```

修改：

```text
apps/desktop/src/shared/ipc.ts
apps/desktop/src/shared/db/schema.ts
apps/desktop/src/shared/db/schema-relations.ts
apps/desktop/src/shared/db/custom-types.ts
```

新增表：

```text
task_run_history
```

生成 migration：

```powershell
pnpm --filter kisaki drizzle-kit generate
```

验收：

- `TaskRun`、`TaskRunProgress`、`TaskRunResult` 类型位于 shared。
- `TaskRunHandle`、`TaskRunContext` 不位于 shared，只由 main process `task-run/runs/` 导出给内部生产者。
- 合同使用 `category`、`operation`、`owner`、`initiator`、`subject`。
- `owner` 与 `initiator` 分离；扩展拥有的 run 通过 `owner.type === 'extension'` 授权，不通过 `initiator` 授权。
- `TaskRunCategory` 不包含 `command`。
- `TaskRunOperation` 不包含通用 `command.execute`；command 入口触发的任务使用真实业务 operation，并通过 `subject.type === 'command'` 关联入口。
- `TaskRunOperation` 覆盖 ingest 单项/批量 add/update/delete、scanner、extension-owned `extension.task.<extensionId>.<operation>`、extension package、extension repository、updater 和 system maintenance。
- `TaskRunStatus` 不包含 `skipped`。
- `TaskRunControls` 只包含 `cancelable` 和 `pausable`；首版不提供 TaskRun 级别重跑控制。
- `TaskRun` 不包含 `dismissedAt`。
- `TaskRunStartResult` 返回 `runId` 和 `createdAt`，不返回误导性的 `startedAt`。
- `TaskRunProgressUpdate` 使用 `phase/work/counters/warnings` 分组，支持 bounded `counters` 和 `warnings` live summary，且每次 report 是完整 progress snapshot replacement。
- task-run payload/length/query limits 不作为 shared 或 extension-api 公共常量导出；未知边界在各自 validation module 本地校验。
- final snapshot 的 `TaskRun.status` 必须等于 `TaskRun.result.status`。
- `TaskRunHandle.cancel()` 和 `ExtensionTaskRunHandle.cancel()` 不接收 `error`。
- DB 不包含 `task_run_events`。
- `task_run_history` 只保存 final history；active runs 不插入 DB，`task_run_history.status` 只允许 final status。
- `task_run_history` 可以参与现有 SQLite `db.*` trigger 事件；这些事件不是 task center 状态源。
- IPC contracts 包含 `task-run:*`。
- DB custom JSON types 支持序列化和反序列化。
- Migration 可运行。

## Phase 2: TaskRunService

新增：

```text
apps/desktop/src/main/services/task-run/service.ts
apps/desktop/src/main/services/task-run/ipc.ts
apps/desktop/src/main/services/task-run/runs/index.ts
apps/desktop/src/main/services/task-run/runs/manager.ts
apps/desktop/src/main/services/task-run/runs/context.ts
apps/desktop/src/main/services/task-run/runs/controls.ts
apps/desktop/src/main/services/task-run/runs/progress.ts
apps/desktop/src/main/services/task-run/runs/query.ts
apps/desktop/src/main/services/task-run/runs/result.ts
apps/desktop/src/main/services/task-run/runs/transitions.ts
apps/desktop/src/main/services/task-run/runs/types.ts
apps/desktop/src/main/services/task-run/runs/validation.ts
apps/desktop/src/main/services/task-run/history/store.ts
apps/desktop/src/main/services/task-run/history/retention.ts
apps/desktop/src/main/services/task-run/notifications.ts
apps/desktop/src/main/services/task-run/rate.ts
apps/desktop/src/main/services/task-run/index.ts
```

修改：

```text
apps/desktop/src/main/container/types.ts
apps/desktop/src/main/index.ts
```

验收：

- service id 为 `task-run`。
- IPC registration 在 `task-run/ipc.ts`。
- active run 状态机在 `task-run/runs/`。
- `TaskRunHandle` 只暴露生命周期方法，`report` 只暴露在 `TaskRunContext`。
- `TaskRunHandle` 暴露 `createdAt`，方便启动型 IPC 返回准确创建时间。
- `TaskRunHandle` 只暴露 `complete()`、`fail()`、`cancel()` 三种终结方法；不提供 generic `finish(result)` 或 `finishFromError()`。
- producer catch 边界使用 `isTaskRunCancellation(error)` 显式区分 `run.cancel()` 和 `run.fail(error)`。
- `TaskRunService` 初始化早于需要创建 task run 的服务和 handler。
- init 时创建空 active map；DB 不保存 active rows，因此不需要 `history.markStaleActiveRuns()`。
- 可以通过 IPC list/get/wait/cancel/pause/resume/clear-completed。
- `service.runs.onCancelRequested(listener)` 作为 main 内部订阅点存在，供 extension task-run provider 转发取消请求；它不是 AppEvents 或 renderer IPC。
- `task-run:list-active` 调用 `service.runs.list(query)`，只返回 active runs。
- `task-run:list-history` 调用 `service.history.list(query)`，只返回 persisted final rows。
- 任务中心 store 分别初始化 active/history 两个 tab，不依赖 main 合并 list，也不直接访问 DB。
- `task-run:get-active` 只读取 active run，`task-run:get-history` 只读取 final history record。
- `task-run:wait` 只等待 active run；run 已经不在 active map 时，调用方读取 `task-run:get-history`。
- 不提供 `task-run:list-events`。
- 不提供 `task-run:dismiss`。
- `task-run:changed` 发送完整 snapshot。
- progress-only `task-run:changed` 在 main process 内按 run 合并和节流；start、controls、cancel/pause/resume、final snapshot 立即 flush。
- rate calculator 只读取 `progress.work`；在 work unit 改变、work current 回退、work total 明显变化或 work 变为不可度量时重置窗口。
- NotifyService 支持 `closable`、`notify:closed` 和 close callback；TaskRunNotificationCoordinator 不会在用户关闭后因 progress update 重建 loading toast。
- dispose 会取消 active runs 并 flush。

## Phase 3: Renderer store and task center shell

新增：

```text
apps/desktop/src/renderer/src/stores/task-run.ts
apps/desktop/src/renderer/src/features/task-center/
```

修改：

```text
apps/desktop/src/renderer/src/stores/index.ts
apps/desktop/src/renderer/src/main.ts
apps/desktop/src/renderer/src/components/layout/sidebar.vue
```

验收：

- sidebar 下半部分显示任务中心按钮。
- active count badge 正常。
- dialog 能打开并显示 active/completed tabs。
- store 初始化读取已有 runs，并订阅 IPC。
- Map 更新 reassign。
- UI 使用 category、operation、owner、initiator、subject 文案和筛选。
- 没有 dismissed UI 状态。

## Phase 4: CommandService rewrite

修改：

```text
apps/desktop/src/shared/command.ts
apps/desktop/src/main/services/command/types.ts
apps/desktop/src/main/services/command/service.ts
apps/desktop/src/main/services/command/ipc.ts
packages/extension-api/src/capabilities/commands.ts
packages/extension-api/src/contributions/commands/contracts.ts
packages/extension-api/src/rpc/contributions.ts
apps/desktop/src/main/services/extension/contributions/commands/point.ts
apps/desktop/src/main/services/extension/capabilities/commands.ts
apps/desktop/src/main/services/extension/runtime/host/contributions/commands/point.ts
```

删除：

```text
apps/desktop/src/main/services/command/executions.ts
apps/desktop/src/main/services/command/notifications.ts
```

如果有少量 command-specific presentation helper，可以迁移到 task-run notifications 或 renderer-owned short feedback。

验收：

- `CommandService` 只维护 command registry 和薄调用路由。
- `CommandService` 不依赖 `TaskRunService`、`NotifyService` 或 `EventService`。
- command invocation 没有 execution id、running/cancelling state、wait、progress、cancel、result history。
- command IPC 只保留 `command:list`、`command:get` 和 `command:invoke`。
- 删除 command start/wait/get-progress/cancel IPC。
- 删除 `command:started`、`command:progress`、`command:finished` renderer events。
- 删除 `command.started`、`command.progressed`、`command.finished` AppEvents，除非后续有真实非 UI 消费者重新设计低频 event。
- 删除 extension command contribution 的 `reportProgress` RPC。
- 长时 command handler 调用真实业务 use case 或 scoped task-run API 创建 TaskRun。
- command 触发的 TaskRun 不使用 `category: 'command'` 或 `operation: 'command.execute'`。
- command 入口通过 `subject.type === 'command'` 关联 TaskRun。
- 长时 command handler 返回 `runId`，调用方通过任务中心查看进度和结果。
- 旧 command notify coordinator 不存在。

## Phase 5: Automation rename

新增或重命名：

```text
apps/desktop/src/main/services/automation/
apps/desktop/src/main/services/automation/history/store.ts
apps/desktop/src/shared/automation.ts
apps/desktop/src/renderer/src/features/automation/
packages/extension-api/src/capabilities/automations.ts
packages/extension-api/src/kisaki.ts
packages/extension-api/src/rpc/capabilities.ts
packages/extension-sdk/src/index.ts
apps/desktop/src/main/services/extension/capabilities/automations.ts
apps/desktop/src/main/services/extension/capabilities/gateway.ts
apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/kisaki-api.ts
```

删除或替换：

```text
apps/desktop/src/main/services/background-task/
apps/desktop/src/shared/background-task.ts
apps/desktop/src/renderer/src/features/background-task/
packages/extension-api/src/capabilities/background-tasks.ts
```

DB：

- `background_tasks` 可直接替换为 `automations`。
- 新增 `automation_run_history`，保存 automation command invocation 历史。
- 无需兼容旧数据。
- automation history 不依赖 `task_run_history`。

验收：

- UI 文案为“自动化”，不再叫“后台任务”。
- automation 通过 `command:invoke` / `CommandService.invoke()` 触发 command，不直接创建 TaskRun。
- 每次实际 command invocation 都写入 `automation_run_history`，即使 handler 没有创建 TaskRun。
- 若 command handler 创建 TaskRun，`initiator` 写入 automation id、nameSnapshot、trigger、attempt。
- automation history 从 `automation_run_history` 查询，保存 command invocation status 和错误，不保存 run id，不复制 TaskRun output/result/progress。
- automation 不提供根据 run id 取消 TaskRun 的能力；长任务取消只通过任务中心或 TaskRun API。
- extension API 使用 `kisaki.automations`。
- extension API、SDK、host bridge 和 RPC 全部删除 `backgroundTasks`，不保留 alias。

## Phase 6: Extension TaskRun API and Bangumi refactor

设计入口：

```text
docs/task-run-system/07-extension-api-and-bangumi-refactor.md
```

新增：

```text
packages/extension-api/src/capabilities/task-runs.ts
apps/desktop/src/main/services/extension/capabilities/task-runs/
```

修改：

```text
packages/extension-api/src/kisaki.ts
packages/extension-api/src/rpc/capabilities.ts
packages/extension-sdk/src/index.ts
apps/desktop/src/main/services/extension/capabilities/gateway.ts
apps/desktop/src/main/services/extension/runtime/host/sdk-bridge/kisaki-api.ts
extensions/bangumi/src/jobs/commands.ts
extensions/bangumi/src/jobs/context.ts
extensions/bangumi/src/jobs/auth.ts
extensions/bangumi/src/jobs/runner.ts
extensions/bangumi/src/jobs/sync.ts
extensions/bangumi/src/jobs/import/**
extensions/bangumi/src/jobs/summary.ts
extensions/bangumi/src/ui/settings/**
extensions/bangumi/src/tasks/**
```

如果 Phase 5 已完成 Automation rename：

```text
extensions/bangumi/src/automations/templates.ts
```

验收：

- public API 新增 `kisaki.taskRuns`。
- `packages/extension-api` 不 import `apps/desktop/src/shared/task-run.ts`，使用 public `ExtensionTaskRun*` DTO。
- `ExtensionTaskRunHandle` 暴露 `report`、`checkpoint`、`complete`、`fail`、`cancel`。
- `ExtensionTaskRunHandle` 不暴露 `finish(result)` 或 `finishFromError()`。
- `ExtensionTaskRunControls` 只包含 `cancelable` 和 `pausable`。
- extension SDK 暴露 `isExtensionTaskRunCancellation(error)`，供扩展 catch 边界显式映射取消。
- extension task-run provider 从 runtime metadata 派生 TaskRun owner，扩展不能伪造。
- extension task-run provider 校验 owner scope、extension-local operation name format、subject ownership、payload 大小和 runtime handle；校验常量放在 provider validation module 附近。
- extension task-run provider 将 public operation name 映射成内部 `extension.task.<extensionId>.<operation>`，返回给扩展时再映射回 public operation name。
- extension task-run provider 使用扩展在 `kisaki.taskRuns.create()` 中显式传入的 `initiator`，未传时默认当前 extension；host scope 和 taskRuns RPC 不携带 command source。
- main task-run provider 通过 `service.runs.onCancelRequested(...)` 订阅被接受的取消请求，并通过 `capabilities.taskRuns.cancelRequested` 通知 host abort 对应 local handle signal。
- extension handle 的 cancel/abort 由 task run cancel 和 extension host dispose 驱动。
- Bangumi 长时 command handler 通过 `kisaki.taskRuns.create({ operation: '<extensionLocalOperation>', initiator: event.source })` 创建 extension-owned run 并返回 `runId`。
- Bangumi job runner 不再接收 command event，不调用 `event.reportProgress()` 或 `event.checkpoint()`。
- Bangumi job runner 使用 `isExtensionTaskRunCancellation(error)` 区分 `run.cancel()` 和 `run.fail(error)`。
- Bangumi settings panel 通过 `kisaki.taskRuns.listActiveOwn()` 判断 active run，不保存 execution id。
- Bangumi 推荐自动化使用 `kisaki.automations`，不使用 `backgroundTasks`。

## Phase 7: Scanner migration

修改：

```text
apps/desktop/src/shared/scanner.ts
apps/desktop/src/main/services/scanner/service.ts
apps/desktop/src/main/services/scanner/ipc.ts
apps/desktop/src/main/services/scanner/handlers/common/runner.ts
apps/desktop/src/main/services/scanner/handlers/common/types.ts
apps/desktop/src/main/services/scanner/handlers/game/handler.ts
apps/desktop/src/renderer/src/stores/scanner.ts
apps/desktop/src/renderer/src/features/scanner/components/scanner-item.vue
```

删除：

```text
scanner:scan-progress
scanner:get-active-scans
```

验收：

- scanner run 创建 `category: 'scanner'`、`operation: 'scanner.scan'`。
- pause/resume/abort 通过 task-run controls 或 scanner IPC 委托到 run。
- scanner 页面从 task-run store 派生 active state。
- scanner.finished 仍作为低频 domain event。
- 任务中心能显示扫描进度、暂停、继续、取消和结果。

## Phase 8: Ingest use cases

新增 main use case：

```text
apps/desktop/src/main/services/ingest/batch/
  game.ts
  person.ts
  company.ts
  character.ts
  types.ts
```

修改：

```text
apps/desktop/src/main/services/ingest/service.ts
apps/desktop/src/main/services/ingest/ipc.ts
apps/desktop/src/main/services/ingest/handlers/*
apps/desktop/src/main/services/ingest/use-cases/*
apps/desktop/src/shared/ingest/update/*
apps/desktop/src/renderer/src/components/shared/*/forms/metadata-update-form-dialog/batch-*.vue
apps/desktop/src/renderer/src/features/adder/components/*-adder-dialog.vue
```

验收：

- renderer 不再循环执行批量 search/update。
- batch IPC 返回 `runId`。
- 现有单项 ingest 添加/更新能力只要涉及抓取、下载、解析、图片处理或多阶段写入，也创建 task run。
- 单项 ingest 操作和 TaskRun 包装分离，批量流程复用纯单项逻辑。
- 批量流程调用纯单项 ingest 操作时传入 `{ signal: context.signal }`，不为每个 item 创建子 task run。
- 纯单项操作不调用 TaskRunService、不 report task progress、不接收父 run runtime。
- 单项操作可以接收 `AbortSignal`，用于取消网络、下载、文件处理和安全边界检查。
- 批量流程在 item 边界调用父 run checkpoint；当前 item 内部通过 signal 尽早停止可取消子步骤。
- 父批量 use case 独占 aggregate progress 和 result 汇总。
- 单项添加完成时 `result.output` 包含新实体 id。
- 任务中心显示批量进度和失败摘要。
- 失败列表有上限。

## Phase 9: Extension package tasks

修改：

```text
apps/desktop/src/main/services/extension/service.ts
apps/desktop/src/main/services/extension/packages/abort.ts
apps/desktop/src/main/services/extension/packages/phases.ts
apps/desktop/src/main/services/extension/packages/preparer.ts
apps/desktop/src/main/services/extension/installer/manager.ts
apps/desktop/src/main/services/extension/updates/manager.ts
apps/desktop/src/renderer/src/features/extension/components/extension-install-dialog.vue
apps/desktop/src/renderer/src/features/extension/components/extension-update-dialog.vue
```

验收：

- renderer 不再生成 package operation id。
- install/update IPC 返回 `runId` 或可在当前 dialog 中跟踪 run。
- run 创建 `category: 'extension'`；包处理使用 run id 作为 package workspace id，不再维护独立 package operation registry。
- download/verify/extract/commit phase 显示在任务中心。
- commit 阶段取消按钮不可用。
- 扩展安装完成后结果进入 task run history。

## Phase 10: Updater and extension repository refresh

修改：

```text
apps/desktop/src/main/services/updater/service.ts
apps/desktop/src/main/services/updater/updates.ts
apps/desktop/src/main/services/updater/ipc.ts
apps/desktop/src/shared/updater.ts
apps/desktop/src/renderer/src/stores/updater.ts
apps/desktop/src/renderer/src/features/updater/components/updater-dialog.vue
apps/desktop/src/main/services/extension/repositories/manager.ts
apps/desktop/src/main/services/extension/ipc.ts
apps/desktop/src/shared/extension/dto.ts
apps/desktop/src/renderer/src/features/extension/components/repository-panel/repository-panel.vue
```

验收：

- `updater:check-for-updates` 返回 `TaskRunStartResult`，run 创建 `category: 'updater'`、`operation: 'updater.check'`。
- `updater:download-update` 返回 `TaskRunStartResult`，run 创建 `category: 'updater'`、`operation: 'updater.download'`，并使用 byte progress。
- updater store 仍保存 update availability、downloaded state 和 changelog cache，但下载运行态、速度、结果和错误以 TaskRun 为准。
- `extension:refresh-repository` 返回 `TaskRunStartResult`，run 创建 `category: 'extension'`、`operation: 'extension.repository.refresh'`。
- `extension:refresh-repositories` 返回 `TaskRunStartResult`，run 创建 `category: 'extension'`、`operation: 'extension.repository.refreshAll'`。
- repository manager 继续拥有 fetch、snapshot persistence、catalog rebuild 和 URL policy。
- repository refresh result 写入 TaskRun result counters/warnings/output 的有限摘要。
- automatic update 触发的 refresh/download 使用 system initiator 或明确的 producer initiator，不伪装成 user。

## Phase 11: Notify cleanup

全仓库搜索：

```powershell
rg -n "notify\\.loading|notify\\.update" apps/desktop/src/renderer/src apps/desktop/src/main extensions packages
```

处理规则：

- 短流程保留 notify。
- 长流程迁移到 task run。
- main-initiated 长流程可启用 task notify presentation。
- loading toast 应可关闭。
- 关闭 toast 不取消 task run。
- renderer 组件不把 toast id 当作运行状态。

验收：

- 批量、扫描、长时命令、自动化、扩展安装更新不再以 notify loading 作为唯一反馈。
- notify 仍用于保存成功、错误提示等短反馈。

## Phase 12: Documentation and skill references

更新：

```text
.codex/skills/kisaki/references/architecture.md
.codex/skills/kisaki/references/ipc-events.md
.codex/skills/kisaki/references/renderer.md
.codex/skills/kisaki/references/extension-system.md
.codex/skills/kisaki/references/extension-api.md
docs/task-run-system/07-extension-api-and-bangumi-refactor.md
```

目标语义：

- `AutomationService` 是持久自动化配置和调度服务。
- `TaskRunService` 是可复用的长流程运行实例基础设施，负责 producer 显式创建的 run 生命周期、progress snapshot、控制信号、任务中心读模型和有限 completed history。
- `TaskRunService` 不替代业务服务、automation、updater、extension 等领域 owner；业务状态、触发记录和领域历史仍由对应 owner 持久化。
- CommandService 只是 command registry 和薄调用路由；长时 command handler 返回真实 producer 创建的 `runId`。
- 扩展长时 command 使用 `kisaki.taskRuns` scoped capability，而不是 command progress。
- scanner active progress 从 task run store 派生。
- notify loading 是 task run notification presentation，不是状态源。
- TaskRun 使用 `category`、`operation`、`owner`、`initiator`、`subject`。
- `subject` 不包含 renderer route；导航由 renderer 根据 `subject.type + subject.id` 推导。

## Negative search checklist

实施完成后，这些搜索应没有不合理结果：

```powershell
rg -n "BackgroundTaskService|background-task|backgroundTasks|capabilities\\.backgroundTasks" apps/desktop/src packages/extension-api packages/extension-sdk extensions
rg -n "scanner:scan-progress|scanner:get-active-scans" apps/desktop/src
rg -n "CommandNotificationCoordinator|CommandExecutions|CommandExecutionProgress|CommandExecutionStartResult|command:start|command:wait|command:get-progress|command:cancel|command:progress|command\\.progressed|reportProgress|contributions\\.commands\\.reportProgress" apps/desktop/src packages/extension-api packages/extension-sdk extensions
rg -n "category: 'command'|operation: 'command\\.execute'|command\\.execute" apps/desktop/src packages/extension-api packages/extension-sdk extensions
rg -n "finishFromError|finish\\(result|capabilities\\.taskRuns\\.finish" apps/desktop/src packages/extension-api packages/extension-sdk extensions
rg -n "markStaleActiveRuns|Application exited before task finished" apps/desktop/src
rg -n "notify\\.loading" apps/desktop/src/renderer/src/components/shared/*/forms/metadata-update-form-dialog apps/desktop/src/renderer/src/features/adder
rg -n "startedAt" apps/desktop/src packages extensions | rg "TaskRunStartResult|return \\{ runId"
```

保留结果必须有明确理由，例如 changelog 或旧设计文档引用。

## Positive search checklist

这些搜索应能找到目标实现：

```powershell
rg -n "TaskRunService|task-run" apps/desktop/src/main apps/desktop/src/shared apps/desktop/src/renderer/src
rg -n "task_run_history|taskRunHistory|TaskRunHistoryStore" apps/desktop/src/main apps/desktop/src/shared
rg -n "TaskRunCategory|TaskRunOperation|TaskRunOwner|TaskRunInitiator|TaskRunSubject" apps/desktop/src/shared apps/desktop/src/main apps/desktop/src/renderer/src
rg -n "AutomationService|automations" apps/desktop/src packages/extension-api packages/extension-sdk extensions
rg -n "checkpoint\\(" apps/desktop/src/main extensions
rg -n "task-run:changed" apps/desktop/src
rg -n "kisaki\\.taskRuns|capabilities\\.taskRuns|ExtensionTaskRun|cancelRequested" packages/extension-api packages/extension-sdk apps/desktop/src/main extensions
rg -n "progress\\.counters|extension\\.repository\\.refresh|updater\\.download" apps/desktop/src
```

## Verification commands

基础验证：

```powershell
pnpm --filter kisaki typecheck
pnpm --filter kisaki lint
pnpm --filter kisaki build
```

如果 extension API/SDK 改名：

```powershell
pnpm build:extension-tooling
pnpm -r --parallel typecheck
pnpm -r --parallel lint
```

## Manual acceptance scenarios

### Command

1. 运行一个 Bangumi command。
2. `CommandService` 只调用 command handler。
3. Bangumi handler 通过 `kisaki.taskRuns.create({ operation: 'fullSync', initiator: event.source })` 创建 task run 并返回 `runId`。
4. 任务中心出现 run 并更新 progress。
5. 点击取消后 task run signal 在 handler checkpoint 生效。
6. 完成后已完成 tab 能看到 result。

### Automation

1. 创建一个 startup 或 cron automation。
2. 手动运行。
3. automation 页面从 `automation_run_history` 显示 command invocation 历史。
4. 若 command handler 创建 TaskRun，任务中心独立显示实际长任务状态，automation 页面不链接该 TaskRun。
5. 若 command handler 没有创建 TaskRun，automation history 仍记录本次 invocation 的完成或失败。

### Scanner

1. 启动 scanner。
2. 任务中心显示扫描进度。
3. scanner 页面和任务中心状态一致。
4. 暂停、继续、取消都能生效。
5. 完成后可查看新增/跳过/失败摘要。

### Single ingest

1. 从 scraper 添加一个游戏。
2. main 创建 `ingest.game.add` run。
3. 任务中心显示抓取、写入和完成状态。
4. 完成后 result output 包含 `gameId`。

### Batch metadata update

1. 选择多个实体批量更新。
2. dialog 提交后 main 创建 run。
3. 任务中心展示进度、速度和失败数。
4. 每个 item 调用纯单项 ingest 操作并传入 `{ signal: context.signal }`，不创建子 task run。
5. 关闭原 dialog 后仍可查看结果。

### Extension install/update

1. 安装扩展。
2. 任务中心显示 download/verify/extract/commit。
3. commit 阶段取消不可用。
4. 成功或失败后保留结果。

### Extension repository refresh

1. 刷新单个扩展仓库。
2. IPC 返回 `runId`，任务中心显示 `extension.repository.refresh`。
3. 刷新全部扩展仓库时显示 `extension.repository.refreshAll`。
4. 完成后 result 显示 success/not-modified/failed 摘要。

### Updater

1. 检查更新。
2. IPC 返回 `runId`，任务中心显示 `updater.check`。
3. 下载更新时显示 `updater.download` byte progress、速度和结果。
4. `quit-and-install` 不创建普通 task run。

## 完成标准

必须满足：

1. `TaskRunService` 是应用长流程运行实例的通用基础设施；对已创建的 active run 提供任务中心运行时读模型，并在完成后写入有限 task run history。
2. 任务中心通过 `task-run:*` IPC 和 store 展示状态。
3. 高频进度不走 TaskRun AppEvents；通用 SQLite `db.*` trigger events 可以存在，但不是 task center 状态源。
4. notify 不再作为长流程状态源，但仍可作为可关闭 presentation。
5. CommandService 只是 registry 和薄调用路由，不拥有 execution id、progress、cancel、result 或 history。
6. automation 与 task run 语义分离，automation history 由 AutomationService 独立持久化，不保存 run id 或任何 TaskRun 引用。
7. scanner 进度进入 task run。
8. 批量 renderer 循环迁到 main use case。
9. 单个耗时 ingest 操作进入 task run。
10. extension package operation 进入 task run。
11. extension repository refresh 和 updater download/check 进入 task run。
12. extension long command 使用 scoped `kisaki.taskRuns`，command progress API 被删除。
13. active runs 不落 DB；crash/restart 后不会残留 queued/running/paused/cancelling 假状态，也不会补写 synthetic failed history。
14. 所有新增服务、IPC、renderer 组件符合 Kisaki 命名和边界规范。
