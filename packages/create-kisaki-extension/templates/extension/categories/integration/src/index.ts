import { defineExtension, defineSettingsPanel } from '@kisaki3/extension-sdk'

const extensionName = `__EXTENSION_NAME__`

export default defineExtension({
  activate(context) {
    context.logger.info(`${extensionName} activated.`)

    context.contributions.settingsPanels.register(
      defineSettingsPanel({
        id: 'connection',
        title: extensionName,
        resolve(_context, settings) {
          return {
            fields: [
              {
                id: 'connection',
                label: 'Connection',
                content: [
                  settings.notice({
                    id: 'setup-note',
                    tone: 'info',
                    text: 'Add connection settings for your integration here.'
                  })
                ]
              }
            ]
          }
        },
        submit(event) {
          return event.close('root')
        }
      })
    )
  }
})
