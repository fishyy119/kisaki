import type { TmdbSettingsV1 } from './schema'
import { TMDB_DEFAULT_API_BASE_URL, TMDB_DEFAULT_IMAGE_BASE_URL } from '../../shared/settings'

export const DEFAULT_TMDB_SETTINGS: TmdbSettingsV1 = {
  version: 1,
  endpoints: {
    apiBaseUrl: TMDB_DEFAULT_API_BASE_URL,
    imageBaseUrl: TMDB_DEFAULT_IMAGE_BASE_URL
  },
  search: {
    includeAdult: false
  },
  client: {
    timeoutMs: 20_000,
    retryCount: 2
  }
}

export function createDefaultTmdbSettings(): TmdbSettingsV1 {
  return structuredClone(DEFAULT_TMDB_SETTINGS)
}
