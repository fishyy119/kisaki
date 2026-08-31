import { kisaki } from '@kisaki3/extension-sdk'
import type { MalAutomationKind, MalAutomationState } from '../../shared/settings'
import { m } from '../i18n'
import { MAL_COMMAND_IDS, type MalCommandId } from '../jobs/commands'

const AUTOMATION_FAILURE_POLICY = {
  type: 'retry',
  retryCount: 2,
  retryDelayMs: 60_000
} as const

const AUTOMATION_COMMAND_BY_KIND: Record<MalAutomationKind, MalCommandId> = {
  'auth-check': MAL_COMMAND_IDS.verifyAccount,
  'push-full-daily': MAL_COMMAND_IDS.pushAll,
  'import-refresh-weekly': MAL_COMMAND_IDS.importLists
}

export async function resolveAutomationStates(): Promise<readonly MalAutomationState[]> {
  const automations = await kisaki.automations.list().catch(() => [])

  return (Object.keys(AUTOMATION_COMMAND_BY_KIND) as MalAutomationKind[]).map((kind) => {
    const automation = automations.find(
      (candidate) => candidate.commandId === AUTOMATION_COMMAND_BY_KIND[kind]
    )

    return {
      kind,
      status: automation ? (automation.enabled ? 'enabled' : 'disabled') : 'missing'
    }
  })
}

export async function createMalAutomation(kind: MalAutomationKind): Promise<void> {
  if (kind === 'auth-check') {
    await kisaki.automations.create({
      name: m().automations.names['auth-check'],
      commandId: MAL_COMMAND_IDS.verifyAccount,
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
      commandId: MAL_COMMAND_IDS.pushAll,
      args: {},
      enabled: true,
      triggers: { onStartup: false, cron: { expression: '0 4 * * *' } },
      failurePolicy: AUTOMATION_FAILURE_POLICY
    })
    return
  }

  // Refreshes statuses from the remote lists without creating entries, so it
  // stays safe to run unattended with no profile configuration.
  await kisaki.automations.create({
    name: m().automations.names['import-refresh-weekly'],
    commandId: MAL_COMMAND_IDS.importLists,
    args: {
      lists: ['anime', 'manga'],
      updateExisting: true,
      createMissing: false
    },
    enabled: true,
    triggers: { onStartup: false, cron: { expression: '0 5 * * 1' } },
    failurePolicy: AUTOMATION_FAILURE_POLICY
  })
}
