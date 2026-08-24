import type { ContentLocale } from '@kisaki3/extension-sdk'
import { trimToUndefined } from './text'

export interface YmgalDisplayName {
  name: string
  originalName?: string
}

export interface YmgalNameOptions {
  locale: ContentLocale
  /** Whether the user asked for Chinese titles on Chinese content locales. */
  preferChineseNames: boolean
}

function isChineseLocale(locale: ContentLocale): boolean {
  return locale === 'zh-Hans' || locale === 'zh-Hant'
}

/**
 * Picks the display name for a YMGal archive.
 *
 * Archives carry the work's own title plus a Chinese title. The original title
 * is always reported as `originalName` so the library keeps it, while the
 * display name follows the content locale: Chinese locales show the Chinese
 * title when the archive has one and the user has not opted out.
 */
export function resolveDisplayName(
  name: string | null | undefined,
  chineseName: string | null | undefined,
  options: YmgalNameOptions,
  fallback: string
): YmgalDisplayName {
  const original = trimToUndefined(name)
  const chinese = trimToUndefined(chineseName)

  if (options.preferChineseNames && isChineseLocale(options.locale) && chinese) {
    return original ? { name: chinese, originalName: original } : { name: chinese }
  }

  if (original) {
    return { name: original, originalName: original }
  }

  return chinese ? { name: chinese, originalName: chinese } : { name: fallback }
}
