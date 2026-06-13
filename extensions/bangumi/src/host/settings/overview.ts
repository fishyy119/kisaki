import { resolveActiveBangumiJobs } from '../jobs/status'
import type { BangumiOptionItem, BangumiSettingsOverview } from '../../shared/settings'
import { resolveAutomationStates } from './automations'
import { toFormState } from './forms'
import type { BangumiSettingsRuntime } from './runtime'

export async function resolveSettingsOverview(
  runtime: BangumiSettingsRuntime
): Promise<BangumiSettingsOverview> {
  const [settings, tokenState, account, activeJobs, profiles, collections, automations] =
    await Promise.all([
      runtime.settingsStore.get(),
      runtime.tokenService.getStoredTokenState(),
      runtime.accountService.getAccountSnapshot(),
      resolveActiveBangumiJobs(),
      listProfiles(runtime),
      listCollections(runtime),
      resolveAutomationStates()
    ])

  return {
    form: toFormState(settings),
    account: {
      loggedIn: Boolean(account && tokenState.hasToken),
      nickname: account?.nickname ?? null,
      username: account?.username ?? null,
      hasToken: tokenState.hasToken,
      hasRefreshToken: tokenState.hasRefreshToken,
      expiresAt: tokenState.expiresAt ?? null,
      expired: tokenState.expired
    },
    activeJobs,
    profiles,
    collections,
    automations
  }
}

async function listProfiles(runtime: BangumiSettingsRuntime): Promise<BangumiOptionItem[]> {
  try {
    const profiles = (await runtime.mediaRegistry.getLocalAdapter('game')?.listProfiles?.()) ?? []
    return profiles.map((profile) => ({ value: profile.id, label: profile.name }))
  } catch {
    return []
  }
}

async function listCollections(runtime: BangumiSettingsRuntime): Promise<BangumiOptionItem[]> {
  try {
    const collections =
      (await runtime.mediaRegistry.getLocalAdapter('game')?.listCollections?.()) ?? []
    return collections.map((collection) => ({ value: collection.id, label: collection.name }))
  } catch {
    return []
  }
}
