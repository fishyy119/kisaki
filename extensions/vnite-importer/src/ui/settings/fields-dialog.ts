import { defineSettingsPanelDialog } from '@kisaki3/extension-sdk'
import type { JsonObject, SettingsPanelSelectOption } from '@kisaki3/extension-sdk'
import { VNITE_FIELD_GROUPS, createFieldGroupNodeId, readFieldSelection } from './options'
import type { VniteSettingsRuntime } from './runtime'

export function createVniteFieldsDialog(runtime: VniteSettingsRuntime) {
  return defineSettingsPanelDialog({
    title: '字段',
    size: 'lg',
    submitLabel: '保存字段',
    async resolve(_context, ui) {
      const [settings, flow] = await Promise.all([
        runtime.settingsStore.get(),
        runtime.flowStore.get()
      ])
      const coverage = new Map(
        (flow.analysis?.fieldCoverage ?? []).map((item) => [
          item.key,
          `${item.present}/${item.total}`
        ])
      )

      return {
        fields: VNITE_FIELD_GROUPS.map((group) => {
          const groupSelection = settings.defaults.fieldSelection[group.key] as Record<
            string,
            boolean
          >
          return {
            id: `fields-${group.key}`,
            label: group.label,
            description: group.description,
            content: [
              ui.multiSelect({
                id: createFieldGroupNodeId(group.key),
                initialValue: group.items
                  .filter((item) => groupSelection[item.key])
                  .map((item) => item.key),
                options: group.items.map((item) =>
                  createFieldOption(item, coverage)
                ) satisfies readonly SettingsPanelSelectOption[]
              })
            ]
          }
        })
      }
    },
    async submit(event) {
      await runtime.settingsStore.update((settings) => ({
        ...settings,
        defaults: {
          ...settings.defaults,
          fieldSelection: readFieldSelection(
            event.values as JsonObject,
            settings.defaults.fieldSelection
          )
        }
      }))

      return event.refresh('all', {
        message: '字段设置已更新。'
      })
    }
  })
}

function createFieldOption(
  item: { key: string; label: string; description?: string; coverageKey?: string },
  coverage: Map<string, string>
): SettingsPanelSelectOption {
  const coverageText = item.coverageKey ? coverage.get(item.coverageKey) : undefined

  return {
    value: item.key,
    label: item.label,
    description: [item.description, coverageText ? `覆盖 ${coverageText}` : undefined]
      .filter(Boolean)
      .join('，')
  }
}
