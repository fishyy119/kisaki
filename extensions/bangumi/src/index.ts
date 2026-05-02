import { defineExtension } from '@kisaki/extension-sdk'
import { BangumiProvider } from './scraper/provider'

export default defineExtension({
  activate(context) {
    context.logger.info('Built-in Bangumi scraper activated.')

    context.contributions.scrapers.registerGameProvider(new BangumiProvider(context))
    context.contributions.settings.register({
      id: 'settings',
      title: 'Bangumi',
      rootScreenId: 'general',
      screens: {
        general: {
          async resolve(_frame, settings) {
            const accessToken = await context.storage.get('accessToken', '')

            return settings.screen({
              nodes: [
                settings.section({
                  id: 'api',
                  title: 'API',
                  children: [
                    settings.textInput({
                      id: 'accessToken',
                      label: 'Access token',
                      value: typeof accessToken === 'string' ? accessToken : '',
                      inputMode: 'password'
                    }),
                    settings.notice({
                      id: 'rate-limit',
                      tone: 'info',
                      text: 'Requests are limited to 4 per second.'
                    })
                  ]
                })
              ]
            })
          },
          async submit(event) {
            const accessToken = event.values.accessToken
            await context.storage.set(
              'accessToken',
              typeof accessToken === 'string' ? accessToken.trim() : ''
            )

            return {
              success: true,
              commands: [{ type: 'close', scope: 'all' }]
            }
          }
        }
      }
    })
  }
})
