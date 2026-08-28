import type { ContentLocale } from '@kisaki3/extension-sdk'
import type { MdLocalizedString, MdMangaAttributes } from '../../api/types'

/** MangaDex locale codes acceptable for each content locale, best first. */
const MD_LOCALE_CANDIDATES: Record<ContentLocale, readonly string[]> = {
  en: ['en'],
  'zh-Hans': ['zh'],
  'zh-Hant': ['zh-hk', 'zh'],
  ja: ['ja'],
  ko: ['ko'],
  de: ['de'],
  fr: ['fr'],
  es: ['es', 'es-la'],
  pt: ['pt-br', 'pt'],
  it: ['it'],
  ru: ['ru'],
  vi: ['vi'],
  th: ['th'],
  id: ['id'],
  pl: ['pl'],
  tr: ['tr'],
  ar: ['ar'],
  uk: ['uk']
}

/** Romanization codes, per original language. */
const ROMANIZED_CODES = ['ja-ro', 'ko-ro', 'zh-ro'] as const

const MAX_ALIASES = 16

export interface TitleSelection {
  name: string
  originalName?: string
  aliases?: string[]
}

/**
 * MangaDex titles are locale maps plus an alternative-title list. Selection
 * reads the locale's candidates across the primary title and alternatives,
 * then falls back English → romanized → native → anything. The titles not
 * chosen become aliases, capped because popular entries carry dozens.
 */
export function selectMangaTitles(
  attributes: MdMangaAttributes | null | undefined,
  options: { locale: ContentLocale; preferRomanized: boolean }
): TitleSelection | undefined {
  const maps: MdLocalizedString[] = [
    ...(attributes?.title ? [attributes.title] : []),
    ...(attributes?.altTitles ?? [])
  ]
  if (maps.length === 0) {
    return undefined
  }

  const originalLanguage = attributes?.originalLanguage?.trim().toLowerCase() ?? ''
  const romanized = pick(maps, ROMANIZED_CODES)
  const native = originalLanguage ? pick(maps, [originalLanguage]) : undefined
  const english = pick(maps, ['en'])
  const localized = pick(maps, MD_LOCALE_CANDIDATES[options.locale])

  const name =
    options.locale === 'ja' && originalLanguage === 'ja'
      ? (native ?? romanized ?? english ?? firstValue(maps))
      : options.preferRomanized
        ? (romanized ?? localized ?? english ?? native ?? firstValue(maps))
        : (localized ?? english ?? romanized ?? native ?? firstValue(maps))
  if (!name) {
    return undefined
  }

  const aliases = collectAliases(maps, [name, native ?? ''])

  return {
    name,
    ...(native !== undefined ? { originalName: native } : {}),
    ...(aliases.length > 0 ? { aliases } : {})
  }
}

/** Description maps use the same locale scheme with an English center. */
export function selectDescription(
  description: MdLocalizedString | null | undefined,
  locale: ContentLocale
): string | undefined {
  if (!description) {
    return undefined
  }

  const maps = [description]
  const text = pick(maps, MD_LOCALE_CANDIDATES[locale]) ?? pick(maps, ['en']) ?? firstValue(maps)
  return text?.trim() || undefined
}

function pick(maps: readonly MdLocalizedString[], codes: readonly string[]): string | undefined {
  for (const code of codes) {
    for (const map of maps) {
      const value = map[code]?.trim()
      if (value) {
        return value
      }
    }
  }
  return undefined
}

function firstValue(maps: readonly MdLocalizedString[]): string | undefined {
  for (const map of maps) {
    for (const value of Object.values(map)) {
      const trimmed = value?.trim()
      if (trimmed) {
        return trimmed
      }
    }
  }
  return undefined
}

function collectAliases(maps: readonly MdLocalizedString[], exclude: readonly string[]): string[] {
  const excluded = new Set(exclude.map((value) => value.trim()).filter(Boolean))
  const seen = new Set<string>()
  const aliases: string[] = []

  for (const map of maps) {
    for (const value of Object.values(map)) {
      const trimmed = value?.trim()
      if (!trimmed || excluded.has(trimmed) || seen.has(trimmed)) {
        continue
      }
      seen.add(trimmed)
      aliases.push(trimmed)
      if (aliases.length >= MAX_ALIASES) {
        return aliases
      }
    }
  }

  return aliases
}
