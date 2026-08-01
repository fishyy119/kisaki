import { kisaki, type ExtensionContext } from '@kisaki3/extension-sdk'

const extensionName = `{{EXTENSION_NAME}}`

/** Registers a sample service integration and hook subscription. */
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
    context.hooks.on('library.changed', ({ changes }) => {
      for (const change of changes) {
        if (change.entity === 'game' && change.kind === 'created') {
          context.logger.info(`Game created: ${change.id}`)
        }
      }
    })
  )
}
