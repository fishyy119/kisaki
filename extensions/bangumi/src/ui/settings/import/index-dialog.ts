import {
  defineSettingsPanelDialog,
  type ScraperProfileSummary,
  type JsonObject
} from '@kisaki3/extension-sdk'
import { SETTINGS_NODE_IDS } from '../ids'
import { normalizeImportIndexArgs } from '../../../jobs/args'
import { toSettingsError } from '../shared/errors'
import { BANGUMI_COMMAND_IDS, startDialogManualJob } from '../shared/jobs'
import { createDialogPreviewFields, runDialogPreview } from '../shared/previews'
import type {
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult
} from '../shared/types'
import type { BangumiSettingsRuntime } from '../runtime'
import { createSettingsResources } from '../resources'
import { createIndexImportArgs } from './args'
import {
  createDialogIndexTargetCollectionFields,
  createDialogImportProfileField,
  createDialogImportScopeField,
  readIndexTargetCollectionMode,
  readImportPatchExisting,
  readImportTargetCollectionId
} from './options'

export function createIndexDialog(runtime: BangumiSettingsRuntime) {
  return defineSettingsPanelDialog({
    title: '导入目录',
    size: 'lg',
    submitLabel: '导入',
    async resolve(context, ui) {
      const resources = createSettingsResources(runtime)
      const [profiles, collections, isActive] = await Promise.all([
        resources.profiles(),
        resources.collections(),
        resources.isCommandActive(BANGUMI_COMMAND_IDS.importIndex)
      ])
      const values = mergeIndexDialogValues(context.values, context.parentValues)
      const targetCollectionMode = readIndexTargetCollectionMode(values)
      const hasTargetCollection =
        targetCollectionMode === 'byIndexTitle' ||
        (targetCollectionMode === 'existing' && !!readImportTargetCollectionId(values))
      const previewArgs = createIndexImportArgs(values, profiles[0]?.id ?? '')
      const preview = runtime.previewRegistry.get(context.sessionId, 'import.index', previewArgs)

      return {
        fields: [
          createDialogImportScopeField({
            settings: ui,
            values,
            mediaRegistry: runtime.mediaRegistry
          }),
          createDialogImportProfileField({
            settings: ui,
            values,
            profiles
          }),
          ...createDialogIndexTargetCollectionFields({
            settings: ui,
            values,
            collections
          }),
          {
            id: 'import-index-patch-existing',
            label: '更新已存在游戏',
            description: '按 Bangumi ID 匹配本地游戏，加入目标合集',
            disabled: !hasTargetCollection,
            orientation: 'horizontal',
            content: [
              ui.switch({
                id: SETTINGS_NODE_IDS.importPatchExisting,
                initialValue: readImportPatchExisting(values),
                onChange(event) {
                  return event.refresh('dialog')
                }
              })
            ]
          },
          {
            id: 'index-preview-action',
            label: '预览',
            orientation: 'horizontal',
            contentLayout: 'inline',
            content: [
              ui.button({
                id: 'index-preview',
                label: '预览将导入的游戏',
                disabled: isActive,
                async onClick(event) {
                  const args = createIndexImportArgs(
                    mergeIndexDialogValues(event.values, event.parentValues),
                    profiles[0]?.id ?? ''
                  )
                  return runDialogPreview({
                    previewKey: 'import.index',
                    commandId: BANGUMI_COMMAND_IDS.importIndex,
                    title: 'Bangumi 导入目录预览',
                    args,
                    signal: runtime.abortSignal,
                    run: (run) =>
                      runtime.jobRunner.previewImportIndex(normalizeImportIndexArgs(args), {
                        commandId: BANGUMI_COMMAND_IDS.importIndex,
                        run
                      }),
                    previewRegistry: runtime.previewRegistry,
                    event
                  })
                }
              })
            ]
          },
          ...createDialogPreviewFields({
            settings: ui,
            id: 'index-preview-changes',
            label: '目录导入预览',
            emptyLabel: '没有将要导入的游戏',
            preview
          })
        ]
      }
    },
    async submit(event) {
      const profiles = await createSettingsResources(runtime).profiles()
      return submitIndexDialog({ event, profiles })
    }
  })
}

async function submitIndexDialog({
  event,
  profiles
}: {
  event: BangumiSettingsDialogSubmitEvent
  profiles: readonly ScraperProfileSummary[]
}): Promise<BangumiSettingsDialogSubmitResult> {
  try {
    const values = mergeIndexDialogValues(event.values, event.parentValues)
    const args = createIndexImportArgs(values, profiles[0]?.id ?? '')

    return await startDialogManualJob({
      commandId: BANGUMI_COMMAND_IDS.importIndex,
      args,
      event
    })
  } catch (error) {
    return event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}

function mergeIndexDialogValues(values: JsonObject, parentValues: JsonObject): JsonObject {
  return {
    ...parentValues,
    ...values
  }
}
