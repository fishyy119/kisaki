# 06 Contribution Integration

settings 和 entity menus 在新系统中是 Extension UI surface，不再各自定义 UI DSL。注册贡献点时只传入 metadata、预写 UI view 和参数。

## Settings registration

目标 API：

```ts
context.contributes.settings.register({
  id: 'settings',
  title: 'Bangumi',
  description: 'Configure Bangumi integration.',
  order: 100,
  view: ui.mount(BangumiSettings, { title: 'Bangumi' })
})
```

新的 `SettingsContribution`：

```ts
export interface SettingsContribution {
  id: string
  title: string
  description?: string
  order?: number
  view: ExtensionUiMount<ExtensionUiParams, ExtensionUiSettingsSurfaceInput>
}
```

删除：

- `rootScreenId`
- `screens`
- `SettingsScreen`
- `SettingsBuilder`
- `SettingsNode`
- `SettingsResolvedNode`
- `SettingsInteractionResult` 专用命令

使用通用：

- `ExtensionUiMount`
- `ExtensionUiDocument`
- `ExtensionUiDispatchResult`
- `ExtensionUiCommand`

## Settings root

settings 是 dialog surface。注册时传入预写 `view`，该 view 必须返回 `ui.dialog(...)`，这样 settings UI 保留 Dialog 的 header/body/footer、尺寸、关闭行为和堆叠样式。

旧系统通过 `settings.dialog({ target: { screenId } })` 打开另一个 screen。新系统删除 settings 专用 screen 概念，第一版用 Dialog 和通用 `ui.command.open` 承接 settings 跳转；Popover 和完整 Menu overlay 作为后续 Extension UI 原生能力追加，不再为 settings 设计额外跳转 API。

可静态组合的 UI 直接作为组件树的一部分渲染；需要按需挂载时，通过按钮、菜单项等事件声明通用 open command。renderer 仍然只执行标准 command，不执行扩展函数。`ui.mount(...)` 只描述 target；打开位置由 `ui.command.open(target, { outlet })` 决定。

## Entity menu registration

目标 API：

```ts
context.contributes.entityMenus.register({
  id: 'bangumi-game',
  target: 'game.single',
  order: 100,
  view: ui.mount(GameMenuContent, ({ surfaceInput }) => ({
    gameId: surfaceInput.input.entityId
  }))
})
```

新的 `EntityMenuContribution`：

```ts
export interface EntityMenuContribution<
  TInput extends EntityMenuResolveInput = EntityMenuResolveInput
> {
  id: string
  target: TInput['target']
  order?: number
  view: ExtensionUiMount<ExtensionUiParams, ExtensionUiEntityMenuSurfaceInput<TInput>>
}
```

删除：

- `resolve(input, menu)`
- `EntityMenuBuilder`
- `EntityMenuNode`
- `EntityMenuItem` 专用 callback model

这里的泛型分两层：`TInput` 是原有 `EntityMenuResolveInput` 的具体分支；`ExtensionUiEntityMenuSurfaceInput<TInput>` 才是 mount params resolver 收到的 surface input。entity menu contribution 的 view root 应是 `MenuNode` 或 `Fragment<MenuNode>`。它不返回完整 `Menu` root，因为注册环境已经是主应用 entity menu 的 content 区域。host validation 会根据 surface 限制组件集合。

后续普通 UI 中的完整 `Menu` overlay 必须通过 `presentation: 'dropdown' | 'context'` 对齐 renderer 的 dropdown/context menu。entity menu contribution 不使用完整 `ui.menu(...)`，只贡献 `ui.menu.item(...)`、`ui.menu.group(...)`、`ui.menu.separator(...)` 等内容节点，由主应用已有菜单容器决定最终是 dropdown 还是 context。

从 entity menu 打开 dialog 时必须使用 command outlet，而不是直接在 menu content 中嵌套 `Dialog`：

```ts
ui.menu.item({
  children: ['Advanced'],
  onSelect: ui.command.open(ui.mount(AdvancedGameDialog, { gameId }), {
    outlet: 'dialog'
  })
})
```

entity menu 点击后可以正常关闭并释放自己的短生命周期 session；`AdvancedGameDialog` 会作为新的 dialog session 挂到应用级 Extension UI dialog outlet，因此不会跟着 menu 被卸载。

## Contribution snapshot

`ExtensionContributionSnapshot` 改为 surface-based：

```ts
export interface ExtensionUiContributionInfo extends ExtensionContributionOwnerInfo {
  contributionId: string
  surface: ExtensionUiContributionSurfaceKind
  title?: string
  description?: string
  order: number
  target?: EntityMenuTarget
}

export interface ExtensionContributionSnapshot {
  ui: readonly ExtensionUiContributionInfo[]
  themes: readonly ExtensionThemeContributionInfo[]
  deeplinks: readonly ExtensionDeeplinkContributionInfo[]
  scrapers: readonly ExtensionScraperProviderInfo[]
}
```

如果希望 renderer 查询更方便，可以在 `core/extensions/ui/store.ts` 提供：

- `settingsContributions`
- `entityMenuContributions(target)`

但 shared contract 只保留统一 `ui` list。

实现阶段可以短期同时存在旧 `settings` / `entityMenus` snapshot 字段和新 `ui` 字段，以保持仓库可 typecheck 和 built-in extension 可运行。Phase 6 完成内置扩展、模板和 renderer 调用点迁移后，必须删除旧字段，最终 shared contract 只保留 `ui`。

## Main API 对应关系

删除旧 service 方法：

- `getSettingsContributions`
- `resolveEntityMenu`
- `invokeEntityMenuCallback`
- `releaseEntityMenuSession`
- `openSettingsSession`
- `openSettingsFrame`
- `refreshSettingsFrame`
- `submitSettingsFrame`
- `invokeSettingsNode`
- `releaseSettingsFrame`
- `releaseSettingsSession`

新增：

- `getExtensionUiContributions(surface?)`
- `openExtensionUiSession(request)`
- `openExtensionUiMountSession(request)`，用于 `ui.command.open(ui.mount(...))` 打开同 extension component。
- `refreshExtensionUiSession(request)`
- `dispatchExtensionUiEvent(request)`
- `releaseExtensionUiSession(request)`
- `openEntityMenuSessions(input)` 作为 entity menu 聚合便利方法，可内部使用 Extension UI session。

`openExtensionUiSession` 只负责打开注册 contribution。`openExtensionUiMountSession` 负责从当前 session 或 explicit owner 打开 mount target，main 必须验证 target component 属于同一 extension runtime。

renderer dispatch 不直接传 `extensionId`、`runtimeHandle` 或 `surfaceInput`。main 通过 active session owner table 找到 runtime owner，再转发给 host；旧 API 删除后不再保留可由 renderer 自报 owner 的 settings/entity menu invoke 入口。

## Built-in Bangumi 改写

当前 `extensions/bangumi/src/index.ts` settings 应改为：

```ts
import { defineExtension, ui } from '@kisaki/extension-sdk'

const BangumiSettings = ui.defineComponent('bangumi.settings', async (ctx) => {
  const accessToken = await ctx.storage.get('accessToken', '')

  return ui.dialog({
    title: 'Bangumi',
    size: 'md',
    slots: {
      content: ui.form({
        id: 'bangumi-settings-form',
        children: [
          ui.section({
            id: 'api',
            title: 'API',
            children: [
              ui.field({
                label: 'Access token',
                slots: {
                  control: ui.input({
                    name: 'accessToken',
                    type: 'password',
                    defaultValue: typeof accessToken === 'string' ? accessToken : ''
                  })
                }
              }),
              ui.notice({
                tone: 'info',
                children: ['Requests are limited to 4 per second.']
              })
            ]
          })
        ],
        onSubmit: ui.action('save', async (event, ctx) => {
          const token = event.values?.accessToken
          await ctx.storage.set('accessToken', typeof token === 'string' ? token.trim() : '')
          return ui.result.closeAll()
        })
      }),
      footer: ui.dialog.footer({
        children: [
          ui.button({
            variant: 'outline',
            children: ['Cancel'],
            onClick: ui.action('cancel', () => ui.result.closeCurrent())
          }),
          ui.button({
            type: 'submit',
            form: 'bangumi-settings-form',
            children: ['Save']
          })
        ]
      })
    }
  })
})

context.contributes.settings.register({
  id: 'settings',
  title: 'Bangumi',
  view: ui.mount(BangumiSettings)
})
```

## Scaffold template 改写

`packages/create-kisaki-extension/templates/default/src/index.ts` 应展示：

- 一个 settings component。
- 一个可复用 dialog component。
- 一个 action 调 `kisaki.notify.info`。
- 一个 entity menu component 示例，展示 params resolver。

这样新扩展从第一天就使用 Extension UI composition，而不是旧 settings builder。

## 删除范围

重写完成、且 Phase 6 的 built-ins/scaffold/renderer 调用点全部迁移后删除：

- `packages/extension-api/src/contributions/settings/contracts.ts` 中旧 node/screen builder。
- `packages/extension-api/src/contributions/entity-menus/contracts.ts` 中旧 menu builder/node。
- settings/entity menu 专用 validation。
- `apps/desktop/src/main/services/extension/runtime/host/contributions/settings.ts`。
- `apps/desktop/src/main/services/extension/runtime/host/contributions/entity-menus.ts`。
- `apps/desktop/src/main/services/extension/contributions/settings.ts`。
- `apps/desktop/src/main/services/extension/contributions/entity-menus.ts`。
- 旧 `apps/desktop/src/renderer/src/components/shared/extension/settings-*` 直连实现；新 settings surface 应位于 `surfaces/settings/` 边界下。
- 旧 `apps/desktop/src/renderer/src/components/shared/extension/entity-menu-items.vue` 直连实现；新实现应位于 `surfaces/entity-menu/` 边界下。
- `apps/desktop/src/renderer/src/core/extensions/settings.ts` 和 `menus.ts` 中旧 helper。

保留并迁移：

- runtime lifecycle。
- contribution snapshot change event。
- extension capability gateway。
- theme、scraper、deeplink contributions。
