import {
  LIBRARY_ANIME_STATUSES,
  LIBRARY_COMIC_STATUSES,
  LIBRARY_GAME_STATUSES,
  type LibraryAnimeStatus,
  type LibraryComicStatus,
  type LibraryGameStatus
} from '@kisaki3/extension-sdk'
import { DEFAULT_BANGUMI_SETTINGS } from './defaults'
import { BANGUMI_MEDIA_SCOPES, type BangumiMediaScope } from '../../shared/scopes'

export type BangumiCollectionType = 1 | 2 | 3 | 4 | 5
export type BangumiStatusMappingValue = BangumiCollectionType | 'skip'

/**
 * Local status to Bangumi collection type tables, one per status-bearing
 * scope. Comics and novels share one reading-status vocabulary, so the book
 * scope owns a single table for both.
 */
export interface BangumiStatusToBangumiMapping {
  game: Record<LibraryGameStatus, BangumiStatusMappingValue>
  anime: Record<LibraryAnimeStatus, BangumiStatusMappingValue>
  book: Record<LibraryComicStatus, BangumiStatusMappingValue>
}

export interface BangumiSettingsV1 {
  version: 1
  auth: {
    loginTimeoutMs: number
  }
  media: Record<
    BangumiMediaScope,
    {
      enabled: boolean
      localSyncEnabled: boolean
    }
  >
  /** One policy for every locally synced scope. */
  autoSync: {
    enabled: boolean
    syncOnCreate: boolean
    playStatusEnabled: boolean
    scoreEnabled: boolean
    /** Pushes per-episode watch state for scopes that track episodes. */
    episodeStatusEnabled: boolean
    clearRemoteScoreWhenEmpty: boolean
    debounceMs: number
    notifyErrors: boolean
    statusToBangumi: BangumiStatusToBangumiMapping
  }
  client: {
    rateLimit: {
      maxRequests: number
      windowMs: number
    }
    timeoutMs: number
    retryCount: number
  }
}

const BANGUMI_COLLECTION_TYPES = [1, 2, 3, 4, 5] as const

export function normalizeBangumiSettings(value: unknown): BangumiSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = DEFAULT_BANGUMI_SETTINGS

  return {
    version: 1,
    auth: normalizeAuthSettings(input?.auth, defaults.auth),
    media: normalizeMediaSettings(input?.media, defaults.media),
    autoSync: normalizeAutoSyncSettings(input?.autoSync, defaults.autoSync),
    client: normalizeClientSettings(input?.client, defaults.client)
  }
}

export function isBangumiSettingsV1(value: unknown): value is BangumiSettingsV1 {
  return settingsEqual(value, normalizeBangumiSettings(value))
}

function normalizeAuthSettings(
  value: unknown,
  defaults: BangumiSettingsV1['auth']
): BangumiSettingsV1['auth'] {
  const input = asRecord(value)

  return {
    loginTimeoutMs: normalizeInteger(input?.loginTimeoutMs, defaults.loginTimeoutMs, {
      min: 60_000,
      max: 60 * 60_000
    })
  }
}

function normalizeMediaSettings(
  value: unknown,
  defaults: BangumiSettingsV1['media']
): BangumiSettingsV1['media'] {
  const input = asRecord(value)
  const output = {} as BangumiSettingsV1['media']

  for (const scope of BANGUMI_MEDIA_SCOPES) {
    const scopeInput = asRecord(input?.[scope])
    output[scope] = {
      enabled: normalizeBoolean(scopeInput?.enabled, defaults[scope].enabled),
      localSyncEnabled: normalizeBoolean(
        scopeInput?.localSyncEnabled,
        defaults[scope].localSyncEnabled
      )
    }
  }

  return output
}

function normalizeAutoSyncSettings(
  value: unknown,
  defaults: BangumiSettingsV1['autoSync']
): BangumiSettingsV1['autoSync'] {
  const input = asRecord(value)

  return {
    enabled: normalizeBoolean(input?.enabled, defaults.enabled),
    syncOnCreate: normalizeBoolean(input?.syncOnCreate, defaults.syncOnCreate),
    playStatusEnabled: normalizeBoolean(input?.playStatusEnabled, defaults.playStatusEnabled),
    scoreEnabled: normalizeBoolean(input?.scoreEnabled, defaults.scoreEnabled),
    episodeStatusEnabled: normalizeBoolean(
      input?.episodeStatusEnabled,
      defaults.episodeStatusEnabled
    ),
    clearRemoteScoreWhenEmpty: normalizeBoolean(
      input?.clearRemoteScoreWhenEmpty,
      defaults.clearRemoteScoreWhenEmpty
    ),
    debounceMs: normalizeInteger(input?.debounceMs, defaults.debounceMs, {
      min: 250,
      max: 60_000
    }),
    notifyErrors: normalizeBoolean(input?.notifyErrors, defaults.notifyErrors),
    statusToBangumi: normalizeStatusToBangumi(input?.statusToBangumi, defaults.statusToBangumi)
  }
}

function normalizeClientSettings(
  value: unknown,
  defaults: BangumiSettingsV1['client']
): BangumiSettingsV1['client'] {
  const input = asRecord(value)

  return {
    rateLimit: normalizeRateLimitSettings(input, defaults.rateLimit),
    timeoutMs: normalizeInteger(input?.timeoutMs, defaults.timeoutMs, {
      min: 1_000,
      max: 120_000
    }),
    retryCount: normalizeInteger(input?.retryCount, defaults.retryCount, { min: 0, max: 10 })
  }
}

function normalizeRateLimitSettings(
  input: Record<string, unknown> | undefined,
  defaults: BangumiSettingsV1['client']['rateLimit']
): BangumiSettingsV1['client']['rateLimit'] {
  const rateLimit = asRecord(input?.rateLimit)

  if (!rateLimit) {
    return { ...defaults }
  }

  return {
    maxRequests: normalizeInteger(rateLimit.maxRequests, defaults.maxRequests, {
      min: 1,
      max: 10_000
    }),
    windowMs: normalizeInteger(rateLimit.windowMs, defaults.windowMs, {
      min: 1_000,
      max: 60 * 60_000
    })
  }
}

function normalizeStatusToBangumi(
  value: unknown,
  defaults: BangumiStatusToBangumiMapping
): BangumiStatusToBangumiMapping {
  const input = asRecord(value)

  return {
    game: normalizeStatusTable(LIBRARY_GAME_STATUSES, asRecord(input?.game), defaults.game),
    anime: normalizeStatusTable(LIBRARY_ANIME_STATUSES, asRecord(input?.anime), defaults.anime),
    book: normalizeStatusTable(LIBRARY_COMIC_STATUSES, asRecord(input?.book), defaults.book)
  }
}

function normalizeStatusTable<TStatus extends string>(
  statuses: readonly TStatus[],
  input: Record<string, unknown> | undefined,
  defaults: Record<TStatus, BangumiStatusMappingValue>
): Record<TStatus, BangumiStatusMappingValue> {
  const output = { ...defaults }

  for (const status of statuses) {
    output[status] = normalizeStatusMappingValue(input?.[status], defaults[status])
  }

  return output
}

function normalizeStatusMappingValue(
  value: unknown,
  fallback: BangumiStatusMappingValue
): BangumiStatusMappingValue {
  if (value === 'skip' || BANGUMI_COLLECTION_TYPES.includes(value as BangumiCollectionType)) {
    return value as BangumiStatusMappingValue
  }

  return fallback
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  options: { min: number; max: number }
): number {
  const number = normalizeNumber(value, fallback, options)
  return Math.trunc(number)
}

function normalizeNumber(
  value: unknown,
  fallback: number,
  options: { min: number; max: number }
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.min(options.max, Math.max(options.min, value))
}

function settingsEqual(left: unknown, right: unknown): boolean {
  return JSON.stringify(left) === JSON.stringify(right)
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
