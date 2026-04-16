# Kisaki Extension System 重构总览

本目录定义 Kisaki 新一代 `extension` 扩展系统，用来彻底替换当前的 `plugin` 插件系统。

这次重构的目标不是在旧系统上修补，而是建立一套新的公开扩展平台边界：

- 扩展只通过公开契约工作，不再直接触碰宿主内部对象。
- 扩展运行时与主应用物理解耦，不再在 renderer 中执行扩展代码。
- 所有扩展接口定义统一原生定义在 `packages`，宿主应用只在 `ExtensionService` 体系内实现和适配。
- UI 扩展改为受控贡献模型，不再支持自定义页面、Tab、Sidebar、任意 Vue 组件注入。
- 工具链统一为 `tsdown`，打包格式统一为 `.kisx`。

## 核心结论

新系统的不可动摇约束如下：

1. 不再存在 `globalThis.kisaki` / `window.kisaki` 这种宿主内部对象直出模式。
2. 不再对扩展暴露 `ServiceContainer`、`electron`、`drizzle`、`Vue app/router/pinia`、内部组件库、内部 composables。
3. 不再在 renderer 进程加载扩展入口，也不再支持 `main + renderer` 双入口扩展。
4. 扩展代码只运行在共享的扩展宿主进程中，renderer 仅消费主进程下发的贡献快照。
5. 扩展只允许受控扩展点：实体菜单、扩展设置面板、事件、scraper、deeplink、theme，以及公开宿主能力；受控 UI 统一采用“打开时 resolve，后续仅显式 refresh”的模型，且所有 UI 回调必须返回结构化 `UiCallbackResult`，明确 success、refresh、error。
6. 扩展面向稳定 DTO 和 capability API，而不是面向数据库 schema、IPC channel 和内部 service。

## 文档清单

- [01-current-state-audit.md](./01-current-state-audit.md)
  当前项目插件体系的完整审计，明确必须删除、必须保留、可以复用的部分。
- [02-target-architecture.md](./02-target-architecture.md)
  新扩展系统的总体架构、进程边界、生命周期、目录设计和运行模型。
- [03-sdk-and-manifest-spec.md](./03-sdk-and-manifest-spec.md)
  Manifest、`activate(context)`、全局 API、类型系统、公开契约和编码规范。
- [04-extension-points-and-ui-spec.md](./04-extension-points-and-ui-spec.md)
  扩展点、菜单/设置受控 UI、事件、scraper、deeplink、theme、宿主能力规范。
- [05-runtime-packaging-and-tooling.md](./05-runtime-packaging-and-tooling.md)
  共享扩展宿主进程、桥接协议、`.kisx` 打包格式、tsdown 工具链、开发调试与安装更新。
- [06-implementation-plan.md](./06-implementation-plan.md)
  仓库级重构实施方案、目录改造、删除/新增模块、测试策略与验收标准。

## 术语约定

- `Extension`：新的扩展单元，替代旧的 `Plugin`。
- `Extension Host`：共享运行所有已启用扩展入口的宿主进程。
- `Main App`：Kisaki 主应用的 Electron main process。
- `Renderer`：Kisaki 的 Vue UI 渲染层，只消费扩展贡献结果，不执行扩展代码。
- `Contribution`：扩展向宿主注册的声明式能力，如菜单项、设置面板、theme、scraper provider。
- `Capability`：宿主暴露给扩展的受控基础能力，如 library、network、notify、log、storage。
- `Activation Context`：传给 `activate(context)` 的实例级上下文，负责生命周期和注册归属。
- `Global Extension API`：扩展中可直接 `import` 的全局公开 API，面向稳定宿主能力。

## 设计原则

### 1. 公开契约前置

扩展 API 不能从 `apps/desktop` 反向导出；必须先在 `packages` 里定义公开契约，再由宿主实现。

宿主实现这些契约时也必须收敛在扩展边界内：

- 公开扩展契约只允许在 `apps/desktop/src/main/services/extension/**` 和 `apps/desktop/src/main/extension-host/**` 中实现或适配
- `ScraperService`、`DeeplinkService`、theme manager 等现有业务模块只作为被接入的内部依赖
- 业务模块本身不直接暴露或承接扩展 API 形状

### 2. Renderer 零扩展代码

renderer 不再 import 扩展入口、不再 mount 扩展组件、不再暴露内部运行时给扩展。所有 UI 扩展都通过主进程下发的结构化贡献模型渲染。

### 3. 注册优于侵入

扩展只能注册：

- 贡献点
- 事件监听
- 回调处理器
- 受控资源访问

扩展不能直接修改宿主状态树、路由树、组件树和 service container。

### 4. 单一稳定入口

每个扩展只有一个 `entry`。共享扩展宿主进程负责加载每个已启用扩展的入口，扩展在 `activate(context)` 内注册全部能力。

### 5. 强类型和可验证

Manifest、RPC 负载、贡献模型、事件负载、DTO 都由共享类型和运行时校验共同约束，不靠约定俗成。

### 6. 优先清晰，不保兼容

本方案默认不保留旧 `plugin` API、不迁就旧模板、不兼容旧包结构、不保留旧 renderer 扩展模型。

### 7. 回调结果结构化

菜单项回调、设置面板按钮回调和 `onSubmit` 必须统一返回结构化 `UiCallbackResult`：

- 必须显式声明本次回调是否成功
- 必须显式声明当前 UI surface 是否需要 refresh
- 失败时必须返回可序列化错误信息

宿主不再接受 `void`、裸 `refresh` 标记或其他隐式语义作为公开回调返回协议。

## 仓库目标结果

重构完成后，仓库应当具有以下稳定结构：

```text
apps/desktop/src/main/services/extension/   # 扩展服务与主进程实现
apps/desktop/src/main/extension-host/       # 共享扩展宿主进程入口与桥接
apps/desktop/src/renderer/src/core/extensions/ # renderer 侧贡献消费层
packages/extension-api/                     # 公开契约、JSON Schema 与验证定义
packages/extension-sdk/                     # 扩展作者 SDK
packages/extension-cli/                     # kisx CLI
packages/create-kisaki-extension/          # 扩展脚手架
docs/architecture/extension-system/         # 本设计文档集
```

## 直接删除范围

以下旧系统在新架构中不再保留：

- `apps/desktop/src/main/services/plugin/**`
- `apps/desktop/src/renderer/src/core/plugin/**`
- `apps/desktop/src/renderer/src/core/ui-extensions/**`
- `apps/desktop/plugin-types/**`
- `apps/desktop/scripts/build-plugin-types.ts`
- `apps/desktop/rolldown.plugin-types.config.ts`
- `packages/plugin-sdk/**`
- `packages/plugin-cli/**`
- `packages/create-kisaki-plugin/**`

具体删除与替换方案见 [06-implementation-plan.md](./06-implementation-plan.md)。
