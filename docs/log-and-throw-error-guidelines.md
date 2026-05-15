# Kisaki Log 与 Throw Error 规范

本文只规定两件事：运行期 log 怎么写，以及 `catch` 后什么时候重新 `throw new Error(...)`。

## Log

Kisaki 的 log 只是对 `electron-log` 的薄包装，只做三件事：

- 给 message 加单级前缀。
- 按来源分流到 `main.log`、`renderer.log`、`extension.log`。
- 透传 message 后的参数给 `electron-log`。

不要做自定义格式化、JSON record、Error 序列化、字段裁剪、语义脱敏或其它日志协议。

运行期日志文件固定为：

```text
userData/logs/main.log
userData/logs/renderer.log
userData/logs/extension.log
```

- `main.log`：main 进程、应用服务、数据库、窗口、IPC、扩展运行时基础设施、extension host stdout/stderr 兜底。
- `renderer.log`：renderer 自身的 UI runtime、store/composable 初始化、跨进程同步、全局异常。
- `extension.log`：扩展作者通过 `context.logger` 主动写出的日志。

日志路径在最终 `userData` 确定后配置给 `electron-log`。开发模式、普通安装和 portable mode 可以有不同 `userData`，但文件名和分流规则不变。

## Logger API

项目内业务代码使用各层的 log 包装入口，不直接散落 `electron-log/*`。

```ts
export interface Logger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}
```

推荐：

```ts
const log = createLogger('Extension')

log.info('Host started', { runtimeHandle, pid })
log.warn('Package skipped', { extensionId, reason })
log.error('Package install failed', error, { extensionId })
```

不推荐：

```ts
log.info(`Host ${runtimeHandle} started with pid ${pid}`)
log.error(JSON.stringify({ message: 'Package install failed', error }))
```

## 单级前缀

前缀只允许一级，不允许点分层级。

允许：`Extension`、`Db`、`Window`、`Updater`、`Scanner`、`Launcher`、`Library`、`Theme`、`Event`、`Ipc`。

禁止：`Extension.Runtime`、`Db.Migration`、`Renderer.Store`、`Main.Extension`、`Extension.Package.Recovery`。

规则：

- 前缀表达稳定业务域，不表达文件路径、函数名或 class name。
- 不把 `main`、`renderer` 写进前缀；日志文件已经表达来源。
- 不把 `extensionId`、`gameId`、`operationId` 等动态值写进前缀。
- 动态值作为后续参数传给 logger。
- 一个文件通常只声明一个 logger。
- logger 可以在模块顶部创建，但创建动作不能读 `userData`、配置 transport 或写文件。
- 不在循环或热路径里反复 `createLogger()`。

## 使用边界

| 位置                               | 使用方式                                   |
| ---------------------------------- | ------------------------------------------ |
| `apps/desktop/src/main/**`         | main 侧 log 包装层                         |
| `apps/desktop/src/renderer/src/**` | renderer 侧 log 包装层                     |
| extension author code              | `context.logger`                           |
| extension host infra               | main 侧 log 包装层；stdout/stderr 只作兜底 |
| `apps/desktop/src/shared/**`       | 不写运行期日志                             |
| CLI / scripts                      | stdout/stderr，不进入桌面运行期日志        |

`console.*` 只用于 CLI/脚本输出、log 初始化前兜底、renderer DevTools 临时观察、extension utility process 崩溃前兜底。运行期诊断事实走对应 log 包装层。

IPC adapter 保持薄。`services/<service>/ipc.ts` 通常不主动写业务日志，只转给 service/domain，并由 `wrapIpc` / `wrapIpcVoid` 转成安全返回。

## 记录边界

应该记录生命周期、后台任务结果、外部边界失败、数据恢复/降级、extension host 状态、renderer 全局异常和跨进程同步失败。

不记录普通渲染、watcher、表单输入、每个普通 IPC 请求、shared 纯函数细节、无额外诊断价值的用户操作失败，以及 tight loop 中每个 item 的细节。

Level 规则：

| Level   | 使用场景                                 |
| ------- | ---------------------------------------- |
| `debug` | 临时或低优先级排查信息                   |
| `info`  | 正常但重要的生命周期和操作结果           |
| `warn`  | 可恢复异常、降级、跳过、重试、清理失败   |
| `error` | 当前操作失败、运行时崩溃、数据一致性风险 |

不要用 `error` 记录已正常处理的业务分支。不要用 `info` 记录高频循环细节。

## 安全边界

Log 包装层不做语义脱敏，调用方不要传入敏感内容。

永远不要记录 token、secret、cookie、Authorization header、OAuth code/state、PKCE verifier、client secret、extension secrets/storage value、用户正文、笔记、评论、剪贴板内容、完整数据库行、完整 HTTP body、无界数组、私钥或签名 key 内容。

路径默认只记录 basename、业务 id 或应用派生路径。用户选择的完整路径只在确有排障价值时记录，并优先放在 `debug`。

第三方 extension 通过 `context.logger` 写入的内容由扩展作者负责。宿主只负责把来源归入 `extension.log`，不要替 extension message 做语义改写。

## Throw Error

`catch` / `throw new Error(...)` 只保留语义化目标：

- 对外抛出的 `Error.message` 稳定、简洁、安全。
- 不把底层库的原始错误字符串直接抛到 renderer 或公共 API。
- 不为了统一错误体系创建全局 Error class。
- 不要求给 `new Error(...)` 加 `{ cause }`。`new Error(...)` 本身会带当前语义边界的 stack。

只有在需要增加语义、做恢复、改变边界消息或记录完整上下文时才 `catch`。

推荐：

```ts
try {
  await installPackage(request)
} catch (error) {
  log.error('Package install failed', error, {
    extensionId: request.extensionId,
    version: request.version
  })

  throw new Error('Failed to install extension package.')
}
```

不推荐：

```ts
try {
  await installPackage(request)
} catch (error) {
  throw new Error(String(error))
}
```

也不推荐：

```ts
try {
  await installPackage(request)
} catch (error) {
  log.error('Install failed', error)
  throw error
}
```

错误消息写稳定英文短句，例如：

```ts
throw new Error('Failed to install extension package.')
throw new Error('Failed to refresh extension repository.')
throw new Error('Failed to open the game executable.')
```

不要把动态值拼进错误消息。动态值需要诊断时，用 log 参数记录。

同一个失败只在拥有上下文的层记录一次。下层抛语义化错误，上层如果只是转交给 IPC 或 UI，不重复 log。

## 一句话

Log 只是 `electron-log` 的薄包装，只加单级前缀并分流到 `main.log`、`renderer.log`、`extension.log`；`catch` 只在需要增加业务语义、恢复或记录完整上下文时使用，重新抛出时写稳定安全的 `new Error('...')`。
