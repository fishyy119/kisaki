import type { LibraryGame, LibraryGameStatus } from '@kisaki/extension-sdk'
import type { BangumiCollectionPatch } from '../api/types'
import type {
  BangumiCollectionType,
  BangumiSettingsV1,
  BangumiStatusMappingValue
} from '../config/schema'
import { BANGUMI_SOURCE_ID } from '../shared/constants'

export interface SyncMappingOptions {
  playStatusEnabled: boolean
  scoreEnabled: boolean
  clearRemoteScoreWhenEmpty: boolean
  statusToBangumi: Record<LibraryGameStatus, BangumiStatusMappingValue>
}

export interface SyncPayloadPlan {
  payload: BangumiCollectionPatch
  mappedType?: BangumiCollectionType
  mappedRate?: number
  skippedByMapping: boolean
}

export interface SyncMappingOverrides {
  playStatusEnabled?: boolean
  scoreEnabled?: boolean
  clearRemoteScoreWhenEmpty?: boolean
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
  game: Pick<LibraryGame, 'status' | 'score'>,
  options: SyncMappingOptions
): SyncPayloadPlan {
  const payload: BangumiCollectionPatch = {}
  const mappedType = mapGameStatusToBangumiType(game.status, options)
  const mappedRate = mapGameScoreToBangumiRate(game.score, options)

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

export function readBangumiSubjectId(game: Pick<LibraryGame, 'externalIds'>): string | undefined {
  const externalId = game.externalIds.find((item) => item.source === BANGUMI_SOURCE_ID)
  const id = externalId?.id.trim()
  return id && /^\d+$/.test(id) ? id : undefined
}

export function mapGameStatusToBangumiType(
  status: LibraryGameStatus,
  options: Pick<SyncMappingOptions, 'playStatusEnabled' | 'statusToBangumi'>
): BangumiCollectionType | undefined {
  if (!options.playStatusEnabled) {
    return undefined
  }

  const mapped = options.statusToBangumi[status]
  return mapped === 'skip' ? undefined : mapped
}

export function mapGameScoreToBangumiRate(
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
