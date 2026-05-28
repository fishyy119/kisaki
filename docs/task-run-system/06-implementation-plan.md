# 06 Implementation Plan

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
task_runs
task_run_events
```

生成 migration：

```powershell
pnpm --filter kisaki drizzle-kit generate
```

验收：

- `TaskRun`、`TaskRunProgress`、`TaskRunResult`、`TaskRunEvent` 类型位于 shared。
- IPC contracts 包含 `task-run:*`。
- DB custom JSON types 有 shape validation。
- Migration 可运行。

## Phase 2: TaskRunService

新增：

```text
apps/desktop/src/main/services/task-run/service.ts
apps/desktop/src/main/services/task-run/ipc.ts
apps/desktop/src/main/services/task-run/runs/manager.ts
apps/desktop/src/main/services/task-run/history/store.ts
apps/desktop/src/main/services/task-run/history/retention.ts
apps/desktop/src/main/services/task-run/notifications.ts
apps/desktop/src/main/services/task-run/rate.ts
apps/desktop/src/main/services/task-run/context.ts
apps/desktop/src/main/services/task-run/validation.ts
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
- `TaskRunService` 初始化早于 command/scanner/extension。
- 可以通过 IPC list/get/cancel/pause/resume/dismiss。
- `task-run:changed` 发送完整 snapshot。
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

## Phase 4: CommandService rewrite

修改：

```text
apps/desktop/src/shared/command.ts
apps/desktop/src/main/services/command/types.ts
apps/desktop/src/main/services/command/executions.ts
apps/desktop/src/main/services/command/service.ts
apps/desktop/src/main/services/command/ipc.ts
apps/desktop/src/main/services/command/notifications.ts
packages/extension-api/src/capabilities/commands.ts
packages/extension-api/src/contributions/commands/contracts.ts
apps/desktop/src/main/services/extension/contributions/commands/point.ts
apps/desktop/src/main/services/extension/capabilities/commands.ts
apps/desktop/src/main/services/extension/runtime/host/contributions/commands/point.ts
```

删除：

```text
apps/desktop/src/main/services/command/notifications.ts
```

如果有少量 command-specific presentation helper，可以迁移到 task-run notifications。

验收：

- command execution id 等于 task run id。
- command progress 从 TaskRunService 读取。
- command cancel 委托 task-run cancel。
- extension command event 暴露 `checkpoint()`。
- 旧 command notify coordinator 不存在。
- Bangumi command 仍可 report progress 和响应 cancel。

## Phase 5: Automation rename

新增或重命名：

```text
apps/desktop/src/main/services/automation/
apps/desktop/src/shared/automation.ts
apps/desktop/src/renderer/src/features/automation/
packages/extension-api/src/capabilities/automations.ts
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
- 无需兼容旧数据。

验收：

- UI 文案为“自动化”，不再叫“后台任务”。
- automation run record 保存 `runId`。
- automation cancel 根据 `runId` 取消 task run。
- extension API 使用 `kisaki.automations`。
- Bangumi automation tab 改用新 API。

## Phase 6: Scanner migration

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

- scanner run 创建 TaskRun。
- pause/resume/abort 通过 task-run controls 或 scanner IPC 委托到 run。
- scanner 页面从 task-run store 派生 active state。
- scanner.finished 仍作为低频 domain event。
- 任务中心能显示扫描进度、暂停、继续、取消和结果。

## Phase 7: Ingest batch use cases

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
apps/desktop/src/shared/ingest/update/*
apps/desktop/src/renderer/src/components/shared/*/forms/metadata-update-form-dialog/batch-*.vue
apps/desktop/src/renderer/src/features/adder/components/*-adder-dialog.vue
```

验收：

- renderer 不再循环执行批量 search/update。
- batch IPC 返回 `runId`。
- 任务中心显示批量进度和失败摘要。
- 失败列表有上限。
- 单项添加若耗时明显，也可以创建 task run；很短流程可继续使用 local submit state。

## Phase 8: Extension package operations

修改：

```text
apps/desktop/src/main/services/extension/service.ts
apps/desktop/src/main/services/extension/packages/operations.ts
apps/desktop/src/main/services/extension/packages/preparer.ts
apps/desktop/src/main/services/extension/installer/manager.ts
apps/desktop/src/main/services/extension/updates/manager.ts
apps/desktop/src/renderer/src/features/extension/components/extension-install-dialog.vue
apps/desktop/src/renderer/src/features/extension/components/extension-update-dialog.vue
```

验收：

- renderer 不再生成 package operation id。
- install/update IPC 返回 `runId` 或可在当前 dialog 中跟踪 run。
- download/verify/extract/commit phase 显示在任务中心。
- commit 阶段取消按钮不可用。
- 扩展安装完成后结果进入 task run history。

## Phase 9: Notify cleanup

全仓库搜索：

```powershell
rg -n "notify\\.loading|notify\\.update" apps/desktop/src/renderer/src apps/desktop/src/main extensions packages
```

处理规则：

- 短流程保留 notify。
- 长流程迁移到 task run。
- main-initiated 长流程可启用 task notify presentation。
- renderer 组件不把 toast id 当作运行状态。

验收：

- 批量、扫描、命令、自动化、扩展安装更新不再以 notify loading 作为唯一反馈。
- notify 仍用于保存成功、错误提示等短反馈。

## Phase 10: Documentation and skill references

更新：

```text
.codex/skills/kisaki/references/architecture.md
.codex/skills/kisaki/references/ipc-events.md
.codex/skills/kisaki/references/renderer.md
.codex/skills/kisaki/references/extension-system.md
docs/bangumi-builtin-extension/06-settings-commands-and-tasks.md
```

替换旧语义：

- `BackgroundTaskService` -> `AutomationService`
- `background task panel` -> `automation page`
- `command notify progress` -> `task run notification presentation`
- `scanner progress store` -> `task run store`

## Negative search checklist

实施完成后，这些搜索应没有不合理结果：

```powershell
rg -n "BackgroundTaskService|background-task" apps/desktop/src packages/extension-api packages/extension-sdk extensions
rg -n "scanner:scan-progress|scanner:get-active-scans" apps/desktop/src
rg -n "CommandNotificationCoordinator" apps/desktop/src
rg -n "notify\\.loading" apps/desktop/src/renderer/src/components/shared/*/forms/metadata-update-form-dialog apps/desktop/src/renderer/src/features/adder
```

保留结果必须有明确理由，例如 changelog 或旧设计文档引用。

## Positive search checklist

这些搜索应能找到目标实现：

```powershell
rg -n "TaskRunService|task-run" apps/desktop/src/main apps/desktop/src/shared apps/desktop/src/renderer/src
rg -n "AutomationService|automations" apps/desktop/src packages/extension-api packages/extension-sdk extensions
rg -n "checkpoint\\(" apps/desktop/src/main extensions
rg -n "task-run:changed" apps/desktop/src
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
2. 任务中心出现 run。
3. progress 更新。
4. 点击取消后 command 收到 AbortSignal。
5. 完成后已完成 tab 能看到 result。

### Automation

1. 创建一个 startup 或 cron automation。
2. 手动运行。
3. automation 页面显示 linked run。
4. 任务中心显示实际执行状态。
5. automation history 不复制大 output。

### Scanner

1. 启动 scanner。
2. 任务中心显示扫描进度。
3. scanner 页面和任务中心状态一致。
4. 暂停、继续、取消都能生效。
5. 完成后可查看新增/跳过/失败摘要。

### Batch metadata update

1. 选择多个实体批量更新。
2. dialog 提交后 main 创建 run。
3. 任务中心展示进度、速度和失败数。
4. 关闭原 dialog 后仍可查看结果。

### Extension install/update

1. 安装扩展。
2. 任务中心显示 download/verify/extract/commit。
3. commit 阶段取消不可用。
4. 成功或失败后保留结果。

## 完成标准

必须满足：

1. `TaskRunService` 是应用长时执行实例唯一运行时读模型。
2. 任务中心通过 `task-run:*` IPC 和 store 展示状态。
3. 高频进度不走 AppEvents。
4. notify 不再作为长流程状态源。
5. command execution 由 task run backed。
6. automation 与 task run 语义分离。
7. scanner 进度进入 task run。
8. 批量 renderer 循环迁到 main use case。
9. extension package operation 进入 task run。
10. 所有新增服务、IPC、renderer 组件符合 Kisaki 命名和边界规范。
