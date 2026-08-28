import type { ExtensionStorage } from '@kisaki3/extension-sdk'
import {
  STEAM_APPDETAILS_CACHE_MAX_ENTRIES,
  STEAM_APPDETAILS_CACHE_TTL_MS
} from '../utils/constants'
import { STEAM_STORAGE_KEYS } from '../utils/ids'
import type { SteamAppDetails } from './types'

interface CacheRecord {
  data: SteamAppDetails
  cachedAt: number
}

interface AppDetailsCacheV1 {
  version: 1
  entries: Record<string, CacheRecord>
}

/**
 * Persistent cache for appdetails responses, keyed by app id and language.
 *
 * The store API rate-limits aggressively and its payloads change rarely, so
 * every read within the TTL is served locally; the cache is pruned by age to
 * a fixed entry budget.
 */
export class AppDetailsCache {
  constructor(private readonly storage: ExtensionStorage) {}

  async get(appId: number, language: string): Promise<SteamAppDetails | undefined> {
    const state = await this.read()
    const record = state.entries[createKey(appId, language)]
    if (!record || record.cachedAt + STEAM_APPDETAILS_CACHE_TTL_MS <= Date.now()) {
      return undefined
    }
    return record.data
  }

  async set(appId: number, language: string, data: SteamAppDetails): Promise<void> {
    const state = await this.read()
    state.entries[createKey(appId, language)] = { data, cachedAt: Date.now() }
    await this.storage.set(STEAM_STORAGE_KEYS.appDetailsCache, prune(state))
  }

  private async read(): Promise<AppDetailsCacheV1> {
    const value = await this.storage.get(STEAM_STORAGE_KEYS.appDetailsCache)
    if (
      typeof value === 'object' &&
      value !== null &&
      !Array.isArray(value) &&
      (value as { version?: unknown }).version === 1 &&
      typeof (value as { entries?: unknown }).entries === 'object'
    ) {
      return value as unknown as AppDetailsCacheV1
    }
    return { version: 1, entries: {} }
  }
}

function createKey(appId: number, language: string): string {
  return `${language}:${appId}`
}

function prune(state: AppDetailsCacheV1): AppDetailsCacheV1 {
  const entries = Object.entries(state.entries).sort(
    (left, right) => right[1].cachedAt - left[1].cachedAt
  )

  return {
    version: 1,
    entries: Object.fromEntries(entries.slice(0, STEAM_APPDETAILS_CACHE_MAX_ENTRIES))
  }
}
