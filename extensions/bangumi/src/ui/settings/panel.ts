import { defineSettingsPanel } from '@kisaki/extension-sdk'
import { createSettingsDialogs } from './dialogs'
import { createSettingsResources } from './resources'
import { createSettingsRuntime, type BangumiSettingsPanelDependencies } from './runtime'
import { readSettingsForm } from './advanced/form'
import { resolveSettingsTabs } from './tabs'

export function createBangumiSettingsPanel(dependencies: BangumiSettingsPanelDependencies) {
  const runtime = createSettingsRuntime(dependencies)
  const dialogs = createSettingsDialogs(runtime)

  return defineSettingsPanel({
    id: 'settings',
    title: 'Bangumi',
    submitLabel: '保存设置',
    dialogs,
    async resolve(context, ui) {
      return {
        size: 'lg',
        tabs: await resolveSettingsTabs({
          context,
          ui,
          runtime,
          resources: createSettingsResources(runtime)
        })
      }
    },
    async submit(event) {
      const current = await runtime.settingsStore.get()
      await runtime.settingsStore.set(readSettingsForm(event.values, current))
      return event.success({ message: 'Bangumi 设置已保存。', refresh: 'root' })
    }
  })
}
