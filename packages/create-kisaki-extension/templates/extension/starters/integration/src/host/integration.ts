import { kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'

const extensionName = `__EXTENSION_NAME__`

/** Registers a sample service integration and host event subscription. */
export async function activateStarter(context: ExtensionContext): Promise<void> {
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
