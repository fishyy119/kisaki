import { defineExtension } from '@kisaki3/extension-sdk'
import { createVniteImporterSettingsPanel } from './ui/settings'

export default defineExtension({
  activate(context) {
    context.logger.info('Built-in Vnite importer activated.')
    context.subscriptions.add(
      context.contributions.settingsPanels.register(createVniteImporterSettingsPanel())
    )
  }
})
