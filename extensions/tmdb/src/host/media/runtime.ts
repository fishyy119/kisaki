import type { ContentLocale } from '@kisaki3/extension-sdk'
import type { TmdbClient } from '../api/client'
import type { TmdbSettingsV1 } from '../config/schema'
import { toTmdbImageLanguages, toTmdbLanguage, toTmdbTitleCountries } from './format/languages'
import type { TmdbImageContext } from './format/images'
import type { TmdbRequestContext } from './loaders'

/** What every TMDB scraper provider is built on: the API and live settings. */
export interface TmdbRuntime {
  readonly client: TmdbClient
  getSettings(): Promise<TmdbSettingsV1>
}

/**
 * Request shaping for one invocation.
 *
 * Settings are read per invocation rather than captured at registration, so
 * changing an endpoint or a preference takes effect on the next scrape instead
 * of at the next app start.
 */
export async function createRequestContext(
  runtime: TmdbRuntime,
  locale: ContentLocale,
  signal: AbortSignal
): Promise<TmdbRequestContext> {
  const settings = await runtime.getSettings()

  return {
    language: toTmdbLanguage(locale),
    imageLanguages: toTmdbImageLanguages(locale),
    titleCountries: toTmdbTitleCountries(locale),
    imageBaseUrl: settings.endpoints.imageBaseUrl,
    signal
  }
}

export function toImageContext(ctx: TmdbRequestContext): TmdbImageContext {
  return { imageBaseUrl: ctx.imageBaseUrl, preferredLanguages: ctx.imageLanguages }
}
