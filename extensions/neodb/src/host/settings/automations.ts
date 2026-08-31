import { kisaki } from '@kisaki3/extension-sdk'
import type { NeodbAutomationKind, NeodbAutomationState } from '../../shared/settings'
import { m } from '../i18n'
import { NEODB_COMMAND_IDS, type NeodbCommandId } from '../jobs/commands'

const AUTOMATION_FAILURE_POLICY = {
  type: 'retry',
  retryCount: 2,
  retryDelayMs: 60_000
} as const

const AUTOMATION_COMMAND_BY_KIND: Record<NeodbAutomationKind, NeodbCommandId> = {
  'auth-check': NEODB_COMMAND_IDS.verifyAccount,
  'push-full-daily': NEODB_COMMAND_IDS.pushAll,
  'import-refresh-weekly': NEODB_COMMAND_IDS.importShelf
}

export async function resolveAutomationStates(): Promise<readonly NeodbAutomationState[]> {
  const automations = await kisaki.automations.list().catch(() => [])

  return (Object.keys(AUTOMATION_COMMAND_BY_KIND) as NeodbAutomationKind[]).map((kind) => {
    const automation = automations.find(
      (candidate) => candidate.commandId === AUTOMATION_COMMAND_BY_KIND[kind]
    )

    return {
      kind,
      status: automation ? (automation.enabled ? 'enabled' : 'disabled') : 'missing'
    }
  })
}

export async function createNeodbAutomation(kind: NeodbAutomationKind): Promise<void> {
  if (kind === 'auth-check') {
    await kisaki.automations.create({
      name: m().automations.names['auth-check'],
      commandId: NEODB_COMMAND_IDS.verifyAccount,
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
      commandId: NEODB_COMMAND_IDS.pushAll,
      args: {},
      enabled: true,
      triggers: { onStartup: false, cron: { expression: '0 4 * * *' } },
      failurePolicy: AUTOMATION_FAILURE_POLICY
    })
    return
  }

  // Refreshes statuses from the remote shelf without creating entries, so it
  // stays safe to run unattended with no profile configuration.
  await kisaki.automations.create({
    name: m().automations.names['import-refresh-weekly'],
    commandId: NEODB_COMMAND_IDS.importShelf,
    args: {
      updateExisting: true,
      createMissing: false
    },
    enabled: true,
    triggers: { onStartup: false, cron: { expression: '0 5 * * 1' } },
    failurePolicy: AUTOMATION_FAILURE_POLICY
  })
}
