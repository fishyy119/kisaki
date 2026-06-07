import { defineSettingsPanelDialog } from '@kisaki3/extension-sdk'
import type { SerializableRecord } from '@kisaki3/extension-sdk'
import { VNITE_SETTINGS_NODE_IDS } from './ids'
import { readBoolean } from './options'
import type { VniteSettingsRuntime } from './runtime'

export function createVniteAdvancedDialog(runtime: VniteSettingsRuntime) {
  return defineSettingsPanelDialog({
    title: '高级选项',
    size: 'md',
    submitLabel: '保存高级选项',
    async resolve(_context, ui) {
      const settings = await runtime.settingsStore.get()

      return {
        fields: [
          {
            id: 'keep-last-analysis',
            label: '保留上一次摘要',
            description: '回到起始步骤后仍显示最近一次导入摘要',
            content: [
              ui.switch({
                id: VNITE_SETTINGS_NODE_IDS.keepLastAnalysis,
                initialValue: settings.cleanup.keepLastAnalysis
              })
            ]
          },
          {
            id: 'strict-attachments',
            label: '严格附件模式',
            description: '附件失败时让相关图节点失败；默认只生成 warning',
            content: [
              ui.switch({
                id: VNITE_SETTINGS_NODE_IDS.strictAttachments,
                initialValue: settings.defaults.strictAttachments
              })
            ]
          },
          {
            id: 'cleanup-current-state',
            label: '清理临时状态',
            description: '释放当前备份包授权并回到起始步骤',
            orientation: 'horizontal',
            contentLayout: 'inline',
            content: [
              ui.button({
                id: VNITE_SETTINGS_NODE_IDS.cleanupCurrentState,
                label: '清理临时文件',
                tone: 'danger',
                confirm: {
                  title: '清理临时状态',
                  description: '当前备份包选择、分析结果和预览都会被清理。',
                  confirmLabel: '清理',
                  cancelLabel: '取消'
                },
                async onClick(event) {
                  const [flow, latestSettings] = await Promise.all([
                    runtime.flowStore.get(),
                    runtime.settingsStore.get()
                  ])
                  if (flow.file) {
                    await runtime.files.releaseGrant(flow.file.grantId).catch((error) => {
                      runtime.logger.warn(
                        'Vnite importer failed to release file grant.',
                        toSafeLog(error)
                      )
                    })
                  }
                  await runtime.flowStore.reset({
                    keepLastSummary: latestSettings.cleanup.keepLastAnalysis
                  })
                  return event.refresh('all', {
                    message: '临时状态已清理。'
                  })
                }
              })
            ]
          }
        ]
      }
    },
    async submit(event) {
      const values = event.values as SerializableRecord
      await runtime.settingsStore.update((settings) => ({
        ...settings,
        defaults: {
          ...settings.defaults,
          strictAttachments: readBoolean(
            values,
            VNITE_SETTINGS_NODE_IDS.strictAttachments,
            settings.defaults.strictAttachments
          )
        },
        cleanup: {
          ...settings.cleanup,
          keepLastAnalysis: readBoolean(
            values,
            VNITE_SETTINGS_NODE_IDS.keepLastAnalysis,
            settings.cleanup.keepLastAnalysis
          )
        }
      }))

      return event.refresh('all', {
        message: '高级选项已保存。'
      })
    }
  })
}

function toSafeLog(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    return {
      name: error.name,
      message: error.message
    }
  }

  return {
    message: String(error)
  }
}
