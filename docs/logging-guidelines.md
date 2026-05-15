# Kisaki 日志设计与规范

本文定义 Kisaki 的统一日志规范：日志记录在哪里、由谁记录、记录什么、不记录什么，以及后续如何把现有散落的 `console` 和 `electron-log` 调用收束到一套可维护的体系。

## 核心结论

Kisaki 桌面运行期保留三个权威日志文件：`logs/main.log`、`logs/renderer.log` 和 `logs/extensions.log`。Main 进程拥有系统、服务、数据、扩展运行时和外部边界的诊断真相；renderer 进程只记录 UI/runtime 层自身能理解的异常和状态同步失败；扩展作者通过 `context.logger` 主动写出的日志进入 `extensions.log`。main / renderer 共享内部调用契约、字段、等级和安全写法；extension 日志保持公共 API 的 console-like 形状，由 host 补来源元数据并做传输边界保护。

日志不是强制只能在某一层级记录，而是由“拥有上下文的层”记录。能解释业务含义、恢复策略、操作 ID 和影响范围的地方，才是应该记录日志的地方；不能解释上下文的薄 adapter、shared mapper、纯 validation helper 不记录。

终端工具和构建脚本不是桌面运行期日志。`kisx`、`create-kisaki-extension` 和 `prepare-builtin-extensions.ts` 的输出属于 CLI/脚本交互输出，继续写 stdout/stderr，不进入桌面运行期日志文件。

## 当前状态

项目已经有一部分正确方向，但还没有统一边界。

- Desktop 已依赖 `electron-log`，入口在 `apps/desktop/src/main/index.ts` 调用 `log.initialize()`，main 服务里大量直接 `import log from 'electron-log/main'`。
- IPC 错误边界当前只把异常转成 `IpcResult`，`wrapIpc` / `wrapIpcVoid` 不记录日志，这是对的，因为 IPC adapter 没有足够业务上下文。
- Extension 公共 API 已有 `ExtensionLogger`，host 通过 `runtime.logger.log` 转发到 main，再由 main 写日志，这是应该保留的主路径。
- Extension host utility process 的 stdout/stderr 已由 `ExtensionHostController` 捕获并写入 main log，可作为 host 崩溃和兜底输出通道。
- Renderer 目前大量使用 `console.error` / `console.warn`，只有少量地方直接使用 `electron-log/renderer`。这会导致运行期日志不完整、不一致。
- `apps/desktop/src/shared/db/custom-types.ts` 里存在 `console.warn` / `console.error`。`shared/` 应保持纯类型和纯转换逻辑，这些日志应迁出。
- CLI 侧已有 `packages/extension-cli/src/logger.ts`，它是终端输出层，不应与桌面运行期日志混用。

## 目标架构

日志分四层，运行期文件按 app 进程和 extension context 来源拆分。

```text
main service/domain  ->  @main/logging  ->  electron-log/main  ->  userData/logs/main.log
renderer/core/ui     ->  @renderer/core/logger  ->  electron-log/renderer  ->  userData/logs/renderer.log
extension context    ->  context.logger  ->  runtime.logger.log RPC  ->  userData/logs/extensions.log
extension host infra ->  host logger or stdout/stderr capture  ->  userData/logs/main.log
```

### 文件位置

目标位置固定为：

```text
${app.getPath('userData')}/logs/main.log
${app.getPath('userData')}/logs/renderer.log
${app.getPath('userData')}/logs/extensions.log
```

具体环境：

- 开发模式：`apps/desktop/dev/app/logs/main.log`、`renderer.log` 和 `extensions.log`，以实际 `process.cwd()` 下的 `dev/app` 为准。
- 普通安装：Electron 当前用户数据目录下的 `logs/main.log`、`logs/renderer.log` 和 `logs/extensions.log`。
- 便携模式：`portable/logs/main.log`、`portable/logs/renderer.log` 和 `portable/logs/extensions.log`，因为 portable mode 会把 `userData` 指向 portable 目录。

实现要求：

- 日志路径必须由 `configureLogging()` 显式设置，不依赖 `electron-log` 默认路径。
- `configureLogging()` 必须在 `userData` 最终路径确定之后执行。
- main 入口必须先完成 pre-ready 路径选择，再初始化日志：开发模式先 `app.setPath('userData', path.join(process.cwd(), 'dev/app'))`；生产模式必须等待 `detectPortableMode()` 完成并确定 normal / portable 的最终 `userData`；随后才调用 `configureLogging()` 和 `electron-log` 的 renderer bridge 初始化。不要在 `userData` 未确定时调用 `log.initialize()`、访问 file transport，或写任何运行期日志。
- `configureLogging()` 必须显式创建和配置 `main`、`renderer`、`extensions` 三个日志 target / logger instance，不依赖 `electron-log` 的默认 renderer 文件名或默认 `logId` 路由。
- renderer logger 必须使用固定 `logId`，main 侧必须在 renderer 启动前创建同 `logId` 的 logger instance，并把它的 file transport 指向 `logs/renderer.log`。否则 `electron-log/renderer` 的 IPC transport 可能落回 main 默认 logger。
- 当前不额外设计日志滚动或多文件保留机制。保留 `electron-log` 文件 transport 的默认 `maxSize` 和归档行为即可；若未来需要更强的容量治理、保留天数或 per-extension fan-out，再另起设计。
- 日志目录是支持包的一部分，后续若提供“导出诊断信息”，只收集 `logs/`、版本信息和必要的配置摘要，不收集数据库、扩展 secrets 或用户内容。`extensions.log` 属于第三方插件输出，导出时必须明确标注，最好允许用户预览或排除。
- `extensions.log` 只接收扩展作者通过 `context.logger` 主动写出的日志。扩展运行时生命周期、安装/卸载、RPC timeout、host crash、stdout/stderr 兜底仍属于 app runtime 事实，记录在 `main.log`。
- 若未来扩展作者日志噪声明显，可以在保留 `logs/extensions.log` 汇总文件的同时增加可选 fan-out 文件，例如 `logs/extensions/<extensionId>.log`。

## 允许的 API

权威运行期日志必须走对应层的 logger facade。`console.*` 不是统一诊断日志 API，但可以作为少量边界场景、DevTools 观察、CLI/脚本交互和 logger 不可用时的兜底输出。判断标准是：这条信息是否应该进入支持包和持久诊断文件；如果是，使用 logger facade；如果只是启动路径判定前的兜底、终端交互、浏览器 DevTools 临时观察或第三方 host 崩溃前输出，可以使用 `console` / stdout / stderr。

业务代码仍不应直接导入 `electron-log/*`。`electron-log` 是底层 transport，只允许 logging facade 内部使用；迁移期已有直接 import 可以逐步收束，新代码不要继续扩散。

| 位置                                                       | 权威日志 API                                    | `console` / stdout / stderr 使用边界                             |
| ---------------------------------------------------------- | ----------------------------------------------- | ---------------------------------------------------------------- |
| `apps/desktop/src/main/**`                                 | `@main/logging` 的 scoped logger                | CLI 输出、`userData` 判定和 logger 初始化前的最小兜底            |
| `apps/desktop/src/renderer/src/**`                         | `@renderer/core/logger`                         | DevTools-only 观察、临时调试、不会进入支持包的浏览器侧诊断       |
| `apps/desktop/src/preload/**`                              | 通常不记录普通业务日志                          | 桥接启动失败或 logger 不可用时的最小兜底                         |
| `apps/desktop/src/shared/**`                               | 不允许 runtime logger                           | 原则上不写；纯转换/validation 应返回 issue、fallback 或抛错      |
| `apps/desktop/src/main/services/extension/runtime/host/**` | host 内部 logger；扩展代码使用 `context.logger` | utility process 崩溃前、RPC/logger 不可用时的 stdout/stderr 兜底 |
| `packages/extension-cli/**`                                | CLI logger/stdout/stderr                        | 终端交互输出                                                     |
| `scripts/**`                                               | stdout/stderr                                   | 构建、准备和 CI 输出                                             |

`console` 使用必须少而明确：

- `apps/desktop/src/main/index.ts` 的 `--help` 和 `--version` 输出可以继续用 `console.log`，它们是 CLI 输出，不是应用日志。
- `userData` / portable mode 判定、日志系统配置前的启动错误，可以使用 `console.error` / stderr 做早期兜底；一旦 `configureLogging()` 完成，后续可诊断事实应走 logger。
- renderer 里只需要出现在 DevTools、且不需要进入支持包的局部诊断可以保留 `console.*`。会影响排障、跨进程同步、全局异常、store 初始化和 runtime 状态的失败应走 `@renderer/core/logger`。
- preload 在 `contextBridge.exposeInMainWorld` 失败时可以保留一次兜底 `console.error`，因为应用 logger 可能还不可用。
- utility process 崩溃前无法走 RPC 时，stdout/stderr 捕获是兜底通道，不是常规业务日志 API。

## Logger Facade 设计

建议新增：

```text
apps/desktop/src/main/logging/
  index.ts          # Explicit exports only.
  configure.ts      # configureMainLogging, configure log file targets.
  logger.ts         # createLogger and scoped Logger implementation.
  format.ts         # context serialization, bounds, error serialization.
  targets.ts        # main.log / renderer.log / extensions.log target writers.

apps/desktop/src/renderer/src/core/logger.ts

apps/desktop/src/shared/logging.ts
  # LogLevel, LogContext, Logger 等纯调用契约类型。
```

`index.ts` 必须只做显式 re-export，不放业务逻辑或初始化副作用，符合项目现有模块边界规则。

`electron-log` 只是底层 transport，不是业务调用 API。实现上应由 `configureLogging()` 创建固定的内部 logger identities，例如：

```text
kisaki-main        -> userData/logs/main.log
kisaki-renderer    -> userData/logs/renderer.log
kisaki-extensions  -> userData/logs/extensions.log
```

main facade 只写 `kisaki-main`；renderer facade 使用 `electron-log/renderer` 创建同名 `kisaki-renderer` instance，通过 IPC 交给 main 侧同 `logId` instance 写入 `renderer.log`；extension context log writer 只写 `kisaki-extensions`。不要让业务代码直接使用默认 `electron-log` singleton，也不要通过修改 `fileName` 期待默认 logger 自动分流。

“同一套 logger facade”首先指 main 与 renderer 内部代码共享同一个调用契约，而不是共用同一个带 Electron 依赖的实现文件：

```ts
export interface Logger {
  debug(message: string, context?: LogContext): void
  info(message: string, context?: LogContext): void
  warn(message: string, context?: LogContext): void
  error(message: string, context?: LogContext): void
}

export type LogLevel = 'debug' | 'info' | 'warn' | 'error'
```

`LogContext` 是调用侧的开放结构化字段，`error` 是唯一保留字段。调用方可以传入 `unknown`，由 logger 在写入前统一序列化、裁剪成 JSON-safe 输出：

```ts
export type LogContext = Readonly<Record<string, unknown>> & {
  readonly error?: unknown
}
```

这样最常见的错误日志可以直接写成：

```ts
log.error('Extension package install failed', { error })
log.error('Extension package install failed', { error, operationId, extensionId })
```

不要使用 `fields?, error?` 这种三参数形状。大多数 error / warn 日志都需要异常 stack，而普通 context 更少见；把 `error` 放在第三个参数会让常见路径变笨，也容易把 `Error` 误传成普通 context。

Extension author 面向的是公共 `context.logger` API，它可以保持 extension API 当前的 `message, ...args` 形状；host bridge 不把它转换成 app 内部 logger 的 `LogContext`，也不暴露 app 内部日志模型。

当前 extension public logger 保持 console-like 形状：

```ts
interface ExtensionLogger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}
```

这是正确的扩展作者 API：它足够小、稳定、接近 `console` 心智，不把桌面应用内部的 `LogContext`、target、scope 规则暴露给第三方扩展。扩展日志内容由插件作者负责，Kisaki 不对 `message` 或 `args` 做语义级安全校验或内容改写；host bridge 只负责自动补 `extensionId`、`extensionVersion`、`runtimeHandle`，并对 `message` / `args` 做序列化、长度、深度和循环引用等传输边界保护，然后写入 `extensions.log`。

Extension log bridge 必须有明确的硬边界。建议初始值：

- `message` 转成 string 后最多 4 KiB。
- `args` 最多保留前 16 个。
- 单个 string value 最多 8 KiB。
- object / array 序列化最大深度 4，单个 array 最多保留前 50 项，单个 object 最多保留前 50 个 enumerable key。
- 单条 extension log record 最多 64 KiB。

超过边界时裁剪并写入稳定占位，例如 `[Truncated]`、`[MaxDepth]` 或 `[Unserializable:<type>]`；不要因为第三方 extension 的日志参数不可序列化而让 `runtime.logger.log` 抛出并影响扩展执行。若写入 `extensions.log` 自身失败，只在 `main.log` 记录一次 app-owned warn，并带 `extensionId` / `runtimeHandle`，避免递归写 extension log。

不要在当前阶段把 `context.logger` 改成 app 内部 logger 的 `(message, context?)` 形状。这会把内部诊断模型暴露成公共 API，也会让扩展作者误以为结构化 context 会参与 app 内部控制流。若未来确实需要扩展内部 scope，可增量添加 `context.createLogger(scope)` 或 `context.logger.withScope(scope)`，但 v1 先保持单一 `context.logger`。

落地方式：

- `apps/desktop/src/shared/logging.ts` 只定义纯类型和字段契约，不导入 Electron、Node fs 或进程相关模块。
- `@main/logging` 实现 `createLogger(scope)`，写 `main.log`；同时提供 extension context log writer，写 `extensions.log`。
- `@renderer/core/logger` 实现同形状的 `createLogger(scope)`，并通过固定 renderer `logId` 写 `renderer.log`。
- extension author 仍只看到 `context.logger`；host bridge 把 `message, ...args` 作为第三方插件日志写入 `extensions.log`。
- main / renderer 的等级、字段名、error serialization、长度限制和序列化规则必须一致；如果两侧不能共享同一份 runtime helper，也必须共享同一份测试用例和 fixtures，确保输出形态一致。
- 不把 `LogRecord` 作为 shared 或公共契约。若实现内部需要中间对象，可以在 `@main/logging` 或 `@renderer/core/logger` 内部定义 `NormalizedLogEntry` 之类的私有类型。

main 和 renderer 使用同一种调用风格：

```ts
const log = createLogger('Extension.Runtime')

log.info('Extension host started', {
  pid,
  durationMs
})

log.warn('Extension unload failed; host will be restarted', {
  extensionId,
  cause,
  error
})
```

规范：

- message 使用稳定英文短句，不把动态 ID 拼进 message。
- 动态信息放在 context 对象里。
- `context.error` 由 logger 统一序列化 `name`、`message`、`stack`、`cause`，不要手动拼进 message。
- 每条日志自动带上 `origin`、`scope`、`pid`、`appVersion`、`mode`、`platform`。
- 需要跨异步流程排查的操作必须带 `operationId` 或已有业务 id。

### Logger 创建与传递

Logger 表达文件/模块身份，不表达某次操作的临时上下文。默认规则是：需要日志的文件在顶部声明一个 logger。不要每次写日志时临时 `createLogger()`，也不要把父级 logger 作为依赖一路传递。

`createLogger(scope)` 必须可以安全地在模块 import 阶段调用。main 入口会静态导入服务模块，服务文件顶部的 logger 声明会早于 `configureLogging()` 执行；因此 `createLogger()` 只能创建轻量 scoped facade，不能读取 `app.getPath('userData')`、创建文件 transport、初始化 `electron-log`、写文件或产生其他副作用。底层 `electron-log` instance、文件路径和 formatter 只能由 `configureLogging()` 在最终 `userData` 确定后绑定；logger 方法调用时再委托到已配置的 target。

原则上不应有运行期日志早于 `configureLogging()`。CLI `--help` / `--version` 继续走 `console.log` 并在日志系统初始化前退出；portable detection 失败等 pre-ready bootstrap 错误应在完成路径选择前使用最小 stderr/console 兜底，或在路径确定后再记录。若 facade 在异常情况下收到过早的日志调用，只能走非递归兜底或安全丢弃，不能触发默认 `electron-log` 路径写入。

推荐：

```ts
const log = createLogger('Extension.Runtime')

export class RuntimeManager {
  async startHost(): Promise<void> {
    log.info('Extension host started', { durationMs })
  }
}
```

规则：

- 所有需要日志的普通 `.ts` 文件都在 imports 后、其他顶层代码前声明 `const log = createLogger('<Scope>')`。
- Vue `.vue` 文件如果确实需要日志，在 `<script setup>` 顶部 imports 后声明。
- 一个文件默认只声明一个 logger。一个文件需要多个 scope，通常说明文件职责过宽，应优先拆分文件。
- Service 根使用服务级 scope，例如 `Extension`。服务第一层子模块使用自己的文件顶部 logger，例如 `Extension.Runtime`、`Extension.Repositories`，不要复用父级 logger。
- 不把 logger 放进 constructor 参数、函数参数或 options 对象。特别小、紧耦合、无独立身份的 helper 如果需要日志，优先让调用方记录结果，而不是把 logger 传进去。
- 不要在热路径、循环、函数体内 create logger。
- 不要把 `operationId`、`extensionId`、`gameId`、`repositoryId` 绑定进 logger 实例；这些是 context 字段，不是 scope。
- 如果一次操作需要反复带同一组 context 字段，可以在函数内创建普通对象 `const context = { operationId, extensionId }` 并展开到每条日志，不需要创建新的 logger。

### Scope 规则

Scope 使用受控的多层级点分名称，不强制单层级，也不允许无限映射文件路径。

格式：

```text
<Domain>[.<SubdomainOrRole>][.<UseCase>]
```

规则：

- `origin` 和日志文件已经表达进程来源，scope 不再写 `Main` 或 `Renderer` 前缀。
- 第一层必须是稳定业务域或服务域，例如 `Extension`、`Db`、`Scanner`、`Launcher`、`Monitor`、`Updater`、`Ipc`、`Event`、`Library`、`Theme`。
- 第二层表达真实子模块或角色，例如 `Extension.Runtime`、`Extension.Repositories`、`Db.Attachment`、`Scanner.Game`。
- 第三层只在确实需要区分 use case 时使用，例如 `Extension.Packages.Recovery`、`Extension.InstalledPanel`、`Library.Explorer.Search`。
- 默认最多三层。不要把 class name、文件路径、函数名逐层塞进 scope。
- Scope 只放稳定分类，不放动态值。`extensionId`、`scannerId`、`gameId`、`repositoryId` 等必须放 context。
- 单个进程日志文件中的可见前缀只显示 scope，例如 `[Extension.Runtime] Extension host started`。不要在 `main.log` / `renderer.log` 的每行再显示 `[Main]` 或 `[Renderer]`。`origin` 可以作为结构化元数据保留，供日志聚合、支持包导出或跨文件搜索使用。

## 记录位置

日志应该由“拥有上下文的层”记录。

### 应记录

- 应用生命周期：启动、路径选择、服务初始化、关闭、强制退出。
- 长生命周期资源：数据库、窗口、IPC、scanner、monitor、launcher、extension host、updater。
- 后台任务和自动流程：开始、跳过原因、完成、失败、耗时。
- 外部边界：文件系统、网络、系统 shell、自动更新、native dialog、extension host RPC。
- 数据恢复和降级：package recovery、FTS rebuild、缩略图失败 fallback、清理失败。
- 运行时崩溃和未处理异常：main、renderer、extension host、Vue error boundary。

### 不应记录

- 普通用户操作的预期失败，如果 renderer 已经用通知或表单错误展示，且 main 没有额外诊断上下文。
- 每次组件渲染、每个 watcher、每个普通 IPC 请求。
- tight loop 中的每个 item。记录 summary：总数、成功数、失败数、耗时，必要时只在 debug 记录前 N 个样本。
- 纯函数、DTO mapper、validation helper、shared custom type 的内部细节。

### 各层责任

- `services/<service>/ipc.ts`：保持薄 adapter，不主动记录业务日志。异常由 `wrapIpc` 转成安全错误。
- service/domain/manager：记录拥有业务上下文的失败、恢复、生命周期和关键决策。
- renderer component：优先通过 notify 或 UI state 反馈用户。只有全局异常、无法恢复的 session cleanup、renderer-only runtime bug 才记录。
- composable/store：可以记录初始化失败、订阅失败、跨进程同步失败；不要在每个表单 submit 里重复打同类日志。
- extension code：只用 `context.logger`。扩展日志必须自动带 `extensionId`、`runtimeHandle`、`extensionVersion`。
- shared：不记录。需要诊断时返回结构化错误，让 main/renderer 边界记录。

## 等级规范

| Level   | 使用场景                                                                         |
| ------- | -------------------------------------------------------------------------------- |
| `debug` | 高频、排查用、默认生产文件可关闭的信息，例如缓存命中、候选过滤细节、批量处理样本 |
| `info`  | 正常但重要的生命周期和操作结果，例如服务 ready、扫描开始/完成、扩展加载完成      |
| `warn`  | 可恢复异常、降级、重试、清理失败、无效外部数据被跳过                             |
| `error` | 当前操作失败、需要用户或开发者关注的异常、数据一致性风险、运行时崩溃             |

禁止用 `error` 记录已被正常处理的业务分支。禁止用 `info` 记录高频循环细节。

## Context 规范

不要用全局 `LogFields` 枚举业务字段。日志 context 是开放的调用侧 record，字段由业务域按需要提供，logger 负责把它序列化、裁剪成 JSON-safe 输出。

```ts
export type LogContext = Readonly<Record<string, unknown>> & {
  /**
   * Reserved field. The logger serializes Error name, message, stack and cause.
   */
  readonly error?: unknown
}
```

字段命名规则：

- 字段名使用 `camelCase`。
- ID 用 `*Id`，例如 `extensionId`、`operationId`、`repositoryId`。
- 时长用 `*Ms`，例如 `durationMs`、`timeoutMs`。
- 数量用 `*Count`，例如 `packageCount`、`failureCount`。
- URL 默认只记录 host 或 origin，例如 `urlHost`、`artifactHost`；不要记录带 query 的完整 URL。
- 路径默认只记录 basename、root hash 或应用派生路径。用户选择的完整路径只能在 debug 且确认无敏感信息时记录。
- `error` 是唯一保留字段，由 logger 特殊序列化；业务字段不要叫 `error`。

禁止放入 context：

- 大对象、DTO、完整数据库行、完整 HTTP body。
- 用户正文、笔记、描述、评论、剪贴板内容。
- token、secret、cookie、Authorization header、OAuth code/state、private key。
- 无界数组或未裁剪的列表。批量操作记录 summary，例如 `successCount`、`failureCount`，必要时只记录前 N 个样本。

## 隐私与安全

本节规则约束 Kisaki app-owned 日志：main、renderer、host/runtime infra、内置服务和内置扩展代码。日志内容安全由调用方负责，敏感字段不应传给 logger；logger facade 不做语义级脱敏或安全审查，只做格式化、错误序列化、长度、深度、循环引用和不可序列化值处理。第三方扩展通过 `context.logger` 写入的内容由插件作者负责，宿主只做边界保护，防止日志输入破坏主进程稳定性。

永远不要记录：

- access token、refresh token、session、cookie、Authorization header。
- OAuth `code`、`state`、PKCE verifier、client secret。
- extension secrets/storage 的 value。
- 用户笔记、描述、评论、完整数据库行、剪贴板内容。
- 私钥、签名 key 文件内容、registry signing secret。
- 原始 HTTP 请求/响应 body，除非是明确的开发模式临时调试，并且不会进入生产文件。

路径规则：

- 用户显式选择的文件路径可以在 `debug` 中记录，但默认 `info` 只记录 basename、root hash 或业务 id。
- 安装包、扩展包、资源目录等应用派生路径可以记录，但仍避免无意义的绝对路径噪声。

## 错误与用户通知

日志和用户通知分离：

- 日志面向诊断，包含 stack、上下文字段、内部错误 cause。
- IPC `IpcError.error` 面向 renderer fallback 展示，保持安全英文摘要。
- 用户通知由 renderer 发起的操作在 renderer 层决定；main 不替用户点击触发的表单提交弹 toast。
- main 主动后台流程可以通知，但日志仍由 main service/domain 记录。

### Error 规范化

当前阶段不引入全局 `KisakiError` 作为强制规范。Kisaki 先统一错误写法，而不是统一错误 class：catch 后如果需要重新抛出，就抛出带语义、安全、可展示的 `Error.message`，并用 `cause` 保留原始错误。

`publicMessage` 暂不需要。Main IPC 当前只返回 `IpcError.error: string`，而 renderer 不应基于错误字符串做控制流；因此边界错误消息本身就应该是安全的用户 fallback 摘要。内部诊断细节放在日志 context 和原始 `cause` 里。

`code` 也不作为 desktop 内部错误的默认要求。只有调用方需要程序化分支，或者错误已经是公共协议的一部分时才需要 code，例如 extension public `ExtensionError`、UI callback result、registry risk code。普通 main service/domain 失败不需要为了日志或 IPC fallback 人为制造 code。

规则：

- 内部函数继续用 exception 表达失败，不把所有错误改成 `Result`。
- 只在需要增加业务语义、隐藏不安全底层信息、做 cleanup/recovery、或把外部库错误转换成应用错误时 catch。
- 语义化 throw 使用稳定英文消息，描述业务失败而不是底层实现失败，例如 `Failed to download extension package.`，不要直接把第三方错误字符串传给 renderer。
- unexpected failure 保留原始 error 作为 `cause`，不要丢 stack。
- catch 后如果只是 `throw error`，不应 catch。
- catch 后如果只想改 message，必须使用 `cause`。
- 同一个失败只在拥有上下文的层记录一次。下层抛出语义化错误，上层如果只是转交给 IPC 或 UI，不重复 log。
- 领域专用 Error class 可以存在，但只有在需要 `instanceof`、携带领域诊断、或参与公共协议时才创建。不要为了“规范化”而给每个领域都造错误类。
- `wrapIpc` / `wrapIpcVoid` 可以继续使用 `Error.message`，但服务/领域层必须保证穿过 IPC 的 message 是安全、简洁、语义化的。未知底层错误应先在拥有上下文的层转换。

标准转换：

```ts
try {
  await downloadArtifact()
} catch (error) {
  log.error('Extension artifact download failed', {
    error,
    operationId,
    extensionId,
    repositoryId,
    urlHost
  })

  throw new Error('Failed to download extension package.', {
    cause: error
  })
}
```

不推荐：

```ts
try {
  await operation()
} catch (error) {
  log.error('Operation failed', { error })
  throw new Error(String(error))
}
```

标准模式：

```ts
// service/domain
try {
  await operation()
} catch (error) {
  log.error('Extension package install failed', {
    error,
    operationId,
    extensionId,
    version
  })
  throw new Error('Failed to install extension package.', {
    cause: error
  })
}

// IPC adapter
ipc.handle('extension:install-release', async (_, request) =>
  wrapIpcVoid(() => service.installer.installRelease(request))
)

// renderer
const result = await ipcManager.invoke('extension:install-release', request)
if (!result.success) {
  notify.error('安装失败', result.error)
}
```

## Domain 规则

### Extension

- 扩展作者日志只走 `context.logger`。
- `context.logger` 输出写入 `extensions.log`，每条必须带 `extensionId`、`extensionVersion`、`runtimeHandle`，scope 固定为 `Extension.Context` 或由 host bridge 提供稳定扩展 scope。
- `context.logger` 的内容安全由插件作者负责；host bridge 不审查 message/args 的语义，只做有界序列化和传输稳定性保护。
- extension log bridge 的裁剪和不可序列化兜底是协议边界的一部分，不能只依赖当前 `toRpcValue` 的 best-effort JSON 转换。
- main 写扩展 runtime 日志时记录在 `main.log`，必须带 `extensionId`；活跃 runtime 内部事件尽量带 `runtimeHandle`。
- extension host stdout/stderr 只作为兜底，记录在 `main.log`；正常内部代码应该使用 host logger。
- 安装、更新、卸载、repository refresh 必须记录 operation 开始、提交成功、失败、恢复动作。

### IPC/Event

- 不记录所有 IPC request。
- 只记录异常的 cross-process failure：发送失败、窗口不存在导致丢弃、buffer 超限、event listener throw。
- `event:forward` 失败由 event manager/core logger 记录一次，不在订阅者里重复记录。

### DB

- DB adapter 不记录每条 query。
- migration、rebuild、corruption recovery、custom type parse failure 由 main DB service 或 store 记录。
- `shared/db/custom-types.ts` 不应直接 `console.warn`，应改成返回 fallback/issue 或抛出由 DB service 记录的错误。

### Renderer

- 全局 Vue error handler、error boundary、core event manager、store 初始化失败可以记录。
- 表单 submit 失败默认不记录，除非失败无法展示给用户或会影响应用一致性。
- `console.*` 在 renderer 可以作为 DevTools-only 的局部诊断保留，但不要把它当成持久运行期日志。需要支持包可见、跨进程关联或长期排障的信息必须走 `@renderer/core/logger`。

### CLI 和脚本

- `packages/extension-cli/src/logger.ts` 是人类终端输出，不是诊断日志系统。
- CLI 若以后需要 `--verbose` 或 `--log-file`，应在 CLI 包内独立设计，不复用 desktop `@main/logging`。
- 构建脚本继续 stdout/stderr，CI 负责收集。

## 约束方式

本规范不新增自动化规则。日志调用是否合适依赖调用位置、诊断目的和运行阶段，靠自动规则容易误伤 `userData` 判定、pre-ready bootstrap、renderer DevTools 观察和 host 兜底输出。

约束方式以代码评审、迁移清单和公共模板文档为主：

- 新业务代码不要直接导入 `electron-log/main`、`electron-log/renderer`，应通过 logging facade 使用底层 transport。
- `shared/**` 禁止 runtime logger import；`shared` 中现有 `console` 应在迁移时移出，但不靠自动规则一刀切。
- extension 模板和 README 明确要求扩展作者使用 `context.logger`。

代码评审检查：

- 这条日志是否由拥有上下文的层记录？
- message 是否稳定，动态值是否进 context？
- 是否包含可关联的 id 或 duration？
- 是否泄漏用户内容、secret、token、完整 URL 或完整 DB row？
- 同一个错误是否被多个层重复记录？
- 这个失败是否更应该是用户通知或返回值，而不是日志？
- 如果使用 `console`，它是否确实是 CLI/脚本输出、logger 初始化前兜底、DevTools-only 观察，或 utility process 崩溃前兜底？

## 迁移计划

1. 新增 `@main/logging` 和 `@renderer/core/logger` facade，先兼容现有 `electron-log` 输出，并在 main 侧建立 `main`、`renderer`、`extensions` 三个固定 logger target。
2. 调整 bootstrap：先完成 CLI help/version 分支；再在 Electron pre-ready 阶段确定最终 `userData`，开发模式同步设置 `dev/app`，生产模式必须等待 `detectPortableMode()` 完成；然后调用 `configureLogging()`、创建固定 `logId` 的 main / renderer / extensions logger target，并初始化 electron-log 的 renderer bridge。`app.whenReady()`、服务初始化和窗口创建都必须发生在日志路径固定之后。
3. 分类处理 renderer 的 `console.error` / `console.warn`：全局 Vue error handler、error boundary、core event/db/theme/deeplink、store 初始化和跨进程同步失败迁到 `@renderer/core/logger`；普通表单提交、按钮点击、用户可见操作失败优先保留 notify / UI state；DevTools-only 局部诊断可以保留 console，不为了“迁移 console”而新增噪声日志。
4. 把 `shared/db/custom-types.ts` 的 console 迁出 shared，由 DB service/store 记录 corrupted/fallback 场景。
5. main 服务逐步从直接 `electron-log/main` 改为 scoped logger。优先改 extension、db、launcher、scanner、updater 这些排障价值高的区域。
6. 扩展 host 内部引入 host logger，保留 stdout/stderr capture 作为兜底。
7. 更新 extension 模板、README 和代码评审清单，说明新代码应使用 logging facade / `context.logger`，不直接扩散 `electron-log/*`。
8. 最后统一日志格式、边界裁剪常量和支持包导出。

## 最终规则

一句话版：

权威运行期日志只落到 `userData/logs/main.log`、`userData/logs/renderer.log` 和 `userData/logs/extensions.log`；main 记录业务和系统真相，renderer 只记录 UI/runtime 异常，extension 作者日志只用 `context.logger` 并归入 `extensions.log`，shared 不记录。`console` 可以用于 CLI/脚本、logger 初始化前兜底、renderer DevTools-only 观察和 utility process 崩溃前输出，但不替代持久诊断日志。app-owned 日志记录在拥有上下文的层，使用稳定 message 加结构化字段，永远不写 secret、用户正文和无界高频噪声；第三方 extension 日志内容由插件作者负责，host 只做有界序列化和来源标注。
