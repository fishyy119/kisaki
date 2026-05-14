# 扩展贡献点 API 统一重构设计与实施文档

本文定义 Kisaki 扩展贡献点 API 的目标形态、命名规则、类型重命名、跨进程 RPC、文件组织和实施顺序。

本次重构不考虑向后兼容：旧 API、旧类型、旧 RPC 名称、旧目录名和旧示例全部删除或重命名，不保留 deprecated alias、shim 或双写逻辑。

## 背景

当前扩展贡献点 API 存在三个主要问题：

1. 顶层贡献点命名不总是表达注册物。例如 `scrapers` 实际注册的是 provider，`settings` 实际注册的是 panel，`deeplinks` 实际注册的是 route。
2. `scrapers` 与其它贡献点的注册风格不一致。其它贡献点多为 `register(...)`，但 scraper 使用 `registerGameProvider(...)`、`registerPersonProvider(...)` 等动词拼接方法名。
3. “贡献点类型”和“产品域/实体域/媒体域”边界不清，导致后续新增贡献点时容易继续落入含混的 `scrapers` 容器。

本次重构的核心目标是让 `context.contributions` 顶层只表达贡献点类型，注册方法统一叫 `register(...)`，域和范围只作为贡献点内部的类型化路径存在。

## 核心结论

`context.contributions` 的顶层 key 表示“贡献点类型”，不是产品域，也不是业务大类。

最终公开入口：

```ts
context.contributions.entityMenus.game.single.register(menu)
context.contributions.settingsPanels.register(panel)
context.contributions.scraperProviders.game.register(provider)
context.contributions.deeplinkRoutes.register(route)
context.contributions.themes.register(theme)
context.contributions.commands.register(command)
```

规则：

- 顶层 key 必须是注册物的复数名：`settingsPanels` 注册 panel，`scraperProviders` 注册 provider，`deeplinkRoutes` 注册 route。
- `register(...)` 方法名不携带对象类型、域名或媒体类型。
- 如果注册物类型因域不同而不同，域出现在 registrar 路径中，例如 `scraperProviders.game.register(...)`。
- 如果域只是注册物自身的普通数据，不影响 register 参数类型，可以作为对象字段。
- 不允许用一个泛化的 `scrapers` 顶层容器承载多个异质贡献。

## 术语

| 术语               | 含义                                                                                 |
| ------------------ | ------------------------------------------------------------------------------------ |
| Contribution point | `context.contributions` 下的顶层能力，例如 `settingsPanels`、`scraperProviders`。    |
| Domain             | 某个贡献点内部的业务维度，例如 entity menu 的 `game`、scraper provider 的 `person`。 |
| Scope              | domain 下进一步收窄的使用场景，例如 entity menu 的 `single`、`batch`。               |
| Contribution       | 扩展注册的完整贡献对象，例如 `SettingsPanelContribution`。                           |
| Registration point | 某个具体路径上的 `register(...)` 容器，例如 `scraperProviders.game`。                |
| Registration       | `register(...)` 返回的可释放句柄。                                                   |
| Runtime registry   | extension host 进程中保存扩展回调和不可序列化对象的注册表。                          |
| Main registry      | main 进程中保存可序列化 contribution snapshot 和 renderer IPC 转发状态的注册表。     |

## 命名规则

### Public API

- 顶层贡献点使用 camelCase 复数名：`entityMenus`、`settingsPanels`、`scraperProviders`。
- 注册方法统一为 `register(...)`。
- 不使用 `registerGameProvider`、`registerRoute`、`registerPanel` 这类方法名。
- 对象变量名与注册物一致：`menu`、`panel`、`provider`、`route`、`theme`、`command`。
- helper 只在需要保持泛型推导时提供，例如 `defineSettingsPanel(...)`。

### TypeScript 类型

| 后缀                   | 含义                                            | 示例                                          |
| ---------------------- | ----------------------------------------------- | --------------------------------------------- |
| `Contribution`         | 扩展作者注册的完整对象                          | `SettingsPanelContribution`                   |
| `Registrar`            | `context.contributions.<point>` 的公共入口      | `ScraperProviderRegistrar`                    |
| `RegistrationPoint`    | 某个 domain/scope 下包含 `register(...)` 的对象 | `ScraperProviderRegistrationPoint<TProvider>` |
| `Registration`         | `register(...)` 返回的 disposable 句柄          | `SettingsPanelRegistration`                   |
| `Definition`           | contribution 内部声明的子定义                   | `SettingsPanelDialogDefinition`               |
| `Model`                | 扩展回调返回的可归一化结构                      | `SettingsPanelRootModel`                      |
| `Node`                 | 可渲染结构单元                                  | `SettingsPanelTextInputNode`                  |
| `Event`                | 扩展 callback 入参                              | `EntityMenuNodeEvent<TInput>`                 |
| `Result`               | 扩展 callback 出参                              | `SettingsPanelSubmitResult`                   |
| `Factory`              | 帮助扩展创建 node/model 的无状态工厂            | `EntityMenuNodeFactory<TInput>`               |
| `Descriptor`           | 内部静态描述符                                  | `ScraperProviderDomainDescriptor`             |
| `RegistrationInfo`     | main/renderer 可见的 snapshot 条目              | `ExtensionScraperProviderRegistrationInfo`    |
| `Request` / `Response` | IPC 或 RPC 传输契约                             | `ExtensionSettingsPanelOpenRequest`           |

### 文件与目录

- 公共 contribution 目录使用 kebab-case 复数名：`settings-panels`、`scraper-providers`、`deeplink-routes`。
- 内部文件也使用 kebab-case：`entity-menus.ts`、`settings-panels.ts`。
- 目录名必须与贡献点名一一对应；不要出现一个目录同时保存多个不同贡献点。
- `index.ts` 只做 re-export，不放实现逻辑。

## 最终 `ExtensionContext`

`packages/extension-api/src/context.ts` 中的贡献点入口改为：

```ts
export interface ExtensionContext {
  readonly extension: ExtensionRuntimeMetadata
  readonly logger: ExtensionLogger
  readonly storage: ExtensionStorage
  readonly secrets: ExtensionSecrets
  readonly subscriptions: DisposableStore
  readonly abortSignal: AbortSignal
  readonly contributions: ExtensionContributionRegistrars
  asAbsolutePath(relativePath: string): string
}

export interface ExtensionContributionRegistrars {
  readonly entityMenus: EntityMenuRegistrar
  readonly settingsPanels: SettingsPanelRegistrar
  readonly scraperProviders: ScraperProviderRegistrar
  readonly deeplinkRoutes: DeeplinkRouteRegistrar
  readonly themes: ThemeRegistrar
  readonly commands: CommandRegistrar
}
```

所有 `register(...)` 返回值必须是同步 disposable 或 registration 句柄。贡献点注册是 extension host 对 contribution 的本地接收，不是等待 main 进程完成的远程事务；不能把 public API 做成有的同步、有的异步。

`register(...)` 成功返回只表示 extension host 已完成本地形状校验、扩展内重复 id 校验，并已写入 runtime registry；不表示 main registry 一定已经完成同步。Host 到 main 的同步请求由 host 跟踪。若 main registry 同步失败，无论该注册发生在 `activate()` 阶段还是运行期，host 都必须只让对应 registration 失效、回滚 runtime registry 中对应条目、记录扩展侧错误日志，并通过 runtime diagnostic 暴露失败原因；扩展本身不因为单个 contribution 同步失败而进入 failed 状态。

`activate()` 阶段结束后，loader 仍必须等待当前扩展的初始 contribution 同步请求全部 settle，避免扩展显示 running 时 main registry 仍处在半同步状态。该等待只负责 drain initial contribution synchronization，不因单个 main registry 同步失败而抛出 activation error。只有扩展代码自身抛错、本地 shape 校验失败、扩展内重复 id 等同步注册错误未被扩展捕获，才会按普通 activation error 处理。

所有 registration/disposable 必须共享同一套幂等状态机。失效后的 registration `dispose()` 必须保持幂等，不能因为 main 侧从未成功注册或已被回滚而抛出非预期错误；`refresh()` 等 registration 自身的主动操作在失效后应返回明确错误。

贡献点 registrar 保持现有自动清理行为：`register(...)` 返回的 registration/disposable 由 SDK registrar 自动加入当前 extension runtime 的 `context.subscriptions`，扩展作者只有在需要提前释放时才需要保存返回值并主动 `dispose()`。不保留 `registerDisposable(disposable)` 这类便捷方法；非 contribution 的自定义 disposable 统一使用 `context.subscriptions.add(disposable)`。

## 贡献点一览

| 顶层 key           | 注册物                      | 是否有 domain/scope       | register 参数                    | 返回                          |
| ------------------ | --------------------------- | ------------------------- | -------------------------------- | ----------------------------- |
| `entityMenus`      | entity menu contribution    | 有：entity domain + scope | `EntityMenuContribution<TInput>` | `EntityMenuRegistration`      |
| `settingsPanels`   | settings panel contribution | 无                        | `SettingsPanelContribution`      | `SettingsPanelRegistration`   |
| `scraperProviders` | scraper provider            | 有：media domain          | `GameScraperProvider` 等         | `ScraperProviderRegistration` |
| `deeplinkRoutes`   | deeplink route contribution | 无                        | `DeeplinkRouteContribution`      | `DeeplinkRouteRegistration`   |
| `themes`           | theme contribution          | 无                        | `ThemeContribution`              | `ThemeRegistration`           |
| `commands`         | command contribution        | 无                        | `CommandContribution`            | `CommandRegistration`         |

## Entity Menus

`menus` 改名为 `entityMenus`，因为该贡献点只面向实体上下文菜单，不代表应用菜单、窗口菜单或命令面板。

### Public API

```ts
context.contributions.entityMenus.game.single.register({
  id: 'open-source',
  order: 20,
  async resolve(input, menu) {
    return [
      menu.action({
        id: 'open',
        label: 'Open source page',
        async onClick() {
          return { success: true, refresh: false }
        }
      })
    ]
  }
})
```

### 类型命名

旧类型全部删除并重命名：

| 旧名                            | 新名                                  |
| ------------------------------- | ------------------------------------- |
| `MenuRegistrar`                 | `EntityMenuRegistrar`                 |
| `MenuRegistrationPoint`         | `EntityMenuRegistrationPoint`         |
| `MenuRegistration`              | `EntityMenuRegistration`              |
| `MenuContribution<TInput>`      | `EntityMenuContribution<TInput>`      |
| `MenuInputMap`                  | `EntityMenuInputMap`                  |
| `MenuDomain`                    | `EntityMenuDomain`                    |
| `MenuScope<TDomain>`            | `EntityMenuScope<TDomain>`            |
| `MenuInput`                     | `EntityMenuInput`                     |
| `MenuInputFor<TDomain, TScope>` | `EntityMenuInputFor<TDomain, TScope>` |
| `MenuNode`                      | `EntityMenuNode`                      |
| `MenuActionNode`                | `EntityMenuActionNode`                |
| `MenuCheckboxNode`              | `EntityMenuCheckboxNode`              |
| `MenuSelectNode`                | `EntityMenuSelectNode`                |
| `MenuSubmenuNode`               | `EntityMenuSubmenuNode`               |
| `MenuSeparatorNode`             | `EntityMenuSeparatorNode`             |
| `MenuSelectOption`              | `EntityMenuSelectOption`              |
| `MenuNodeEvent<TInput>`         | `EntityMenuNodeEvent<TInput>`         |
| `MenuNodeFactory<TInput>`       | `EntityMenuNodeFactory<TInput>`       |
| `MenuRefreshReason`             | `EntityMenuRefreshReason`             |

### Registrar

```ts
export type EntityMenuRegistrar = {
  [TDomain in EntityMenuDomain]: {
    [TScope in EntityMenuScope<TDomain>]: EntityMenuRegistrationPoint<
      EntityMenuInputFor<TDomain, TScope>
    >
  }
}

export interface EntityMenuRegistrationPoint<TInput extends EntityMenuInput> {
  register(menu: EntityMenuContribution<TInput>): EntityMenuRegistration
}
```

`EntityMenuInputMap` 是 domain/scope/input 的唯一事实源。不要再维护第二套 domain/scope contribution 映射。

当前 entity menu domain/scope 清单完整保留，只做类型与贡献点命名重构：

```ts
export interface EntityMenuInputMap {
  game: {
    single: EntityMenuGameSingleInput
    batch: EntityMenuGameBatchInput
  }
  character: {
    single: EntityMenuCharacterSingleInput
  }
  person: {
    single: EntityMenuPersonSingleInput
  }
  company: {
    single: EntityMenuCompanySingleInput
  }
  collection: {
    single: EntityMenuCollectionSingleInput
  }
  tag: {
    single: EntityMenuTagSingleInput
  }
}
```

### RPC

Host 到 main：

- `contributions.entityMenus.register`
- `contributions.entityMenus.unregister`
- `contributions.entityMenus.refreshRequested`

Main 到 host：

- `contributions.entityMenus.resolve`
- `contributions.entityMenus.invoke`
- `contributions.entityMenus.release`

Renderer IPC：

- `extension:resolve-entity-menu`
- `extension:invoke-entity-menu`
- `extension:release-entity-menu`

Renderer event：

- `extension:entity-menus-refresh-requested`

## Settings Panels

`settings` 改名为 `settingsPanels`。该贡献点注册的是扩展设置面板，不是应用设置能力，也不是扩展 storage。

### Public API

```ts
context.contributions.settingsPanels.register(
  defineSettingsPanel({
    id: 'general',
    title: 'Bangumi',
    async resolve(_context, settings) {
      return {
        fields: [
          {
            id: 'api',
            label: 'API',
            content: [
              settings.textInput({
                id: 'accessToken',
                initialValue: '',
                inputMode: 'password'
              })
            ]
          }
        ]
      }
    },
    async submit(event) {
      return event.close('root', { message: 'Settings saved.' })
    }
  })
)
```

### 类型命名

所有 settings contribution 公共类型加 `SettingsPanel` 前缀：

| 旧名                         | 新名                             |
| ---------------------------- | -------------------------------- |
| `SettingsRegistrar`          | `SettingsPanelRegistrar`         |
| `SettingsRegistration`       | `SettingsPanelRegistration`      |
| `SettingsContribution`       | `SettingsPanelContribution`      |
| `defineSettingsContribution` | `defineSettingsPanel`            |
| `SettingsRootModel`          | `SettingsPanelRootModel`         |
| `SettingsDialogDefinition`   | `SettingsPanelDialogDefinition`  |
| `SettingsPopoverDefinition`  | `SettingsPanelPopoverDefinition` |
| `SettingsDialogModel`        | `SettingsPanelDialogModel`       |
| `SettingsPopoverModel`       | `SettingsPanelPopoverModel`      |
| `SettingsField`              | `SettingsPanelField`             |
| `SettingsTab`                | `SettingsPanelTab`               |
| `SettingsNodeFactory`        | `SettingsPanelNodeFactory`       |
| `SettingsTextInputNode`      | `SettingsPanelTextInputNode`     |
| `SettingsButtonNode`         | `SettingsPanelButtonNode`        |
| `SettingsRefreshReason`      | `SettingsPanelRefreshReason`     |
| `SettingsRootSubmitEvent`    | `SettingsPanelRootSubmitEvent`   |
| `SettingsRootSubmitResult`   | `SettingsPanelRootSubmitResult`  |

内部 surface 名称保留 `root`、`dialog`、`popover`，但类型名前缀必须是 `SettingsPanel`。

### Registrar

```ts
export interface SettingsPanelRegistrar {
  register<
    const TPopovers extends SettingsPanelPopoverMap = EmptySettingsPanelPopoverMap,
    const TDialogs extends SettingsPanelDialogMap<TPopovers> = EmptySettingsPanelDialogMap
  >(
    panel: SettingsPanelContribution<TPopovers, TDialogs>
  ): SettingsPanelRegistration
}
```

### RPC

Host 到 main：

- `contributions.settingsPanels.register`
- `contributions.settingsPanels.unregister`
- `contributions.settingsPanels.refreshRequested`

Main 到 host：

- `contributions.settingsPanels.open`
- `contributions.settingsPanels.refresh`
- `contributions.settingsPanels.submit`
- `contributions.settingsPanels.invoke`
- `contributions.settingsPanels.release`

Renderer IPC：

- `extension:open-settings-panel`
- `extension:refresh-settings-panel`
- `extension:submit-settings-panel`
- `extension:invoke-settings-panel-node`
- `extension:release-settings-panel`

Renderer event：

- `extension:settings-panels-refresh-requested`

## Scraper Providers

`scrapers` 改名为 `scraperProviders`。该贡献点只注册 provider，不承载其它 scraper 相关贡献。

### Public API

```ts
context.contributions.scraperProviders.game.register(new BangumiProvider(context))
context.contributions.scraperProviders.person.register(personProvider)
context.contributions.scraperProviders.company.register(companyProvider)
context.contributions.scraperProviders.character.register(characterProvider)
```

### 类型命名

| 旧名                                   | 新名                                            |
| -------------------------------------- | ----------------------------------------------- |
| `ScraperRegistrar`                     | `ScraperProviderRegistrar`                      |
| `registerGameProvider(provider)`       | `scraperProviders.game.register(provider)`      |
| `registerPersonProvider(provider)`     | `scraperProviders.person.register(provider)`    |
| `registerCompanyProvider(provider)`    | `scraperProviders.company.register(provider)`   |
| `registerCharacterProvider(provider)`  | `scraperProviders.character.register(provider)` |
| `GameScraperProviderRegistration`      | `GameScraperProviderRegistrationInfo`           |
| `PersonScraperProviderRegistration`    | `PersonScraperProviderRegistrationInfo`         |
| `CompanyScraperProviderRegistration`   | `CompanyScraperProviderRegistrationInfo`        |
| `CharacterScraperProviderRegistration` | `CharacterScraperProviderRegistrationInfo`      |

Provider 本身继续使用现有语义名：

- `GameScraperProvider`
- `PersonScraperProvider`
- `CompanyScraperProvider`
- `CharacterScraperProvider`
- `GameScraperSession`
- `PersonScraperSession`
- `CompanyScraperSession`
- `CharacterScraperSession`
- `ScraperLookup`
- `ScraperMediaType`

`ScraperMediaType` 是内部 snapshot 和 scraper 数据会用到的媒体类型；provider contribution 对象本身不新增 `mediaType` 字段，因为 media domain 已由 registrar 路径提供。

### Registrar

```ts
export interface ScraperProviderRegistrar {
  readonly game: ScraperProviderRegistrationPoint<GameScraperProvider>
  readonly person: ScraperProviderRegistrationPoint<PersonScraperProvider>
  readonly company: ScraperProviderRegistrationPoint<CompanyScraperProvider>
  readonly character: ScraperProviderRegistrationPoint<CharacterScraperProvider>
}

export interface ScraperProviderRegistrationPoint<TProvider extends BaseScraperProvider> {
  register(provider: TProvider): ScraperProviderRegistration
}

export interface ScraperProviderRegistration extends Disposable {}
```

### RPC

Host 到 main 使用 domain 参数而不是方法名拼接：

- `contributions.scraperProviders.register`
- `contributions.scraperProviders.unregister`

Payload：

```ts
export type ScraperProviderRegisterRequest =
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'game'
      provider: GameScraperProviderRegistrationInfo
    }
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'person'
      provider: PersonScraperProviderRegistrationInfo
    }
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'company'
      provider: CompanyScraperProviderRegistrationInfo
    }
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'character'
      provider: CharacterScraperProviderRegistrationInfo
    }
```

Main 到 host：

- `contributions.scraperProviders.search`
- `contributions.scraperProviders.resolve`
- `contributions.scraperProviders.session.open`
- `contributions.scraperProviders.session.get`
- `contributions.scraperProviders.session.close`

这些 request 都包含 `mediaType` 和 `providerId`。调用端根据 `mediaType` 使用对应的结果类型。

统一 method string 后，类型安全必须由 payload 的 discriminated union 保留，不能退化成 `mediaType: ScraperMediaType` 搭配宽泛 `unknown` 结果。RPC request/response 按 `mediaType` 分支：

```ts
export type ScraperProviderSearchRequest =
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'game'
      providerId: string
      query: string
      locale?: Locale
    }
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'person'
      providerId: string
      query: string
      locale?: Locale
    }
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'company'
      providerId: string
      query: string
      locale?: Locale
    }
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'character'
      providerId: string
      query: string
      locale?: Locale
    }

export type ScraperProviderSearchResponse =
  | { mediaType: 'game'; results: readonly GameSearchResult[] }
  | { mediaType: 'person'; results: readonly PersonSearchResult[] }
  | { mediaType: 'company'; results: readonly CompanySearchResult[] }
  | { mediaType: 'character'; results: readonly CharacterSearchResult[] }

export type ScraperProviderSessionGetRequest =
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'game'
      providerId: string
      sessionId: string
      slots: readonly GameScraperSlot[]
    }
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'person'
      providerId: string
      sessionId: string
      slots: readonly PersonScraperSlot[]
    }
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'company'
      providerId: string
      sessionId: string
      slots: readonly CompanyScraperSlot[]
    }
  | {
      runtimeHandle: ExtensionRuntimeHandle
      mediaType: 'character'
      providerId: string
      sessionId: string
      slots: readonly CharacterScraperSlot[]
    }

export type ScraperProviderSessionGetResponse =
  | { mediaType: 'game'; results: Partial<GameSessionResultMap> }
  | { mediaType: 'person'; results: Partial<PersonSessionResultMap> }
  | { mediaType: 'company'; results: Partial<CompanySessionResultMap> }
  | { mediaType: 'character'; results: Partial<CharacterSessionResultMap> }
```

`resolve`、`session.open`、`session.close` 使用同一原则：method string 统一，payload 以 `mediaType` 做唯一判别字段，调用端在发送 request 前已经知道 media domain，接收 response 后必须按相同 `mediaType` 分支收窄。

Renderer 不直接调用 extension contribution RPC。Renderer 仍通过现有 scraper/ingest IPC 使用 main 中的 `ScraperService`，main 侧 provider adapter 再转发给 extension host。

## Deeplink Routes

`deeplinks` 改名为 `deeplinkRoutes`。该贡献点注册的是 route handler，不是 deeplink 能力本身。

### Public API

```ts
context.contributions.deeplinkRoutes.register({
  id: 'oauth-callback',
  path: '/oauth/callback',
  async handle(event) {
    return { success: true, status: 'handled' }
  }
})
```

`path` 采用 URL route 风格，public API 中必须以 `/` 开头。最终 URL 由 host 按 extension id 自动命名空间化，例如 extension id 为 `bangumi`、path 为 `/oauth/callback` 时生成：

```text
kisaki://ext/bangumi/oauth/callback
```

Path 规则：

- 必须以 `/` 开头。
- 不允许 query、hash 或完整 URL。
- 不允许 `..`、反斜杠、空 segment。
- 同一扩展内 canonical path 不能重复。
- public DTO、RPC payload 和 renderer-facing info 都使用 canonical leading-slash path。

### 类型命名

| 旧名                               | 新名                            |
| ---------------------------------- | ------------------------------- |
| `DeeplinkContribution`             | `DeeplinkRouteContribution`     |
| `DeeplinkRegistrar`                | `DeeplinkRouteRegistrar`        |
| `DeeplinkRegistrationHandle`       | `DeeplinkRouteRegistration`     |
| `DeeplinkContributionRegistration` | `DeeplinkRouteRegistrationInfo` |
| `DeeplinkRequest`                  | `DeeplinkRouteHandleEvent`      |
| `DeeplinkResponse`                 | `DeeplinkRouteHandleResult`     |

Public callback 入参/出参使用 `Event` / `Result` 后缀；RPC 传输契约使用 `Request` / `Response` 后缀。因此 deeplink route 的 public handler 是：

```ts
handle(event: DeeplinkRouteHandleEvent): MaybePromise<DeeplinkRouteHandleResult>
```

RPC 层另行使用：

- `DeeplinkRouteHandleRequest`
- `DeeplinkRouteHandleResponse`

### Registrar

```ts
export interface DeeplinkRouteRegistrar {
  register(route: DeeplinkRouteContribution): DeeplinkRouteRegistration
}

export interface DeeplinkRouteRegistration extends Disposable {
  readonly url: string
}
```

### RPC

Host 到 main：

- `contributions.deeplinkRoutes.register`
- `contributions.deeplinkRoutes.unregister`

Main 到 host：

- `contributions.deeplinkRoutes.handle`

## Themes

`themes` 命名已经清晰，保留顶层 key。只补齐 registration 命名。

### Public API

```ts
context.contributions.themes.register({
  id: 'midnight',
  name: 'Midnight',
  tokens: {
    light: lightTokens,
    dark: darkTokens
  }
})
```

### 类型命名

- `ThemeContribution`
- `ThemeRegistrar`
- `ThemeRegistration`
- `ThemeTokenName`
- `ThemeTokenMap`
- `ExtensionThemeRegistrationInfo`

### RPC

Host 到 main：

- `contributions.themes.register`
- `contributions.themes.unregister`

Themes 没有 main 到 host callback RPC，因为它是纯声明式贡献。

## Commands

`commands` 命名可保留。它注册的是 extension-owned command contribution；执行命令的能力仍在 `kisaki.commands`。

### Public API

```ts
context.contributions.commands.register({
  id: 'bangumi.sync',
  title: 'Sync Bangumi',
  async execute(args, event) {
    return { synced: true }
  }
})
```

### 类型命名

- `CommandContribution`
- `CommandRegistrar`
- `CommandRegistration`
- `CommandContributionExecuteEvent`
- `CommandContributionExecuteResult`
- `CommandContributionRegistrationInfo`
- `CommandExecuteRequest`
- `CommandExecuteResponse`

`CommandContributionExecuteEvent` 替代 public contribution callback 里的 `CommandExecutionContext` 命名，避免和 `kisaki.commands` capability 或 main `CommandService` 的执行上下文混淆。RPC 层继续使用 `CommandExecuteRequest` / `CommandExecuteResponse`。

`CommandRegistrar.register(...)` 改为同步返回 `CommandRegistration`，与其它贡献点一致。

同步化是为了让 `commands` 保持 contribution point 的注册语义一致。它不再承诺“返回时命令已经进入 main 侧 `CommandService`”，只承诺 host 已完成本地校验和 runtime registry 写入。若 main 侧因全局 command id 冲突、CommandService 不可用或其它同步错误拒绝注册，host 必须撤销该 command contribution，并通过扩展 logger/runtime 状态暴露失败原因。

### RPC

Host 到 main：

- `contributions.commands.register`
- `contributions.commands.unregister`

Main 到 host：

- `contributions.commands.execute`

Commands 默认不进入 `ExtensionContributionSnapshot`，除非 renderer 需要展示扩展贡献命令列表。命令面板应通过 command capability 查询聚合后的命令。

## Contribution Snapshot

`apps/desktop/src/shared/extension.ts`：

```ts
export interface ExtensionContributionSnapshot {
  entityMenus: readonly ExtensionEntityMenuRegistrationInfo[]
  settingsPanels: readonly ExtensionSettingsPanelRegistrationInfo[]
  scraperProviders: readonly ExtensionScraperProviderRegistrationInfo[]
  deeplinkRoutes: readonly ExtensionDeeplinkRouteRegistrationInfo[]
  themes: readonly ExtensionThemeRegistrationInfo[]
}
```

`commands` 默认不放入 snapshot。若需要展示扩展命令来源，再新增：

```ts
commands: readonly ExtensionCommandRegistrationInfo[]
```

Snapshot key 必须与 `context.contributions` 顶层 key 保持一致。

## RPC 命名总表

| 贡献点             | Host 到 main                                 | Main 到 host                                                        |
| ------------------ | -------------------------------------------- | ------------------------------------------------------------------- |
| `entityMenus`      | `register`、`unregister`、`refreshRequested` | `resolve`、`invoke`、`release`                                      |
| `settingsPanels`   | `register`、`unregister`、`refreshRequested` | `open`、`refresh`、`submit`、`invoke`、`release`                    |
| `scraperProviders` | `register`、`unregister`                     | `search`、`resolve`、`session.open`、`session.get`、`session.close` |
| `deeplinkRoutes`   | `register`、`unregister`                     | `handle`                                                            |
| `themes`           | `register`、`unregister`                     | 无                                                                  |
| `commands`         | `register`、`unregister`                     | `execute`                                                           |

完整 method 字符串格式：

```text
contributions.<contributionPoint>.<operation>
```

不再使用：

```text
contributions.scrapers.games.register
contributions.scrapers.persons.register
contributions.settings.*
contributions.deeplinks.*
contributions.menus.*
```

## Desktop Main 文件组织

`apps/desktop/src/main/services/extension/contributions/`：

```text
contributions/
  index.ts
  registry.ts
  types.ts
  commands/
    index.ts
    point.ts
    types.ts
  deeplink-routes/
    index.ts
    point.ts
    types.ts
  entity-menus/
    index.ts
    point.ts
    sessions.ts
    types.ts
    normalize.ts
  scraper-providers/
    index.ts
    point.ts
    adapters.ts
    descriptors.ts
    registrations.ts
    types.ts
  settings-panels/
    index.ts
    point.ts
    requests.ts
    sessions.ts
    types.ts
    normalize.ts
    utils.ts
  themes/
    index.ts
    point.ts
    types.ts
```

Main 侧类命名：

| 贡献点             | Main contribution point                     |
| ------------------ | ------------------------------------------- |
| `entityMenus`      | `ExtensionEntityMenuContributionPoint`      |
| `settingsPanels`   | `ExtensionSettingsPanelContributionPoint`   |
| `scraperProviders` | `ExtensionScraperProviderContributionPoint` |
| `deeplinkRoutes`   | `ExtensionDeeplinkRouteContributionPoint`   |
| `themes`           | `ExtensionThemeContributionPoint`           |
| `commands`         | `ExtensionCommandContributionPoint`         |

`ExtensionContributionRegistry` 字段名与 snapshot key 一致：

```ts
readonly entityMenus: ExtensionEntityMenuContributionPoint
readonly settingsPanels: ExtensionSettingsPanelContributionPoint
readonly scraperProviders: ExtensionScraperProviderContributionPoint
readonly deeplinkRoutes: ExtensionDeeplinkRouteContributionPoint
readonly themes: ExtensionThemeContributionPoint
readonly commands: ExtensionCommandContributionPoint
```

## Extension Host 文件组织

`apps/desktop/src/main/services/extension/runtime/host/contributions/`：

```text
contributions/
  index.ts
  registration.ts
  types.ts
  utils.ts
  commands/
    index.ts
    point.ts
  deeplink-routes/
    index.ts
    point.ts
  entity-menus/
    index.ts
    point.ts
    normalize.ts
    callbacks.ts
    types.ts
  scraper-providers/
    index.ts
    point.ts
    descriptors.ts
    domain.ts
    registrations.ts
    types.ts
  settings-panels/
    index.ts
    point.ts
    normalize.ts
    callbacks.ts
    context.ts
    factory.ts
    values.ts
    types.ts
  themes/
    index.ts
    point.ts
```

Host contribution 根目录职责：

- `types.ts` 只放类型声明，不包含运行时代码。
- `registration.ts` 放通用 contribution registration 状态机，负责 active、invalidated、disposed 状态、main 同步失败 rollback hook 和幂等 `dispose()`。
- `utils.ts` 放 `requireRuntimeByScope`、validation error formatting 等无状态辅助函数。

Host 侧类命名：

| 贡献点             | Host contribution point                |
| ------------------ | -------------------------------------- |
| `entityMenus`      | `HostEntityMenuContributionPoint`      |
| `settingsPanels`   | `HostSettingsPanelContributionPoint`   |
| `scraperProviders` | `HostScraperProviderContributionPoint` |
| `deeplinkRoutes`   | `HostDeeplinkRouteContributionPoint`   |
| `themes`           | `HostThemeContributionPoint`           |
| `commands`         | `HostCommandContributionPoint`         |

`LoadedExtensionRuntime` 字段：

```ts
entityMenus: Map<string, RegisteredEntityMenuContribution>
settingsPanels: Map<string, SettingsPanelContribution<any, any>>
scraperProviders: {
  game: Map<string, GameScraperProvider>
  person: Map<string, PersonScraperProvider>
  company: Map<string, CompanyScraperProvider>
  character: Map<string, CharacterScraperProvider>
}
deeplinkRoutes: Map<string, DeeplinkRouteContribution>
themes: Map<string, ThemeContribution>
commands: Map<string, CommandContribution>
```

## Shared DTO 文件组织

`apps/desktop/src/shared/extension.ts` 保持单文件，不在本次重构中拆成 `shared/extension/` 目录。本次重构只更新其中的 DTO、snapshot key、request/response 类型和事件命名。拆分 shared DTO 文件不是 contribution API 语义统一的必要条件，避免把目录整理和协议重命名混在同一次迁移里。

Renderer-facing DTO 命名：

- `ExtensionEntityMenuRegistrationInfo`
- `ExtensionResolvedEntityMenu`
- `ExtensionResolvedEntityMenuGroup`
- `ExtensionResolvedEntityMenuNode`
- `ExtensionSettingsPanelRegistrationInfo`
- `ExtensionSettingsPanelSession`
- `ExtensionResolvedSettingsPanelRoot`
- `ExtensionResolvedSettingsPanelDialog`
- `ExtensionResolvedSettingsPanelPopover`
- `ExtensionResolvedSettingsPanelNode`
- `ExtensionScraperProviderRegistrationInfo`
- `ExtensionDeeplinkRouteRegistrationInfo`
- `ExtensionThemeRegistrationInfo`

## Renderer 文件组织

`apps/desktop/src/renderer/src/components/extension/`：

```text
components/extension/
  entity-menus/
    entity-menu-items.vue
    entity-menu-session.ts
    node/
      action-node.vue
      checkbox-node.vue
      select-node.vue
      submenu-node.vue
      separator-node.vue
  settings-panels/
    settings-panel-dialog.vue
    settings-panel-session.ts
    surface/
      root-surface.vue
      dialog-surface.vue
      popover-surface.vue
      tabs.vue
      field.vue
    node/
      switch-node.vue
      checkbox-node.vue
      select-node.vue
      multi-select-node.vue
      text-input-node.vue
      textarea-node.vue
      number-input-node.vue
      string-list-node.vue
      record-list-node.vue
      button-node.vue
      text-node.vue
      notice-node.vue
      status-node.vue
      table-node.vue
      image-node.vue
      divider-node.vue
```

Renderer 规则：

- Renderer 只渲染 main 提供的 `ExtensionResolved*` DTO。
- Renderer 不 import extension entry，也不执行扩展 callback。
- Renderer contribution 组件从 `@shared/extension` 导入 DTO 类型。
- 不再使用 `@renderer/core/extensions` 做 settings/menu 的类型或 IPC 总出口。

## 内置扩展与脚手架

必须更新：

- `extensions/bangumi/src/index.ts`
- `packages/create-kisaki-extension/templates/default/src/index.ts`
- `packages/create-kisaki-extension/templates/default/README.md`
- `extensions/bangumi/README.md`
- `packages/extension-api/README.md`
- `packages/extension-sdk/README.md`
- `.codex/skills/kisaki/references/extension-system.md`

示例全部使用新 API：

```ts
context.contributions.scraperProviders.game.register(new BangumiProvider(context))
context.contributions.settingsPanels.register(defineSettingsPanel({ ... }))
```

旧 API 字符串不得出现在文档示例中：

- `context.contributions.scrapers`
- `registerGameProvider`
- `context.contributions.settings`
- `defineSettingsContribution`
- `context.contributions.deeplinks`
- `context.contributions.menus`

## 删除清单

删除 public API：

- `context.contributions.menus`
- `context.contributions.settings`
- `context.contributions.scrapers`
- `context.contributions.deeplinks`
- `ScraperRegistrar`
- `SettingsRegistrar`
- `DeeplinkRegistrar`
- `MenuRegistrar`
- `registerGameProvider`
- `registerPersonProvider`
- `registerCompanyProvider`
- `registerCharacterProvider`
- `defineSettingsContribution`

删除 RPC：

- `contributions.menus.*`
- `contributions.settings.*`
- `contributions.scrapers.*`
- `contributions.deeplinks.*`

删除或重命名目录：

- `apps/desktop/src/main/services/extension/contributions/settings`
- `apps/desktop/src/main/services/extension/contributions/scrapers`
- `apps/desktop/src/main/services/extension/runtime/host/contributions/settings`
- `apps/desktop/src/main/services/extension/runtime/host/contributions/scrapers`
- `apps/desktop/src/renderer/src/components/extension/settings`
- `apps/desktop/src/renderer/src/components/extension/menus`

## 实施顺序

实施按“协议闭环优先”推进。每一步完成后尽量保持对应 package 可 typecheck，避免等全仓重命名完成后才发现 RPC 或 registrar 类型已经漂移。

1. 更新 `packages/extension-api/src/contributions` 中的 public contracts 和 validation，保持现有目录结构；仅为 `commands` 增加 `validation.ts`。
2. 重写 `packages/extension-api/src/rpc/contributions.ts` 中的贡献点命名、request/response 类型和 RPC method 字符串；`scraperProviders` 必须先落地 `mediaType` discriminated union。
3. 更新 `packages/extension-api/src/context.ts`，引入 `ExtensionContributionRegistrars`，确认所有 public `register(...)` 都同步返回 registration/disposable。
4. 更新 `packages/extension-sdk` README，确保示例只展示新 API。
5. 重构 extension host runtime registry 字段和 `sdk-bridge/registrars.ts`，实现同步返回、main 同步跟踪、初始同步 drain、失败 rollback、registration 失效和幂等 dispose；main registry 同步失败不能让单个 contribution 注册失败升级为 activation failed。
6. 重构 host contribution managers，使用新的 class、目录和 RPC 名称。
7. 重构 main contribution registry 与各 contribution host，更新 `CommandService` 接入和 `ScraperService` adapter 接入点。
8. 更新 `apps/desktop/src/shared/extension.ts` 中的 snapshot、request、response DTO 和事件命名，保持文件路径不变。
9. 更新 renderer contribution 组件目录和 IPC channel 名称。
10. 更新内置扩展、create-extension 模板和所有文档。
11. 按“搜索校验”中的边界搜索旧名称并删除残留。
12. 运行构建与类型检查。

## 搜索校验

实施完成后以下搜索必须无结果。搜索按边界分层，避免把主应用内部服务方法误判为扩展 public API 残留。

```powershell
# Public extension API / SDK / built-in extensions / scaffold / docs 不允许旧 public API。
rg -n "context\\.contributions\\.(menus|settings|scrapers|deeplinks)(\\.|\\b)|register(Game|Person|Company|Character)Provider|defineSettingsContribution|ScraperRegistrar|SettingsRegistrar|DeeplinkRegistrar|MenuRegistrar" packages/extension-api packages/extension-sdk extensions packages/create-kisaki-extension docs .codex --glob "!docs/extension-contribution-api-redesign.md"

# Extension RPC namespace 不允许旧 contribution point 名称。
rg -n "contributions\\.(menus|settings|scrapers|deeplinks)(\\.|\\b)" packages/extension-api/src/rpc apps/desktop/src/main/services/extension apps/desktop/src/shared apps/desktop/src/renderer/src --glob "!apps/desktop/src/main/services/scraper/**"

# Renderer-facing IPC 不允许旧 channel 名称。
rg -n "extension:(resolve|invoke|release)-menu|extension:(open|refresh|submit|invoke|release)-settings|extension:(menus|settings)-refresh-requested|extension:get-settings-contributions" apps/desktop/src/shared apps/desktop/src/main/services/extension apps/desktop/src/renderer/src
```

以下搜索必须有结果：

```powershell
rg -n "context\\.contributions\\.(entityMenus|settingsPanels|scraperProviders|deeplinkRoutes)" packages apps extensions docs .codex
rg -n "defineSettingsPanel|ScraperProviderRegistrar|SettingsPanelRegistrar|DeeplinkRouteRegistrar|EntityMenuRegistrar" packages apps extensions docs .codex
rg -n "contributions\\.(entityMenus|settingsPanels|scraperProviders|deeplinkRoutes)" packages apps extensions docs .codex
rg -n "extension:(resolve|invoke|release)-entity-menu|extension:(open|refresh|submit|invoke|release)-settings-panel|extension:(entity-menus|settings-panels)-refresh-requested" apps packages extensions docs .codex
```

## 验收标准

- `context.contributions` 顶层 key 全部表示贡献点类型。
- 所有 public registrar 的方法名都是 `register(...)`。
- Scraper provider 不再通过 `registerGameProvider(...)` 注册。
- Settings panel 不再使用 `settings` / `SettingsContribution` 命名。
- Deeplink route 不再使用 `deeplinks` / `DeeplinkContribution` 命名。
- Entity menu 不再使用泛化的 `menus` 命名。
- Contribution snapshot key 与 `context.contributions` 顶层 key 一致。
- RPC namespace 与贡献点 key 一致。
- Main、host、renderer contribution 文件夹使用同一套 kebab-case 名称。
- 内置扩展和脚手架只展示新 API。
- Public API、extension contribution RPC、renderer IPC 边界内无旧 API、旧 RPC 和旧类型残留；主应用内部 `ScraperService` 等非 public contribution API 命名不纳入本次验收。
- `pnpm build:extension-contracts` 通过。
- `pnpm --filter kisaki typecheck` 通过。
- `pnpm --filter @kisaki/extension-api lint` 通过。
- `pnpm --filter @kisaki/extension-sdk lint` 通过。
