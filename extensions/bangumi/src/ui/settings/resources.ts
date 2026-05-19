import type { BangumiAccountSnapshotV1 } from '../../auth/account'
import type { StoredTokenState } from '../../auth/token-service'
import type { BangumiSettingsV1 } from '../../config/schema'
import type { BackgroundTask, ScraperProfileSummary } from '@kisaki/extension-sdk'
import type { BangumiCommandId } from '../../jobs/commands'
import { listBangumiAutomationTasks } from './automation/tasks'
import type { BangumiSettingsRuntime } from './runtime'
import { isBangumiCommandRunning, resolveRunningJobs, type BangumiRunningJobs } from './shared/jobs'
import { listGameScraperProfiles } from './shared/profiles'

export interface BangumiSettingsResources {
  settings(): Promise<BangumiSettingsV1>
  tokenState(): Promise<StoredTokenState>
  account(): Promise<BangumiAccountSnapshotV1 | undefined>
  profiles(): Promise<readonly ScraperProfileSummary[]>
  runningJobs(): Promise<BangumiRunningJobs>
  isCommandRunning(commandId: BangumiCommandId): Promise<boolean>
  automationTasks(): Promise<readonly BackgroundTask[]>
}

export function createSettingsResources(runtime: BangumiSettingsRuntime): BangumiSettingsResources {
  const settings = once(() => runtime.settingsStore.get())
  const tokenState = once(() => runtime.tokenService.getStoredTokenState())
  const account = once(() => runtime.accountService.getAccountSnapshot())
  const profiles = once(() => listGameScraperProfiles())
  const runningJobs = once(() => resolveRunningJobs())
  const automationTasks = once(() => listBangumiAutomationTasks())

  return {
    settings,
    tokenState,
    account,
    profiles,
    runningJobs,
    isCommandRunning: isBangumiCommandRunning,
    automationTasks
  }
}

function once<T>(resolve: () => Promise<T>): () => Promise<T> {
  let promise: Promise<T> | undefined

  return () => {
    promise ??= resolve()
    return promise
  }
}
