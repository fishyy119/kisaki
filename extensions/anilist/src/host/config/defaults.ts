import type { AnilistSettingsV1 } from './schema'
import { ANILIST_DEFAULT_GRAPHQL_URL, ANILIST_DEFAULT_OAUTH_RELAY_URL } from '../../shared/settings'

export const DEFAULT_ANILIST_SETTINGS: AnilistSettingsV1 = {
  version: 1,
  endpoints: {
    graphqlUrl: ANILIST_DEFAULT_GRAPHQL_URL,
    oauthRelayUrl: ANILIST_DEFAULT_OAUTH_RELAY_URL
  },
  naming: {
    preferRomajiTitles: false
  },
  client: {
    timeoutMs: 20_000,
    retryCount: 2
  },
  sync: {
    enabled: false,
    pushScore: true
  }
}

export function createDefaultAnilistSettings(): AnilistSettingsV1 {
  return structuredClone(DEFAULT_ANILIST_SETTINGS)
}
