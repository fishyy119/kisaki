import { defineSettingsPanelTab } from '@kisaki/extension-sdk'
import type { BangumiSettingsRootScope, BangumiSettingsTab } from '../contracts'
import { SETTINGS_DIALOG_IDS, SETTINGS_NODE_IDS } from '../ids'
import { readString } from '../shared/values'

export async function resolveImportTab(
  scope: BangumiSettingsRootScope
): Promise<BangumiSettingsTab> {
  const [profiles, runningJobs] = await Promise.all([
    scope.resources.profiles(),
    scope.resources.runningJobs()
  ])
  const hasProfile = profiles.length > 0
  const indexInput = readString(scope.context.values, SETTINGS_NODE_IDS.importIndexInput, '')
  const hasIndexInput = indexInput.trim().length > 0

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
            disabled: runningJobs.importCollections,
            onClick(event) {
              return event.openDialog(SETTINGS_DIALOG_IDS.importCollections)
            }
          }),
          scope.ui.notice({
            id: 'import-profile-missing',
            tone: 'warning',
            hidden: hasProfile,
            text: '当前没有可用的游戏刮削配置，导入命令会被阻止。'
          })
        ]
      },
      {
        id: 'import-index-entry',
        label: '目录导入',
        orientation: 'horizontal',
        contentLayout: 'inline',
        content: [
          scope.ui.textInput({
            id: SETTINGS_NODE_IDS.importIndexInput,
            initialValue: indexInput,
            placeholder: 'Bangumi 目录 ID 或链接',
            inputMode: 'url',
            grow: true,
            onChange(event) {
              return event.refresh('root')
            }
          }),
          scope.ui.button({
            id: 'import-index',
            label: '导入',
            tone: 'primary',
            disabled: !hasIndexInput || runningJobs.importIndex,
            onClick(event) {
              return event.openDialog(SETTINGS_DIALOG_IDS.importIndex)
            }
          })
        ]
      }
    ]
  })
}
