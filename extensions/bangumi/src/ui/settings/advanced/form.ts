import type { BangumiSettingsV1 } from '../../../config/schema'
import { SETTINGS_NODE_IDS } from '../ids'
import { createAutoSyncFlags, readAutoSyncItems } from '../sync/options'
import { readBoolean, readNumber } from '../shared/values'

export function readSettingsForm(
  values: Record<string, unknown>,
  current: BangumiSettingsV1
): BangumiSettingsV1 {
  const autoSyncFlags = createAutoSyncFlags(readAutoSyncItems(values, current))

  return {
    version: 1,
    auth: {
      loginTimeoutMs:
        readNumber(
          values,
          SETTINGS_NODE_IDS.loginTimeoutMinutes,
          current.auth.loginTimeoutMs / 60_000
        ) * 60_000
    },
    media: current.media,
    game: {
      autoSync: {
        ...current.game.autoSync,
        enabled: readBoolean(
          values,
          SETTINGS_NODE_IDS.autoSyncEnabled,
          current.game.autoSync.enabled
        ),
        ...autoSyncFlags,
        clearRemoteScoreWhenEmpty: readBoolean(
          values,
          SETTINGS_NODE_IDS.clearRemoteScoreWhenEmpty,
          current.game.autoSync.clearRemoteScoreWhenEmpty
        ),
        debounceMs:
          readNumber(
            values,
            SETTINGS_NODE_IDS.debounceSeconds,
            current.game.autoSync.debounceMs / 1000
          ) * 1000,
        notifyErrors: readBoolean(
          values,
          SETTINGS_NODE_IDS.autoSyncNotifyErrors,
          current.game.autoSync.notifyErrors
        )
      }
    },
    client: {
      rateLimit: {
        maxRequests: readNumber(
          values,
          SETTINGS_NODE_IDS.rateLimitMaxRequests,
          current.client.rateLimit.maxRequests
        ),
        windowMs:
          readNumber(
            values,
            SETTINGS_NODE_IDS.rateLimitWindowSeconds,
            current.client.rateLimit.windowMs / 1000
          ) * 1000
      },
      timeoutMs:
        readNumber(values, SETTINGS_NODE_IDS.timeoutSeconds, current.client.timeoutMs / 1000) *
        1000,
      retryCount: readNumber(values, SETTINGS_NODE_IDS.retryCount, current.client.retryCount)
    }
  }
}
