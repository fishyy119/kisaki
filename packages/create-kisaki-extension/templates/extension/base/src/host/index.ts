import { defineExtension } from '@kisaki3/extension-sdk'
import { activateStarter } from './__STARTER_MODULE__'

const extensionName = `__EXTENSION_NAME__`

export default defineExtension({
  async activate(context) {
    context.logger.info(`${extensionName} activated.`)
    await activateStarter(context)
  }
})
