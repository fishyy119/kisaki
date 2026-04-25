import { defineExtension, kisaki } from '@kisaki/extension-sdk'

const extensionName = `__EXTENSION_NAME__`

export default defineExtension({
  async activate(context) {
    context.logger.info(`${extensionName} activated.`)

    context.contributes.settingsPanels.register({
      id: 'general',
      title: extensionName,
      async resolve(panel) {
        const enabled = await context.storage.get('enabled', true)

        return [
          panel.section({
            id: 'general',
            title: 'General',
            controls: [
              panel.switch({
                id: 'enabled',
                label: 'Enabled',
                value: enabled
              }),
              panel.button({
                id: 'test-notification',
                label: 'Test notification',
                async onClick() {
                  await kisaki.notify.info(extensionName, 'Notification sent from the extension.')
                  return { success: true, refresh: false }
                }
              })
            ]
          })
        ]
      },
      async onSubmit(event) {
        await context.storage.set('enabled', Boolean(event.values.enabled))
        return { success: true, refresh: false }
      }
    })
  }
})
