/**
 * Application locale vocabulary.
 *
 * Two independent locale axes:
 * - `UiLocale` is the application interface language (message catalogs, formatting).
 * - `ContentLocale` is the media metadata language (scraper lookups, library content).
 *
 * The extension protocol declares its own equivalent vocabulary in
 * `@kisaki3/extension-api`; the two are bridged only at the extension host boundary.
 */

/** Interface languages with complete message catalogs. */
export const UI_LOCALES = ['en', 'ja', 'zh-Hans', 'zh-Hant'] as const

export type UiLocale = (typeof UI_LOCALES)[number]

/** Locale used when no preference exists and system negotiation fails. */
export const FALLBACK_UI_LOCALE: UiLocale = 'en'

/** UI language state owned by the main process and mirrored by the renderer. */
export interface UiLocaleState {
  /** Persisted user preference; null means follow the system language. */
  preference: UiLocale | null
  /** Locale actually in effect after negotiation. */
  effective: UiLocale
}

/** Validates an untrusted string as a supported UI locale tag. */
export function parseUiLocale(value: unknown): UiLocale | null {
  return typeof value === 'string' && (UI_LOCALES as readonly string[]).includes(value)
    ? (value as UiLocale)
    : null
}

/**
 * Media metadata languages (BCP 47) selectable for scraper providers and
 * content-language preferences. Independent from the UI language set.
 */
export const CONTENT_LOCALES = [
  'en',
  'zh-Hans',
  'zh-Hant',
  'ja',
  'ko',
  'de',
  'fr',
  'es',
  'pt',
  'it',
  'ru',
  'vi',
  'th',
  'id',
  'pl',
  'tr',
  'ar',
  'uk'
] as const

export type ContentLocale = (typeof CONTENT_LOCALES)[number]

/** Validates an untrusted string as a supported content locale tag. */
export function parseContentLocale(value: unknown): ContentLocale | null {
  return typeof value === 'string' && (CONTENT_LOCALES as readonly string[]).includes(value)
    ? (value as ContentLocale)
    : null
}
