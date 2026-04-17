# 02. 目标架构

本文件定义新的 `extension` 系统的总体架构、进程模型、生命周期、模块边界和目录组织。

## 总体目标

新的扩展架构必须同时满足：

- 扩展与主应用物理解耦。
- 扩展与 renderer 运行时解耦。
- 扩展只依赖共享公开契约。
- 扩展仅通过注册、事件、回调、受控能力参与宿主行为。
- 扩展贡献可以被宿主统一管理、统一渲染、统一测试。

## 顶层架构

```text
┌─────────────────────────────────────────────────────────────┐
│ Main App (Electron main)                                   │
│                                                             │
│  ExtensionService                                           │
│  ├─ ManifestCatalog                                         │
│  ├─ InstallationManager                                     │
│  ├─ RuntimeManager                                          │
│  ├─ ContributionRegistry                                    │
│  ├─ CapabilityGateway                                       │
│  ├─ Contribution modules (entity-menus/settings-panels/    │
│  │  themes/scrapers/                                       │
│  │  deeplinks, with host integration)                      │
│  └─ Renderer IPC facade                                     │
│                                                             │
└───────────────▲───────────────────────────────▲─────────────┘
                │ protocol channel + sdk bridge │ app IPC
                │                               │
┌───────────────┴──────────────────────┐   ┌────┴────────────────────────────┐
│ Shared Extension Host Process        │   │ Renderer (Vue)                  │
│ one shared process for all enabled   │   │                                  │
│ extensions                           │   │                                  │
│                                      │   │ core/extensions/                 │
│  entry -> activate(context)          │   │ ├─ settings panels               │
│  SDK global API                      │   │ ├─ entity menu rendering         │
│  callbacks + event handlers          │   │ ├─ theme choices                 │
│  remote providers                    │   │ └─ extension manager UI          │
│                                      │   │                                  │
└──────────────────────────────────────┘   └──────────────────────────────────┘
```

## 核心决策

## 1. 单一共享扩展宿主进程

采用“主应用 + 单一共享 extension host”模型。所有已启用扩展都运行在同一个扩展宿主进程内，但仍通过独立上下文、独立存储命名空间、独立 contribution 归属和独立 callback registry 做逻辑隔离。

原因：

- 仍然保留了“主应用”和“扩展运行时”之间的物理解耦。
- 避免“一扩展一进程”带来的线性内存和进程数量膨胀。
- 启动、调试、日志、桥接、dev reload 都可以统一管理。
- 对当前 Kisaki 的规模和定位更合理，复杂度也更可控。

代价：

- 共享宿主如果发生进程级崩溃，会短暂影响全部扩展。
- 必须在扩展回调边界做好异常捕获，尽量把错误收敛在单扩展范围内。

本方案不再提供“按需独立进程”分流模型，运行时拓扑保持单一且固定。

## 2. Renderer 不再执行扩展代码

renderer 只做三件事：

- 请求当前贡献快照
- 渲染受控 UI
- 把用户交互回传给 main，再由 main 转发给共享扩展宿主进程

这意味着：

- 没有 renderer extension loader
- 没有 renderer extension entry
- 没有扩展组件注入
- 没有 `window.kisaki`

## 3. 扩展只保留一个入口

每个扩展只有一个 `entry`，由共享扩展宿主进程按扩展清单加载。

扩展入口负责：

- `activate(context)`
- 注册 contribution
- 订阅宿主事件
- 调用 capability API

扩展入口不再区分 `main` / `renderer`。

## 4. 公开契约定义在 `packages`，宿主只负责实现

新增统一公共包：

```text
packages/extension-api/
packages/extension-sdk/
packages/extension-cli/
packages/create-kisaki-extension/
```

约束如下：

- `extension-api`：只放公开类型、验证定义、协议、DTO、全局 API 契约与 contribution 类型。
- `extension-sdk`：扩展作者使用的运行时包装层，以及收敛在 `context.contributes.*` 域内的 contribution helper。
- `apps/desktop`：只在 `ExtensionService` 体系内实现这些公开契约，不反向输出内部实现。

进一步约束：

- 宿主侧对公开扩展契约的实现与适配，必须收敛在 `apps/desktop/src/main/services/extension/**` 与 `apps/desktop/src/main/extension-host/**`
- `ScraperService`、`DeeplinkService`、theme manager、db service 等现有业务模块不直接实现扩展 API 类型
- 这些业务模块只通过 `ExtensionService` 下的 contribution/capability 模块被调用和适配

## 目录设计

目标目录如下：

```text
apps/desktop/src/main/services/extension/
  service.ts
  types.ts
  manifest.ts
  state.ts
  catalog/
  installer/
  runtime/
    manager.ts
    host-controller.ts
    protocol.ts
    crash-policy.ts
  capabilities/
    library.ts
    network.ts
    notify.ts
    events.ts
    storage.ts
    log.ts
  contributions/
    registry.ts
    entity-menus.ts
    settings-panels.ts
    themes.ts
    scrapers.ts
    deeplinks.ts

apps/desktop/src/main/extension-host/
  index.ts
  bridge.ts
  loader.ts
  protocol.ts
  sdk-bootstrap.ts

apps/desktop/src/renderer/src/core/extensions/
  index.ts
  ipc.ts
  store.ts
  menus.ts
  settings.ts
  themes.ts
  types.ts

packages/extension-api/
packages/extension-sdk/
packages/extension-cli/
packages/create-kisaki-extension/
```

## 生命周期

## 1. 发现与装载

主应用启动后：

1. `ExtensionService` 扫描 `userData/extensions/packages/*/manifest.json`
2. 校验 manifest 和安装状态
3. 为每个已启用扩展生成运行描述
4. 启动共享扩展宿主进程
5. 建立 protocol 通道并接线 SDK bridge
6. 将所有已启用扩展的运行描述下发给共享宿主
7. 逐个加载扩展 `entry` 并调用 `activate(context)`

## 2. 注册期

扩展在 `activate(context)` 中完成：

- 菜单贡献注册
- 设置面板注册
- scraper provider 注册
- deeplink handler 注册
- theme 注册
- 事件订阅
- 生命周期清理注册

主应用把这些注册汇总到 `ContributionRegistry`。
各个 contribution 模块自身同时负责把相关贡献接到宿主现有模块里；例如 `scrapers.ts` 负责扩展 scraper 的注册模型和接入 `ScraperService` 的逻辑，`deeplinks.ts` 负责扩展 deeplink 的注册模型和接入 `DeeplinkService` 的逻辑。这些接线都必须停留在 `ExtensionService` 体系内完成，而不是把扩展契约形状扩散到现有业务模块内部。

## 3. 运行期

运行期主应用负责：

- 响应 renderer 的 UI 查询
- 把用户交互路由给正确的扩展运行槽位
- 调用远程 provider
- 维护启用/禁用/卸载/更新状态
- 处理扩展级异常、宿主级崩溃、超时和重载

## 4. 停用期

当扩展被禁用、卸载、重载或应用退出时：

1. main 请求扩展执行 `deactivate()`（可选）
2. 清理所有注册的 contribution 和订阅
3. 通知共享宿主卸载该扩展；仅在应用退出时关闭共享宿主进程
4. renderer 收到贡献刷新事件，UI 自动收敛

## 公开边界

## 宿主内部，绝不对扩展暴露

- `ServiceContainer`
- `DbService` / `sqlite` / `drizzle`
- `electron` 原生模块
- `Vue app`
- `router`
- `pinia`
- renderer 内部组件
- renderer 内部 stores/composables/utils
- 宿主 IPC channel 名字和实现细节

## 公开给扩展的稳定边界

- `activate(context)` 生命周期接口
- `kisaki` 全局扩展 API
- 结构化 contribution 接口
- 结构化 `UiCallbackResult` 回调结果契约
- 结构化 event 接口
- 结构化 DTO 和 query/filter contract

## 关键运行数据流

## 1. 菜单打开

```text
Renderer 打开实体菜单
  -> Main 请求 ContributionRegistry 组装该实体菜单
  -> Main 向共享宿主中的目标扩展运行槽位调用 resolveMenu(...)
  -> 共享宿主把作者态菜单节点归一化为结构化菜单项
  -> Main 合并结果并下发结构化菜单项
  -> Renderer 用宿主内置菜单组件渲染
```

这里的 `resolveMenu(...)` 只在菜单打开时自动执行一次。同一次打开会话内不会隐式再次 `resolve`；如果菜单项回调返回的 `UiCallbackResult` 中 `refresh: true`，则共享宿主才会重新解析当前菜单会话。无论如何，下次再次打开菜单时仍会重新执行 `resolveMenu(...)`。

## 2. 菜单交互

```text
Renderer 点击 action / checkbox / select
  -> Main 发送 interaction 到共享宿主中的目标扩展运行槽位
  -> 目标扩展执行目标菜单项的专属回调
  -> 回调返回结构化 `UiCallbackResult`
  -> 若结果中的 `refresh: true`，则共享宿主重新解析当前仍处于活动状态的菜单会话
  -> 必要时调用 library/network/notify 等 capability
  -> Main 通知 renderer 刷新菜单或提示状态
```

## 3. 设置面板渲染

```text
Renderer 打开扩展设置页
  -> Main 向共享宿主中的目标扩展运行槽位调用 resolvePanel(...)
  -> 共享宿主返回当前完整设置面板节点列表
  -> Renderer 用宿主内置表单控件渲染，并基于该节点列表初始化本地草稿
  -> 用户点击提交后回传表单值
  -> Main 转发给共享宿主中的目标扩展 onSubmit
  -> `onSubmit` 或按钮/高级控件回调返回结构化 `UiCallbackResult`
  -> 若结果中的 `refresh: true`，则 Main 再次调用 resolvePanel(...)
  -> Renderer 用新的面板节点列表重建当前面板
```

设置面板和菜单统一遵循同一条时机规则：`resolve` 仅在 UI 打开时自动执行，后续不做隐式刷新；只有扩展回调返回的 `UiCallbackResult.refresh === true` 时，宿主才会再次执行 `resolve`。

## 4. Scraper 调用

```text
宿主业务调用 scraper registry
  -> 若 provider 属于扩展，则转发给 `contributions/scrapers.ts` 中的扩展接线逻辑
  -> 目标扩展执行 provider.search/resolve/openSession
  -> 结果返回宿主现有 scraper pipeline
```

## 错误模型

新系统不以安全隔离为首要目标，但必须有清晰的错误边界：

- 扩展异常不会泄漏为宿主内部调用栈依赖。
- 每个扩展都有独立日志前缀、状态和 contribution 归属。
- protocol 调用有超时和结构化错误。
- 扩展级异常默认在回调边界被捕获并只影响当前扩展；UI 回调抛出的异常会被宿主归一化为 `UiCallbackResult` 失败结果。
- 如果共享宿主发生进程级崩溃，main 会重启宿主并重新激活全部已启用扩展。
- renderer 永远只处理结构化失败结果，不处理扩展代码异常对象。

## 主应用中的角色划分

### `ExtensionService`

新的总入口 service，替代旧 `PluginService`。职责：

- 扩展扫描
- 安装/卸载/更新/启停
- 扩展宿主管理
- contribution registry 管理
- 对 renderer 暴露统一 IPC facade
- 作为宿主实现扩展公开契约的唯一主边界

### `RuntimeManager`

负责共享扩展宿主进程与扩展加载生命周期：

- startHost
- handshake
- loadExtension
- unloadExtension
- reloadExtension
- restartHost
- shutdownHost

### `ContributionRegistry`

主进程统一维护所有扩展贡献：

- entity menus
- settings panels
- themes
- scrapers
- deeplinks

### `CapabilityGateway`

把宿主内部 service 适配成稳定 capability：

- `library`
- `network`
- `notify`
- `events`
- `storage`
- `log`

## 重构完成后的结果

完成后，扩展系统将从“宿主内部 API 直出”变成“进程隔离 + 契约前置 + 受控贡献”的架构：

- 主应用保留主导权。
- renderer 保持干净。
- 扩展作者拿到稳定、可维护、可演进的 API。
- 宿主内部可以继续重构，而不会把内部实现细节永久锁死为平台 API。
