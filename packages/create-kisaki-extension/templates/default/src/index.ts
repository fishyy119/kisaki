import { defineExtension, kisaki } from '@kisaki/extension-sdk'

export default defineExtension({
  async activate(context) {
    context.logger.info('__EXTENSION_NAME__ activated.')

    context.contributes.settingsPanels.register({
      id: 'general',
      title: '__EXTENSION_NAME__',
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
                  await kisaki.notify.info(
                    '__EXTENSION_NAME__',
                    'Notification sent from the extension.'
                  )
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
