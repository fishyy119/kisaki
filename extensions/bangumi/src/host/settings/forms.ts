import type { JsonObject } from '@kisaki3/extension-sdk'
import type { BangumiSettingsV1 } from '../config/schema'
import type {
  BangumiFullSyncFormArgs,
  BangumiImportCollectionsFormArgs,
  BangumiImportIndexFormArgs,
  BangumiSettingsFormState
} from '../../shared/settings'

export function toFormState(settings: BangumiSettingsV1): BangumiSettingsFormState {
  const autoSync = settings.autoSync

  return {
    autoSyncEnabled: autoSync.enabled,
    autoSyncItems: [
      ...(autoSync.syncOnCreate ? (['create'] as const) : []),
      ...(autoSync.playStatusEnabled ? (['status'] as const) : []),
      ...(autoSync.scoreEnabled ? (['score'] as const) : []),
      ...(autoSync.unitProgressEnabled ? (['unitProgress'] as const) : [])
    ],
    clearRemoteScoreWhenEmpty: autoSync.clearRemoteScoreWhenEmpty,
    loginTimeoutMinutes: Math.round(settings.auth.loginTimeoutMs / 60_000),
    rateLimitMaxRequests: settings.client.rateLimit.maxRequests,
    rateLimitWindowSeconds: Math.round(settings.client.rateLimit.windowMs / 1000),
    timeoutSeconds: Math.round(settings.client.timeoutMs / 1000),
    retryCount: settings.client.retryCount,
    debounceSeconds: settings.autoSync.debounceMs / 1000,
    notifyErrors: autoSync.notifyErrors
  }
}

export function applyFormState(
  current: BangumiSettingsV1,
  form: BangumiSettingsFormState
): BangumiSettingsV1 {
  return {
    ...current,
    auth: {
      loginTimeoutMs: form.loginTimeoutMinutes * 60_000
    },
    autoSync: {
      ...current.autoSync,
      enabled: form.autoSyncEnabled,
      syncOnCreate: form.autoSyncItems.includes('create'),
      playStatusEnabled: form.autoSyncItems.includes('status'),
      scoreEnabled: form.autoSyncItems.includes('score'),
      unitProgressEnabled: form.autoSyncItems.includes('unitProgress'),
      clearRemoteScoreWhenEmpty: form.clearRemoteScoreWhenEmpty,
      debounceMs: Math.round(form.debounceSeconds * 1000),
      notifyErrors: form.notifyErrors
    },
    client: {
      rateLimit: {
        maxRequests: form.rateLimitMaxRequests,
        windowMs: form.rateLimitWindowSeconds * 1000
      },
      timeoutMs: form.timeoutSeconds * 1000,
      retryCount: form.retryCount
    }
  }
}

export function toFullSyncArgs(args: BangumiFullSyncFormArgs): JsonObject {
  return {
    scope: args.scope,
    updateExisting: args.updateExisting,
    playStatusEnabled: args.items.includes('status'),
    scoreEnabled: args.items.includes('score'),
    unitProgressEnabled: args.items.includes('unitProgress'),
    clearRemoteScoreWhenEmpty: args.clearRemoteScoreWhenEmpty,
    batchSize: args.batchSize
  }
}

export function toImportCollectionsArgs(args: BangumiImportCollectionsFormArgs): JsonObject {
  return {
    scope: args.scope,
    profileId: args.profileId,
    collectionTypes: [...args.collectionTypes],
    fields: {
      status: args.dataItems.includes('status'),
      score: args.dataItems.includes('score'),
      tags: args.dataItems.includes('tags'),
      unitProgress: args.dataItems.includes('unitProgress')
    },
    patchExisting: args.patchExisting,
    targetCollection: args.targetCollectionId
      ? { kind: 'existing', collectionId: args.targetCollectionId }
      : { kind: 'none' }
  }
}

export function toImportIndexArgs(args: BangumiImportIndexFormArgs): JsonObject {
  return {
    scope: args.scope,
    profileId: args.profileId,
    indexInput: args.indexInput,
    patchExisting: args.patchExisting,
    targetCollection:
      args.targetCollectionMode === 'existing'
        ? { kind: 'existing', collectionId: args.targetCollectionId ?? '' }
        : { kind: args.targetCollectionMode }
  }
}
