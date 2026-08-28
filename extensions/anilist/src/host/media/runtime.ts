import type { ContentLocale } from '@kisaki3/extension-sdk'
import type { AnilistClient } from '../api/client'
import type { AnilistSettingsV1 } from '../config/schema'
import { createSessionContext, type MediaSessionContext } from './session'

/** What every AniList scraper provider is built on: the API and live settings. */
export interface AnilistRuntime {
  readonly client: AnilistClient
  getSettings(): Promise<AnilistSettingsV1>
}

/**
 * Settings are read per invocation rather than captured at registration, so
 * changing a preference takes effect on the next scrape instead of at the
 * next app start.
 */
export async function createRequestContext(
  runtime: AnilistRuntime,
  locale: ContentLocale
): Promise<MediaSessionContext> {
  return createSessionContext(await runtime.getSettings(), locale)
}
