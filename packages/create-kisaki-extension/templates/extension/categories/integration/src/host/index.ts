import { defineExtension, kisaki } from '@kisaki3/extension-sdk'

const extensionName = `__EXTENSION_NAME__`

export default defineExtension({
  async activate(context) {
    context.logger.info(`${extensionName} activated.`)

    context.contributions.cardActions.register({
      id: 'test-connection',
      label: 'Test connection',
      description: 'Verify that the integration can reach its service.',
      async run() {
        await kisaki.notify.info(extensionName, 'Connection test succeeded.')
      }
    })

    context.subscriptions.add(
      await kisaki.events.on('game.created', (event) => {
        context.logger.info(`Game created: ${event.gameId}`)
      })
    )
  }
})
