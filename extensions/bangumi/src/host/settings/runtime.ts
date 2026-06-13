import type { ExtensionLogger } from '@kisaki3/extension-sdk'
import type { AccountService } from '../auth/account'
import type { OAuthFlow } from '../auth/oauth-flow'
import type { TokenService } from '../auth/token-service'
import type { SettingsStore } from '../config/store'
import type { BangumiJobEvents } from '../jobs/events'
import type { JobRunner } from '../jobs/runner'
import type { MediaRegistry } from '../media/registry'
import type { SyncStateStore } from '../sync/fingerprint'
import type { SyncQueueStore } from '../sync/queue'

export interface BangumiSettingsRuntime {
  settingsStore: SettingsStore
  accountService: AccountService
  oauthFlow: OAuthFlow
  tokenService: TokenService
  jobRunner: JobRunner
  jobEvents: BangumiJobEvents
  mediaRegistry: MediaRegistry
  syncStateStore: SyncStateStore
  syncQueueStore: SyncQueueStore
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
