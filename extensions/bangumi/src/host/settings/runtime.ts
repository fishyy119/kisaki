import type { ExtensionLogger, OAuthRelayFlow } from '@kisaki3/extension-sdk'
import type { AccountService } from '../auth/account'
import type { TokenService } from '../auth/token-service'
import type { BangumiSettingsStore } from '../config/schema'
import type { BangumiJobEvents } from '../jobs/events'
import type { JobRunner } from '../jobs/runner'
import type { MediaRegistry } from '../media/registry'
import type { EpisodeSyncStateStore } from '../sync/episode-state'
import type { SyncStateStore } from '../sync/fingerprint'
import type { SyncQueueStore } from '../sync/queue'

export interface BangumiSettingsRuntime {
  settingsStore: BangumiSettingsStore
  accountService: AccountService
  oauthFlow: OAuthRelayFlow
  tokenService: TokenService
  jobRunner: JobRunner
  jobEvents: BangumiJobEvents
  mediaRegistry: MediaRegistry
  syncStateStore: SyncStateStore
  episodeSyncStateStore: EpisodeSyncStateStore
  syncQueueStore: SyncQueueStore
  logger: ExtensionLogger
  abortSignal: AbortSignal
}
