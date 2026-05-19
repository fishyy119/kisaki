import { defineSettingsPanelTab } from '@kisaki/extension-sdk'
import type { BangumiSettingsRootScope, BangumiSettingsTab } from '../contracts'
import { AUTO_SYNC_ITEM_OPTIONS, SETTINGS_DIALOG_IDS, SETTINGS_NODE_IDS } from '../ids'
import { readBoolean } from '../shared/values'
import { readAutoSyncItems } from './options'

export async function resolveSyncTab(scope: BangumiSettingsRootScope): Promise<BangumiSettingsTab> {
  const [storedSettings, runningJobs] = await Promise.all([
    scope.resources.settings(),
    scope.resources.runningJobs()
  ])
  const autoSyncEnabled = readBoolean(
    scope.context.values,
    SETTINGS_NODE_IDS.autoSyncEnabled,
    storedSettings.autoSync.enabled
  )
  const selectedItems = readAutoSyncItems(scope.context.values, storedSettings)
  const scoreSyncEnabled = selectedItems.includes('score')

  return defineSettingsPanelTab({
    id: 'sync',
    label: '同步',
    fields: [
      {
        id: 'auto-sync',
        label: '自动同步',
        description: '本地游戏变化后自动写入 Bangumi 收藏',
        content: [
          scope.ui.switch({
            id: SETTINGS_NODE_IDS.autoSyncEnabled,
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
          scope.ui.multiSelect({
            id: SETTINGS_NODE_IDS.autoSyncItems,
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
          scope.ui.checkbox({
            id: SETTINGS_NODE_IDS.clearRemoteScoreWhenEmpty,
            initialValue: storedSettings.autoSync.clearRemoteScoreWhenEmpty
          })
        ]
      },
      {
        id: 'full-sync-entry',
        label: '全量同步',
        description: '全量同步已绑定 Bangumi ID 的本地游戏',
        orientation: 'horizontal',
        contentLayout: 'inline',
        content: [
          scope.ui.button({
            id: 'open-full-sync-dialog',
            label: '配置全量同步',
            tone: 'primary',
            disabled: runningJobs.syncFull,
            onClick(event) {
              return event.openDialog(SETTINGS_DIALOG_IDS.fullSync)
            }
          })
        ]
      }
    ]
  })
}
