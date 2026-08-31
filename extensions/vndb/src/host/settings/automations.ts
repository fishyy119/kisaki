import { kisaki } from '@kisaki3/extension-sdk'
import type { VndbAutomationKind, VndbAutomationState } from '../../shared/settings'
import { m } from '../i18n'
import { VNDB_COMMAND_IDS, type VndbCommandId } from '../jobs/commands'

const AUTOMATION_FAILURE_POLICY = {
  type: 'retry',
  retryCount: 2,
  retryDelayMs: 60_000
} as const

const AUTOMATION_COMMAND_BY_KIND: Record<VndbAutomationKind, VndbCommandId> = {
  'auth-check': VNDB_COMMAND_IDS.verifyAccount,
  'push-full-daily': VNDB_COMMAND_IDS.pushAll,
  'import-refresh-weekly': VNDB_COMMAND_IDS.importList
}

export async function resolveAutomationStates(): Promise<readonly VndbAutomationState[]> {
  const automations = await kisaki.automations.list().catch(() => [])

  return (Object.keys(AUTOMATION_COMMAND_BY_KIND) as VndbAutomationKind[]).map((kind) => {
    const automation = automations.find(
      (candidate) => candidate.commandId === AUTOMATION_COMMAND_BY_KIND[kind]
    )

    return {
      kind,
      status: automation ? (automation.enabled ? 'enabled' : 'disabled') : 'missing'
    }
  })
}

export async function createVndbAutomation(kind: VndbAutomationKind): Promise<void> {
  if (kind === 'auth-check') {
    await kisaki.automations.create({
      name: m().automations.names['auth-check'],
      commandId: VNDB_COMMAND_IDS.verifyAccount,
      args: {},
      enabled: true,
      triggers: { onStartup: true },
      failurePolicy: AUTOMATION_FAILURE_POLICY
    })
    return
  }

  if (kind === 'push-full-daily') {
    await kisaki.automations.create({
      name: m().automations.names['push-full-daily'],
      commandId: VNDB_COMMAND_IDS.pushAll,
      args: {},
      enabled: true,
      triggers: { onStartup: false, cron: { expression: '0 4 * * *' } },
      failurePolicy: AUTOMATION_FAILURE_POLICY
    })
    return
  }

  // Refreshes statuses from the remote list without creating entries, so it
  // stays safe to run unattended with no profile configuration.
  await kisaki.automations.create({
    name: m().automations.names['import-refresh-weekly'],
    commandId: VNDB_COMMAND_IDS.importList,
    args: {
      updateExisting: true,
      createMissing: false
    },
    enabled: true,
    triggers: { onStartup: false, cron: { expression: '0 5 * * 1' } },
    failurePolicy: AUTOMATION_FAILURE_POLICY
  })
}
