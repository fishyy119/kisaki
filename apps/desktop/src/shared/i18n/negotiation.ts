/**
 * System language negotiation.
 *
 * Maps ordered system language tags (e.g. Electron `app.getPreferredSystemLanguages()`
 * or `navigator.languages`) onto the supported UI locale set.
 */

import { FALLBACK_UI_LOCALE, UI_LOCALES, type UiLocale } from './locales'

/** Traditional-script Chinese regions default to zh-Hant. */
const TRADITIONAL_CHINESE_REGIONS = new Set(['tw', 'hk', 'mo'])

/**
 * Resolve the effective UI locale from ordered preferred language tags.
 * @param preferredTags - System language tags in preference order. Invalid tags are skipped.
 * @returns The first supported match, or the fallback locale when none match.
 */
export function resolveUiLocale(preferredTags: readonly string[]): UiLocale {
  for (const tag of preferredTags) {
    const match = matchUiLocale(tag)
    if (match) {
      return match
    }
  }

  return FALLBACK_UI_LOCALE
}

function matchUiLocale(tag: string): UiLocale | null {
  const normalized = tag.trim().toLowerCase()
  if (!normalized) {
    return null
  }

  const exact = (UI_LOCALES as readonly string[]).find(
    (locale) => locale.toLowerCase() === normalized
  )
  if (exact) {
    return exact as UiLocale
  }

  const [language, ...subtags] = normalized.split('-')

  if (language === 'zh') {
    if (subtags.includes('hant')) {
      return 'zh-Hant'
    }
    if (subtags.includes('hans')) {
      return 'zh-Hans'
    }
    if (subtags.some((subtag) => TRADITIONAL_CHINESE_REGIONS.has(subtag))) {
      return 'zh-Hant'
    }
    return 'zh-Hans'
  }

  if (language === 'ja') {
    return 'ja'
  }

  if (language === 'en') {
    return 'en'
  }

  return null
}
