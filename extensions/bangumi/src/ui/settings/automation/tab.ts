import { defineSettingsPanelTab, kisaki, type Automation } from '@kisaki3/extension-sdk'
import type {
  BangumiSettingsRootField,
  BangumiSettingsRootScope,
  BangumiSettingsTab
} from '../contracts'
import { BANGUMI_COMMAND_IDS } from '../shared/jobs'
import { toSettingsError } from '../shared/errors'

const AUTOMATION_FAILURE_POLICY = {
  type: 'retry',
  retryCount: 2,
  retryDelayMs: 60_000
} as const

export async function resolveAutomationTab(
  scope: BangumiSettingsRootScope
): Promise<BangumiSettingsTab> {
  const [storedSettings, automations] = await Promise.all([
    scope.resources.settings(),
    scope.resources.automations()
  ])

  return defineSettingsPanelTab({
    id: 'automation',
    label: '自动化',
    fields: [
      createAutomationField({
        scope,
        id: 'automation-auth-refresh-startup',
        label: '启动时刷新凭据',
        existingAutomation: findAutomation(automations, BANGUMI_COMMAND_IDS.authRefresh),
        create: () =>
          kisaki.automations.create({
            name: 'Bangumi 启动时刷新凭据',
            commandId: BANGUMI_COMMAND_IDS.authRefresh,
            args: {
              forceRefresh: true,
              verifyAccount: true
            },
            enabled: true,
            triggers: { onStartup: true },
            failurePolicy: AUTOMATION_FAILURE_POLICY
          })
      }),
      createAutomationField({
        scope,
        id: 'automation-sync-changed-startup',
        label: '启动后同步变更队列',
        existingAutomation: findAutomation(automations, BANGUMI_COMMAND_IDS.syncChangedItems),
        create: () =>
          kisaki.automations.create({
            name: 'Bangumi 启动后同步变更队列',
            commandId: BANGUMI_COMMAND_IDS.syncChangedItems,
            args: {
              scope: 'game',
              dryRun: false,
              limit: 500
            },
            enabled: true,
            triggers: { onStartup: true },
            failurePolicy: AUTOMATION_FAILURE_POLICY
          })
      }),
      createAutomationField({
        scope,
        id: 'automation-full-sync-daily',
        label: '每日全量同步',
        existingAutomation: findAutomation(automations, BANGUMI_COMMAND_IDS.syncFull),
        create: () =>
          kisaki.automations.create({
            name: 'Bangumi 每日全量同步',
            commandId: BANGUMI_COMMAND_IDS.syncFull,
            args: {
              scope: 'game',
              dryRun: false,
              updateExisting: true,
              playStatusEnabled: storedSettings.game.autoSync.playStatusEnabled,
              scoreEnabled: storedSettings.game.autoSync.scoreEnabled,
              clearRemoteScoreWhenEmpty: storedSettings.game.autoSync.clearRemoteScoreWhenEmpty,
              batchSize: 100
            },
            enabled: true,
            triggers: {
              onStartup: false,
              cron: { expression: '0 4 * * *' }
            },
            failurePolicy: AUTOMATION_FAILURE_POLICY
          })
      })
    ]
  })
}

function createAutomationField({
  scope,
  id,
  label,
  existingAutomation,
  create
}: {
  scope: BangumiSettingsRootScope
  id: string
  label: string
  existingAutomation?: Automation
  create: () => Promise<Automation>
}): BangumiSettingsRootField {
  const { ui } = scope

  return {
    id,
    label,
    orientation: 'horizontal',
    contentLayout: 'inline',
    content: [
      ui.status({
        id: `${id}.status`,
        tone: existingAutomation?.enabled ? 'success' : existingAutomation ? 'warning' : 'neutral',
        value: existingAutomation ? (existingAutomation.enabled ? '已创建' : '已停用') : '未创建'
      }),
      ui.button({
        id: `${id}.create`,
        label: '创建',
        tone: 'primary',
        disabled: !!existingAutomation,
        async onClick(event) {
          try {
            await create()
            return event.success({
              message: `${label}自动化已创建。`,
              refresh: 'root'
            })
          } catch (error) {
            return event.fail(toSettingsError(error), { refresh: 'root' })
          }
        }
      })
    ]
  }
}

function findAutomation(
  automations: readonly Automation[],
  commandId: string
): Automation | undefined {
  return automations.find((automation) => automation.commandId === commandId)
}
