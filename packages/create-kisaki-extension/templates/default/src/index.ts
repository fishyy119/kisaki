import { defineExtension, kisaki } from '@kisaki/extension-sdk'

const extensionName = `__EXTENSION_NAME__`

export default defineExtension({
  async activate(context) {
    context.logger.info(`${extensionName} activated.`)

    context.contributes.settings.register({
      id: 'general',
      title: extensionName,
      rootScreenId: 'general',
      screens: {
        general: {
          async resolve(_frame, settings) {
            const enabled = await context.storage.get('enabled', true)

            return settings.screen({
              nodes: [
                settings.section({
                  id: 'general',
                  title: 'General',
                  children: [
                    settings.switch({
                      id: 'enabled',
                      label: 'Enabled',
                      value: enabled
                    }),
                    settings.dialog({
                      id: 'advanced',
                      label: 'Advanced',
                      target: { screenId: 'advanced' }
                    }),
                    settings.button({
                      id: 'test-notification',
                      label: 'Test notification',
                      async onClick() {
                        await kisaki.notify.info(
                          extensionName,
                          'Notification sent from the extension.'
                        )
                        return { success: true }
                      }
                    })
                  ]
                })
              ]
            })
          },
          async submit(event) {
            await context.storage.set('enabled', Boolean(event.values.enabled))
            return {
              success: true,
              commands: [{ type: 'close', scope: 'all' }]
            }
          }
        },
        advanced: {
          resolve(_frame, settings) {
            return settings.screen({
              title: 'Advanced',
              size: 'sm',
              nodes: [
                settings.notice({
                  id: 'advanced-note',
                  tone: 'info',
                  text: 'Nested settings screens can resolve their own content.'
                })
              ]
            })
          }
        }
      }
    })
  }
})
