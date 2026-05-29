# Task Run System 设计与实施文档

本文档集定义 Kisaki 长时任务运行时、任务中心 UI、命令系统、自动化、扫描器、批量导入/更新和扩展包操作的目标形态。

本次设计不考虑向后兼容：旧的零散 `notify.loading` 长流程、旧 `BackgroundTaskService` 命名、旧 scanner 专用进度 IPC、旧 command-only 进度中心、旧 renderer 批量循环执行模型都可以被删除或重写，不保留 alias、shim、双写或降级路径。

核心结论：

```text
Command 是可执行动作定义。
Automation 是持久自动化配置。
TaskRun 是一次正在运行或已经完成的长时执行实例，也是进度、结果和完成历史的唯一事实源。
Task Center 只展示 TaskRun。
Notify 是 TaskRun 的可选展示层，不是状态源。
```

## 文档结构

- [01-current-state-and-target.md](01-current-state-and-target.md): 当前事实、问题、目标、非目标和核心决策。
- [02-domain-model-and-contracts.md](02-domain-model-and-contracts.md): TaskRun 领域模型、状态机、进度、结果、DB 和 IPC 合同。
- [03-main-process-architecture.md](03-main-process-architecture.md): 主进程服务结构、生命周期、协作式取消/暂停、通知和错误边界。
- [04-producer-adapters.md](04-producer-adapters.md): Command、Automation、Scanner、Ingest、Extension package 和 Updater 的接入方式。
- [05-renderer-task-center-ui.md](05-renderer-task-center-ui.md): 任务中心 Dialog、侧边栏入口、Pinia store、列表和详情交互。
- [06-implementation-plan.md](06-implementation-plan.md): 文件级实施顺序、迁移策略、验证命令和完成标准。
- [07-extension-api-and-bangumi-refactor.md](07-extension-api-and-bangumi-refactor.md): `kisaki.taskRuns` public extension API、RPC/SDK/host provider 和现有 Bangumi 扩展重构。

## 总体目标

新增应用级 `TaskRunService`，统一承载所有长时执行实例的运行状态、进度、速度、结果、错误、取消、暂停和完成历史。

目标架构：

```text
长时业务函数/扫描/导入/扩展包操作/长时命令 handler
  -> TaskRunService create 运行实例
  -> task-run:* IPC 推送和查询快照
  -> renderer task-run store
  -> 任务中心 Dialog 展示进行中和已完成
```

重要边界：

- `TaskRunService` 不 import scanner、ingest、extension、command 等业务服务。
- 业务服务显式创建 task run，通过 `TaskRunHandle` 结束生命周期，并通过 `TaskRunContext` 上报执行期进度。
- `TaskRunService` 不接收业务 executor，不调度业务流程。
- `CommandService` 不自动创建或转发 task run；长时 command handler 自己创建 task run。
- 扩展长时 command 通过 scoped `kisaki.taskRuns` 创建自己的 run，不再使用 command progress。
- 高频进度不走 AppEvents，只走 IPC/store 状态。
- notify 是任务状态的一种 presentation，不是任务状态源。
- 暂停/继续是协作式能力，不试图强行暂停任意 Promise。

## 命名决策

旧 `BackgroundTaskService` 语义不准确。它当前持久化的是“定时/启动触发的命令配置”，不是一次执行实例。

目标命名：

| 当前概念                | 目标概念               | 说明                             |
| ----------------------- | ---------------------- | -------------------------------- |
| `CommandService`        | `CommandService`       | 保留，定义和调用命令。           |
| `BackgroundTaskService` | `AutomationService`    | 持久自动化配置和调度。           |
| long command handler    | `TaskRun` producer     | 长时命令的实际函数自行创建 run。 |
| scanner active progress | `TaskRun`              | 扫描运行态进入 task run。        |
| extension package op    | `TaskRun`              | 安装/更新/导入包操作进入中心。   |
| renderer notify loading | `TaskRun` presentation | 长时流程状态不再散落在 toast。   |

UI 文案：

- `任务中心`: 显示所有正在运行和已完成的长时执行实例。
- `自动化`: 管理定时、启动时、手动触发的持久规则。
- `命令`: 可被用户、扩展或自动化调用的动作。

不使用 `Activity` 命名：

- `Activity` 更像通用活动流，容易吸纳普通日志、审计、最近操作和通知。
- 当前边界是长时执行实例，`TaskRun` 更准确。
- UI 叫“任务中心”时，`TaskRun` 和产品语义一致。

## 最终心智模型

```text
Command
  描述“可以做什么”

Automation
  描述“什么时候自动做某个 Command”

TaskRun
  描述“这一次做什么、谁触发、关联什么对象、做得怎么样”

Task Center
  展示“现在正在做什么、刚才做完了什么、结果是什么”
```

一句话原则：

```text
统一运行态，不统一业务所有权；统一展示，不把所有长流程伪装成命令。
```

TaskRun 内部使用：

```text
category: UI 分组
operation: 具体操作
initiator: 启动来源
subject: 关联业务对象
```
