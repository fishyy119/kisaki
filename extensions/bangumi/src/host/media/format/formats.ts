import type { LibraryAnimeFormat } from '@kisaki3/extension-sdk'
import { normalizeToken } from './text'

/**
 * Map the Bangumi anime platform label to a library format.
 *
 * The label is free text on the entry, so unknown wording stays `other`
 * instead of guessing a shape the source never stated.
 */
export function mapBangumiAnimeFormat(platform?: string | null): LibraryAnimeFormat | undefined {
  const normalized = normalizeToken(platform)
  if (!normalized) return undefined

  if (normalized === 'tv' || normalized.includes('tv')) return 'tv'
  if (normalized.includes('剧场版') || normalized.includes('劇場版') || normalized.includes('movie')) {
    return 'movie'
  }
  if (normalized.includes('ova') || normalized.includes('oad')) return 'ova'
  if (normalized.includes('web') || normalized.includes('ona') || normalized.includes('动态漫画')) {
    return 'ona'
  }
  if (normalized.includes('sp') || normalized.includes('特别篇') || normalized.includes('特別篇')) {
    return 'special'
  }

  return 'other'
}
