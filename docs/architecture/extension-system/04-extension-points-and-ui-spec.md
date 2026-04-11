# 04. 扩展点与受控 UI 规范

本文件定义新扩展系统允许的扩展点，以及菜单、设置面板、事件、scraper、deeplink、theme 和宿主能力的具体规范。

## 支持的扩展点总表

| 扩展点           | 执行位置       | 结果形态               | renderer 是否执行扩展代码 |
| ---------------- | -------------- | ---------------------- | ------------------------- |
| `entityMenus`    | Extension Host | 结构化菜单项           | 否                        |
| `settingsPanels` | Extension Host | 结构化设置面板节点列表 | 否                        |
| `events`         | Extension Host | 事件监听/发送          | 否                        |
| `scrapers`       | Extension Host | provider contribution  | 否                        |
| `deeplinks`      | Extension Host | route handler          | 否                        |
| `themes`         | Extension Host | 语义 token theme       | 否                        |

## 明确不支持的扩展方式

以下能力在新系统中显式移除：

- 注册新页面
- 注册新路由
- 注册新 Sidebar 导航
- 注册新的 Detail Tab
- 注入自定义 Vue 组件
- 扩展 renderer store/composable
- 操作宿主 DOM
- 挂接宿主 app/router/pinia 生命周期

## 实体菜单扩展

## 目标

实体菜单扩展要满足：

- 允许扩展在宿主实体菜单中贡献项
- 支持 `action`、`checkbox`、`select`
- 支持动态显隐、禁用、状态显示
- 由宿主菜单组件统一渲染
- 交互回调回到共享扩展宿主进程中的目标扩展执行

## 菜单挂载点

首批支持以下挂载点：

- `game.single`
- `game.batch`
- `character.single`
- `person.single`
- `company.single`
- `collection.single`
- `tag.single`

后续如果扩展新的实体类型，仍然沿用相同模型。

## Contribution 接口

推荐形式：

```ts
interface EntityMenuContribution<TInput> {
  id: string
  target: EntityMenuTarget
  order?: number

  resolve(input: TInput): Promise<EntityMenuNode[]>
}
```

这里的 `EntityMenuNode` 是扩展作者返回的作者态菜单节点，允许把菜单项声明和项级回调写在一起。共享扩展宿主进程会在运行时把它归一化为纯结构化 `EntityMenuItem`，并额外登记 callback registry。

## 菜单定义类型

```ts
type EntityMenuNode = ActionMenuItem | CheckboxMenuItem | SelectMenuItem | SeparatorMenuItem
```

### `action`

适用于普通点击行为。

字段：

- `kind: 'action'`
- `id`
- `label`
- `icon?`
- `description?`
- `disabled?`
- `hidden?`
- `onClick?`

### `checkbox`

适用于布尔状态切换。

字段：

- `kind: 'checkbox'`
- `id`
- `label`
- `icon?`
- `checked`
- `disabled?`
- `hidden?`
- `onChange?`

renderer 渲染为宿主现有 checkbox menu item。

### `select`

适用于枚举状态选择。

字段：

- `kind: 'select'`
- `id`
- `label`
- `icon?`
- `value`
- `options`
- `disabled?`
- `hidden?`
- `onChange?`

其中：

```ts
interface MenuSelectOption {
  value: string
  label: string
  disabled?: boolean
}
```

renderer 渲染为宿主现有 submenu + radio item 结构。

### `separator`

适用于菜单分隔。

字段：

- `kind: 'separator'`
- `id`

## 菜单回调模型

实体菜单本质上是“动作列表”，不是表单，因此默认交互模型如下：

1. 菜单打开时，宿主自动调用一次 `resolve()`。
2. 扩展在 `resolve()` 中返回作者态菜单节点。
3. 共享宿主把菜单节点归一化为纯结构化 `EntityMenuItem[]`，并建立菜单项级 callback registry。
4. renderer 只渲染 `EntityMenuItem[]`，完全不执行扩展代码。
5. 用户点击 action / checkbox / select 时，事件再路由回目标菜单项的专属回调。

这意味着：

- 菜单的公开主路径是菜单项级 handler。
- `action` 默认使用 `onClick`。
- `checkbox` 与 `select` 默认使用 `onChange`。
- contribution 级的 `onAction` / `onToggle` / `onSelect` 不再作为公开主 API。
- 同一次菜单打开会话内不会隐式再次 `resolve()`；只有菜单项回调显式返回 `refresh` 时，宿主才会重新解析当前菜单会话。

## 菜单渲染规则

1. 宿主按 `target` 聚合所有 contribution。
2. 每个 contribution 的 `resolve` 返回作者态菜单节点。
3. 共享宿主把菜单节点归一化为纯结构化菜单项，并登记菜单项级 callback registry。
4. renderer 只认识菜单项结构，不认识扩展代码。
5. 菜单项 ID 在 contribution 内唯一。
6. `select` 只能展开为宿主控制的 radio submenu，不允许任意多级自定义子菜单。

## 设置面板扩展

## 目标

扩展设置不再通过注入完整对话框组件实现，而是通过“受控 resolve 模型 + 本地表单草稿 + 提交优先回调模型”实现。

## Contribution 接口

```ts
interface SettingsPanelContribution {
  id: string
  title: string
  description?: string
  order?: number

  resolve(): Promise<SettingsPanelNode[]>
  onSubmit?(event: SettingsSubmitEvent): Promise<void | UiEffect>
}
```

## 默认交互模型

设置面板本质上是表单，因此默认交互模型如下：

1. 设置面板打开时，宿主自动调用一次 `resolve()`。
2. `resolve()` 返回当前完整面板节点列表，renderer 基于其中的字段值初始化本地表单草稿。
3. 普通字段编辑不会立即触发扩展回调，也不会自动再次 `resolve()`。
4. 用户点击“保存”或“提交”时，宿主把整个表单值交给 `onSubmit()`。
5. 只有 `onSubmit` 或控件级回调显式返回 `refresh` 时，宿主才会再次执行 `resolve()` 并重建当前面板。

这意味着：

- `onSubmit` 是设置面板最常用、最推荐的主回调。
- 扩展作者可以把大多数设置保存逻辑都收敛到 `onSubmit` 中。
- 公开 API 不再保留顶层 `schema` 属性，完整设置面板节点列表统一由 `resolve()` 生成。
- renderer 只需要实现统一表单容器和统一提交逻辑，复杂度最低。

## 控件级回调原则

控件级回调不是默认主路径，只用于以下场景：

- `button` 类型控件的点击行为
- 明确需要即时触发的高级操作
- 少量联动场景，如点击“测试连接”“重新授权”“刷新远程选项”

设计原则：

- 普通字段优先进入表单草稿，再统一 `onSubmit`
- 按钮和高级操作允许把控件定义与回调内联写在一起
- 如果控件回调显式返回 `refresh`，当前面板会丢弃本地草稿并用新的 `resolve()` 结果重建
- 宿主运行时仍会把纯面板模型和 callback registry 分开管理

## 支持的节点类型

首版支持以下节点：

- `section`
- `text`
- `switch`
- `checkbox`
- `select`
- `textInput`
- `textarea`
- `numberInput`
- `button`
- `notice`
- `status`
- `divider`

这套控件足够覆盖：

- 开关与布尔项
- 枚举选择
- 文本/路径/URL/Token 输入
- 操作按钮
- 状态显示与提示信息

其中：

- `switch`、`checkbox`、`select`、`textInput`、`textarea`、`numberInput` 默认作为普通表单字段参与提交
- `button` 是最典型的控件级回调节点
- 只有少量高级字段才应该使用即时回调

## 面板节点模型

`resolve()` 直接返回完整面板节点列表，例如：

```ts
;[
  settings.section({
    id: 'general',
    title: 'General',
    controls: []
  }),
  settings.notice({
    id: 'tips',
    tone: 'info',
    text: '部分更改需要重新登录后生效'
  })
]
```

这样可以支持：

- 字段当前值直接内联在控件定义里
- 控件显示/隐藏切换
- 控件禁用/启用切换
- 动态状态显示
- 动态下拉项
- 按钮和高级节点的项级回调

## 推荐作者体验

推荐让扩展作者写成“控件与行为靠近”的形式，例如：

```ts
settings.panel({
  id: 'sample.settings',
  title: 'Sample Extension',
  async resolve() {
    return [
      settings.section({
        id: 'general',
        title: 'General',
        controls: [
          settings.switch({
            id: 'autoSync',
            label: '启动时自动同步',
            value: true
          }),
          settings.button({
            id: 'relogin',
            label: '重新登录',
            async onClick(_, ctx) {
              ctx.logger.info('manual relogin requested')
              return { kind: 'refresh' }
            }
          })
        ]
      })
    ]
  },
  async onSubmit(event) {
    // 主要保存逻辑集中在这里
    void event
  }
})
```

这个写法的好处是：

- 扩展作者阅读时最清晰
- 按钮等少量即时操作不用再去另找 handler 映射
- 表单保存逻辑不会散落在每个字段回调里
- 面板节点结构和当前状态都收敛在一次 `resolve()` 的返回值里

## 显式刷新效果

菜单项回调、设置面板控件回调和 `onSubmit` 都可以显式返回统一 UI effect：

```ts
type UiEffect = { kind: 'none' } | { kind: 'refresh' }
```

语义如下：

- `none`：不触发额外 UI 刷新
- `refresh`：宿主重新执行当前 UI surface 的 `resolve()`

这条规则是新系统中受控 UI 的统一原则：

- UI 打开时自动 `resolve()`
- 后续不会隐式重复 `resolve()`
- 只有扩展回调显式请求时才会 refresh

## 事件接口

## 目标

扩展需要两类事件：

1. 宿主事件：由主应用定义并广播
2. 扩展事件：由扩展自己或其他扩展消费

## 宿主事件

宿主事件是强类型内建事件，例如：

- `app.ready`
- `library.game.updated`
- `library.person.updated`
- `scanner.completed`
- `theme.changed`
- `extension.enabled`

这些事件统一定义在 `packages/extension-api` 中。

## 扩展自定义事件

允许扩展发送自定义事件，但必须强制命名空间化：

```text
ext.<extension-id>.<topic>
```

例如：

```text
ext.dev.ximu.sample-extension.auth.completed
```

事件 payload 必须 JSON 可序列化。

## Scraper 扩展点

## 目标

把当前 `ScraperService` 的注册式能力提升为正式扩展点。

## 设计原则

- 内建 provider 与扩展 provider 使用同一 registry 语义。
- 扩展 provider 在 extension host 中执行。
- 宿主通过 `contributions/scrapers.ts` 中的接线逻辑调用扩展 provider。
- 扩展只能使用公开 helper / capability，不直接接触 `DbService` 或内部 handler。

## 注册接口

```ts
interface ScraperRegistrar {
  registerGameProvider(provider: GameScraperProvider): Disposable
  registerCharacterProvider(provider: CharacterScraperProvider): Disposable
  registerPersonProvider(provider: PersonScraperProvider): Disposable
  registerCompanyProvider(provider: CompanyScraperProvider): Disposable
}
```

provider 形态延续当前 session-based runtime 思路：

- `search`
- `resolve`
- `openSession`

但其公开 provider 契约应原生定义在 `packages/extension-api` 中。主应用只在 `apps/desktop/src/main/services/extension/contributions/scrapers.ts` 内把这套公开契约适配到内部 `ScraperService`，而不是让 `ScraperService` 直接承接扩展 API 类型。

## Deeplink 扩展点

## 目标

当前 `DeeplinkAction = 'launch' | 'auth' | 'navigate' | 'scan'` 太封闭，不适合作为扩展平台协议。

新系统改为 route namespace 模型。

## 路由规范

- 宿主保留：`app/*`
- 扩展使用：`ext/<extension-id>/*`

例如：

- `kisaki://app/launch?gameId=...`
- `kisaki://ext/dev.ximu.sample-extension/oauth/callback?code=...`

## 注册接口

```ts
interface DeeplinkContribution {
  id: string
  route: string
  handle(input: DeeplinkRequest): Promise<DeeplinkResponse>
}
```

约束：

- route 必须唯一
- 扩展 route 必须位于自身命名空间下
- renderer 不直接处理扩展 deeplink，统一由 main 路由
- 主应用只在 `apps/desktop/src/main/services/extension/contributions/deeplinks.ts` 内把公开 deeplink 契约适配到内部 `DeeplinkService`

## Theme 扩展点

## 目标

当前 theme 通过原始 CSS 字符串注册，不利于类型安全和受控演进。

新系统把 theme 改为语义 token 贡献。

## 贡献模型

```ts
interface ThemeContribution {
  id: string
  name: string
  description?: string
  tokens: {
    light: ThemeTokenMap
    dark: ThemeTokenMap
  }
}
```

其中 `ThemeTokenMap` 只允许宿主声明过的语义 token，例如：

- `background`
- `foreground`
- `surface`
- `surfaceForeground`
- `primary`
- `primaryForeground`
- `muted`
- `mutedForeground`
- `border`
- `accent`
- `danger`

宿主负责把 token map 编译为 CSS variables。

这样可以做到：

- 扩展 theme 类型安全
- theme 不再能注入任意 CSS
- 宿主仍保留 light/dark/system 模式控制权

## 宿主能力

新系统向扩展暴露的能力模块如下。

## 1. `library`

职责：

- 读取实体
- 列表/查询实体
- 创建实体
- 更新实体
- 删除实体
- 处理附件与媒体

推荐形态：

```ts
kisaki.library.games.get(id)
kisaki.library.games.list(query)
kisaki.library.games.create(input)
kisaki.library.games.update(id, patch)
kisaki.library.games.remove(id)
```

约束：

- 使用稳定 DTO 和 patch 类型
- 不暴露原始 SQL / Drizzle
- 不暴露宿主内部表名和 schema object

## 2. `network`

职责：

- 统一 fetch / download
- 复用宿主超时、重试、限流能力

约束：

- 扩展不直接接触 `electron.net`
- 限流 key 通过公开 API 注册或使用预设

## 3. `notify`

职责：

- toast
- native
- auto
- loading/update/dismiss

其语义沿用当前 `NotifyService`，但作为 capability 暴露，不作为 service 容器对象暴露。

## 4. `events`

职责：

- 订阅宿主事件
- 发送扩展事件

约束：

- 不暴露内部 IPC channel
- 事件 payload 结构化、可序列化

## 5. `log`

建议通过 `context.logger` 提供，不单独公开未绑定作用域的 logger 实例。

## 明确不开放的能力

以下能力即使技术上可以做，也不纳入公开扩展平台：

- 任意文件系统读写
- 任意 Electron 模块访问
- 直接注册 IPC channel
- 直接访问数据库连接
- 自定义窗口与 webContents
- 直接操作路由与导航树
- 直接注入 renderer 组件

## 总结

新扩展系统允许扩展做“宿主认可的事”：

- 给已有菜单增加动作和状态控件
- 给扩展管理页增加受控配置面板
- 注册 scraper / deeplink / theme 等正式扩展点
- 读写宿主库实体
- 使用网络、通知、日志和事件能力

但不再允许扩展做“宿主内部怎么实现都得跟着背锅的事”：

- 注入任意 UI
- 绑死 renderer 运行时
- 接入内部 service / schema / component 细节
