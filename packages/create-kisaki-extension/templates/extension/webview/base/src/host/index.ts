import { defineExtension } from '@kisaki3/extension-sdk'
import { activateStarter } from './{{EXTENSION_STARTER_MODULE}}'
import { registerWebview } from './webview'

const extensionName = `{{EXTENSION_NAME}}`

export default defineExtension({
  async activate(context) {
    context.logger.info(`${extensionName} activated.`)
    await activateStarter(context)
    registerWebview(context)
  }
})
