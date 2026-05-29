# 01 Current State And Target

## 当前事实

项目已经存在多个“长时执行”的局部模型。

### Command execution

`CommandService` 已经支持：

- 命令注册和列表。
- `start` / `wait` / `execute`。
- `cancel`。
- `reportProgress`。
- `command:started`、`command:progress`、`command:finished` IPC。
- 可选 notify loading presentation。

局限：

- 完成结果只在内存中保留最近 100 条。
- 状态只有 `running` 和 `cancelling`。
- 没有暂停/继续。
- 命令执行历史不是一个可持久查看的应用级运行记录。
- notify coordination 与 command execution 强绑定。

### Background task

当前 `BackgroundTaskService` 持久化：

- command id。
- args。
- startup/cron triggers。
- failure policy。
- 最近 50 条 run history。

它实际是自动化配置，不是应用级长时任务运行时。它的运行态通过 `runningTaskIds` 和 command execution id 间接维护。

### Scanner

Scanner 已经有比较完整的运行态：

- queued/scanning/pausing/paused/aborting/completed/aborted。
- pause/resume/abort。
- active scans 查询。
- `scanner:scan-progress` 高频 IPC。
- renderer `scanner` Pinia store。

局限：

- 运行态只属于 scanner 页面。
- 完成状态从 active map 删除，不形成统一历史。
- 进度、结果、错误不进入应用级任务中心。

### Extension package operations

扩展安装、更新、本地导入已经有 operation registry：

- operation id。
- kind。
- phase。
- cancellation。
- AbortController。

局限：

- phase 只在 main 内部使用。
- renderer 只在当前 dialog 里看到 installing/updating boolean。
- 不能在全局入口查看进度、取消或结果。

### Renderer-owned batch flows

批量元数据更新、添加等流程有不少逻辑在 renderer 中：

- renderer 循环调用 search/update IPC。
- renderer 用 `notify.loading` 和 `notify.update` 反馈进度。
- 失败列表只存在当前函数局部变量。

局限：

- 关闭 dialog 或刷新 UI 后无法查看。
- 不能统一取消。
- 任务状态和结果散落在组件代码里。
- 主进程无法作为长时流程的事实源。

## 根本问题

当前问题不是缺少一个 UI，而是缺少一个清晰的应用级运行时边界。

如果只做 UI：

- 只能拼接 command/scanner/background-task/extension 的局部状态。
- 结果和错误仍然分散。
- 速度、ETA、完成历史、取消/暂停控制无法统一。
- 新增长时流程时仍然容易继续散落 `notify.loading`。

如果把所有长时流程都注册为 command：

- command registry 会承担“所有异步事情”的职责。
- scanner、extension package、批量导入等领域会被迫伪装成 command。
- pause/resume、队列、阶段、目标对象、结果摘要等领域差异会挤进 command contract。
- command 与 automation 的语义会更加混乱。

## 核心决策

新增 `TaskRunService`，作为长时执行实例的唯一运行时读模型。

规则：

1. 任何需要进入任务中心的长时流程必须创建 `TaskRun`。
2. `TaskRunService` 是长任务进度、结果和完成历史的唯一事实源。
3. 创建者通过 `TaskRunHandle` 控制生命周期，通过 `TaskRunContext` 上报进度并检查取消/暂停。
4. `TaskRunService` 不接收业务 executor，不调度业务流程。
5. `CommandService` 只维护 command registry 和薄调用路由，不拥有 execution id、进度、取消、结果或历史。
6. 长时 command handler 只能调用实际业务 use case 或 scoped task-run API 创建 TaskRun，并返回 `runId`。
7. 自动化配置和触发历史由 `AutomationService` 承载，自动化 invoke command，并为每次实际 command invocation 写入独立 `automation_run_history`；即使 handler 创建 TaskRun，自动化历史也不保存 run id 或任何 TaskRun 引用。
8. 扩展长时 command 通过 scoped `kisaki.taskRuns` 创建、上报和结束自己拥有的 TaskRun，不通过 command progress。
9. 高频进度流使用 `task-run:*` IPC 和 renderer store，不使用 TaskRun AppEvents。
10. notify 只订阅 task run 变化生成可关闭 toast，不作为业务状态源。

## 目标

- 统一展示所有应用级长时任务。
- 支持进行中和已完成两个视图。
- 展示阶段、进度、速度、ETA、耗时、结果、错误和关联对象。
- 支持取消、暂停、继续和重试，其中暂停/继续必须是协作式能力。
- 持久化完成历史，避免完成后只能看 toast。
- 清理 renderer 中的长时循环和散落 loading toast。
- 将旧 `BackgroundTaskService` 重命名并重塑为自动化配置服务。
- 让被 command 入口触发的真实 producer、扫描器、扩展安装、批量更新都接入同一运行时。
- 保持服务边界清晰，不引入一个 import 所有业务服务的中央协调器。

## 非目标

- 不做跨进程强制线程挂起。
- 不让 `TaskRunService` 调度所有业务流程。
- 不把所有业务流程注册成 command。
- 不为旧 IPC、旧 extension API、旧 DB 表名保留兼容层。
- 不把每一次高频 progress 都写入 TaskRun AppEvents、DB row 或 DB event log。
- 不在 renderer 直接访问 SQLite task run 表。
- 不在低层 handler 中调用 notify。
- 不把用户私密内容、完整 HTTP body、完整 DB row 或大数组写入 task result。

## 目标边界图

```text
CommandService
  owns command registry and thin invocation routing
  does not own execution ids, progress, cancellation, results or history
  long-running handlers return the runId created by the real producer

AutomationService
  owns persistent schedules, failure policy and automation_run_history
  invokes commands without storing TaskRun references in automation history

ScannerService
  owns scanner discovery, queue and scanner-specific rules
  reports scan run state through TaskRunContext

IngestService
  owns add/update workflows
  exposes batch use cases that create TaskRun instances

ExtensionService
  owns package install/update/uninstall operations
  reports operation phase through TaskRunContext
  exposes scoped kisaki.taskRuns for extension-owned long runs

TaskRunService
  owns run snapshots, progress, history, controls, IPC and task center presentation
```

## 设计原则

### 运行态统一，业务所有权不统一

`TaskRunService` 不知道如何扫描、安装扩展、更新元数据或同步 Bangumi。它只知道一次运行的生命周期。

### 快照是事实源

每次 `task-run:changed` 推送都是完整 task run snapshot，renderer store 直接替换。组件不根据增量事件拼状态。

高频 progress update 可以在 main process 内合并和节流，但每次对 renderer 可见的推送仍然必须是完整 snapshot。生命周期、控制状态和 final snapshot 必须立即 flush。

TaskRun 使用 `category` 做 UI 分组，使用 `operation` 描述具体操作，使用 `owner` 描述归属和权限范围，使用 `initiator` 描述启动来源，使用 `subject` 描述关联业务对象。自动化是 initiator，不是 task run category；扩展权限看 owner，不看 initiator。

### Progress 是瞬时状态，Result 是完成事实

进度可以频繁变化；结果只在结束时产生。UI 不从最后一条 progress 推断完成结果。

### 暂停/继续必须协作式

只有任务代码在安全边界调用 `await context.checkpoint()` 时，暂停才生效。没有 checkpoint 的任务不声明 `pausable`。

### Notification 是派生视图

toast 可以显示任务开始、进度和完成，但任务中心和 task run store 才是运行状态源。loading toast 应该可关闭，关闭 toast 不取消任务。

### 历史持久化受限

TaskRun history 持久化长任务 final snapshot、结果摘要、错误和计数，不持久化无限日志、高频 progress 或敏感数据。自动化历史由 AutomationService 持久化 command invocation 结果，保存触发来源、命令和错误；它不从 TaskRun history 派生，不保存 run id，也不复制 TaskRun progress/result。CommandService 不保存命令历史；需要历史的业务域应拥有自己的记录。
