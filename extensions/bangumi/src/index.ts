import { defineExtension, defineSettingsContribution } from '@kisaki/extension-sdk'
import { BangumiProvider } from './scraper/provider'

export default defineExtension({
  activate(context) {
    context.logger.info('Built-in Bangumi scraper activated.')

    context.contributions.scrapers.registerGameProvider(new BangumiProvider(context))
    context.contributions.settings.register(
      defineSettingsContribution({
        id: 'settings',
        title: 'Bangumi',
        async resolve(_context, settings) {
          const accessToken = await context.storage.get('accessToken', '')

          return {
            fields: [
              {
                id: 'api',
                label: 'API',
                content: [
                  settings.textInput({
                    id: 'accessToken',
                    initialValue: typeof accessToken === 'string' ? accessToken : '',
                    inputMode: 'password',
                    grow: true
                  }),
                  settings.notice({
                    id: 'rate-limit',
                    tone: 'info',
                    text: 'Requests are limited to 4 per second.'
                  })
                ]
              }
            ]
          }
        },
        async submit(event) {
          const accessToken = event.values.accessToken
          await context.storage.set(
            'accessToken',
            typeof accessToken === 'string' ? accessToken.trim() : ''
          )

          return event.close('root', { message: 'Bangumi settings saved.' })
        }
      })
    )
  }
})
