import type { SerializableRecord } from '@kisaki/extension-sdk'
import type { BangumiSettingsV1 } from '../../config/schema'
import { BANGUMI_COMMAND_IDS } from '../../jobs/commands'
import { FULL_SYNC_ITEM_OPTIONS, NODE_IDS } from '../common/constants'
import { toSettingsError } from '../common/errors'
import { maybeDialogField, startDialogManualJob } from '../common/jobs'
import {
  createDialogPreviewChangesField,
  PreviewResultRegistry,
  runDialogPreview
} from '../common/preview'
import { readBoolean, readNumber } from '../common/values'
import type {
  BangumiSettingsDialogFactory,
  BangumiSettingsDialogField,
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult
} from '../common/types'
import { createFullSyncFields, readFullSyncItems } from './options'

export function createFullSyncDialogFields({
  settings,
  values,
  storedSettings,
  previewRegistry,
  sessionId,
  isRunning
}: {
  settings: BangumiSettingsDialogFactory
  values: SerializableRecord
  storedSettings: BangumiSettingsV1
  previewRegistry: PreviewResultRegistry
  sessionId: string
  isRunning: boolean
}): BangumiSettingsDialogField[] {
  const selectedItems = readFullSyncItems(values, storedSettings)
  const scoreSyncEnabled = selectedItems.includes('score')
  const updateExisting = readBoolean(values, NODE_IDS.fullSyncUpdateExisting, true)
  const previewArgs = createFullSyncArgs(values, storedSettings, true)
  const preview = previewRegistry.get(sessionId, 'sync.full', previewArgs)

  return [
    {
      id: 'full-sync-items',
      label: '同步项',
      description: '选择全量同步要写入 Bangumi 的数据',
      content: [
        settings.multiSelect({
          id: NODE_IDS.fullSyncItems,
          initialValue: selectedItems,
          options: FULL_SYNC_ITEM_OPTIONS,
          onCommit(event) {
            return event.refresh('dialog')
          }
        })
      ]
    },
    {
      id: 'full-sync-update-existing',
      label: '更新已有收藏',
      description: '关闭后只创建缺失收藏，不修改远端已有收藏',
      content: [
        settings.switch({
          id: NODE_IDS.fullSyncUpdateExisting,
          initialValue: updateExisting,
          onCommit(event) {
            return event.refresh('dialog')
          }
        })
      ]
    },
    {
      id: 'full-sync-clear-remote-score',
      label: '允许删除远端评分',
      description: '本地评分为空时删除 Bangumi 收藏中的评分',
      disabled: !updateExisting || !scoreSyncEnabled,
      content: [
        settings.checkbox({
          id: NODE_IDS.fullSyncClearRemoteScoreWhenEmpty,
          initialValue: readBoolean(
            values,
            NODE_IDS.fullSyncClearRemoteScoreWhenEmpty,
            storedSettings.autoSync.clearRemoteScoreWhenEmpty
          )
        })
      ]
    },
    {
      id: 'full-sync-batch-size',
      label: '批次大小',
      content: [
        settings.numberInput({
          id: NODE_IDS.fullSyncBatchSize,
          initialValue: readNumber(values, NODE_IDS.fullSyncBatchSize, 100),
          min: 1,
          max: 500,
          step: 1
        })
      ]
    },
    {
      id: 'full-sync-preview-action',
      label: '预览',
      orientation: 'horizontal',
      contentLayout: 'inline',
      content: [
        settings.button({
          id: 'full-sync-preview',
          label: '预览将更改的游戏',
          disabled: isRunning,
          async onClick(event) {
            return runDialogPreview({
              previewKey: 'sync.full',
              commandId: BANGUMI_COMMAND_IDS.syncFull,
              args: createFullSyncArgs(event.values, storedSettings, true),
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
        id: 'full-sync-preview-changes',
        label: '将更改的游戏',
        preview
      })
    )
  ]
}

export async function submitFullSyncDialog({
  event,
  storedSettings
}: {
  event: BangumiSettingsDialogSubmitEvent
  storedSettings: BangumiSettingsV1
}): Promise<BangumiSettingsDialogSubmitResult> {
  try {
    return await startDialogManualJob({
      commandId: BANGUMI_COMMAND_IDS.syncFull,
      args: createFullSyncArgs(event.values, storedSettings, false),
      event
    })
  } catch (error) {
    return event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}

function createFullSyncArgs(
  values: SerializableRecord,
  storedSettings: BangumiSettingsV1,
  dryRun: boolean
): SerializableRecord {
  const items = readFullSyncItems(values, storedSettings)
  const fields = createFullSyncFields(items)
  const updateExisting = readBoolean(values, NODE_IDS.fullSyncUpdateExisting, true)
  const scoreEnabled = fields.scoreEnabled === true

  return {
    dryRun,
    updateExisting,
    ...fields,
    clearRemoteScoreWhenEmpty:
      updateExisting &&
      scoreEnabled &&
      readBoolean(values, NODE_IDS.fullSyncClearRemoteScoreWhenEmpty, false),
    batchSize: readNumber(values, NODE_IDS.fullSyncBatchSize, 100)
  }
}
