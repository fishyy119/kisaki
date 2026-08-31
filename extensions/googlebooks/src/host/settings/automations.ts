import { kisaki } from '@kisaki3/extension-sdk'
import type { GbooksAutomationKind, GbooksAutomationState } from '../../shared/settings'
import { m } from '../i18n'
import { GBOOKS_COMMAND_IDS, type GbooksCommandId } from '../jobs/commands'

const AUTOMATION_FAILURE_POLICY = {
  type: 'retry',
  retryCount: 2,
  retryDelayMs: 60_000
} as const

const AUTOMATION_COMMAND_BY_KIND: Record<GbooksAutomationKind, GbooksCommandId> = {
  'import-refresh-weekly': GBOOKS_COMMAND_IDS.importLibrary
}

export async function resolveAutomationStates(): Promise<readonly GbooksAutomationState[]> {
  const automations = await kisaki.automations.list().catch(() => [])

  return (Object.keys(AUTOMATION_COMMAND_BY_KIND) as GbooksAutomationKind[]).map((kind) => {
    const automation = automations.find(
      (candidate) => candidate.commandId === AUTOMATION_COMMAND_BY_KIND[kind]
    )

    return {
      kind,
      status: automation ? (automation.enabled ? 'enabled' : 'disabled') : 'missing'
    }
  })
}

// Refreshes statuses from the remote library without creating entries, so it
// stays safe to run unattended with no profile configuration.
export async function createGbooksAutomation(kind: GbooksAutomationKind): Promise<void> {
  if (kind !== 'import-refresh-weekly') {
    return
  }

  await kisaki.automations.create({
    name: m().automations.names['import-refresh-weekly'],
    commandId: GBOOKS_COMMAND_IDS.importLibrary,
    args: {
      includeEbooks: true,
      includeReadingShelves: true,
      updateExisting: true,
      createMissing: false,
      mergeSeries: true
    },
    enabled: true,
    triggers: { onStartup: false, cron: { expression: '0 5 * * 1' } },
    failurePolicy: AUTOMATION_FAILURE_POLICY
  })
}
