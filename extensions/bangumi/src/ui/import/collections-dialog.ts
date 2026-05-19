import type { ScraperProfileSummary, SerializableRecord } from '@kisaki/extension-sdk'
import { BANGUMI_COMMAND_IDS } from '../../jobs/commands'
import { BANGUMI_COLLECTION_TYPE_OPTIONS, DIALOG_IDS, NODE_IDS } from '../common/constants'
import { toSettingsError } from '../common/errors'
import { maybeDialogField, startDialogManualJob } from '../common/jobs'
import {
  createDialogPreviewChangesField,
  PreviewResultRegistry,
  runDialogPreview
} from '../common/preview'
import { readString } from '../common/values'
import type {
  BangumiSettingsDialogFactory,
  BangumiSettingsDialogField,
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult,
  BangumiSettingsRootFactory,
  BangumiSettingsRootField
} from '../common/types'
import {
  createDialogImportProfileField,
  createImportWriteFieldArgs,
  createImportWriteFieldsField,
  readImportCollectionTypes
} from './options'

export function createMyCollectionsImportFields({
  settings,
  profiles,
  isRunning
}: {
  settings: BangumiSettingsRootFactory
  profiles: readonly ScraperProfileSummary[]
  isRunning: boolean
}): BangumiSettingsRootField[] {
  const hasProfile = profiles.length > 0

  return [
    {
      id: 'import-my-collections-entry',
      label: '我的收藏',
      orientation: 'horizontal',
      contentLayout: 'inline',
      content: [
        settings.button({
          id: 'open-import-my-collections-dialog',
          label: '配置导入',
          tone: 'primary',
          disabled: !hasProfile || isRunning,
          onClick(event) {
            return event.openDialog(DIALOG_IDS.importMyCollections)
          }
        }),
        settings.notice({
          id: 'import-profile-missing',
          tone: 'warning',
          hidden: hasProfile,
          text: '当前没有可用的游戏 scraper profile，导入命令会被阻止。'
        })
      ]
    }
  ]
}

export function createMyCollectionsDialogFields({
  settings,
  values,
  profiles,
  previewRegistry,
  sessionId,
  isRunning
}: {
  settings: BangumiSettingsDialogFactory
  values: SerializableRecord
  profiles: readonly ScraperProfileSummary[]
  previewRegistry: PreviewResultRegistry
  sessionId: string
  isRunning: boolean
}): BangumiSettingsDialogField[] {
  const previewArgs = createMyCollectionsImportArgs(values, profiles[0]?.id ?? '', true)
  const preview = previewRegistry.get(sessionId, 'import.myCollections', previewArgs)

  return [
    createDialogImportProfileField({
      settings,
      values,
      profiles
    }),
    {
      id: 'my-collections-types',
      label: '收藏类型',
      orientation: 'horizontal',
      contentLayout: 'inline',
      content: [
        settings.multiSelect({
          id: NODE_IDS.importCollectionTypes,
          initialValue: readImportCollectionTypes(values),
          options: BANGUMI_COLLECTION_TYPE_OPTIONS,
          onCommit(event) {
            return event.refresh('dialog')
          }
        })
      ]
    },
    createImportWriteFieldsField(settings, values),
    {
      id: 'my-collections-preview-action',
      label: '预览',
      orientation: 'horizontal',
      contentLayout: 'inline',
      content: [
        settings.button({
          id: 'my-collections-preview',
          label: '预览将导入的游戏',
          disabled: isRunning,
          async onClick(event) {
            return runDialogPreview({
              previewKey: 'import.myCollections',
              commandId: BANGUMI_COMMAND_IDS.importMyCollections,
              args: createMyCollectionsImportArgs(event.values, profiles[0]?.id ?? '', true),
              previewRegistry,
              event
            })
          }
        })
      ]
    },
    ...maybeDialogField(
      createDialogPreviewChangesField({
        settings,
        id: 'my-collections-preview-changes',
        label: '将导入的游戏',
        preview
      })
    )
  ]
}

export async function submitMyCollectionsDialog({
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

function createMyCollectionsImportArgs(
  values: SerializableRecord,
  fallbackProfileId: string,
  dryRun: boolean
): SerializableRecord {
  return {
    dryRun,
    profileId: readString(values, NODE_IDS.importProfileId, fallbackProfileId),
    collectionTypes: readImportCollectionTypes(values),
    fields: createImportWriteFieldArgs(values),
    targetCollection: {
      kind: 'none'
    },
    concurrency: 4
  }
}
