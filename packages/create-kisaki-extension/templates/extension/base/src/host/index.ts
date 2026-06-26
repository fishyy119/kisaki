import { defineExtension } from '@kisaki3/extension-sdk'
import { activateStarter } from './{{STARTER_MODULE}}'

const extensionName = `{{EXTENSION_NAME}}`

export default defineExtension({
  async activate(context) {
    context.logger.info(`${extensionName} activated.`)
    await activateStarter(context)
  }
})
