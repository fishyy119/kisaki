import { defineExtension, defineSettingsPanel, kisaki } from '@kisaki3/extension-sdk'

const extensionName = `__EXTENSION_NAME__`

export default defineExtension({
  async activate(context) {
    context.logger.info(`${extensionName} activated.`)

    context.contributions.settingsPanels.register(
      defineSettingsPanel({
        id: 'general',
        title: extensionName,
        dialogs: {
          advanced: {
            title: 'Advanced',
            size: 'sm',
            resolve(_context, settings) {
              return {
                fields: [
                  {
                    id: 'advanced',
                    content: [
                      settings.notice({
                        id: 'advanced-note',
                        tone: 'info',
                        text: 'Task dialogs can resolve focused settings content.'
                      })
                    ]
                  }
                ]
              }
            }
          }
        },
        async resolve(_context, settings) {
          const enabled = await context.storage.get('enabled', true)

          return {
            fields: [
              {
                id: 'general',
                label: 'General',
                content: [
                  settings.switch({
                    id: 'enabled',
                    initialValue: Boolean(enabled)
                  }),
                  settings.button({
                    id: 'advanced',
                    label: 'Advanced',
                    onClick(event) {
                      return event.openDialog('advanced')
                    }
                  }),
                  settings.button({
                    id: 'test-notification',
                    label: 'Test notification',
                    async onClick(event) {
                      await kisaki.notify.info(
                        extensionName,
                        'Notification sent from the extension.'
                      )
                      return event.success()
                    }
                  })
                ]
              }
            ]
          }
        },
        async submit(event) {
          await context.storage.set('enabled', Boolean(event.values.enabled))
          return event.close('root', { message: 'Settings saved.' })
        }
      })
    )
  }
})
