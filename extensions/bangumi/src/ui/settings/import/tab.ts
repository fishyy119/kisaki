import { defineSettingsPanelTab } from '@kisaki/extension-sdk'
import type { BangumiSettingsRootScope, BangumiSettingsTab } from '../contracts'
import { SETTINGS_DIALOG_IDS } from '../ids'

export async function resolveImportTab(
  scope: BangumiSettingsRootScope
): Promise<BangumiSettingsTab> {
  const [profiles, runningJobs] = await Promise.all([
    scope.resources.profiles(),
    scope.resources.runningJobs()
  ])
  const hasProfile = profiles.length > 0

  return defineSettingsPanelTab({
    id: 'import',
    label: '导入',
    fields: [
      {
        id: 'import-my-collections-entry',
        label: '我的收藏',
        orientation: 'horizontal',
        contentLayout: 'inline',
        content: [
          scope.ui.button({
            id: 'open-import-my-collections-dialog',
            label: '配置导入',
            tone: 'primary',
            disabled: !hasProfile || runningJobs.importMyCollections,
            onClick(event) {
              return event.openDialog(SETTINGS_DIALOG_IDS.importMyCollections)
            }
          }),
          scope.ui.notice({
            id: 'import-profile-missing',
            tone: 'warning',
            hidden: hasProfile,
            text: '当前没有可用的游戏 scraper profile，导入命令会被阻止。'
          })
        ]
      },
      {
        id: 'import-index-entry',
        label: '目录导入',
        orientation: 'horizontal',
        contentLayout: 'inline',
        content: [
          scope.ui.button({
            id: 'open-import-index-dialog',
            label: '配置导入',
            tone: 'primary',
            disabled: !hasProfile || runningJobs.importIndex,
            onClick(event) {
              return event.openDialog(SETTINGS_DIALOG_IDS.importIndex)
            }
          })
        ]
      }
    ]
  })
}
