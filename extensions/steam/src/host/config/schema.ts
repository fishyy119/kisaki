import type { SettingsStore } from '@kisaki3/extension-sdk'
import { matchesSteamId64Format } from '../../shared/settings'
import { DEFAULT_STEAM_SETTINGS } from './defaults'

/** Store shape every Steam submodule reads settings through. */
export type SteamSettingsStore = SettingsStore<SteamSettingsV1>

export interface SteamSettingsV1 {
  version: 1
  account: {
    /** SteamID64 of the account whose library the import reads; empty when unset. */
    steamId: string
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
export function normalizeSteamSettings(value: unknown): SteamSettingsV1 {
  const input = isRecord(value) && value.version === 1 ? value : undefined
  const defaults = DEFAULT_STEAM_SETTINGS
  const account = asRecord(input?.account)
  const client = asRecord(input?.client)

  const steamId = typeof account?.steamId === 'string' ? account.steamId.trim() : ''

  return {
    version: 1,
    account: {
      steamId: matchesSteamId64Format(steamId) ? steamId : ''
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
