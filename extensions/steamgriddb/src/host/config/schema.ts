import type { SettingsStore } from '../utils/settings-store'
import { DEFAULT_SGDB_SETTINGS } from './defaults'

/** Store shape every SteamGridDB submodule reads settings through. */
export type SgdbSettingsStore = SettingsStore<SgdbSettingsV1>

export interface SgdbSettingsV1 {
  version: 1
  art: {
    /** Include artwork the community marked as NSFW. */
    includeNsfw: boolean
  }
  client: {
    timeoutMs: number
    retryCount: number
  }
}

/**
 * Total-parse of stored settings: unknown or damaged members fall back to the
 * defaults so a bad write never blocks the extension from loading.
 */
export function normalizeSgdbSettings(value: unknown): SgdbSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = DEFAULT_SGDB_SETTINGS
  const art = asRecord(input?.art)
  const client = asRecord(input?.client)

  return {
    version: 1,
    art: {
      includeNsfw:
        typeof art?.includeNsfw === 'boolean' ? art.includeNsfw : defaults.art.includeNsfw
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
    }
  }
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
