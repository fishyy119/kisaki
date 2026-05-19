import { defineSettingsPanelDialog, type ScraperProfileSummary } from '@kisaki/extension-sdk'
import { SETTINGS_NODE_IDS } from '../ids'
import { toSettingsError } from '../shared/errors'
import { BANGUMI_COMMAND_IDS, maybeDialogField, startDialogManualJob } from '../shared/jobs'
import { createDialogPreviewChangesField, runDialogPreview } from '../shared/previews'
import { readString } from '../shared/values'
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
      const [profiles, collections, isRunning] = await Promise.all([
        resources.profiles(),
        resources.collections(),
        resources.isCommandRunning(BANGUMI_COMMAND_IDS.importIndex)
      ])
      const targetCollectionMode = readIndexTargetCollectionMode(context.values)
      const hasTargetCollection =
        targetCollectionMode === 'byIndexTitle' ||
        (targetCollectionMode === 'existing' && !!readImportTargetCollectionId(context.values))
      const previewArgs = createIndexImportArgs(context.values, profiles[0]?.id ?? '', true)
      const preview = runtime.previewRegistry.get(context.sessionId, 'import.index', previewArgs)

      return {
        fields: [
          {
            id: 'index-input',
            label: 'Bangumi 目录',
            content: [
              ui.textInput({
                id: SETTINGS_NODE_IDS.importIndexInput,
                initialValue: readString(context.values, SETTINGS_NODE_IDS.importIndexInput, ''),
                placeholder: 'Bangumi 目录 ID 或 URL',
                inputMode: 'url',
                grow: true,
                onCommit(event) {
                  return event.refresh('dialog')
                }
              })
            ]
          },
          createDialogImportProfileField({
            settings: ui,
            values: context.values,
            profiles
          }),
          ...createDialogIndexTargetCollectionFields({
            settings: ui,
            values: context.values,
            collections
          }),
          {
            id: 'import-index-patch-existing',
            label: '更新已存在游戏',
            description: '按 Bangumi ID 匹配本地游戏，并把已存在游戏也加入目标合集',
            disabled: !hasTargetCollection,
            content: [
              ui.switch({
                id: SETTINGS_NODE_IDS.importPatchExisting,
                initialValue: readImportPatchExisting(context.values),
                onCommit(event) {
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
                disabled: isRunning,
                async onClick(event) {
                  return runDialogPreview({
                    previewKey: 'import.index',
                    commandId: BANGUMI_COMMAND_IDS.importIndex,
                    args: createIndexImportArgs(event.values, profiles[0]?.id ?? '', true),
                    previewRegistry: runtime.previewRegistry,
                    event
                  })
                }
              })
            ]
          },
          ...maybeDialogField(
            createDialogPreviewChangesField({
              settings: ui,
              id: 'index-preview-changes',
              label: '将导入的游戏',
              preview
            })
          )
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
    return await startDialogManualJob({
      commandId: BANGUMI_COMMAND_IDS.importIndex,
      args: createIndexImportArgs(event.values, profiles[0]?.id ?? '', false),
      event
    })
  } catch (error) {
    return event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}
