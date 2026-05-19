import type { BangumiSettingsDialogId } from './types'

export const NODE_IDS = {
  loginTimeoutMinutes: 'auth.loginTimeoutMinutes',
  autoSyncEnabled: 'autoSync.enabled',
  autoSyncItems: 'autoSync.items',
  clearRemoteScoreWhenEmpty: 'autoSync.clearRemoteScoreWhenEmpty',
  debounceSeconds: 'autoSync.debounceSeconds',
  autoSyncNotifyErrors: 'autoSync.notifyErrors',
  rateLimitMaxRequests: 'client.rateLimit.maxRequests',
  rateLimitWindowSeconds: 'client.rateLimit.windowSeconds',
  timeoutSeconds: 'client.timeoutSeconds',
  retryCount: 'client.retryCount',
  importProfileId: 'import.profileId',
  importCollectionTypes: 'import.collectionTypes',
  importWriteFields: 'import.writeFields',
  importIndexInput: 'import.indexInput',
  fullSyncUpdateExisting: 'sync.full.updateExisting',
  fullSyncItems: 'sync.full.items',
  fullSyncClearRemoteScoreWhenEmpty: 'sync.full.clearRemoteScoreWhenEmpty',
  fullSyncBatchSize: 'sync.full.batchSize'
} as const

export const DIALOG_IDS = {
  fullSync: 'fullSync',
  importMyCollections: 'importMyCollections',
  importIndex: 'importIndex'
} as const satisfies Record<BangumiSettingsDialogId, BangumiSettingsDialogId>

export const BANGUMI_COLLECTION_TYPE_OPTIONS = [
  { value: '1', label: '想玩' },
  { value: '2', label: '玩过' },
  { value: '3', label: '在玩' },
  { value: '4', label: '搁置' },
  { value: '5', label: '抛弃' }
] as const

export const AUTO_SYNC_ITEM_OPTIONS = [
  { value: 'create', label: '新增游戏' },
  { value: 'status', label: '游玩状态' },
  { value: 'score', label: '评分' }
] as const

export const FULL_SYNC_ITEM_OPTIONS = [
  { value: 'status', label: '游玩状态' },
  { value: 'score', label: '评分' }
] as const

export const IMPORT_WRITE_FIELD_OPTIONS = [
  { value: 'status', label: '游玩状态' },
  { value: 'score', label: '评分' },
  { value: 'tags', label: '标签' }
] as const
