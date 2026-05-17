import type { LibraryGameStatus } from '@kisaki/extension-sdk'
import { DEFAULT_BANGUMI_SETTINGS } from './defaults'

export type BangumiCollectionType = 1 | 2 | 3 | 4 | 5
export type BangumiStatusMappingValue = BangumiCollectionType | 'skip'
export type BangumiUnmappedStrategy = 'skip' | 'notify' | 'resolveWithProfile'

export interface BangumiSettingsV1 {
  version: 1
  auth: {
    loginTimeoutMs: number
  }
  sync: {
    autoSyncEnabled: boolean
    syncOnCreate: boolean
    playStatusEnabled: boolean
    scoreEnabled: boolean
    clearRemoteScoreWhenEmpty: boolean
    unmappedStrategy: BangumiUnmappedStrategy
    resolveProfileId?: string
    debounceMs: number
    statusToBangumi: Record<LibraryGameStatus, BangumiStatusMappingValue>
    bangumiToStatus: Record<BangumiCollectionType, LibraryGameStatus | 'skip'>
  }
  client: {
    rateLimit: {
      maxRequests: number
      windowMs: number
    }
    timeoutMs: number
    retryCount: number
  }
  diagnostics: {
    notifySyncErrors: boolean
  }
}

const BANGUMI_COLLECTION_TYPES = [1, 2, 3, 4, 5] as const
const LIBRARY_GAME_STATUS_VALUES = [
  'notStarted',
  'inProgress',
  'partial',
  'completed',
  'multiple',
  'shelved'
] as const satisfies readonly LibraryGameStatus[]
const UNMAPPED_STRATEGIES = ['skip', 'notify', 'resolveWithProfile'] as const

export function normalizeBangumiSettings(value: unknown): BangumiSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = DEFAULT_BANGUMI_SETTINGS

  return {
    version: 1,
    auth: normalizeAuthSettings(input?.auth, defaults.auth),
    sync: normalizeSyncSettings(input?.sync, defaults.sync),
    client: normalizeClientSettings(input?.client, defaults.client),
    diagnostics: normalizeDiagnosticsSettings(input?.diagnostics, defaults.diagnostics)
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

function normalizeSyncSettings(
  value: unknown,
  defaults: BangumiSettingsV1['sync']
): BangumiSettingsV1['sync'] {
  const input = asRecord(value)
  const resolveProfileId = normalizeOptionalString(input?.resolveProfileId)

  return {
    autoSyncEnabled: normalizeBoolean(input?.autoSyncEnabled, defaults.autoSyncEnabled),
    syncOnCreate: normalizeBoolean(input?.syncOnCreate, defaults.syncOnCreate),
    playStatusEnabled: normalizeBoolean(input?.playStatusEnabled, defaults.playStatusEnabled),
    scoreEnabled: normalizeBoolean(input?.scoreEnabled, defaults.scoreEnabled),
    clearRemoteScoreWhenEmpty: normalizeBoolean(
      input?.clearRemoteScoreWhenEmpty,
      defaults.clearRemoteScoreWhenEmpty
    ),
    unmappedStrategy: normalizeEnum(
      input?.unmappedStrategy,
      UNMAPPED_STRATEGIES,
      defaults.unmappedStrategy
    ),
    ...(resolveProfileId ? { resolveProfileId } : {}),
    debounceMs: normalizeInteger(input?.debounceMs, defaults.debounceMs, {
      min: 250,
      max: 60_000
    }),
    statusToBangumi: normalizeStatusToBangumi(input?.statusToBangumi, defaults.statusToBangumi),
    bangumiToStatus: normalizeBangumiToStatus(input?.bangumiToStatus, defaults.bangumiToStatus)
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

function normalizeDiagnosticsSettings(
  value: unknown,
  defaults: BangumiSettingsV1['diagnostics']
): BangumiSettingsV1['diagnostics'] {
  const input = asRecord(value)

  return {
    notifySyncErrors: normalizeBoolean(input?.notifySyncErrors, defaults.notifySyncErrors)
  }
}

function normalizeStatusToBangumi(
  value: unknown,
  defaults: BangumiSettingsV1['sync']['statusToBangumi']
): BangumiSettingsV1['sync']['statusToBangumi'] {
  const input = asRecord(value)
  const output = { ...defaults }

  for (const status of LIBRARY_GAME_STATUS_VALUES) {
    output[status] = normalizeStatusMappingValue(input?.[status], defaults[status])
  }

  return output
}

function normalizeBangumiToStatus(
  value: unknown,
  defaults: BangumiSettingsV1['sync']['bangumiToStatus']
): BangumiSettingsV1['sync']['bangumiToStatus'] {
  const input = asRecord(value)
  const output = { ...defaults }

  for (const type of BANGUMI_COLLECTION_TYPES) {
    output[type] = normalizeLibraryStatusOrSkip(input?.[String(type)], defaults[type])
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

function normalizeLibraryStatusOrSkip(
  value: unknown,
  fallback: LibraryGameStatus | 'skip'
): LibraryGameStatus | 'skip' {
  if (value === 'skip' || LIBRARY_GAME_STATUS_VALUES.includes(value as LibraryGameStatus)) {
    return value as LibraryGameStatus | 'skip'
  }

  return fallback
}

function normalizeOptionalString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim() ? value.trim() : undefined
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

function normalizeEnum<T extends readonly string[]>(
  value: unknown,
  allowedValues: T,
  fallback: T[number]
): T[number] {
  return typeof value === 'string' && allowedValues.includes(value) ? value : fallback
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
