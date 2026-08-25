import { resolveActiveBangumiJobs } from '../jobs/status'
import type {
  BangumiOptionItem,
  BangumiScopeOption,
  BangumiSettingsOverview
} from '../../shared/settings'
import { m } from '../i18n'
import type { LocalMediaAdapter } from '../media/types'
import { resolveAutomationStates } from './automations'
import { toFormState } from './forms'
import type { BangumiSettingsRuntime } from './runtime'

export async function resolveSettingsOverview(
  runtime: BangumiSettingsRuntime
): Promise<BangumiSettingsOverview> {
  const [settings, tokenState, account, activeJobs, scopes, collections, automations] =
    await Promise.all([
      runtime.settingsStore.get(),
      runtime.tokenService.getStoredTokenState(),
      runtime.accountService.getAccountSnapshot(),
      resolveActiveBangumiJobs(),
      listScopes(runtime),
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
    scopes,
    collections,
    automations
  }
}

/** Scopes the user can run local jobs against, in registration order. */
async function listScopes(runtime: BangumiSettingsRuntime): Promise<BangumiScopeOption[]> {
  const adapters = runtime.mediaRegistry.listLocalAdapters()

  return Promise.all(
    adapters.map(async (adapter) => ({
      scope: adapter.scope,
      label: m().media.scopes[adapter.scope],
      supportsUnitProgress: adapter.supportsUnitProgress === true,
      profiles: await listProfiles(adapter)
    }))
  )
}

async function listProfiles(adapter: LocalMediaAdapter): Promise<BangumiOptionItem[]> {
  try {
    const profiles = (await adapter.listProfiles?.()) ?? []
    return profiles.map((profile) => ({ value: profile.id, label: profile.name }))
  } catch {
    return []
  }
}

async function listCollections(runtime: BangumiSettingsRuntime): Promise<BangumiOptionItem[]> {
  const adapter = runtime.mediaRegistry.listLocalAdapters()[0]
  if (!adapter) {
    return []
  }

  try {
    const collections = (await adapter.listCollections?.()) ?? []
    return collections.map((collection) => ({ value: collection.id, label: collection.name }))
  } catch {
    return []
  }
}
