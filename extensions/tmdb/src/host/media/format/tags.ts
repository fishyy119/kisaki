import type { ScrapedTag } from '@kisaki3/extension-sdk'
import type { TmdbGenre, TmdbKeyword } from '../../api/types'
import { trimToUndefined } from './text'

/**
 * Genres and keywords as one tag list.
 *
 * TMDB localizes genre names but never keywords, and a keyword frequently
 * repeats a genre, so both streams are deduplicated case-insensitively with
 * genres kept first.
 */
export function buildTags(
  genres: readonly TmdbGenre[] | undefined,
  keywords: readonly TmdbKeyword[] | undefined
): ScrapedTag[] {
  const names = [...(genres ?? []), ...(keywords ?? [])]
    .map((entry) => trimToUndefined(entry.name))
    .filter((name): name is string => name !== undefined)

  const seen = new Set<string>()
  const tags: ScrapedTag[] = []

  for (const name of names) {
    const key = name.toLowerCase()
    if (seen.has(key)) {
      continue
    }
    seen.add(key)
    tags.push({ name })
  }

  return tags
}
