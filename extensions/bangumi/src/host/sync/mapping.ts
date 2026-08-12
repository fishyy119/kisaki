import type { BangumiCollectionPatch } from '../api/types'
import type {
  BangumiCollectionType,
  BangumiSettingsV1,
  BangumiStatusMappingValue,
  BangumiStatusToBangumiMapping
} from '../config/schema'
import type { LocalMediaItem } from '../media/types'
import type { BangumiMediaScope } from '../../shared/scopes'
import { BANGUMI_WISH_COLLECTION_TYPE } from '../utils/constants'

export interface SyncMappingOptions {
  playStatusEnabled: boolean
  scoreEnabled: boolean
  clearRemoteScoreWhenEmpty: boolean
  statusToBangumi: BangumiStatusToBangumiMapping
}

export interface SyncPayloadPlan {
  payload: BangumiCollectionPatch
  mappedType?: BangumiCollectionType
  mappedRate?: number
  skippedByMapping: boolean
}

export interface SyncMappingOverrides {
  playStatusEnabled?: boolean | undefined
  scoreEnabled?: boolean | undefined
  clearRemoteScoreWhenEmpty?: boolean | undefined
}

export function createSyncMappingOptions(
  settings: BangumiSettingsV1,
  overrides: SyncMappingOverrides = {}
): SyncMappingOptions {
  return {
    playStatusEnabled: overrides.playStatusEnabled ?? settings.autoSync.playStatusEnabled,
    scoreEnabled: overrides.scoreEnabled ?? settings.autoSync.scoreEnabled,
    clearRemoteScoreWhenEmpty:
      overrides.clearRemoteScoreWhenEmpty ?? settings.autoSync.clearRemoteScoreWhenEmpty,
    statusToBangumi: settings.autoSync.statusToBangumi
  }
}

export function createSyncPayloadPlan(
  item: Pick<LocalMediaItem, 'scope' | 'status' | 'score'>,
  options: SyncMappingOptions
): SyncPayloadPlan {
  const payload: BangumiCollectionPatch = {}
  const mappedType = mapMediaStatusToBangumiType(item.scope, item.status, options)
  const mappedRate = resolveBangumiRateForSync(
    mappedType,
    mapMediaScoreToBangumiRate(item.score, options)
  )

  if (mappedType !== undefined) {
    payload.type = mappedType
  }

  if (mappedRate !== undefined) {
    payload.rate = mappedRate
  }

  return {
    payload,
    ...(mappedType !== undefined ? { mappedType } : {}),
    ...(mappedRate !== undefined ? { mappedRate } : {}),
    skippedByMapping: Object.keys(payload).length === 0
  }
}

export function mapMediaStatusToBangumiType(
  scope: BangumiMediaScope,
  status: string | undefined,
  options: Pick<SyncMappingOptions, 'playStatusEnabled' | 'statusToBangumi'>
): BangumiCollectionType | undefined {
  if (!options.playStatusEnabled || !status) {
    return undefined
  }

  const mapped = readStatusTable(options.statusToBangumi, scope)?.[status]
  return mapped === undefined || mapped === 'skip' ? undefined : mapped
}

/** Only status-bearing scopes own a mapping table; other scopes never push status. */
function readStatusTable(
  statusToBangumi: BangumiStatusToBangumiMapping,
  scope: BangumiMediaScope
): Partial<Record<string, BangumiStatusMappingValue>> | undefined {
  return scope === 'game' || scope === 'anime' ? statusToBangumi[scope] : undefined
}

export function mapMediaScoreToBangumiRate(
  score: number | null | undefined,
  options: Pick<SyncMappingOptions, 'scoreEnabled' | 'clearRemoteScoreWhenEmpty'>
): number | undefined {
  if (!options.scoreEnabled) {
    return undefined
  }

  if (score === null || score === undefined || !Number.isFinite(score)) {
    return options.clearRemoteScoreWhenEmpty ? 0 : undefined
  }

  if (score <= 0) {
    return undefined
  }

  return Math.min(10, Math.max(1, Math.round(score / 10)))
}

function resolveBangumiRateForSync(
  mappedType: BangumiCollectionType | undefined,
  mappedRate: number | undefined
): number | undefined {
  if (mappedType === BANGUMI_WISH_COLLECTION_TYPE) {
    return 0
  }

  return mappedRate
}

export function normalizeBangumiRemoteRate(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.min(10, Math.max(1, Math.trunc(value)))
    : undefined
}

export function syncPayloadMatchesRemote(
  payload: BangumiCollectionPatch,
  remote: { type?: BangumiCollectionType; rate?: number } | undefined
): boolean {
  if (!remote) {
    return false
  }

  if (payload.type !== undefined && remote.type !== payload.type) {
    return false
  }

  if (payload.rate !== undefined) {
    const remoteRate = normalizeBangumiRemoteRate(remote.rate)
    if (payload.rate === 0) {
      return remoteRate === undefined
    }
    if (remoteRate !== payload.rate) {
      return false
    }
  }

  return true
}
