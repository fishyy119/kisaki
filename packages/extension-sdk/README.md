# @kisaki3/extension-sdk

Authoring SDK for Kisaki extensions.

Use this package from extension code. It re-exports the public contracts from
`@kisaki3/extension-api` and adds the small authoring surface that extension entry
points use directly.

## Exports

- `defineExtension(definition)`.
- `kisaki`, a lazy bridge to host capabilities such as library, network, notify,
  events, runtime, scrapers, ingest, commands, and background tasks.
- Settings panel helpers such as `defineSettingsPanel(...)`,
  `defineSettingsPanelDialog(...)`, `defineSettingsPanelPopover(...)`, and
  `defineSettingsPanelTab(...)`.
- All public types and validation helpers exported by `@kisaki3/extension-api`.

## Example

```ts
import { defineExtension, defineSettingsPanel, kisaki } from '@kisaki3/extension-sdk'

export default defineExtension({
  activate(context) {
    context.contributions.commands.register({
      id: 'show-status',
      title: 'Show Status',
      async execute() {
        await kisaki.notify.info('Extension is active')
      }
    })

    context.contributions.settingsPanels.register(
      defineSettingsPanel({
        id: 'general',
        title: 'General',
        resolve(_context, settings) {
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
  }
})
```

## Boundary

The SDK does not assemble `ExtensionContext`, configure runtime bridges, or own
extension lifecycle cleanup. The shared extension host owns those runtime
responsibilities so extension code cannot forge another extension's identity.
