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
5. 扩展只允许受控扩展点：实体菜单、扩展设置面板、事件、scraper、deeplink、theme，以及公开宿主能力；其中 scraper API 当前聚焦 provider 注册接口与会话契约，不再额外承诺独立 helper 模块；受控 UI 统一采用“打开时 resolve，后续仅显式 refresh”的模型，且所有 UI 回调必须返回结构化 `UiCallbackResult`，明确 success、refresh、error。
6. 扩展面向稳定 DTO 和 capability API，而不是面向数据库 schema、IPC channel 和内部 service。
7. `library` capability 是宿主库域总入口，不只是实体 CRUD；它还必须覆盖实体关系/集合成员关系的创建与维护，以及附件、媒体等受控库操作。

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
- `Capability`：宿主暴露给扩展的受控基础能力，如 `library`（实体、关系、集合成员、附件/媒体）、network、notify、log、storage。
- `Activation Context`：传给 `activate(context)` 的实例级上下文，负责生命周期和注册归属。
- `Global Extension API`：扩展中可直接 `import` 的全局公开 API，面向稳定宿主能力。

## 设计原则

### 1. 公开契约前置

扩展 API 不能从 `apps/desktop` 反向导出；必须先在 `packages` 里定义公开契约，再由宿主实现。

宿主实现这些契约时也必须收敛在扩展边界内：

- 公开扩展契约只允许在 `apps/desktop/src/main/services/extension/**` 中实现或适配；共享宿主进程入口、RPC server、SDK bridge 与 host 侧 contribution 实现也统一收敛在该子系统内的 `runtime/host/**`
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

Manifest、protocol 消息、贡献模型、事件负载、DTO 都由共享类型和运行时校验共同约束，不靠约定俗成。

### 6. 优先清晰，不保兼容

本方案默认不保留旧 `plugin` API、不迁就旧模板、不兼容旧包结构、不保留旧 renderer 扩展模型。

### 7. 回调结果结构化

菜单项回调、设置面板按钮回调和 `onSubmit` 必须统一返回结构化 `UiCallbackResult`：

- 必须显式声明本次回调是否成功
- 必须显式声明当前 UI surface 是否需要 refresh
- 失败时必须返回可序列化错误信息

宿主不再接受 `void`、裸 `refresh` 标记或其他隐式语义作为公开回调返回协议。

### 8. 主边界先收敛，再按子域拆分

`ExtensionService` 内部优先保持少量根级单文件边界，例如 `manifest.ts`、`state.ts`、`catalog.ts`、`installer.ts`；只有当某个子域天然承载多模块协作时，才升级为目录，例如 `sources/`、`runtime/`、`contributions/`、`capabilities/`。

这条规则的目的不是压缩文件数量，而是避免把单一职责模块过早目录化，降低实现初期的导航成本，并让“来源接入”“共享宿主运行时”这类真正多模块子域保持清晰边界；其中共享宿主进程相关实现继续保留独立运行时边界，但目录归属统一收敛在 `services/extension/runtime/host/`。

共享宿主 runtime 子域内部也应优先使用自说明命名，例如 `entry.ts`、`rpc-server.ts`、`extension-registry.ts`、`extension-loader.ts`、`sdk-bridge.ts`；避免 `runtime.ts`、`registry.ts`、`loader.ts` 这类脱离上下文后容易歧义的文件名。UI session 状态默认内聚在各自的 `runtime/host/contributions/*.ts` 域内，只有 callback handle 管理保持为共享宿主级基础设施。

## 仓库目标结果

重构完成后，仓库应当具有以下稳定结构：

```text
apps/desktop/src/main/services/extension/      # 扩展服务、运行时与共享宿主实现
apps/desktop/src/renderer/src/core/extensions/ # renderer 侧贡献消费层
packages/extension-api/                        # 公开契约、JSON Schema 与验证定义
packages/extension-sdk/                        # 扩展作者 SDK
packages/extension-cli/                        # kisx CLI
packages/create-kisaki-extension/             # 扩展脚手架
docs/architecture/extension-system/            # 本设计文档集
```

注意：这里的“收敛到 `services/extension/`”仅表示目录归属统一，不表示把共享 `Extension Host` 进程并回 `ExtensionService` 同进程执行。共享宿主进程仍然保持独立入口、独立构建产物和独立运行时边界。

## Packages 目录设计

这里把四个公开包一起定型：`extension-api`、`extension-sdk`、`create-kisaki-extension` 负责作者侧分层，`extension-cli` 负责工具链消费层。整体仍按“纯契约层 -> 作者运行时层 -> 工具链/脚手架层”的顺序收敛，避免后续实现时再次滑回旧 `plugin` 系统的 `main/renderer` 双入口设计。

依赖方向必须固定为：

```text
extension-api <- extension-sdk <- create-kisaki-extension(生成物依赖)
        ^             ^
        └──── apps/desktop / extension-cli 只消费，不反向输出内部实现
```

### `packages/extension-api/`

职责：公开契约、JSON Schema、DTO、全局 API 契约、贡献类型、底层 protocol 类型。

```text
packages/extension-api/
  package.json
  tsconfig.json
  tsdown.config.ts
  README.md
  schemas/
    extension-manifest.schema.json
  src/
    index.ts
    shared/
    manifest.ts
    context.ts
    kisaki.ts
    capabilities/
      events.ts
      library/
    contributions/
    rpc.ts
```

约束：

- 只放稳定公开契约，不放任何宿主实现、进程桥接、状态管理或 app 内部路径引用。
- `schemas/` 只放对外发布的 JSON Schema；运行时校验定义应跟随 `manifest.ts`、`contributions/**`、`rpc.ts` 等公开契约就近组织，而不是再扩一个顶层 `validation/` 杂项目录。
- `shared/` 用于收敛真正跨域复用的共享契约，例如 locale、序列化约束、生命周期接口、值对象、`UiCallbackResult` 与相关验证 helper；没有跨域复用需求的类型应回收到对应 capability / contribution 文件。
- `contributions/` 下一级只保留真正的扩展点定义；跨扩展点复用的 UI 协议不再混入该目录。
- `context.ts`、`kisaki.ts`、`rpc.ts` 先保持单文件；只有当某个公开子域稳定长成多模块时再升级成目录。
- `rpc.ts` 同时定义底层 transport envelope、握手、structured-clone 安全传输值，以及 main 与 extension host 共享的方向化 request/event contracts。宿主 runtime 与 `@kisaki/extension-sdk/bridge` 只负责实现和适配这些契约，不在 `extension-api` 中承载任何宿主实现。
- `capabilities/library/` 单独成域，后续继续拆实体、关系、集合成员、附件/媒体相关 DTO 与 command/query。
- `events` 契约归入 `src/capabilities/events.ts`，作为宿主能力而不是 contribution 扩展点建模。
- `scraper` 公开契约当前聚焦 provider、search/resolve 和 session 合同；只有在后续确实沉淀出稳定复用面时，才再升级为独立公开 helper 子域。
- 不再出现 `main/`、`renderer/`、`types/` 这种来自宿主内部结构的镜像目录。

### `packages/extension-sdk/`

职责：扩展作者运行时包装层，负责把 `extension-api` 的契约变成可直接书写扩展的开发体验。

```text
packages/extension-sdk/
  package.json
  tsconfig.json
  tsdown.config.ts
  README.md
  src/
    index.ts
    bridge.ts
    capabilities/
    contributions/
```

约束：

- 作者侧公开入口收敛在根 `index.ts`，集中暴露 `defineExtension`、`kisaki`、`ExtensionContext` 相关 helper、`createDisposableStore()`，并转发 `@kisaki/extension-api` 的公开契约。
- 宿主 bootstrap helper 收敛在 `bridge.ts`，通过显式子路径 `@kisaki/extension-sdk/bridge` 暴露；不再保留 `internal/` 目录。
- `capabilities/` 对应宿主公开能力包装；`contributions/` 对应作者态注册器与域内 builder。UI 节点构造应收敛在 `context.contributes.entityMenus` / `context.contributes.settingsPanels` 的作用域内，不再依赖额外顶层公开 `entityMenu`、`settingsPanel` builder。
- 公开类型、模块名与 registrar 命名优先自说明，优先使用 `EntityMenu*`、`SettingsPanel*`、`entityMenus`、`settingsPanels` 这类完整领域名；避免把 `menu`、`settings` 作为 SDK 顶层公开主命名。
- scraper 作者态 API 当前聚焦 provider 注册器与 capability 包装；通用解析工具只有在形成稳定复用面后，才考虑上提为公开契约。
- 不再保留 `src/main/`、`src/renderer/`、`theme.css`、宿主复制出的 `.d.ts` 目录。

### `packages/extension-cli/`

职责：提供 `kisx` 命令，负责扩展项目发现、manifest 校验、构建、打包、dev 启动与调试接线。

```text
packages/extension-cli/
  package.json
  tsconfig.json
  tsdown.config.ts
  README.md
  src/
    index.ts
    cli.ts
    commands/
      build.ts
      validate.ts
      pack.ts
      dev.ts
    manifest.ts
    project.ts
    archive.ts
    launch.ts
    logger.ts
```

约束：

- `index.ts` 只作为 bin 入口；`cli.ts` 负责参数解析、help 输出和命令分发。
- `commands/` 必须一条顶层命令一个文件，只编排流程，不重复实现 manifest 校验、打包或 dev 启动细节。
- `manifest.ts` 负责读取 `manifest.json`、调用官方 schema、执行 `entry` / `engines.kisaki` / 可选资源等复用校验。
- `project.ts` 负责识别扩展项目根目录、路径布局和产物位置，不把这些路径规则散落到各命令文件里。
- `archive.ts` 只负责 `.kisx` 打包布局与压缩，不重复构建或 schema 校验逻辑。
- `launch.ts` 只负责 `kisx dev` 下的 Kisaki 启动与 `--dev-extension` 接线。
- `logger.ts` 只提供统一 CLI 输出；不新增 `utils/`、`helpers/`、`core/` 这类泛目录。
- CLI 只消费 `extension-api` 和工作区约定，不反向定义公开契约，也不从 `apps/desktop/**` 反向导入内部实现。

### `packages/create-kisaki-extension/`

职责：生成最小可运行扩展项目，本身只负责交互、模板渲染和文件落盘。

```text
packages/create-kisaki-extension/
  package.json
  tsconfig.json
  tsdown.config.ts
  README.md
  src/
    index.ts
    cli/
    scaffold/
  templates/
    default/
      package.json
      manifest.json
      tsconfig.json
      tsdown.config.ts
      README.md
      src/
        index.ts
```

约束：

- `src/cli/` 负责 prompts、参数解析、输出日志；`src/scaffold/` 负责模板变量、文件渲染、冲突处理与写盘。
- `templates/default/` 必须只生成单入口扩展最小集合，不再出现 `src/main/`、`src/renderer/`、`src/shared/`、`vite.config.ts`。
- 模板默认依赖 `@kisaki/extension-sdk`，通过 `kisx` 命令接入 CLI 工具链，并直接引用 `@kisaki/extension-api` 发布的 manifest schema。
- 该包不再保留 `scripts/build.ts` 这类自定义 copy 流程，构建统一交给 `tsdown`，模板目录直接随包发布。

### 结构冻结规则

- 这四个包都不允许从 `apps/desktop/**` 反向导入任何内部模块或类型。
- 公开契约先落在 `extension-api`，再由 `extension-sdk` 提供作者体验，最后才由脚手架消费。
- `extension-cli` 只消费公开契约和工作区约定；新增命令优先放进 `src/commands/**`，新增跨命令复用逻辑优先增加单一职责文件，而不是引入 `utils/` 杂项目录。
- 如果后续需要增加新扩展点，优先新增 `extension-api/src/contributions/**` 与 `extension-sdk/src/contributions/**`，而不是在根目录平铺文件。
- 如果后续需要新增宿主能力，优先新增 `extension-api/src/capabilities/**` 与 `extension-sdk/src/capabilities/**` 的对应子模块。

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
