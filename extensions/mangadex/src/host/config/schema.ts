import type { SettingsStore } from '../utils/settings-store'
import { DEFAULT_MANGADEX_SETTINGS } from './defaults'

/** Store shape every MangaDex submodule reads settings through. */
export type MangadexSettingsStore = SettingsStore<MangadexSettingsV1>

export interface MangadexSettingsV1 {
  version: 1
  naming: {
    /** Prefer the romanized title over the English one outside native locales. */
    preferRomanizedTitles: boolean
  }
  client: {
    timeoutMs: number
    retryCount: number
  }
  sync: {
    /** Push local status and score changes to MangaDex automatically. */
    enabled: boolean
    /** Include the local score when pushing. */
    pushScore: boolean
  }
}

/**
 * Total-parse of stored settings: unknown or damaged members fall back to the
 * defaults so a bad write never blocks the extension from loading.
 */
export function normalizeMangadexSettings(value: unknown): MangadexSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = DEFAULT_MANGADEX_SETTINGS
  const naming = asRecord(input?.naming)
  const client = asRecord(input?.client)
  const sync = asRecord(input?.sync)

  return {
    version: 1,
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
