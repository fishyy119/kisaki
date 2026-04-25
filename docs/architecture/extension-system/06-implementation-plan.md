# 06. 实施方案

> 状态：已完成迁移计划归档。
>
> 本文件保留一次性切换到新 `extension` 系统的实施路线和验收标准，描述的是迁移过程而不是当前待办。
> 当前源码已经移除旧 plugin runtime/tooling，实际实现状态以 [README.md](./README.md) 和源码实现为准。

本文件给出一次性切换到新 `extension` 系统的具体实施方案。由于本次重构不考虑向后兼容和迁移成本，因此采用“清晰优先”的大重构路径。

## 实施原则

1. 不做旧 `plugin` 与新 `extension` 的长期共存层。
2. 不保留旧 renderer 扩展执行链路。
3. 不保留旧 SDK 和旧脚手架。
4. 所有公开契约先在 `packages` 定义，再落宿主实现。
5. 以可测试的中间里程碑推进，每一步都可单独验收。

## 仓库级重构目标

## 删除

```text
apps/desktop/src/main/services/plugin/**
apps/desktop/src/renderer/src/core/plugin/**
apps/desktop/src/renderer/src/core/ui-extensions/**
apps/desktop/plugin-types/**
apps/desktop/scripts/build-plugin-types.ts
apps/desktop/rolldown.plugin-types.config.ts
packages/plugin-sdk/**
packages/plugin-cli/**
packages/create-kisaki-plugin/**
```

## 新增

```text
apps/desktop/src/main/services/extension/**
apps/desktop/src/renderer/src/core/extensions/**
packages/extension-api/**
packages/extension-sdk/**
packages/extension-cli/**
packages/create-kisaki-extension/**
```

## 重命名与替换

| 旧对象                 | 新对象                    |
| ---------------------- | ------------------------- |
| `PluginService`        | `ExtensionService`        |
| `plugin` 目录          | `extension` 目录          |
| `--dev-plugin`         | `--dev-extension`         |
| `.zip` 插件包          | `.kisx` 扩展包            |
| `@kisaki/plugin-sdk`   | `@kisaki/extension-sdk`   |
| `@kisaki/plugin-cli`   | `@kisaki/extension-cli`   |
| `create-kisaki-plugin` | `create-kisaki-extension` |

## 分阶段实施

## Phase 1：建立公开契约包

### 目标

先建立新平台的公开边界，切断“从 app 反向生成类型”的旧链路。

### 任务

1. 创建 `packages/extension-api/`
2. 定义以下核心契约：
   - `ExtensionManifest`
   - `ExtensionCategory`
   - `ExtensionContext`
   - `KisakiApi`
   - `HostEvents`
   - `library` DTO、entity query/patch 类型、relation query/command 类型
   - `EntityMenuContribution`、`SettingsPanelContribution`、theme/scraper/deeplink contribution 类型
   - `extension-manifest.schema.json`
   - 底层 protocol 类型
3. 创建 `packages/extension-sdk/`
4. 实现：
   - `defineExtension`
   - `kisaki` 全局 API
   - `context.contributes.entityMenus` / `settingsPanels` 域内 UI helpers
   - context / storage / logger 等作者侧 helper
5. 所有包使用 `tsdown`

### 验收标准

- `extension-api` 与 `extension-sdk` 可以独立构建
- 官方 manifest JSON Schema 可被 CLI 与宿主复用
- 宿主不再依赖 `plugin-types`
- 扩展模板可以只依赖这两个包拿到完整类型

## Phase 2：实现 Core Extension Runtime

### 拆分原则

当前 runtime 相关工作同时包含安装链路、共享宿主生命周期、能力桥接、contribution 接线、主应用现有 service 接入，以及 renderer 消费层接入，范围过大。这里拆成六个连续子阶段：

1. 先完成不依赖共享宿主的 main 侧安装与目录闭环
2. 再完成共享宿主进程与 RPC 生命周期
3. 先把 capability API 与宿主服务桥接打通
4. 再接入 contribution registry 与 UI callback 语义
5. 先把 contribution 接到主应用现有 service，并在 main 侧定型 renderer 可消费的 IPC facade
6. 最后在 renderer 建立结构化消费层并替换现有 UI 消费路径

这样每一段都可以单独验收，也更容易定位风险点。

### Phase 2A：主进程基础设施与安装闭环

#### 目标

先把 `ExtensionService` 的 main 侧静态能力做实，形成“发现扩展 -> 安装/卸载 -> 状态持久化 -> catalog 聚合”的闭环。

#### 任务

1. 新建 `apps/desktop/src/main/services/extension/`
2. 先收敛不依赖共享宿主的 main 侧模块边界：
   - `service.ts`
   - `types.ts`
   - `manifest.ts`
   - `state.ts`
   - `catalog.ts`
   - `installer.ts`
   - `sources/`
3. 细化来源与安装职责：
   - `sources/manager.ts` 负责 source resolve/search/download/getLatestVersion
   - `sources/github.ts`、`sources/local-file.ts` 负责具体来源 provider
   - `installer.ts` 只负责 `.kisx` 安装、卸载、更新流程编排
4. 实现安装状态存储：
   - `userData/extensions/state.json`
5. 实现 `.kisx` 安装、卸载、更新
6. 让 `catalog.ts` 先能稳定聚合：
   - 已安装扩展
   - manifest 解析结果
   - enable/disable 状态
   - 来源与版本信息

#### 验收标准

- main 可以扫描并安装 `.kisx`
- main 可以启用/禁用/卸载扩展
- `userData/extensions/state.json` 成为 extension 安装状态的唯一持久化来源
- main 侧 `catalog.ts` 可以稳定聚合已安装扩展与来源元数据

### Phase 2B：共享宿主进程与 RPC 生命周期

#### 目标

在不引入完整 contribution 接线的前提下，先打通共享 `extension-host` 的启动、握手、加载、卸载、重载与崩溃恢复。

#### 任务

1. 新增 runtime 模块：
   - `runtime/manager.ts`
   - `runtime/host-controller.ts`
   - `runtime/rpc-client.ts`
   - `runtime/crash-policy.ts`
   - `runtime/host/entry.ts`
   - `runtime/host/rpc-server.ts`
   - `runtime/host/extension-registry.ts`
   - `runtime/host/extension-loader.ts`
   - `runtime/host/sdk-bridge.ts`
2. host 侧能力要求：
   - `entry.ts` 作为共享宿主进程唯一入口，只负责组装、启动与退出清理
   - 基于 protocol message envelope 的 RPC 消息处理与 SDK bridge 适配
   - 多扩展 entry loader
   - extension runtime registry
   - deactivate 基础清理流程
3. `RuntimeManager` 能：
   - `startHost`
   - `handshake`
   - `loadExtension`
   - `unloadExtension`
   - `reloadExtension`
   - `restartHost`
   - `shutdownHost`
4. 实现 `--dev-extension`
5. 收集宿主崩溃状态并重建已启用扩展

#### 验收标准

- main 可以启动共享 `extension-host` 并完成 handshake
- 多个扩展能在共享宿主进程中成功执行 `activate(context)`
- `load/unload/reload/shutdown` 生命周期完整可用
- `--dev-extension` 可以把本地扩展接入共享宿主调试
- 共享宿主崩溃后可恢复已启用扩展

### Phase 2C：能力桥接与宿主 API

#### 目标

在共享宿主稳定后，先把不依赖 contribution registry 的 capability API 接到 `ExtensionService` 与共享宿主之间，建立稳定的宿主能力调用边界。

#### 任务

1. 新增并接线：
   - `capabilities/`
2. 建立能力桥接的宿主边界：
   - `ExtensionService` 只通过 `capabilities/` 调用宿主已有业务模块
   - 共享宿主通过 `sdk-bridge.ts` / RPC 映射访问 capability API
   - capability handler 不直接依赖 contribution registry
   - main 为每次 `load/reload` 生成不透明 `runtimeHandle`，所有 capability、storage、logger 与 host event 订阅请求都使用该句柄授权，不接受扩展代码自报 `extensionId`
3. 优先打通不参与 contribution registry 的宿主能力：
   - `events`
   - library query / command
   - 其他 `extension-api` 中定义的宿主能力入口
4. 统一 capability 调用错误模型：
   - protocol 级 request/response 失败归一化
   - timeout / unavailable / validation failure 等结构化错误
   - 错误类型、normalizer、`RpcErrorPayload` helper 统一落在 `packages/extension-api`
   - 不泄漏宿主内部 service 错误细节
5. 补齐 load / unload / reload 期间的 capability 清理与失效处理
   - unload/reload 时释放 `runtimeHandle`、event 订阅与 capability 侧运行实例状态
   - 长耗时 capability 调用接收生命周期 `AbortSignal`，运行实例失效后不再继续访问宿主

#### 验收标准

- 扩展可以调用 capability API
- `events` 等非 contribution 能力可在共享宿主中独立使用
- 能力桥接不依赖 contribution registry 即可单独验收
- capability 调用失败会返回结构化宿主错误，而不是直接泄漏内部异常
- 过期或伪造的 `runtimeHandle` 无法访问 storage、logger、library、network、notify、runtime 或 host event capability
- unload/reload 后旧运行实例的订阅和长耗时请求会被取消或失效，不会继续污染新实例状态

### Phase 2D：贡献注册与 UI 回调接线

#### 目标

在能力桥接稳定后，再把 contribution registry、受控 UI callback 和 contribution 域状态正式接到 `ExtensionService` 上。

#### 任务

1. 新增并接线：
   - `contributions/`
   - `runtime/host/contributions/*.ts`
2. contribution 模块内聚接线逻辑，不再单独设 `adapters/`
3. host 侧补齐 contribution 域能力：
   - contribution 域内聚的 session/refresh 状态
   - callback registry 与 UI callback dispatch
   - deactivate 时 contribution 清理
4. 建立 main 侧 contribution registry 与快照聚合：
   - 已注册 contribution 的归属追踪
   - enable/disable / reload 后的增量刷新
   - 为后续 renderer IPC facade 提供稳定读取面
5. 统一 UI 回调结果模型：
   - `UiCallbackResult`
   - success / error / refresh 语义
   - 结构化错误归一化

#### 验收标准

- main 能建立 contribution registry
- 扩展可以在 registry 层面注册 contribution
- UI 回调统一返回结构化 `UiCallbackResult`
- 单扩展回调异常会被归一化为结构化失败结果，不会直接中断主应用
- contribution refresh 与 unload/reload 后的清理行为可预测且可验收

### Phase 2E：主进程接入现有 service 与 IPC facade

#### 目标

在 contribution registry 与 UI callback 语义稳定后，先在 main 侧把扩展贡献真正接入主应用现有业务 service，并建立 renderer 可消费的稳定 IPC facade。本阶段只完成主进程边界，不替换 renderer UI。

#### 任务

1. 把非 UI contribution 接入现有宿主业务模块：
   - `contributions/scrapers.ts` 负责把扩展 scraper provider 适配进 `ScraperService` 的 provider registry
   - `contributions/deeplinks.ts` 负责把扩展 route handler 接入 `DeeplinkService` / `DeeplinkRouter`
   - `contributions/themes.ts` 负责把语义 token theme 纳入 main 侧 theme contribution snapshot，并通过受控 IPC 暴露给 renderer
   - 这些接线都必须停留在 `ExtensionService` 体系内，不把 `extension-api` 类型扩散进 `ScraperService`、`DeeplinkService` 或 renderer theme manager 内部
2. 为 renderer 建立稳定 IPC facade：
   - 获取 contribution snapshot
   - 获取 settings panels
   - resolve / invoke entity menu contribution
   - resolve / submit / invoke settings panel contribution
   - 获取 theme contributions
3. 定型 IPC facade 的主进程边界：
   - IPC handler 只返回结构化 DTO，不返回 host 内部对象
   - UI callback 只经 main 转发到 extension host，并统一返回 `UiCallbackResult`
   - contribution snapshot 从 main 侧 registry / adapter 状态聚合，不让 renderer 直接感知 extension host
4. 旧 renderer plugin 执行链路先不在本阶段删除；彻底退役放到 Phase 3 / Phase 5，避免 service 接入和旧系统清理互相混杂

#### 验收标准

- 扩展 scraper provider 能被主应用现有 scraper 流程发现和调用
- 扩展 deeplink route 能由主应用 deeplink 入口路由到 extension host
- 扩展 theme contribution 能进入 main 侧 theme contribution snapshot，并通过 IPC 以语义 token DTO 形式读取
- renderer-facing IPC facade 可以获取 contribution snapshot、settings panels、entity menu、settings panel 和 theme contribution
- 菜单和设置面板回调可以经 main 转发到 extension host，并返回结构化 `UiCallbackResult`
- 主应用现有 service 不需要直接依赖或扩散 `extension-api` 类型

### Phase 2F：渲染进程结构化消费层与 UI 替换

#### 目标

在 main 侧 service 接入与 IPC facade 稳定后，新建 renderer 结构化消费层，并把现有 UI 从旧 plugin / ui-extension 执行模型切到只消费 main 下发 DTO 的模式。完成本阶段后，新扩展系统才算从“runtime 可运行”进入“主应用端到端可用”。

#### 任务

1. 新建 renderer 贡献消费层：
   - `src/renderer/src/core/extensions/**`
2. 把现有 UI 替换为结构化贡献消费：
   - 通过 IPC 获取 entity menu contributions
   - 通过 IPC 获取 settings panels
   - 通过 IPC 获取 theme contributions
   - 扩展管理页从“组件存在判断”改成“结构化 panel 存在判断”
3. 接入 renderer 侧 UI callback 调用：
   - entity menu invoke
   - settings panel resolve / submit / action invoke
   - `UiCallbackResult` 的 success / refresh / error 语义展示与刷新处理
4. 保持 renderer 零扩展代码：
   - renderer 不 import 扩展入口
   - renderer 不执行扩展 callback
   - renderer 只渲染 main 下发的结构化菜单、设置面板和 theme 数据
5. 旧 renderer plugin 执行链路先不在本阶段删除；彻底退役放到 Phase 3 / Phase 5，避免 renderer 消费层替换和旧系统清理互相混杂

#### 验收标准

- 扩展 theme 能进入 renderer theme 选择 / 应用流程，且仍只通过语义 token 生效
- renderer 可通过 IPC 获取并渲染 entity menu 与 settings panel contribution
- 菜单和设置面板回调能从 renderer 经 main 转发到 extension host，并返回结构化 `UiCallbackResult`
- renderer 内的新 extension 消费层不执行任何扩展代码

## Phase 3：退役 PluginService 与旧 plugin runtime

### 目标

在新 `ExtensionService`、共享宿主进程和 renderer 贡献消费层稳定后，把应用内扩展流量彻底切离旧 `PluginService` 与旧 plugin runtime。

### 任务

1. 从 main 启动链路移除 `PluginService` 的注册与初始化
2. 删除旧 main 侧 plugin runtime：
   - `apps/desktop/src/main/services/plugin/**`
   - `--dev-plugin` 启动接线
3. 删除旧 plugin 管理 IPC 与对应调用：
   - 安装 / 卸载 / 更新 / 已装列表 / registry 搜索
   - dev-plugin wait / loaded entries 等旧运行时通道
4. 确保以下职责只由 `ExtensionService` 承担：
   - 安装、卸载、更新
   - 启停状态与 catalog 聚合
   - 扩展宿主生命周期与正式扩展点接线

### 验收标准

- 旧 `PluginService` 不再承担安装、目录聚合或启动职责
- 启动链路不再注册 `PluginService`
- 应用内扩展管理与运行时流量只通过 `ExtensionService` 与 `extension host`

## Phase 4：替换工具链与脚手架

### 目标

彻底删除旧插件工具链，改成统一 tsdown 模型。

### 任务

1. 新建 `packages/extension-cli/`
2. 提供 `kisx` 命令：
   - `build`
   - `dev`
   - `validate`
   - `pack`
3. 新建 `packages/create-kisaki-extension/`
4. 生成新的模板项目：
   - 单 `manifest.json`
   - 单 `src/index.ts`
   - 单 `tsdown.config.ts`
5. 删除旧：
   - Vite 模板
   - plugin type build pipeline
   - `plugin-sdk/scripts/build.ts`

### 验收标准

- 新扩展模板不依赖 Vite
- 新扩展可通过 `kisx pack` 产出 `.kisx`
- 主应用可安装并运行该 `.kisx`

## Phase 5：清理旧系统并统一命名

### 目标

把仓库从 `plugin` 语义彻底切到 `extension`。

### 任务

1. 删除旧包与旧目录
2. 更新 root scripts：
   - `build:plugin-*` -> `build:extension-*`
3. 更新文档与 README
4. 更新 app 内所有 `plugin:*` IPC/event/channel 命名
5. 更新 UI 文案：插件 -> 扩展

### 验收标准

- 仓库中不存在旧 `plugin-sdk`、`plugin-cli`、`create-kisaki-plugin`
- 仓库级脚本、UI 文案与文档都统一为 `extension`

## 测试策略

## 1. 单元测试

覆盖：

- manifest 校验
- manifest categories 枚举与唯一性校验
- protocol message codec
- contribution model 校验
- theme token 校验
- entity menu / settings panel resolve 归一化逻辑
- `UiCallbackResult` 校验与归一化
- success / error / refresh 语义
- settings panel submit 与草稿重建逻辑
- storage/log/capability wrapper

## 2. 集成测试

至少准备一个 fixture extension，覆盖：

- `activate(context)`
- entity menu action
- entity menu checkbox
- entity menu select
- entity menu callback failure result
- settings panel submit
- settings panel action button
- settings panel explicit refresh
- settings panel structured error result
- event subscribe/emit
- theme contribution
- scraper provider
- deeplink handler

## 3. 端到端测试

覆盖：

- 安装 `.kisx`
- 启用/禁用扩展
- 卸载扩展
- 共享宿主崩溃恢复
- dev hot reload
- renderer 菜单与设置 UI 正常刷新

## 4. 回归测试

重点检查：

- 原有内建 scraper 不回退
- 原有 theme 切换不回退
- 原有通知、事件、网络 service 不回退
- 主应用启动和关闭流程不回退

## 里程碑验收

## M1：契约与 SDK 完成

判断标准：

- `packages/extension-api` 与 `packages/extension-sdk` 定型
- 不再生成 `plugin-types`

## M2A：安装与目录闭环完成

判断标准：

- `ExtensionService` 已完成安装、卸载、启停状态与 catalog 聚合闭环
- `.kisx` 安装链路与 `state.json` 持久化稳定可用

## M2B：共享宿主生命周期跑通

判断标准：

- main 侧 `ExtensionService` 与共享宿主进程可端到端协作
- 多个示例扩展能在共享宿主进程中激活并输出独立前缀日志

## M2C：能力桥接与宿主 API 跑通

判断标准：

- 示例扩展可以调用 capability API，且不依赖 contribution registry
- 宿主能力调用失败会被归一化为结构化错误

## M2D：贡献注册与 UI 回调跑通

判断标准：

- 示例扩展可以注册 contribution，并被 main 侧 registry 稳定聚合
- UI callback 已统一落到结构化 `UiCallbackResult`

## M2E：主进程 service 接入与 IPC facade 跑通

判断标准：

- 示例扩展能提供 scraper provider、deeplink route 和 theme contribution，并被主应用现有业务入口消费
- main 侧可以通过 IPC facade 暴露 contribution snapshot、菜单、设置面板和 theme 数据
- 菜单和设置面板回调可以经 main 转发到 extension host，并返回结构化 `UiCallbackResult`

## M2F：renderer 结构化消费层跑通

判断标准：

- 示例扩展能提供菜单项与设置面板
- renderer 能通过 IPC 消费结构化 contribution snapshot、菜单、设置面板和 theme 数据
- 菜单和设置面板回调能从 renderer 经 main 转发到 extension host，并返回结构化 `UiCallbackResult`
- renderer 无扩展代码执行

## M3：PluginService 退役完成

判断标准：

- 旧 `PluginService` 不再参与 main 启动链路
- 应用内扩展管理和运行时流量已切到 `ExtensionService`

## M4：旧系统完全移除

判断标准：

- 仓库不存在旧 plugin runtime/tooling
- 所有命名统一为 extension

## 最终完成定义

以下条件全部满足时，重构视为完成：

1. 扩展只使用 `manifest.json + entry + activate(context)`。
2. 扩展运行时与主应用为独立进程，且全部扩展共享单一 `extension host`。
3. renderer 不再执行扩展代码。
4. 扩展 API 全部由 `packages/extension-api` / `packages/extension-sdk` 定义。
5. 菜单、设置、events、scraper、deeplink、theme 全部纳入统一扩展模型，并已接入主应用现有 service 与 renderer 结构化消费层。
6. `.kisx` 成为唯一官方分发格式。
7. `tsdown` 成为唯一官方扩展工具链。
8. 旧 `plugin` 系统与相关构建链路被完全删除。
