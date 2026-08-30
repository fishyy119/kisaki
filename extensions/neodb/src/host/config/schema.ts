import type { SettingsStore } from '../utils/settings-store'
import { matchesHttpUrlFormat, type NeodbSyncVisibility } from '../../shared/settings'
import { DEFAULT_NEODB_SETTINGS } from './defaults'

/** Store shape every NeoDB submodule reads settings through. */
export type NeodbSettingsStore = SettingsStore<NeodbSettingsV1>

export interface NeodbSettingsV1 {
  version: 1
  endpoints: {
    /** Root of the NeoDB instance the account lives on. */
    instanceUrl: string
  }
  client: {
    timeoutMs: number
    retryCount: number
  }
  sync: {
    /** Push local status and score changes to the shelf automatically. */
    enabled: boolean
    /** Include the local score when pushing. */
    pushScore: boolean
    /** Fediverse visibility of pushed marks. */
    visibility: NeodbSyncVisibility
  }
}

/**
 * Total-parse of stored settings: unknown or damaged members fall back to the
 * defaults so a bad write never blocks the extension from loading.
 */
export function normalizeNeodbSettings(value: unknown): NeodbSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = DEFAULT_NEODB_SETTINGS
  const endpoints = asRecord(input?.endpoints)
  const client = asRecord(input?.client)
  const sync = asRecord(input?.sync)

  return {
    version: 1,
    endpoints: {
      instanceUrl: normalizeHttpUrl(endpoints?.instanceUrl, defaults.endpoints.instanceUrl)
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
      enabled: typeof sync?.enabled === 'boolean' ? sync.enabled : defaults.sync.enabled,
      pushScore: typeof sync?.pushScore === 'boolean' ? sync.pushScore : defaults.sync.pushScore,
      visibility: normalizeVisibility(sync?.visibility, defaults.sync.visibility)
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

function normalizeVisibility(value: unknown, fallback: NeodbSyncVisibility): NeodbSyncVisibility {
  return value === 'public' || value === 'followers' || value === 'self' ? value : fallback
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
