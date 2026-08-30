import type { SettingsStore } from '../utils/settings-store'
import { matchesHttpUrlFormat } from '../../shared/settings'
import { DEFAULT_MAL_SETTINGS } from './defaults'

/** Store shape every MAL submodule reads settings through. */
export type MalSettingsStore = SettingsStore<MalSettingsV1>

export interface MalSettingsV1 {
  version: 1
  endpoints: {
    /** Root of the official MAL API v2. */
    apiUrl: string
    /** Whether the Jikan-compatible mirror serves characters, staff, and episodes. */
    mirrorEnabled: boolean
    /** Root of the Jikan-compatible mirror. */
    mirrorUrl: string
  }
  naming: {
    /** Prefer the romaji title over the English one outside Japanese locales. */
    preferRomajiTitles: boolean
  }
  client: {
    timeoutMs: number
    retryCount: number
  }
  sync: {
    /** Push local status and score changes to the MAL lists automatically. */
    enabled: boolean
    /** Include the local score when pushing. */
    pushScore: boolean
  }
}

/**
 * Total-parse of stored settings: unknown or damaged members fall back to the
 * defaults so a bad write never blocks the extension from loading.
 */
export function normalizeMalSettings(value: unknown): MalSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = DEFAULT_MAL_SETTINGS
  const endpoints = asRecord(input?.endpoints)
  const naming = asRecord(input?.naming)
  const client = asRecord(input?.client)
  const sync = asRecord(input?.sync)

  return {
    version: 1,
    endpoints: {
      apiUrl: normalizeHttpUrl(endpoints?.apiUrl, defaults.endpoints.apiUrl),
      mirrorEnabled: normalizeBoolean(endpoints?.mirrorEnabled, defaults.endpoints.mirrorEnabled),
      mirrorUrl: normalizeHttpUrl(endpoints?.mirrorUrl, defaults.endpoints.mirrorUrl)
    },
    naming: {
      preferRomajiTitles: normalizeBoolean(
        naming?.preferRomajiTitles,
        defaults.naming.preferRomajiTitles
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
