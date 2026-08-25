import type { BangumiSettingsV1 } from './schema'

export const DEFAULT_BANGUMI_SETTINGS: BangumiSettingsV1 = {
  version: 1,
  auth: {
    loginTimeoutMs: 10 * 60 * 1000
  },
  media: {
    book: {
      enabled: true,
      localSyncEnabled: true
    },
    game: {
      enabled: true,
      localSyncEnabled: true
    },
    anime: {
      enabled: true,
      localSyncEnabled: true
    },
    music: {
      enabled: true,
      localSyncEnabled: false
    }
  },
  autoSync: {
    enabled: false,
    syncOnCreate: false,
    playStatusEnabled: true,
    scoreEnabled: true,
    episodeStatusEnabled: true,
    clearRemoteScoreWhenEmpty: false,
    debounceMs: 3000,
    notifyErrors: true,
    statusToBangumi: {
      game: {
        notStarted: 1,
        inProgress: 3,
        partial: 3,
        completed: 2,
        multiple: 2,
        shelved: 4
      },
      anime: {
        planned: 1,
        watching: 3,
        completed: 2,
        onHold: 4,
        dropped: 5
      },
      book: {
        planned: 1,
        reading: 3,
        completed: 2,
        onHold: 4,
        dropped: 5
      }
    }
  },
  client: {
    rateLimit: {
      maxRequests: 120,
      windowMs: 60_000
    },
    timeoutMs: 30_000,
    retryCount: 3
  }
}

export function createDefaultBangumiSettings(): BangumiSettingsV1 {
  return structuredClone(DEFAULT_BANGUMI_SETTINGS)
}
