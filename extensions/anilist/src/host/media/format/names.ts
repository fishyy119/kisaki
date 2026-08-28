import type { ContentLocale } from '@kisaki3/extension-sdk'
import type { AnilistName, AnilistTitle } from '../../api/types'
import { trimToUndefined } from './text'

export interface TitleSelection {
  name: string
  originalName?: string
  aliases?: string[]
}

/**
 * AniList carries romaji, English, and native titles but no Chinese ones, so
 * locale resolution is: Japanese locales read the native title, everything
 * else reads English (or romaji when preferred or English is absent). The
 * titles not chosen become aliases together with the community synonyms.
 */
export function selectMediaTitles(
  title: AnilistTitle | null | undefined,
  synonyms: readonly (string | null)[] | null | undefined,
  options: { locale: ContentLocale; preferRomaji: boolean }
): TitleSelection | undefined {
  const romaji = trimToUndefined(title?.romaji)
  const english = trimToUndefined(title?.english)
  const native = trimToUndefined(title?.native)

  const name =
    options.locale === 'ja'
      ? (native ?? romaji ?? english)
      : options.preferRomaji
        ? (romaji ?? english ?? native)
        : (english ?? romaji ?? native)
  if (!name) {
    return undefined
  }

  const aliases = dedupeNames([english, romaji, native, ...(synonyms ?? [])], [name, native ?? ''])

  return {
    name,
    ...(native !== undefined ? { originalName: native } : {}),
    ...(aliases.length > 0 ? { aliases } : {})
  }
}

export interface PersonNameSelection {
  name: string
  originalName?: string
  aliases?: string[]
}

/** Staff and characters share the full/native/alternative name shape. */
export function selectPersonNames(
  name: AnilistName | null | undefined,
  options: { locale: ContentLocale }
): PersonNameSelection | undefined {
  const full = trimToUndefined(name?.full)
  const native = trimToUndefined(name?.native)

  const display = options.locale === 'ja' ? (native ?? full) : (full ?? native)
  if (!display) {
    return undefined
  }

  const aliases = dedupeNames([full, native, ...(name?.alternative ?? [])], [display, native ?? ''])

  return {
    name: display,
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
