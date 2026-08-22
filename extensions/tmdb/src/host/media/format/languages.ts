import type { ContentLocale } from '@kisaki3/extension-sdk'

/**
 * Kisaki content locales expressed as TMDB `language` tags. TMDB resolves
 * region-qualified tags and falls back to the base language on its own, so the
 * most widely populated region is used for each locale.
 */
const TMDB_LANGUAGE_BY_LOCALE: Record<ContentLocale, string> = {
  en: 'en-US',
  'zh-Hans': 'zh-CN',
  'zh-Hant': 'zh-TW',
  ja: 'ja-JP',
  ko: 'ko-KR',
  de: 'de-DE',
  fr: 'fr-FR',
  es: 'es-ES',
  pt: 'pt-BR',
  it: 'it-IT',
  ru: 'ru-RU',
  vi: 'vi-VN',
  th: 'th-TH',
  id: 'id-ID',
  pl: 'pl-PL',
  tr: 'tr-TR',
  ar: 'ar-SA',
  uk: 'uk-UA'
}

/**
 * ISO-639-1 codes an image of the locale may be tagged with. TMDB tags Chinese
 * artwork as either `zh` or `cn` depending on when it was uploaded, so both
 * variants count as a match.
 */
const IMAGE_LANGUAGES_BY_LOCALE: Partial<Record<ContentLocale, readonly string[]>> = {
  'zh-Hans': ['zh', 'cn'],
  'zh-Hant': ['zh', 'cn']
}

/**
 * ISO-3166-1 codes whose alternative titles read as the locale's own. TMDB
 * files a title under a country rather than a language, so a written language
 * released in several markets counts every one of them.
 */
const TITLE_COUNTRIES_BY_LOCALE: Partial<Record<ContentLocale, readonly string[]>> = {
  'zh-Hans': ['CN', 'SG'],
  'zh-Hant': ['TW', 'HK']
}

export function toTmdbLanguage(locale: ContentLocale): string {
  return TMDB_LANGUAGE_BY_LOCALE[locale] ?? TMDB_LANGUAGE_BY_LOCALE.en
}

/** Image languages in preference order: the locale, English, then untagged. */
export function toTmdbImageLanguages(locale: ContentLocale): readonly string[] {
  const localeCodes = IMAGE_LANGUAGES_BY_LOCALE[locale] ?? [locale.split('-')[0]!]
  return [...new Set([...localeCodes, 'en', 'null'])]
}

/** Countries whose titles count as the locale's own, in preference order. */
export function toTmdbTitleCountries(locale: ContentLocale): readonly string[] {
  const region = toTmdbLanguage(locale).split('-')[1]
  return TITLE_COUNTRIES_BY_LOCALE[locale] ?? (region ? [region] : [])
}
