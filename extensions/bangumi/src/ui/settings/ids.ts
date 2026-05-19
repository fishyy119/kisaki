export const SETTINGS_NODE_IDS = {
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
  importMyCollections: 'importMyCollections',
  importIndex: 'importIndex'
} as const

export type BangumiSettingsDialogId = (typeof SETTINGS_DIALOG_IDS)[keyof typeof SETTINGS_DIALOG_IDS]

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

export const INDEX_TARGET_COLLECTION_MODE_OPTIONS = [
  { value: 'none', label: '不加入合集', description: '只导入缺失游戏，不写入本地合集' },
  { value: 'existing', label: '选择现有合集', description: '将导入的游戏加入指定本地合集' },
  {
    value: 'byIndexTitle',
    label: '按目录名创建合集',
    description: '按 Bangumi 目录名创建或复用本地合集'
  }
] as const
