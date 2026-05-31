import { defineSettingsPanelDialog, type ScraperProfileSummary } from '@kisaki3/extension-sdk'
import { SETTINGS_NODE_IDS } from '../ids'
import { normalizeImportCollectionsArgs } from '../../../jobs/args'
import { formatScopedCollectionType } from '../../../media/labels'
import type { BangumiCollectionType } from '../../../api/types'
import { toSettingsError } from '../shared/errors'
import { BANGUMI_COMMAND_IDS, startDialogManualJob } from '../shared/jobs'
import { createDialogPreviewFields, runDialogPreview } from '../shared/previews'
import type {
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult
} from '../shared/types'
import type { BangumiSettingsRuntime } from '../runtime'
import { createSettingsResources } from '../resources'
import { createMyCollectionsImportArgs } from './args'
import {
  createDialogImportProfileField,
  createDialogImportScopeField,
  createDialogImportTargetCollectionField,
  IMPORT_DATA_ITEM_OPTIONS,
  readImportCollectionTypes,
  readImportDataItems,
  readImportPatchExisting,
  readImportScope
} from './options'

export function createMyCollectionsDialog(runtime: BangumiSettingsRuntime) {
  return defineSettingsPanelDialog({
    title: '导入我的收藏',
    size: 'lg',
    submitLabel: '导入',
    async resolve(context, ui) {
      const resources = createSettingsResources(runtime)
      const [profiles, collections, isActive] = await Promise.all([
        resources.profiles(),
        resources.collections(),
        resources.isCommandActive(BANGUMI_COMMAND_IDS.importCollections)
      ])
      const previewArgs = createMyCollectionsImportArgs(context.values, profiles[0]?.id ?? '')
      const selectedScope = readImportScope(context.values)
      const preview = runtime.previewRegistry.get(
        context.sessionId,
        'import.myCollections',
        previewArgs
      )

      return {
        fields: [
          createDialogImportScopeField({
            settings: ui,
            values: context.values,
            mediaRegistry: runtime.mediaRegistry
          }),
          createDialogImportProfileField({
            settings: ui,
            values: context.values,
            profiles
          }),
          createDialogImportTargetCollectionField({
            settings: ui,
            values: context.values,
            collections
          }),
          {
            id: 'my-collections-types',
            label: '收藏类型',
            description: '筛选 Bangumi 收藏类型',
            orientation: 'horizontal',
            contentLayout: 'inline',
            content: [
              ui.multiSelect({
                id: SETTINGS_NODE_IDS.importCollectionTypes,
                initialValue: readImportCollectionTypes(context.values),
                options: createCollectionTypeOptions(selectedScope),
                onChange(event) {
                  return event.refresh('dialog')
                }
              })
            ]
          },
          {
            id: 'import-data-items',
            label: '数据项',
            description: '选择导入时携带的数据',
            hidden: selectedScope !== 'game',
            content: [
              ui.multiSelect({
                id: SETTINGS_NODE_IDS.importDataItems,
                initialValue: readImportDataItems(context.values),
                options: IMPORT_DATA_ITEM_OPTIONS,
                onChange(event) {
                  return event.refresh('dialog')
                }
              })
            ]
          },
          {
            id: 'import-patch-existing',
            label: '更新已存在游戏',
            description: '按 Bangumi ID 匹配本地游戏，更新选中的数据项并加入目标合集',
            hidden: selectedScope !== 'game',
            content: [
              ui.switch({
                id: SETTINGS_NODE_IDS.importPatchExisting,
                initialValue: readImportPatchExisting(context.values),
                onChange(event) {
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
                disabled: isActive,
                async onClick(event) {
                  const args = createMyCollectionsImportArgs(
                    event.values,
                    profiles[0]?.id ?? ''
                  )
                  return runDialogPreview({
                    previewKey: 'import.myCollections',
                    commandId: BANGUMI_COMMAND_IDS.importCollections,
                    title: 'Bangumi 导入我的收藏预览',
                    args,
                    signal: runtime.abortSignal,
                    run: (run) =>
                      runtime.jobRunner.previewImportCollections(
                        normalizeImportCollectionsArgs(args),
                        {
                          commandId: BANGUMI_COMMAND_IDS.importCollections,
                          run
                        }
                      ),
                    previewRegistry: runtime.previewRegistry,
                    event
                  })
                }
              })
            ]
          },
          ...createDialogPreviewFields({
            settings: ui,
            id: 'my-collections-preview-changes',
            label: '将导入的游戏',
            emptyLabel: '没有将要导入的游戏',
            preview
          })
        ]
      }
    },
    async submit(event) {
      const profiles = await createSettingsResources(runtime).profiles()
      return submitMyCollectionsDialog({ event, profiles })
    }
  })
}

function createCollectionTypeOptions(scope: ReturnType<typeof readImportScope>) {
  return ([1, 2, 3, 4, 5] as const satisfies readonly BangumiCollectionType[]).map((type) => ({
    value: String(type),
    label: formatScopedCollectionType(scope, type)
  }))
}

async function submitMyCollectionsDialog({
  event,
  profiles
}: {
  event: BangumiSettingsDialogSubmitEvent
  profiles: readonly ScraperProfileSummary[]
}): Promise<BangumiSettingsDialogSubmitResult> {
  try {
    const args = createMyCollectionsImportArgs(event.values, profiles[0]?.id ?? '')

    return await startDialogManualJob({
      commandId: BANGUMI_COMMAND_IDS.importCollections,
      args,
      event
    })
  } catch (error) {
    return event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}
