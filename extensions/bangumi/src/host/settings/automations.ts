import { kisaki } from '@kisaki3/extension-sdk'
import { BANGUMI_COMMAND_IDS, type BangumiCommandId } from '../jobs/commands'
import type { SettingsStore } from '../config/store'
import type { BangumiAutomationKind, BangumiAutomationState } from '../../shared/settings'

const AUTOMATION_FAILURE_POLICY = {
  type: 'retry',
  retryCount: 2,
  retryDelayMs: 60_000
} as const

const AUTOMATION_COMMAND_BY_KIND: Record<BangumiAutomationKind, BangumiCommandId> = {
  'auth-refresh': BANGUMI_COMMAND_IDS.authRefresh,
  'sync-changed': BANGUMI_COMMAND_IDS.syncChangedItems,
  'sync-full-daily': BANGUMI_COMMAND_IDS.syncFull
}

export async function resolveAutomationStates(): Promise<readonly BangumiAutomationState[]> {
  const automations = await kisaki.automations.list().catch(() => [])

  return (Object.keys(AUTOMATION_COMMAND_BY_KIND) as BangumiAutomationKind[]).map((kind) => {
    const automation = automations.find(
      (candidate) => candidate.commandId === AUTOMATION_COMMAND_BY_KIND[kind]
    )

    return {
      kind,
      status: automation ? (automation.enabled ? 'enabled' : 'disabled') : 'missing'
    }
  })
}

export async function createBangumiAutomation(
  settingsStore: SettingsStore,
  kind: BangumiAutomationKind
): Promise<void> {
  if (kind === 'auth-refresh') {
    await kisaki.automations.create({
      name: 'Bangumi 启动时刷新凭据',
      commandId: BANGUMI_COMMAND_IDS.authRefresh,
      args: { forceRefresh: true, verifyAccount: true },
      enabled: true,
      triggers: { onStartup: true },
      failurePolicy: AUTOMATION_FAILURE_POLICY
    })
    return
  }

  if (kind === 'sync-changed') {
    await kisaki.automations.create({
      name: 'Bangumi 启动后同步变更队列',
      commandId: BANGUMI_COMMAND_IDS.syncChangedItems,
      args: { scope: 'game', limit: 500 },
      enabled: true,
      triggers: { onStartup: true },
      failurePolicy: AUTOMATION_FAILURE_POLICY
    })
    return
  }

  const settings = await settingsStore.get()
  await kisaki.automations.create({
    name: 'Bangumi 每日全量同步',
    commandId: BANGUMI_COMMAND_IDS.syncFull,
    args: {
      scope: 'game',
      updateExisting: true,
      playStatusEnabled: settings.game.autoSync.playStatusEnabled,
      scoreEnabled: settings.game.autoSync.scoreEnabled,
      clearRemoteScoreWhenEmpty: settings.game.autoSync.clearRemoteScoreWhenEmpty,
      batchSize: 100
    },
    enabled: true,
    triggers: { onStartup: false, cron: { expression: '0 4 * * *' } },
    failurePolicy: AUTOMATION_FAILURE_POLICY
  })
}
