import { defineExtension } from '@kisaki/extension-sdk'
import { BangumiProvider } from './scraper/provider'

export default defineExtension({
  activate(context) {
    context.logger.info('Built-in Bangumi scraper activated.')

    context.contributes.scrapers.registerGameProvider(new BangumiProvider(context))
    context.contributes.settingsPanels.register({
      id: 'settings',
      title: 'Bangumi',
      async resolve(panel) {
        const accessToken = await context.storage.get('accessToken', '')

        return [
          panel.section({
            id: 'api',
            title: 'API',
            controls: [
              panel.textInput({
                id: 'accessToken',
                label: 'Access token',
                value: typeof accessToken === 'string' ? accessToken : '',
                inputMode: 'password'
              }),
              panel.notice({
                id: 'rate-limit',
                tone: 'info',
                text: 'Requests are limited to 4 per second.'
              })
            ]
          })
        ]
      },
      async onSubmit(event) {
        const accessToken = event.values.accessToken
        await context.storage.set(
          'accessToken',
          typeof accessToken === 'string' ? accessToken.trim() : ''
        )

        return { success: true, refresh: false }
      }
    })
  }
})
