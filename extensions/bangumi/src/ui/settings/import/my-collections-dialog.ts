import { defineSettingsPanelDialog, type ScraperProfileSummary } from '@kisaki/extension-sdk'
import {
  BANGUMI_COLLECTION_TYPE_OPTIONS,
  IMPORT_WRITE_FIELD_OPTIONS,
  SETTINGS_NODE_IDS
} from '../ids'
import { toSettingsError } from '../shared/errors'
import { BANGUMI_COMMAND_IDS, maybeDialogField, startDialogManualJob } from '../shared/jobs'
import { createDialogPreviewChangesField, runDialogPreview } from '../shared/previews'
import type {
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult
} from '../shared/types'
import type { BangumiSettingsRuntime } from '../runtime'
import { createSettingsResources } from '../resources'
import { createMyCollectionsImportArgs } from './args'
import {
  createDialogImportProfileField,
  readImportCollectionTypes,
  readImportWriteFields
} from './options'

export function createMyCollectionsDialog(runtime: BangumiSettingsRuntime) {
  return defineSettingsPanelDialog({
    title: '导入我的收藏',
    size: 'lg',
    submitLabel: '导入',
    async resolve(context, ui) {
      const resources = createSettingsResources(runtime)
      const [profiles, isRunning] = await Promise.all([
        resources.profiles(),
        resources.isCommandRunning(BANGUMI_COMMAND_IDS.importMyCollections)
      ])
      const previewArgs = createMyCollectionsImportArgs(context.values, profiles[0]?.id ?? '', true)
      const preview = runtime.previewRegistry.get(
        context.sessionId,
        'import.myCollections',
        previewArgs
      )

      return {
        fields: [
          createDialogImportProfileField({
            settings: ui,
            values: context.values,
            profiles
          }),
          {
            id: 'my-collections-types',
            label: '收藏类型',
            orientation: 'horizontal',
            contentLayout: 'inline',
            content: [
              ui.multiSelect({
                id: SETTINGS_NODE_IDS.importCollectionTypes,
                initialValue: readImportCollectionTypes(context.values),
                options: BANGUMI_COLLECTION_TYPE_OPTIONS,
                onCommit(event) {
                  return event.refresh('dialog')
                }
              })
            ]
          },
          {
            id: 'import-write-fields',
            label: '写入项',
            description: '只对本次新建的游戏写入这些用户态数据',
            content: [
              ui.multiSelect({
                id: SETTINGS_NODE_IDS.importWriteFields,
                initialValue: readImportWriteFields(context.values),
                options: IMPORT_WRITE_FIELD_OPTIONS,
                onCommit(event) {
                  return event.refresh('dialog')
                }
              })
            ]
          },
          {
            id: 'my-collections-preview-action',
            label: '预览',
            orientation: 'horizontal',
            contentLayout: 'inline',
            content: [
              ui.button({
                id: 'my-collections-preview',
                label: '预览将导入的游戏',
                disabled: isRunning,
                async onClick(event) {
                  return runDialogPreview({
                    previewKey: 'import.myCollections',
                    commandId: BANGUMI_COMMAND_IDS.importMyCollections,
                    args: createMyCollectionsImportArgs(event.values, profiles[0]?.id ?? '', true),
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
              id: 'my-collections-preview-changes',
              label: '将导入的游戏',
              preview
            })
          )
        ]
      }
    },
    async submit(event) {
      const profiles = await createSettingsResources(runtime).profiles()
      return submitMyCollectionsDialog({ event, profiles })
    }
  })
}

async function submitMyCollectionsDialog({
  event,
  profiles
}: {
  event: BangumiSettingsDialogSubmitEvent
  profiles: readonly ScraperProfileSummary[]
}): Promise<BangumiSettingsDialogSubmitResult> {
  try {
    return await startDialogManualJob({
      commandId: BANGUMI_COMMAND_IDS.importMyCollections,
      args: createMyCollectionsImportArgs(event.values, profiles[0]?.id ?? '', false),
      event
    })
  } catch (error) {
    return event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}
