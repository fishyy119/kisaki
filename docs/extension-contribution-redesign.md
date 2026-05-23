# 扩展贡献点当前设计

本文取代早期只覆盖设置面板与实体菜单的贡献点重构说明。当前完整实施准则以
[extension-contribution-api-redesign.md](extension-contribution-api-redesign.md) 为准。

## Public Entry Points

扩展贡献点按“注册物类型”分组：

```ts
context.contributions.entityMenus.game.single.register(menu)
context.contributions.settingsPanels.register(panel)
context.contributions.scraperProviders.game.register(provider)
context.contributions.deeplinkRoutes.register(route)
context.contributions.themes.register(theme)
context.contributions.commands.register(command)
```

所有 public registrar 都使用 `register(...)`。只有当 domain 或 scope 会影响注册参数类型时，
它们才出现在 registrar 路径中。

## Type Families

- Entity menu 类型使用 `EntityMenu` 前缀，例如 `EntityMenuContribution<TInput>`、
  `EntityMenuRegistrar` 和 `EntityMenuRegistration`。
- Settings panel 类型使用 `SettingsPanel` 前缀，例如 `SettingsPanelContribution`、
  `SettingsPanelNodeFactory` 和 `SettingsPanelRegistration`。
- Scraper provider 注册入口使用 `ScraperProviderRegistrar` 与
  `ScraperProviderRegistration`，provider 实现类型继续保留媒体域名称。
- Deeplink handler 是 route contribution，使用 `DeeplinkRouteContribution`、
  `DeeplinkRouteRegistrar` 和 `DeeplinkRouteRegistration`。
- Theme 与 command 贡献点保留直接语义命名。

## Runtime Shape

Extension host 持有包含 callback 的 contribution 对象，并把可序列化 snapshot 同步到
main contribution registry。Main 持有 renderer IPC handler，并通过
`contributions.<point>.<operation>` RPC namespace 把 callback 请求转发回 host。

Renderer 只消费 `apps/desktop/src/shared/extension.ts` 中的 DTO，并调用 `extension:*` IPC
channel；它不 import extension entry，也不执行 extension callback。

## File Organization

Main process、host runtime 与 renderer 使用一致的 kebab-case contribution 目录：

- `entity-menus`
- `settings-panels`
- `scraper-providers`
- `deeplink-routes`
- `themes`
- `commands`

Renderer-facing shared DTO 继续保留在 `apps/desktop/src/shared/extension.ts`。

## Verification

修改 contribution API 后运行：

```powershell
pnpm build:extension-tooling
pnpm --filter kisaki typecheck
pnpm --filter @kisaki/extension-api lint
pnpm --filter @kisaki/extension-sdk lint
```
