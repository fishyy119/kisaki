import { defineSettingsPanelDialog } from '@kisaki3/extension-sdk'
import type { BangumiSettingsV1 } from '../../../config/schema'
import { SETTINGS_NODE_IDS } from '../ids'
import { normalizeFullSyncArgs } from '../../../jobs/args'
import { BANGUMI_COMMAND_IDS, startDialogManualJob } from '../shared/jobs'
import { createDialogPreviewFields, runDialogPreview } from '../shared/previews'
import { readBoolean, readNumber } from '../shared/values'
import { toSettingsError } from '../shared/errors'
import type {
  BangumiSettingsDialogSubmitEvent,
  BangumiSettingsDialogSubmitResult
} from '../shared/types'
import type { BangumiSettingsRuntime } from '../runtime'
import { createSettingsResources } from '../resources'
import { createFullSyncArgs } from './args'
import { FULL_SYNC_ITEM_OPTIONS, readFullSyncItems } from './options'

export function createFullSyncDialog(runtime: BangumiSettingsRuntime) {
  return defineSettingsPanelDialog({
    title: '全量同步',
    size: 'lg',
    submitLabel: '执行同步',
    async resolve(context, ui) {
      const resources = createSettingsResources(runtime)
      const [storedSettings, isActive] = await Promise.all([
        resources.settings(),
        resources.isCommandActive(BANGUMI_COMMAND_IDS.syncFull)
      ])
      const selectedItems = readFullSyncItems(context.values, storedSettings)
      const scoreSyncEnabled = selectedItems.includes('score')
      const updateExisting = readBoolean(
        context.values,
        SETTINGS_NODE_IDS.fullSyncUpdateExisting,
        true
      )
      const previewArgs = createFullSyncArgs(context.values, storedSettings)
      const preview = runtime.previewRegistry.get(context.sessionId, 'sync.full', previewArgs)

      return {
        fields: [
          {
            id: 'full-sync-items',
            label: '同步项',
            description: '选择全量同步要写入 Bangumi 的数据',
            orientation: 'horizontal',
            content: [
              ui.multiSelect({
                id: SETTINGS_NODE_IDS.fullSyncItems,
                initialValue: selectedItems,
                options: FULL_SYNC_ITEM_OPTIONS,
                onChange(event) {
                  return event.refresh('dialog')
                }
              })
            ]
          },
          {
            id: 'full-sync-update-existing',
            label: '更新已有收藏',
            description: '关闭后只创建缺失收藏，不修改远端已有收藏',
            orientation: 'horizontal',
            content: [
              ui.switch({
                id: SETTINGS_NODE_IDS.fullSyncUpdateExisting,
                initialValue: updateExisting,
                onChange(event) {
                  return event.refresh('dialog')
                }
              })
            ]
          },
          {
            id: 'full-sync-clear-remote-score',
            label: '允许删除远端评分',
            description: '本地评分为空或状态为想玩时删除 Bangumi 收藏中的评分',
            disabled: !updateExisting || !scoreSyncEnabled,
            orientation: 'horizontal',
            content: [
              ui.checkbox({
                id: SETTINGS_NODE_IDS.fullSyncClearRemoteScoreWhenEmpty,
                initialValue: readBoolean(
                  context.values,
                  SETTINGS_NODE_IDS.fullSyncClearRemoteScoreWhenEmpty,
                  storedSettings.game.autoSync.clearRemoteScoreWhenEmpty
                )
              })
            ]
          },
          {
            id: 'full-sync-batch-size',
            label: '批次大小',
            orientation: 'horizontal',
            content: [
              ui.numberInput({
                id: SETTINGS_NODE_IDS.fullSyncBatchSize,
                initialValue: readNumber(context.values, SETTINGS_NODE_IDS.fullSyncBatchSize, 100),
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
              ui.button({
                id: 'full-sync-preview',
                label: '预览将更改的游戏',
                disabled: isActive,
                async onClick(event) {
                  const args = createFullSyncArgs(event.values, storedSettings)
                  return runDialogPreview({
                    previewKey: 'sync.full',
                    commandId: BANGUMI_COMMAND_IDS.syncFull,
                    title: 'Bangumi 全量同步预览',
                    args,
                    signal: runtime.abortSignal,
                    run: (run) =>
                      runtime.jobRunner.previewFullSync(
                        normalizeFullSyncArgs(args),
                        {
                          commandId: BANGUMI_COMMAND_IDS.syncFull,
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
            id: 'full-sync-preview-changes',
            label: '将更改的游戏',
            preview
          })
        ]
      }
    },
    async submit(event) {
      return submitFullSyncDialog({
        event,
        storedSettings: await runtime.settingsStore.get()
      })
    }
  })
}

async function submitFullSyncDialog({
  event,
  storedSettings
}: {
  event: BangumiSettingsDialogSubmitEvent
  storedSettings: BangumiSettingsV1
}): Promise<BangumiSettingsDialogSubmitResult> {
  try {
    return await startDialogManualJob({
      commandId: BANGUMI_COMMAND_IDS.syncFull,
      args: createFullSyncArgs(event.values, storedSettings),
      event
    })
  } catch (error) {
    return event.fail(toSettingsError(error), { refresh: 'dialog' })
  }
}
