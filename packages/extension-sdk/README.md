# `@kisaki/extension-sdk`

Authoring SDK for Kisaki extensions.

Public entry points:

- `defineExtension(...)`
- `kisaki`
- all public contract types re-exported from `@kisaki/extension-api`

## Contribution API

Contribution registrars live on `context.contributions`. Top-level keys name the registered
contribution type, and every registrar uses `register(...)`.

```ts
import { defineExtension, defineSettingsPanel } from '@kisaki/extension-sdk'

export default defineExtension({
  activate(context) {
    context.contributions.scraperProviders.game.register(new BangumiProvider(context))

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
        }
      })
    )

    context.contributions.deeplinkRoutes.register({
      id: 'oauth-callback',
      path: '/oauth/callback/:provider',
      handle(event) {
        context.logger.info(`OAuth callback for ${event.params.provider}`)
        return { success: true, status: 'handled' }
      }
    })

    context.contributions.entityMenus.game.single.register({
      id: 'open-source',
      async resolve(input, menu) {
        return [
          menu.action({
            id: 'open',
            label: `Open ${input.entityId}`,
            onClick() {
              return { success: true }
            }
          })
        ]
      }
    })
  }
})
```

## Architecture

`kisaki` is a thin view over the host-provided `KisakiApi`.
Capability access stays direct and lazy: each property getter reads from the configured runtime bridge when the extension actually uses it.

The runtime bridge store lives in the SDK internals and is configured only by the shared extension host.
The SDK does not assemble `ExtensionContext`, register contributions, or own lifecycle helpers like disposable stores; those runtime responsibilities stay entirely in the host.
The SDK does not add a second abstraction layer for capabilities like `network` or `notify`; those are exposed directly from the runtime bridge.

Host-runtime bootstrap is intentionally not a public package entry point. The host owns bridge
configuration and extension context creation so extension code cannot forge another extension's
identity or bypass runtime lifecycle cleanup.
