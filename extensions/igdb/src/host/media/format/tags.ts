import type { LibraryGender, ScrapedTag } from '@kisaki3/extension-sdk'
import { trimToUndefined } from './text'

/** Note text is a stable machine-readable qualifier, not translatable copy. */
export const TAG_NOTES = {
  gameType: 'Game Type',
  gameStatus: 'Game Status',
  gameMode: 'Game Mode',
  playerPerspective: 'Player Perspective',
  platform: 'Platform',
  languageSupport: 'Language Support',
  releaseStatus: 'Release Status',
  species: 'Species',
  country: 'Country'
} as const

export function dedupeTags(tags: readonly ScrapedTag[]): ScrapedTag[] {
  const seen = new Set<string>()
  const output: ScrapedTag[] = []

  for (const tag of tags) {
    const name = trimToUndefined(tag.name)
    if (!name) {
      continue
    }

    const note = trimToUndefined(tag.note)
    const key = `${name.toLowerCase()}::${note?.toLowerCase() ?? ''}`
    if (seen.has(key)) {
      continue
    }

    seen.add(key)
    output.push(note ? { name, note } : { name })
  }

  return output
}

/**
 * IGDB's character gender vocabulary is an open table rather than a fixed
 * enum, so anything beyond male and female maps to `other` instead of being
 * dropped: the source did state a gender.
 */
export function mapGender(name: string | null | undefined): LibraryGender | undefined {
  const token = trimToUndefined(name)?.toLowerCase()
  if (!token) {
    return undefined
  }

  if (token === 'male') {
    return 'male'
  }
  if (token === 'female') {
    return 'female'
  }
  return 'other'
}
