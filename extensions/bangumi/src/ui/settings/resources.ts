import type { BangumiAccountSnapshotV1 } from '../../auth/account'
import type { StoredTokenState } from '../../auth/token-service'
import type { BangumiSettingsV1 } from '../../config/schema'
import type { Automation, ScraperProfileSummary } from '@kisaki3/extension-sdk'
import type { BangumiCommandId } from '../../jobs/commands'
import type { LocalCollectionSummary } from '../../media/types'
import { listBangumiAutomations } from './automation/automations'
import type { BangumiSettingsRuntime } from './runtime'
import { isBangumiCommandActive, resolveActiveJobs, type BangumiActiveJobs } from './shared/jobs'

export interface BangumiSettingsResources {
  settings(): Promise<BangumiSettingsV1>
  tokenState(): Promise<StoredTokenState>
  account(): Promise<BangumiAccountSnapshotV1 | undefined>
  profiles(): Promise<readonly ScraperProfileSummary[]>
  collections(): Promise<readonly LocalCollectionSummary[]>
  activeJobs(): Promise<BangumiActiveJobs>
  isCommandActive(commandId: BangumiCommandId): Promise<boolean>
  automations(): Promise<readonly Automation[]>
}

export function createSettingsResources(runtime: BangumiSettingsRuntime): BangumiSettingsResources {
  const settings = once(() => runtime.settingsStore.get())
  const tokenState = once(() => runtime.tokenService.getStoredTokenState())
  const account = once(() => runtime.accountService.getAccountSnapshot())
  const profiles = once(() => listScraperProfiles(runtime))
  const collections = once(() => listStaticCollections(runtime))
  const activeJobs = once(() => resolveActiveJobs())
  const automations = once(() => listBangumiAutomations())

  return {
    settings,
    tokenState,
    account,
    profiles,
    collections,
    activeJobs,
    isCommandActive: isBangumiCommandActive,
    automations
  }
}

async function listScraperProfiles(
  runtime: BangumiSettingsRuntime
): Promise<readonly ScraperProfileSummary[]> {
  try {
    return (await runtime.mediaRegistry.getLocalAdapter('game')?.listProfiles?.()) ?? []
  } catch {
    return []
  }
}

async function listStaticCollections(
  runtime: BangumiSettingsRuntime
): Promise<readonly LocalCollectionSummary[]> {
  try {
    return (await runtime.mediaRegistry.getLocalAdapter('game')?.listCollections?.()) ?? []
  } catch {
    return []
  }
}

function once<T>(resolve: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined

  return () => {
    promise ??= resolve()
    return promise
  }
}
