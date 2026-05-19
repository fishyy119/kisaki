import type { SerializableRecord } from '@kisaki/extension-sdk'
import type { BangumiSettingsV1 } from '../../config/schema'
import { AUTO_SYNC_ITEM_OPTIONS, DIALOG_IDS, NODE_IDS } from '../common/constants'
import { readBoolean } from '../common/values'
import type { BangumiSettingsRootFactory, BangumiSettingsRootField } from '../common/types'
import { readAutoSyncItems } from './options'

export function createSyncFields({
  settings,
  values,
  storedSettings,
  isFullSyncRunning
}: {
  settings: BangumiSettingsRootFactory
  values: SerializableRecord
  storedSettings: BangumiSettingsV1
  isFullSyncRunning: boolean
}): BangumiSettingsRootField[] {
  return [
    ...createAutoSyncFields(settings, values, storedSettings),
    {
      id: 'full-sync-entry',
      label: '全量同步',
      description: '全量同步已绑定 Bangumi ID 的本地游戏',
      orientation: 'horizontal',
      contentLayout: 'inline',
      content: [
        settings.button({
          id: 'open-full-sync-dialog',
          label: '配置全量同步',
          tone: 'primary',
          disabled: isFullSyncRunning,
          onClick(event) {
            return event.openDialog(DIALOG_IDS.fullSync)
          }
        })
      ]
    }
  ]
}

function createAutoSyncFields(
  settings: BangumiSettingsRootFactory,
  values: SerializableRecord,
  storedSettings: BangumiSettingsV1
): BangumiSettingsRootField[] {
  const autoSyncEnabled = readBoolean(
    values,
    NODE_IDS.autoSyncEnabled,
    storedSettings.autoSync.enabled
  )
  const selectedItems = readAutoSyncItems(values, storedSettings)
  const scoreSyncEnabled = selectedItems.includes('score')

  return [
    {
      id: 'auto-sync',
      label: '自动同步',
      description: '本地游戏变化后自动写入 Bangumi 收藏',
      content: [
        settings.switch({
          id: NODE_IDS.autoSyncEnabled,
          initialValue: autoSyncEnabled,
          onCommit(event) {
            return event.refresh('all')
          }
        })
      ]
    },
    {
      id: 'auto-sync-items',
      label: '同步项',
      description: '选择自动同步要处理的游戏变化',
      disabled: !autoSyncEnabled,
      content: [
        settings.multiSelect({
          id: NODE_IDS.autoSyncItems,
          initialValue: selectedItems,
          options: AUTO_SYNC_ITEM_OPTIONS,
          onCommit(event) {
            return event.refresh('all')
          }
        })
      ]
    },
    {
      id: 'clear-remote-score',
      label: '允许删除远端评分',
      description: '本地评分为空时删除 Bangumi 收藏中的评分',
      disabled: !autoSyncEnabled || !scoreSyncEnabled,
      content: [
        settings.checkbox({
          id: NODE_IDS.clearRemoteScoreWhenEmpty,
          initialValue: storedSettings.autoSync.clearRemoteScoreWhenEmpty
        })
      ]
    }
  ]
}
