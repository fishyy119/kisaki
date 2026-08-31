import { kisaki } from '@kisaki3/extension-sdk'
import type { SteamAutomationKind, SteamAutomationState } from '../../shared/settings'
import { m } from '../i18n'
import { STEAM_COMMAND_IDS, type SteamCommandId } from '../jobs/commands'
import { SteamExtensionError } from '../utils/errors'

const AUTOMATION_FAILURE_POLICY = {
  type: 'retry',
  retryCount: 2,
  retryDelayMs: 60_000
} as const

const AUTOMATION_COMMAND_BY_KIND: Record<SteamAutomationKind, SteamCommandId> = {
  'auth-check': STEAM_COMMAND_IDS.verifyAccount,
  'import-refresh-weekly': STEAM_COMMAND_IDS.importOwned
}

export async function resolveAutomationStates(): Promise<readonly SteamAutomationState[]> {
  const automations = await kisaki.automations.list().catch(() => [])

  return (Object.keys(AUTOMATION_COMMAND_BY_KIND) as SteamAutomationKind[]).map((kind) => {
    const automation = automations.find(
      (candidate) => candidate.commandId === AUTOMATION_COMMAND_BY_KIND[kind]
    )

    return {
      kind,
      status: automation ? (automation.enabled ? 'enabled' : 'disabled') : 'missing'
    }
  })
}

export async function createSteamAutomation(kind: SteamAutomationKind): Promise<void> {
  if (kind === 'auth-check') {
    await kisaki.automations.create({
      name: m().automations.names['auth-check'],
      commandId: STEAM_COMMAND_IDS.verifyAccount,
      args: {},
      enabled: true,
      triggers: { onStartup: true },
      failurePolicy: AUTOMATION_FAILURE_POLICY
    })
    return
  }

  // The import creates entries, so the template bakes in a game profile; the
  // args stay editable on the app automation page afterwards.
  const profiles = await kisaki.scrapers.profiles.list({ mediaType: 'game' })
  const profile = profiles[0]
  if (!profile) {
    throw new SteamExtensionError('profile_required', m().errors.profileRequired)
  }

  await kisaki.automations.create({
    name: m().automations.names['import-refresh-weekly'],
    commandId: STEAM_COMMAND_IDS.importOwned,
    args: { profileId: profile.id },
    enabled: true,
    triggers: { onStartup: false, cron: { expression: '0 5 * * 1' } },
    failurePolicy: AUTOMATION_FAILURE_POLICY
  })
}
