import type { ContentLocale } from '@kisaki3/extension-sdk'
import type { MalAlternativeTitles } from '../../api/types'
import { trimToUndefined } from './text'

export interface TitleSelection {
  name: string
  originalName?: string
  aliases?: string[]
}

/**
 * MAL's `title` is the romaji title; `alternative_titles` carries English and
 * Japanese plus synonyms. Japanese locales read the native title, everything
 * else reads English (or romaji when preferred or English is absent). The
 * titles not chosen become aliases together with the synonyms.
 */
export function selectMalTitles(
  title: string | null | undefined,
  alternatives: MalAlternativeTitles | null | undefined,
  options: { locale: ContentLocale; preferRomaji: boolean }
): TitleSelection | undefined {
  const romaji = trimToUndefined(title)
  const english = trimToUndefined(alternatives?.en)
  const native = trimToUndefined(alternatives?.ja)

  const name =
    options.locale === 'ja'
      ? (native ?? romaji ?? english)
      : options.preferRomaji
        ? (romaji ?? english ?? native)
        : (english ?? romaji ?? native)
  if (!name) {
    return undefined
  }

  const aliases = dedupeNames(
    [english, romaji, native, ...(alternatives?.synonyms ?? [])],
    [name, native ?? '']
  )

  return {
    name,
    ...(native !== undefined ? { originalName: native } : {}),
    ...(aliases.length > 0 ? { aliases } : {})
  }
}

function dedupeNames(
  candidates: readonly (string | null | undefined)[],
  exclude: readonly string[]
): string[] {
  const excluded = new Set(exclude.map((value) => value.trim()).filter(Boolean))
  const seen = new Set<string>()
  const names: string[] = []

  for (const candidate of candidates) {
    const value = candidate?.trim()
    if (!value || excluded.has(value) || seen.has(value)) {
      continue
    }
    seen.add(value)
    names.push(value)
  }

  return names
}
