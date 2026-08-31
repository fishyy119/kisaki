import type { SettingsStore } from '../utils/settings-store'
import { DEFAULT_GBOOKS_SETTINGS } from './defaults'

/** Store shape every Google Books submodule reads settings through. */
export type GbooksSettingsStore = SettingsStore<GbooksSettingsV1>

export interface GbooksSettingsV1 {
  version: 1
  client: {
    timeoutMs: number
    retryCount: number
  }
}

/**
 * Total-parse of stored settings: unknown or damaged members fall back to the
 * defaults so a bad write never blocks the extension from loading.
 */
export function normalizeGbooksSettings(value: unknown): GbooksSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = DEFAULT_GBOOKS_SETTINGS
  const client = asRecord(input?.client)

  return {
    version: 1,
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
