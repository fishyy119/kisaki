export const SETTINGS_NODE_IDS = {
  loginTimeoutMinutes: 'auth.loginTimeoutMinutes',
  autoSyncEnabled: 'autoSync.enabled',
  autoSyncItems: 'autoSync.items',
  clearRemoteScoreWhenEmpty: 'autoSync.clearRemoteScoreWhenEmpty',
  debounceSeconds: 'autoSync.debounceSeconds',
  autoSyncNotifyErrors: 'autoSync.notifyErrors',
  syncScope: 'sync.scope',
  rateLimitMaxRequests: 'client.rateLimit.maxRequests',
  rateLimitWindowSeconds: 'client.rateLimit.windowSeconds',
  timeoutSeconds: 'client.timeoutSeconds',
  retryCount: 'client.retryCount',
  importScope: 'import.scope',
  importProfileId: 'import.profileId',
  importCollectionTypes: 'import.collectionTypes',
  importDataItems: 'import.dataItems',
  importPatchExisting: 'import.patchExisting',
  importUseTargetCollection: 'import.useTargetCollection',
  importTargetCollectionMode: 'import.targetCollectionMode',
  importTargetCollectionId: 'import.targetCollectionId',
  importIndexInput: 'import.indexInput',
  fullSyncUpdateExisting: 'sync.full.updateExisting',
  fullSyncItems: 'sync.full.items',
  fullSyncClearRemoteScoreWhenEmpty: 'sync.full.clearRemoteScoreWhenEmpty',
  fullSyncBatchSize: 'sync.full.batchSize'
} as const

export const SETTINGS_DIALOG_IDS = {
  fullSync: 'fullSync',
  importCollections: 'importCollections',
  importIndex: 'importIndex'
} as const

export type BangumiSettingsDialogId = (typeof SETTINGS_DIALOG_IDS)[keyof typeof SETTINGS_DIALOG_IDS]
