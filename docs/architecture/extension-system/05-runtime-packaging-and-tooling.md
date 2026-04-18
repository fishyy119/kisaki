# 05. 运行时、打包与工具链

本文件定义扩展宿主运行时、桥接协议、`.kisx` 打包格式、安装布局、开发调试方式，以及基于 `tsdown` 的统一工具链。

## 运行时总原则

## 1. 扩展代码只运行在共享 Extension Host Process

不再有：

- main 直接 import 扩展入口
- renderer 直接 import 扩展入口

改为：

- main 通过 `RuntimeManager` 启动共享扩展宿主进程
- 共享扩展宿主进程按扩展 ID 加载、卸载和重载扩展 `entry`
- 所有扩展逻辑通过底层 protocol 通道与主应用通信

## 2. 桥接协议必须结构化

推荐使用统一消息信封：

```ts
type ProtocolMessage =
  | { kind: 'request'; id: string; method: string; params: unknown }
  | { kind: 'response'; id: string; ok: true; result: unknown }
  | { kind: 'response'; id: string; ok: false; error: SerializableError }
  | { kind: 'event'; name: string; payload: unknown }
```

这层只负责可序列化消息传输；具体宿主能力、贡献回调和生命周期命令的语义映射由 extension host 结合 `@kisaki/extension-sdk/bridge` 完成。

约束：

- 所有数据必须可序列化
- 不传递函数
- 不传递宿主对象引用
- 不传递 renderer/runtime 实例

## 3. Renderer 永远通过主进程间接访问扩展

renderer 的所有扩展相关操作都走 main 暴露的 IPC facade：

- 获取设置面板列表
- 打开菜单并获取已解析的菜单结果
- 触发菜单交互
- 打开设置面板并获取当前完整面板节点列表
- 提交设置面板
- 触发设置面板按钮与高级动作
- 获取 theme 列表

renderer 不认识共享扩展宿主进程，也不直接与之通信。

受控 UI 的桥接时机统一为：

- 菜单或设置面板打开时，main 才会请求一次对应的 `resolve`
- 后续不会自动重复 `resolve`
- 只有扩展回调返回的 `UiCallbackResult` 中 `refresh: true`，main 才会再次请求对应 UI surface 的 `resolve`

UI 回调桥接协议统一为：

- 菜单项回调、设置面板控件回调和 `onSubmit` 都返回结构化 `UiCallbackResult`
- `success`、`refresh`、`error` 字段都必须可序列化
- main 不再通过 `void`、特殊字面量或异常分支推断 UI 行为
- 扩展回调抛出异常时，extension host 必须记录完整日志，并把响应归一化为 `success: false` 的 `UiCallbackResult`

## 共享扩展宿主进程设计

## 启动职责

共享扩展宿主进程入口负责：

1. 接收 main 传入的扩展运行描述
2. 初始化 SDK bridge
3. 建立扩展运行时注册表
4. 动态 import 指定扩展入口
5. 对目标扩展执行 `activate(context)` / `deactivate(context)`
6. 管理分扩展的注册回调与订阅
7. 响应 main 的 protocol 请求

当前 SDK 实现把宿主侧桥接 helper 收敛在 `@kisaki/extension-sdk/bridge`，由该入口暴露 `configureExtensionSdkBridge(...)`、`createExtensionContext(...)` 等 bootstrap 函数。

## 必备能力

- 分扩展 runtime registry
- 进程内 callback registry
- protocol request/response 处理
- 结构化日志上报
- 单扩展 load/unload/reload
- dev reload 支持

## `.kisx` 包格式

`.kisx` 本质上是 zip，但作为扩展系统的官方分发后缀统一使用 `.kisx`。

## 包内结构

```text
sample-extension-1.0.0.kisx
  manifest.json
  dist/
    index.mjs
    index.d.ts
  icon.png
  README.md
```

约束：

- `manifest.json` 必须位于包根目录
- `entry` 必须能定位到包内真实文件
- 不允许 `main/renderer` 双入口结构

## 安装后目录布局

宿主用户目录统一改为：

```text
userData/extensions/
  packages/
    <extension-id>/
      manifest.json
      dist/
      icon.png
  data/
    <extension-id>/
      storage.json
  temp/
    <extension-id>/
  state.json
```

说明：

- `packages/`：安装后的扩展包内容
- `data/`：扩展私有持久化数据
- `temp/`：扩展临时文件
- `state.json`：启用状态、安装来源、版本、更新时间等宿主状态

## 安装与更新

新的安装体系按“来源接入”和“安装编排”分层：

- `sources/manager.ts` 负责 source resolve/search/download/getLatestVersion
- `sources/*.ts` 负责 GitHub、本地文件等具体来源 provider
- `installer.ts` 负责安装、卸载、更新流程编排与 `state.json` 维护

其中安装器职责为：

- 校验 `.kisx`
- 解析并验证 `manifest.json`
- 使用官方 manifest JSON Schema 校验 `categories`、`entry` 和未知字段
- 校验 `entry`
- 安装到 `packages/<id>`
- 更新 `state.json`
- 通知共享宿主加载、卸载或重载对应扩展

安装器不再关心 `renderer entry`。

## 工具链统一：全部使用 tsdown

## 目标

新扩展工具链统一为 `tsdown`，覆盖：

- `extension-api`
- `extension-sdk`
- `extension-cli`
- `create-kisaki-extension`
- 扩展模板项目本身

## 废弃链路

以下旧链路直接删除：

- 扩展模板里的 Vite 双入口构建
- `apps/desktop/scripts/build-plugin-types.ts`
- `apps/desktop/rolldown.plugin-types.config.ts`
- SDK 从宿主复制 `.d.ts`
- `plugin-sdk/scripts/build.ts` 那套 copy-then-build 流程

## 扩展模板构建

扩展模板改为纯 `tsdown`：

```ts
import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    index: 'src/index.ts'
  },
  format: 'esm',
  dts: true,
  outDir: 'dist',
  clean: true,
  sourcemap: true
})
```

## 新 CLI

新 CLI 包命名建议：

- package: `@kisaki/extension-cli`
- bin: `kisx`

命令统一为：

- `kisx build`
- `kisx dev`
- `kisx validate`
- `kisx pack`

## 命令行为

### `kisx build`

- 读取 `manifest.json`
- 先按官方 JSON Schema 校验 manifest
- 运行 `tsdown`
- 校验 `entry` 文件存在

### `kisx validate`

- 按官方 JSON Schema 校验 `manifest.json`
- 校验 `categories` 枚举、唯一性和最少项数
- 校验 `entry`
- 校验图标与 README 等可选资源
- 校验 `engines.kisaki`

### `kisx pack`

- 运行 `build`
- 生成 `.kisx`
- 按包根目录布局写入 `manifest.json`、`dist/` 等文件

### `kisx dev`

- 运行 `tsdown --watch`
- 启动 Kisaki 并附带 `--dev-extension=<path>`
- 宿主监听产物变更并通知共享宿主重载对应扩展

## 开发模式

## 启动参数

旧参数：

```text
--dev-plugin=<path>
```

新参数：

```text
--dev-extension=<path>
```

## 热重载策略

新 dev reload 只重载“目标扩展”，不再重启整个共享宿主，也不涉及 renderer 扩展重载。

流程：

1. `kisx dev` 用 `tsdown --watch` 产出 `dist/index.mjs`
2. main 检测 `manifest.json` 或 `dist/**` 变更
3. `RuntimeManager` 请求共享宿主卸载目标扩展
4. 共享宿主重新加载该扩展并再次 `activate(context)`
5. contribution registry 刷新
6. renderer 只收到刷新结果，不加载扩展代码

## 调试模型

推荐：

- 共享扩展宿主进程提供单一 inspector 端口
- `kisx dev` 在启动时打印该端口
- 日志必须始终带扩展 ID 前缀，保证共享进程下仍可定位问题
- 不再需要旧的 `dev wait` 与 renderer 同步等待机制

## 与宿主构建的关系

宿主应用构建不再需要“为扩展生成类型”这一步。

构建关系改为：

1. `packages/extension-api` 构建
2. `packages/extension-sdk` 构建
3. `packages/extension-cli` 与 `packages/create-kisaki-extension` 构建
4. `apps/desktop` 直接依赖上述 packages

这样可以彻底消除：

- app 反向生成 plugin types
- SDK 对 app 内部路径的构建期依赖

## 脚手架

新脚手架包命名建议：

- package: `create-kisaki-extension`

生成内容应只包含：

- `manifest.json`
- `package.json`
- `tsdown.config.ts`
- `src/index.ts`
- `tsconfig.json`
- `README.md`

默认不生成 renderer 目录、不生成 Vue 组件、不生成 `shared/manifest.ts`。

生成的 `manifest.json` 默认应包含：

- `"$schema"`
- 至少一个合法 `categories`

## 建议的 package.json 脚本

```json
{
  "scripts": {
    "build": "kisx build",
    "dev": "kisx dev",
    "validate": "kisx validate",
    "pack": "kisx pack",
    "typecheck": "tsc --noEmit"
  }
}
```

## 总结

新的运行时与工具链目标非常明确：

- 单入口
- 单运行时
- 单构建工具
- 单打包后缀
- 单桥接协议

也就是：

- 扩展只写 `src/index.ts`
- 扩展只编译成 `dist/index.mjs`
- 扩展只打成 `.kisx`
- 宿主只连接共享扩展宿主进程
- renderer 只渲染结构化贡献
