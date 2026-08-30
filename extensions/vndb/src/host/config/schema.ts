import type { SettingsStore } from '../utils/settings-store'
import { matchesHttpUrlFormat } from '../../shared/settings'
import { DEFAULT_VNDB_SETTINGS } from './defaults'

/** Store shape every VNDB submodule reads settings through. */
export type VndbSettingsStore = SettingsStore<VndbSettingsV1>

export interface VndbSettingsV1 {
  version: 1
  endpoints: {
    /** Root of the VNDB Kana API; changeable for mirrors. */
    apiBaseUrl: string
  }
  naming: {
    /** Fall back to the romanized title instead of the original script. */
    preferRomanizedTitles: boolean
  }
  client: {
    timeoutMs: number
    retryCount: number
  }
  sync: {
    /** Push local status and score changes to the VNDB list automatically. */
    enabled: boolean
    /** Include the local score as a VNDB vote when pushing. */
    pushScore: boolean
  }
}

/**
 * Total-parse of stored settings: unknown or damaged members fall back to the
 * defaults so a bad write never blocks the extension from loading.
 */
export function normalizeVndbSettings(value: unknown): VndbSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = DEFAULT_VNDB_SETTINGS
  const endpoints = asRecord(input?.endpoints)
  const naming = asRecord(input?.naming)
  const client = asRecord(input?.client)
  const sync = asRecord(input?.sync)

  return {
    version: 1,
    endpoints: {
      apiBaseUrl: normalizeHttpUrl(endpoints?.apiBaseUrl, defaults.endpoints.apiBaseUrl)
    },
    naming: {
      preferRomanizedTitles: normalizeBoolean(
        naming?.preferRomanizedTitles,
        defaults.naming.preferRomanizedTitles
      )
    },
    client: {
      timeoutMs: normalizeInteger(client?.timeoutMs, defaults.client.timeoutMs, {
        min: 1_000,
        max: 120_000
      }),
      retryCount: normalizeInteger(client?.retryCount, defaults.client.retryCount, {
        min: 0,
        max: 10
      })
    },
    sync: {
      enabled: normalizeBoolean(sync?.enabled, defaults.sync.enabled),
      pushScore: normalizeBoolean(sync?.pushScore, defaults.sync.pushScore)
    }
  }
}

function normalizeHttpUrl(value: unknown, fallback: string): string {
  if (typeof value !== 'string') {
    return fallback
  }

  const trimmed = value.trim().replace(/\/+$/, '')
  return trimmed && matchesHttpUrlFormat(trimmed) ? trimmed : fallback
}

function normalizeBoolean(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback
}

function normalizeInteger(
  value: unknown,
  fallback: number,
  options: { min: number; max: number }
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback
  }

  return Math.trunc(Math.min(options.max, Math.max(options.min, value)))
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
