# 03. SDK 与 Manifest 规范

本文件定义新扩展系统的公开开发模型，包括 manifest、项目结构、`activate(context)`、全局 API、类型约束和编码规范。

## Manifest 设计

## 目标

Manifest 必须满足：

- 单独 JSON 文件
- 只承载扩展元数据
- 不参与代码生成
- 不依赖 TS 文件导出
- 单入口字段使用 `entry`
- 由官方 JSON Schema 严格校验

## 文件名

扩展项目根目录与 `.kisx` 包内统一使用：

```text
manifest.json
```

## Manifest 结构

### 必填字段

| 字段         | 类型                  | 说明                                    |
| ------------ | --------------------- | --------------------------------------- |
| `id`         | `string`              | 稳定唯一 ID，建议反向域名或组织前缀风格 |
| `name`       | `string`              | 展示名称                                |
| `version`    | `string`              | semver 版本                             |
| `categories` | `ExtensionCategory[]` | 宿主固定分类，用于扩展市场筛选与分组    |
| `entry`      | `string`              | 相对路径，指向扩展唯一入口文件          |

### 选填字段

| 字段             | 类型       | 说明         |
| ---------------- | ---------- | ------------ |
| `description`    | `string`   | 简短描述     |
| `author`         | `string`   | 作者名       |
| `homepage`       | `string`   | 项目主页     |
| `icon`           | `string`   | 相对路径图标 |
| `keywords`       | `string[]` | 自由检索标签 |
| `engines.kisaki` | `string`   | 宿主兼容范围 |

### 分类枚举

`categories` 不是自由文本，而是宿主固定枚举。首版沿用现有市场筛选语义：

- `scraper`：元数据
- `tool`：工具
- `theme`：主题
- `integration`：集成

约束：

- 至少包含 1 个分类
- 不允许重复值
- 只能使用宿主定义的固定枚举
- 分类只用于市场筛选、分组和检索，不参与运行时能力判定

### 示例

```json
{
  "$schema": "./node_modules/@kisaki/extension-api/schemas/extension-manifest.schema.json",
  "id": "dev.ximu.sample-extension",
  "name": "Sample Extension",
  "version": "1.0.0",
  "categories": ["tool"],
  "entry": "./dist/index.mjs",
  "description": "Sample extension for Kisaki",
  "author": "ximu",
  "homepage": "https://example.com",
  "icon": "./icon.png",
  "keywords": ["metadata", "theme"],
  "engines": {
    "kisaki": ">=0.1.0"
  }
}
```

## JSON Schema 约束

`packages/extension-api` 必须提供官方 manifest schema，例如：

```text
packages/extension-api/schemas/extension-manifest.schema.json
```

规则如下：

- `create-kisaki-extension` 生成的 `manifest.json` 默认写入 `"$schema"`。
- `kisx validate`、`kisx build`、`kisx pack` 全部使用同一份 schema。
- 主应用安装 `.kisx` 时也使用同一份 schema。
- schema 采用 `additionalProperties: false`，不接受未声明字段。
- `categories` 通过枚举、`minItems`、`uniqueItems` 严格校验。

## 非目标字段

新 Manifest 中明确不再保留：

- `main`
- `renderer`
- `category`
- 任意宿主内部路径字段
- 任意 renderer 组件入口声明

其中旧的单值 `category` 被正式替换为严格约束的 `categories`。

## 项目结构

推荐扩展项目结构：

```text
my-extension/
  package.json
  manifest.json
  tsconfig.json
  tsdown.config.ts
  src/
    index.ts
  assets/
    icon.png
  README.md
```

这里的 `package.json` 仅用于 npm 依赖与脚本，不作为扩展元数据来源。

脚手架生成的 `manifest.json` 应默认包含：

- `"$schema"`
- 至少一个合法的 `categories`

## 单一入口模型

每个扩展只暴露一个入口文件，对应：

```ts
export default defineExtension({
  activate(context) {},
  deactivate(context) {}
})
```

或：

```ts
export async function activate(context: ExtensionContext): Promise<void> {}
export async function deactivate(context: ExtensionContext): Promise<void> {}
```

统一推荐使用 `defineExtension`。

## SDK 包设计

## 包划分

### `@kisaki/extension-api`

职责：

- 纯公开契约
- 类型定义
- manifest schema
- manifest JSON Schema
- DTO
- 事件名与 payload
- contribution schema
- 底层 protocol 类型

特点：

- 不依赖宿主实现
- 可被主应用、SDK、测试、扩展共同引用

推荐 `src/` 结构：

```text
src/
  index.ts
  shared/
  version.ts
  manifest.ts
  context.ts
  kisaki.ts
  capabilities/
    events.ts
    library/
  contributions/
  rpc.ts
```

当前实现把 locale、可序列化约束、生命周期接口、值对象、`UiCallbackResult` 以及相关验证 helper 等真正跨域复用的共享契约集中在 `src/shared/`。`contributions/` 下一级只保留实体菜单、设置面板、scraper、deeplink、theme 这类实际扩展点。`version.ts` 负责跨边界共享的扩展平台 API 版本常量；`rpc.ts` 同时负责底层 transport envelope、握手、structured-clone 安全传输值、RPC 协议常量，以及 main 与 extension host 共享的方向化 request/event maps。宿主 runtime 与 `@kisaki/extension-sdk/bridge` 只实现和适配这些契约，不在 `extension-api` 中承载任何宿主实现。`events` 当前保持为 `src/capabilities/events.ts` 单文件；没有明确跨域复用需求的类型，应收回到各自 capability / contribution 文件中。

### `@kisaki/extension-sdk`

职责：

- 运行时桥接封装
- `defineExtension`
- `kisaki` 全局扩展 API
- `context.contributes.*` 域内的 contribution helper
- context / storage / logger 等开发辅助

特点：

- 只面向扩展作者
- 不暴露宿主内部对象

推荐 `src/` 结构：

```text
src/
  index.ts
  bridge.ts
  capabilities/
  contributions/
```

当前实现保持两个根入口：

- `@kisaki/extension-sdk` -> `src/index.ts`，面向扩展作者，集中暴露 `defineExtension`、`kisaki`、`createDisposableStore()` 与 `@kisaki/extension-api` 的公开契约。
- `@kisaki/extension-sdk/bridge` -> `src/bridge.ts`，面向宿主 bootstrap，提供 `configureExtensionSdkBridge(...)`、`createExtensionContext(...)` 等桥接函数。

因此不再单独保留 `define.ts`、`kisaki.ts`、`context.ts` 或 `internal/` 目录。

## 公开命名约束

公开类型、模块名与 registrar 命名优先使用完整领域词，例如 `EntityMenuContribution`、`SettingsPanelContribution`、`entityMenus`、`settingsPanels`。避免把 `menu`、`settings` 这类语义过宽的短名作为 SDK 顶层公开主命名；局部 builder 参数可以在 `contributes.*` 的作用域内按上下文简写为 `menu`、`panel`。

## UI 注册 API 自包含

UI contribution 的 helper 不再作为 `@kisaki/extension-sdk` 的顶层导出，而是跟随 `context.contributes.entityMenus` / `context.contributes.settingsPanels` 一起工作。

推荐形态：

- `register({ ... })` 仍然是公开注册入口
- `resolve(...)` 直接收到当前 contribution 域注入的 builder
- 扩展作者不需要再额外 `import { entityMenu, settingsPanel }`
- builder 只负责构造作者态节点，不承担隐藏状态或命令式累积注册

## `activate(context)` 与全局 API 的职责划分

这是新系统最重要的边界之一。

### `activate(context)` 传入的实例级上下文

`ExtensionContext` 只承载“这次激活实例”的生命周期归属。

推荐接口：

```ts
interface ExtensionContext {
  readonly extension: {
    id: string
    name: string
    version: string
    manifestPath: string
    extensionPath: string
    dataPath: string
    tempPath: string
    mode: 'development' | 'production'
  }

  readonly logger: ExtensionLogger
  readonly storage: ExtensionStorage
  readonly subscriptions: DisposableStore
  readonly abortSignal: AbortSignal

  readonly contributes: {
    entityMenus: EntityMenuRegistrar
    settingsPanels: SettingsPanelRegistrar
    scrapers: ScraperRegistrar
    deeplinks: DeeplinkRegistrar
    themes: ThemeRegistrar
  }

  asAbsolutePath(relativePath: string): string
  registerDisposable(disposable: Disposable): void
}
```

实例级上下文必须具备的特点：

- 与扩展激活周期绑定
- 自动清理注册与订阅
- 自带当前扩展的 scoped logger
- 自带当前扩展的私有存储空间
- 不包含宿主内部 service 引用

### 可 import 的全局扩展 API

`@kisaki/extension-sdk` 提供全局 `kisaki` 对象：

```ts
import { kisaki } from '@kisaki/extension-sdk'
```

推荐接口：

```ts
const kisaki = {
  library,
  network,
  notify,
  events,
  runtime
}
```

其中：

- `library`：实体、关系、集合成员与附件等宿主库能力
- `network`：统一网络能力
- `notify`：通知能力
- `events`：宿主事件与扩展事件总线
- `runtime`：环境信息、延迟任务、版本信息等

`library` 不是“只做实体 CRUD”的薄封装，而是宿主库域能力的统一入口，至少覆盖：

- 实体的读取、查询、创建、更新、删除
- 实体关系与集合成员关系的创建、更新、删除
- 附件、封面、媒体资源等受控库资源操作

关系能力必须走公开 API，而不是让扩展感知内部 link table。推荐形态例如：

```ts
await kisaki.library.relations.create({
  kind: 'character-person',
  from: { entityType: 'character', id: characterId },
  to: { entityType: 'person', id: personId },
  metadata: {
    type: 'actor',
    order: 0
  }
})
```

### 两者差异

| 对象      | 作用域             | 用途                                   |
| --------- | ------------------ | -------------------------------------- |
| `context` | 本次激活实例       | 注册、清理、存储、日志、路径、生命周期 |
| `kisaki`  | 当前扩展运行时全局 | 调用宿主公开能力                       |

结论：

- 需要“归属”和“清理”的东西放进 `context`
- 需要“随处可用”的能力放进 `kisaki`

## 推荐入口写法

```ts
import { defineExtension, kisaki } from '@kisaki/extension-sdk'

export default defineExtension({
  async activate(context) {
    context.contributes.entityMenus.register({
      id: 'sample.game-tools',
      target: 'game.single',
      async resolve(input, menu) {
        const game = await kisaki.library.games.get(input.entityId)

        return [
          menu.action({
            id: 'sync',
            label: '同步元数据',
            async onClick() {
              context.logger.info('sync requested', input.entityId)
              return { success: true, refresh: false }
            }
          }),
          menu.checkbox({
            id: 'favorite',
            label: '喜欢',
            checked: !!game.isFavorite,
            async onChange(checked) {
              await kisaki.library.games.update(input.entityId, { isFavorite: checked })
              return { success: true, refresh: false }
            }
          }),
          menu.select({
            id: 'status',
            label: '游玩状态',
            value: game.status,
            options: [
              { value: 'notStarted', label: '未开始' },
              { value: 'inProgress', label: '进行中' }
            ],
            async onChange(value) {
              await kisaki.library.games.update(input.entityId, { status: value })
              return { success: true, refresh: false }
            }
          })
        ]
      }
    })

    context.contributes.settingsPanels.register({
      id: 'sample.settings',
      title: 'Sample Extension',
      async resolve(panel) {
        const autoSync = await context.storage.get('autoSync', false)

        return [
          panel.section({
            id: 'general',
            title: 'General',
            controls: [
              panel.switch({
                id: 'autoSync',
                label: '启动时自动同步',
                value: autoSync
              }),
              panel.button({
                id: 'relogin',
                label: '重新登录',
                async onClick(_, panelContext) {
                  panelContext.logger.info('manual relogin requested')
                  await kisaki.notify.info('正在重新登录')
                  return { success: true, refresh: true }
                }
              })
            ]
          })
        ]
      },
      async onSubmit(event) {
        await context.storage.set('autoSync', !!event.values.autoSync)
        return { success: true, refresh: false }
      }
    })
  }
})
```

## UI 回调模型

对扩展作者暴露的 UI API 采用“声明上合并，运行时分离”的设计：

- 作者写扩展时，控件定义和控件专属回调可以写在一起，这样最直观。
- 宿主实际运行时，会把可序列化的 UI model 和不可序列化的 callback registry 拆开。

所有公开 UI 回调都必须返回统一结构化对象：

```ts
interface UiCallbackError {
  code?: string
  message: string
  details?: Record<string, unknown>
}

type UiCallbackResult =
  | { success: true; refresh: boolean }
  | { success: false; refresh: boolean; error: UiCallbackError }
```

约束如下：

- 菜单项回调、设置面板控件回调和 `onSubmit` 都不再接受 `void` 作为公开返回值。
- `refresh` 必须显式给出，宿主不再通过“没返回值”或特殊字面量推断是否刷新。
- 扩展如果抛出异常，宿主会记录完整日志，并把结果归一化为 `success: false` 的 `UiCallbackResult`。

统一时机规则如下：

- `resolve()` 仅在对应 UI 首次打开时自动执行。
- UI 打开后的普通交互不会隐式再次 `resolve()`。
- 只有回调返回的 `UiCallbackResult.refresh === true` 时，宿主才会再次执行当前 UI 的 `resolve()`。

对于实体菜单，默认规则是：

- 菜单项以项级回调为主路径。
- `resolve(input, menu)` 中的 `menu.action(...)` 直接内联 `onClick`。
- `resolve(input, menu)` 中的 `menu.checkbox(...)` 与 `menu.select(...)` 直接内联 `onChange`。
- 运行时仍然会把菜单定义归一化为纯结构化菜单项，再把回调登记到 callback registry。

对于设置面板，默认规则是：

- `resolve()` 直接返回当前完整面板节点列表，不再额外暴露公开 `schema` 属性。
- 普通字段以表单草稿方式编辑，不即时触发回调。
- 面板的主保存路径使用 `onSubmit`。
- 控件级回调只推荐给按钮和少量高级即时操作。
- 面板后续是否重新 `resolve()`，由 `onSubmit` 或控件回调显式决定。

这意味着对外体验像这样：

- `resolve(panel)` 中的 `panel.switch(...)`、`panel.select(...)`、`panel.textInput(...)` 默认只是字段节点定义，不自带即时回调
- `resolve(panel)` 中的 `panel.button(...)` 可以直接内联 `onClick`
- 少量高级字段如果确实需要即时行为，可以显式声明控件级回调，但不是默认主路径

## 类型安全原则

## 1. 契约必须先定义，再实现

禁止继续使用：

- 从 `apps/desktop/src/shared` 反向生成 SDK 类型
- 从宿主内部文件直接拷贝 `.d.ts`
- 通过宿主全局对象形状推导 SDK

改为：

- `packages/extension-api` 先定义公开类型与验证定义
- 宿主只在 `ExtensionService` 体系内实现这些契约
- SDK 包装这些契约

## 2. 公共类型一律显式命名

公共平台类型必须稳定命名，如：

- `ExtensionManifest`
- `ExtensionContext`
- `EntityMenuContribution`
- `EntityMenuBuilder`
- `SettingsPanelContribution`
- `SettingsPanelBuilder`
- `UiCallbackResult`
- `UiCallbackError`
- `ThemeContribution`
- `HostEvents`
- `LibraryGame`
- `LibraryGamePatch`
- `LibraryRelation`
- `LibraryRelationCreateInput`
- `LibraryRelationPatch`

禁止对外暴露匿名结构体或宿主内部类型别名。

## 3. 使用判别联合建模 contribution

例如菜单项：

```ts
type EntityMenuItem =
  | { kind: 'action'; ... }
  | { kind: 'checkbox'; ... }
  | { kind: 'select'; ... }
  | { kind: 'separator'; ... }
```

这样 renderer 和 main 都能按 `kind` 做完全穷尽判断。

## 4. 使用运行时校验

类型系统解决编译期问题，运行时仍需校验：

- manifest 解析
- manifest JSON Schema
- protocol message 与宿主 bridge 入参出参
- contribution 注册
- settings panel resolved model
- settings panel submit payload
- callback result payload
- theme token completeness

推荐在 `extension-api` 中随 `manifest`、`contributions`、`protocol` 等公开契约就近提供这些运行时校验定义，而不是再额外扩一个顶层 `validation/` 目录。

## 5. 公开 DTO，不公开内部 schema

禁止直接对扩展暴露：

- `drizzle` 表对象
- `sqlite` 连接
- 原始宿主表结构

改为暴露稳定 DTO，例如：

- `LibraryGame`
- `LibraryCharacter`
- `LibraryPerson`
- `LibraryCompany`
- `LibraryCollection`
- `LibraryRelation`

## Storage 规范

扩展私有数据只通过 `context.storage` 访问。

推荐接口：

```ts
interface ExtensionStorage {
  get<T>(key: string, fallback: T): Promise<T>
  set<T>(key: string, value: T): Promise<void>
  delete(key: string): Promise<void>
  listKeys(prefix?: string): Promise<string[]>
}
```

约束：

- 键空间自动以扩展 ID 隔离
- 只允许 JSON 可序列化数据
- 不暴露宿主底层存储实现

## Logger 规范

`context.logger` 自动带扩展前缀，不要求扩展手动拼接 `[MyExtension]`。

推荐接口：

```ts
interface ExtensionLogger {
  debug(message: string, ...args: unknown[]): void
  info(message: string, ...args: unknown[]): void
  warn(message: string, ...args: unknown[]): void
  error(message: string, ...args: unknown[]): void
}
```

## 命名规范

- 扩展 ID：全局唯一、稳定、不随展示名称变化
- contribution ID：扩展内唯一，建议 `<area>.<feature>`
- event topic：必须命名空间化
- deeplink route：必须带扩展命名空间

## 明确废弃的旧模式

以下旧模式在新 SDK 中全部删除：

- `container.get(...)`
- `schema` / `db` 直接暴露
- `electron` re-export
- `vue` / `vue-router` / `pinia` runtime 暴露
- 宿主 UI 组件全集导出
- 声明合并扩展宿主 `IpcMainHandlers` / `AppEvents` 的模式

## 结论

新的 SDK 不是宿主内部模块的“镜像导出层”，而是：

- 一个围绕公开契约设计的开发平台
- 一个围绕 `activate(context)` 与 `kisaki` 全局能力分层的运行时模型
- 一个不依赖 renderer 注入、主进程容器暴露、内部组件暴露的现代扩展 API
