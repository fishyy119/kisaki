import { defineSettingsPanel, type EmptySettingsPanelPopoverMap } from '@kisaki/extension-sdk'
import type { AccountService } from '../auth/account'
import type { OAuthFlow } from '../auth/oauth-flow'
import type { TokenService } from '../auth/token-service'
import type { SettingsStore } from '../config/store'
import { createAccountFields } from './account'
import { createAdvancedFields, readSettingsForm } from './advanced'
import { createAutomationFields, listBangumiAutomationTasks } from './automation'
import {
  createMyCollectionsDialogFields,
  createMyCollectionsImportFields,
  submitMyCollectionsDialog
} from './import/collections-dialog'
import {
  createIndexDialogFields,
  createIndexImportFields,
  submitIndexDialog
} from './import/index-dialog'
import { createFullSyncDialogFields, submitFullSyncDialog } from './sync/full-dialog'
import { createSyncFields } from './sync/root-fields'
import { DIALOG_IDS, NODE_IDS } from './common/constants'
import { BANGUMI_COMMAND_IDS, isBangumiCommandRunning, resolveRunningJobs } from './common/jobs'
import { PreviewResultRegistry } from './common/preview'
import { listGameScraperProfiles } from './common/profiles'
import { readBoolean } from './common/values'
import type { BangumiSettingsDialogMap } from './common/types'

interface BangumiSettingsPanelDependencies {
  settingsStore: SettingsStore
  accountService: AccountService
  oauthFlow: OAuthFlow
  tokenService: TokenService
}

export function createBangumiSettingsPanel({
  settingsStore,
  accountService,
  oauthFlow,
  tokenService
}: BangumiSettingsPanelDependencies) {
  const previewRegistry = new PreviewResultRegistry()

  return defineSettingsPanel<EmptySettingsPanelPopoverMap, BangumiSettingsDialogMap>({
    id: 'settings',
    title: 'Bangumi',
    submitLabel: '保存设置',
    dialogs: {
      [DIALOG_IDS.fullSync]: {
        title: '全量同步',
        size: 'lg',
        submitLabel: '执行同步',
        async resolve(context, settings) {
          const [storedSettings, isRunning] = await Promise.all([
            settingsStore.get(),
            isBangumiCommandRunning(BANGUMI_COMMAND_IDS.syncFull)
          ])
          return {
            fields: createFullSyncDialogFields({
              settings,
              values: context.values,
              storedSettings,
              previewRegistry,
              sessionId: context.sessionId,
              isRunning
            })
          }
        },
        async submit(event) {
          return submitFullSyncDialog({
            event,
            storedSettings: await settingsStore.get()
          })
        }
      },
      [DIALOG_IDS.importMyCollections]: {
        title: '导入我的收藏',
        size: 'lg',
        submitLabel: '导入',
        async resolve(context, settings) {
          const [profiles, isRunning] = await Promise.all([
            listGameScraperProfiles(),
            isBangumiCommandRunning(BANGUMI_COMMAND_IDS.importMyCollections)
          ])
          return {
            fields: createMyCollectionsDialogFields({
              settings,
              values: context.values,
              profiles,
              previewRegistry,
              sessionId: context.sessionId,
              isRunning
            })
          }
        },
        async submit(event) {
          return submitMyCollectionsDialog({
            event,
            profiles: await listGameScraperProfiles()
          })
        }
      },
      [DIALOG_IDS.importIndex]: {
        title: '导入目录',
        size: 'lg',
        submitLabel: '导入',
        async resolve(context, settings) {
          const [profiles, isRunning] = await Promise.all([
            listGameScraperProfiles(),
            isBangumiCommandRunning(BANGUMI_COMMAND_IDS.importIndex)
          ])
          return {
            fields: createIndexDialogFields({
              settings,
              values: context.values,
              profiles,
              previewRegistry,
              sessionId: context.sessionId,
              isRunning
            })
          }
        },
        async submit(event) {
          return submitIndexDialog({
            event,
            profiles: await listGameScraperProfiles()
          })
        }
      }
    },
    async resolve(context, settings) {
      const [storedSettings, tokenState, account, profiles, runningJobs, automationTasks] =
        await Promise.all([
          settingsStore.get(),
          tokenService.getStoredTokenState(),
          accountService.getAccountSnapshot(),
          listGameScraperProfiles(),
          resolveRunningJobs(),
          listBangumiAutomationTasks()
        ])
      const autoSyncEnabled = readBoolean(
        context.values,
        NODE_IDS.autoSyncEnabled,
        storedSettings.autoSync.enabled
      )

      return {
        size: 'lg',
        tabs: [
          {
            id: 'account',
            label: '账号',
            fields: createAccountFields({
              settings,
              tokenState,
              account,
              accountService,
              oauthFlow,
              isRefreshRunning: runningJobs.accountRefresh
            })
          },
          {
            id: 'sync',
            label: '同步',
            fields: createSyncFields({
              settings,
              values: context.values,
              storedSettings,
              isFullSyncRunning: runningJobs.syncFull
            })
          },
          {
            id: 'import',
            label: '导入',
            fields: [
              ...createMyCollectionsImportFields({
                settings,
                profiles,
                isRunning: runningJobs.importMyCollections
              }),
              ...createIndexImportFields({
                settings,
                profiles,
                isRunning: runningJobs.importIndex
              })
            ]
          },
          {
            id: 'automation',
            label: '自动化',
            fields: createAutomationFields({
              settings,
              storedSettings,
              tasks: automationTasks
            })
          },
          {
            id: 'advanced',
            label: '高级',
            fields: createAdvancedFields({
              settings,
              storedSettings,
              settingsStore,
              autoSyncEnabled
            })
          }
        ]
      }
    },
    async submit(event) {
      const current = await settingsStore.get()
      await settingsStore.set(readSettingsForm(event.values, current))
      return event.success({ message: 'Bangumi 设置已保存。', refresh: 'root' })
    }
  })
}
