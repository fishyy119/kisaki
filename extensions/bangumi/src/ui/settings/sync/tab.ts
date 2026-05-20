import { defineSettingsPanelTab } from '@kisaki/extension-sdk'
import type { BangumiSettingsRootScope, BangumiSettingsTab } from '../contracts'
import { SETTINGS_DIALOG_IDS, SETTINGS_NODE_IDS } from '../ids'
import { toSettingsError } from '../shared/errors'
import { BANGUMI_COMMAND_IDS, startRootManualJob } from '../shared/jobs'
import { MEDIA_SCOPE_OPTIONS } from '../shared/options'
import { readBoolean } from '../shared/values'
import { AUTO_SYNC_ITEM_OPTIONS, readAutoSyncItems, readSyncScope } from './options'

export async function resolveSyncTab(scope: BangumiSettingsRootScope): Promise<BangumiSettingsTab> {
  const [storedSettings, runningJobs] = await Promise.all([
    scope.resources.settings(),
    scope.resources.runningJobs()
  ])
  const selectedScope = readSyncScope(scope.context.values)
  const selectedDescriptor = scope.runtime.mediaRegistry.require(selectedScope)
  const localSyncAvailable = !!selectedDescriptor.localAdapter?.supportsAutoSync
  const syncScopeOptions = MEDIA_SCOPE_OPTIONS.map((option) => {
    const descriptor = scope.runtime.mediaRegistry.require(option.value)
    return {
      ...option,
      disabled: !descriptor.localAdapter?.supportsAutoSync
    }
  })
  const autoSyncEnabled = readBoolean(
    scope.context.values,
    SETTINGS_NODE_IDS.autoSyncEnabled,
    storedSettings.game.autoSync.enabled
  )
  const selectedItems = readAutoSyncItems(scope.context.values, storedSettings)
  const scoreSyncEnabled = selectedItems.includes('score')

  return defineSettingsPanelTab({
    id: 'sync',
    label: '同步',
    fields: [
      {
        id: 'sync-scope',
        label: '媒体类型',
        orientation: 'horizontal',
        contentLayout: 'inline',
        content: [
          scope.ui.radioGroup({
            id: SETTINGS_NODE_IDS.syncScope,
            initialValue: selectedScope,
            orientation: 'horizontal',
            options: syncScopeOptions,
            onChange(event) {
              return event.refresh('all')
            }
          })
        ]
      },
      {
        id: 'sync-remote-only',
        hidden: localSyncAvailable,
        content: [
          scope.ui.notice({
            id: 'sync-remote-only-notice',
            tone: 'info',
            text: `${selectedDescriptor.label}目前只支持远端预览，不支持本地自动同步。`
          })
        ]
      },
      {
        id: 'auto-sync',
        label: '自动同步',
        description: `本地${selectedDescriptor.label}变化后自动写入 Bangumi 收藏`,
        hidden: !localSyncAvailable,
        content: [
          scope.ui.switch({
            id: SETTINGS_NODE_IDS.autoSyncEnabled,
            initialValue: autoSyncEnabled,
            onChange(event) {
              return event.refresh('all')
            }
          })
        ]
      },
      {
        id: 'auto-sync-items',
        label: '同步项',
        description: `选择自动同步要处理的${selectedDescriptor.label}变化`,
        hidden: !localSyncAvailable,
        disabled: !autoSyncEnabled,
        content: [
          scope.ui.multiSelect({
            id: SETTINGS_NODE_IDS.autoSyncItems,
            initialValue: selectedItems,
            options: AUTO_SYNC_ITEM_OPTIONS,
            onChange(event) {
              return event.refresh('all')
            }
          })
        ]
      },
      {
        id: 'clear-remote-score',
        label: '允许删除远端评分',
        description: '本地评分为空或状态为想玩时删除 Bangumi 收藏中的评分',
        hidden: !localSyncAvailable,
        disabled: !autoSyncEnabled || !scoreSyncEnabled,
        content: [
          scope.ui.checkbox({
            id: SETTINGS_NODE_IDS.clearRemoteScoreWhenEmpty,
            initialValue: storedSettings.game.autoSync.clearRemoteScoreWhenEmpty
          })
        ]
      },
      {
        id: 'changed-items-sync-entry',
        label: '待同步变更',
        description: '手动处理尚未写入 Bangumi 的本地变更',
        hidden: !localSyncAvailable,
        orientation: 'horizontal',
        contentLayout: 'inline',
        content: [
          scope.ui.button({
            id: 'sync-changed-items',
            label: '立即同步',
            tone: 'primary',
            disabled: runningJobs.syncChangedItems,
            async onClick(event) {
              try {
                return await startRootManualJob({
                  commandId: BANGUMI_COMMAND_IDS.syncChangedItems,
                  args: {
                    scope: selectedScope,
                    dryRun: false,
                    limit: 500
                  },
                  event
                })
              } catch (error) {
                return event.fail(toSettingsError(error), { refresh: 'root' })
              }
            }
          })
        ]
      },
      {
        id: 'full-sync-entry',
        label: '全量同步',
        description: `全量同步已绑定 Bangumi ID 的本地${selectedDescriptor.label}`,
        hidden: !localSyncAvailable,
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
