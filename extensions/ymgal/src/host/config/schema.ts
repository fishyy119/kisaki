import { matchesHttpUrlFormat } from '../../shared/settings'
import { DEFAULT_YMGAL_SETTINGS } from './defaults'

export interface YmgalSettingsV1 {
  version: 1
  endpoints: {
    /** Root of the YMGal open API; changeable for mirrors. */
    apiBaseUrl: string
  }
  naming: {
    /** Use the Chinese title as the display name for Chinese content locales. */
    preferChineseNames: boolean
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
export function normalizeYmgalSettings(value: unknown): YmgalSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = DEFAULT_YMGAL_SETTINGS
  const endpoints = asRecord(input?.endpoints)
  const naming = asRecord(input?.naming)
  const client = asRecord(input?.client)

  return {
    version: 1,
    endpoints: {
      apiBaseUrl: normalizeHttpUrl(endpoints?.apiBaseUrl, defaults.endpoints.apiBaseUrl)
    },
    naming: {
      preferChineseNames: normalizeBoolean(
        naming?.preferChineseNames,
        defaults.naming.preferChineseNames
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
    }
  }
}

export function isYmgalSettingsV1(value: unknown): value is YmgalSettingsV1 {
  return JSON.stringify(value) === JSON.stringify(normalizeYmgalSettings(value))
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
