import type { ContentLocale } from '@kisaki3/extension-sdk'
import type { VndbTitle } from '../../api/types'
import { trimToUndefined } from './text'

export interface VndbDisplayName {
  name: string
  originalName?: string
}

export interface VndbNameOptions {
  locale: ContentLocale
  /** Fall back to the romanized form instead of the original script. */
  preferRomanizedTitles: boolean
}

/** VNDB tags Chinese titles by script, so both satisfy a Chinese locale. */
const CHINESE_TITLE_LANGS = new Set(['zh-Hans', 'zh-Hant', 'zh'])

interface NormalizedTitle {
  lang?: string
  title: string
  latin?: string
  isMain: boolean
}

function normalizeTitles(titles: readonly VndbTitle[] | null | undefined): NormalizedTitle[] {
  const output: NormalizedTitle[] = []

  for (const entry of titles ?? []) {
    const title = trimToUndefined(entry?.title)
    if (!title) {
      continue
    }

    output.push({
      title,
      isMain: entry?.main === true,
      ...(trimToUndefined(entry?.lang) ? { lang: trimToUndefined(entry.lang)! } : {}),
      ...(trimToUndefined(entry?.latin) ? { latin: trimToUndefined(entry.latin)! } : {})
    })
  }

  return output
}

function pickLocalizedTitle(
  titles: readonly NormalizedTitle[],
  locale: ContentLocale
): NormalizedTitle | undefined {
  const exactMain = titles.find((entry) => entry.lang === locale && entry.isMain)
  if (exactMain) {
    return exactMain
  }

  const exact = titles.find((entry) => entry.lang === locale)
  if (exact) {
    return exact
  }

  if (locale !== 'zh-Hans' && locale !== 'zh-Hant') {
    return undefined
  }

  return (
    titles.find((entry) => entry.lang && CHINESE_TITLE_LANGS.has(entry.lang) && entry.isMain) ??
    titles.find((entry) => entry.lang && CHINESE_TITLE_LANGS.has(entry.lang))
  )
}

/**
 * Picks the display name for a visual novel.
 *
 * A VN carries one title per language plus a romanization of each. The
 * content locale decides which one is shown, the main title is always
 * reported as `originalName` so the library keeps the work's own name, and an
 * English locale (or the romanization preference) reads the latin form.
 */
export function resolveVnDisplayName(
  source: { title?: string | null; alttitle?: string | null; titles?: VndbTitle[] | null },
  options: VndbNameOptions,
  fallback: string
): VndbDisplayName {
  const titles = normalizeTitles(source.titles)
  const mainTitle = titles.find((entry) => entry.isMain)
  // `title` is VNDB's own romanized headline; `alttitle` is the original script.
  const romanized = trimToUndefined(source.title)
  const localized = pickLocalizedTitle(titles, options.locale)

  const preferLatin = options.locale === 'en' || options.preferRomanizedTitles
  const displayed = preferLatin
    ? (localized?.latin ?? localized?.title ?? romanized ?? mainTitle?.title)
    : (localized?.title ?? mainTitle?.title ?? romanized)

  const name = trimToUndefined(displayed) ?? trimToUndefined(source.alttitle) ?? fallback
  const originalName = mainTitle?.title ?? trimToUndefined(source.alttitle)

  return originalName ? { name, originalName } : { name }
}

/**
 * Picks the display name for a character, staff member, or producer.
 *
 * VNDB stores the romanized name in `name` and the original script in
 * `original`, so the content locale decides which leads while the original
 * always travels along.
 */
export function resolveEntityDisplayName(
  name: string | null | undefined,
  original: string | null | undefined,
  options: VndbNameOptions,
  fallback: string
): VndbDisplayName {
  const romanized = trimToUndefined(name)
  const originalName = trimToUndefined(original)
  const preferLatin = options.locale === 'en' || options.preferRomanizedTitles

  const displayed = preferLatin ? (romanized ?? originalName) : (originalName ?? romanized)
  const resolved = displayed ?? fallback

  return originalName ? { name: resolved, originalName } : { name: resolved }
}
