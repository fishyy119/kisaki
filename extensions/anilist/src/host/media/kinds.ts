import type {
  LibraryAnimeFormat,
  LibraryComicFormat,
  LibraryNovelFormat
} from '@kisaki3/extension-sdk'

/**
 * The three library media types AniList serves from one Media entity.
 *
 * A kind is a GraphQL filter plus a format vocabulary: anime is the ANIME
 * type, novels are MANGA rows in the NOVEL format, and comics are the
 * remaining MANGA rows.
 */
export type AnilistMediaKind = 'anime' | 'comic' | 'novel'

export interface AnilistKindFilters {
  type: 'ANIME' | 'MANGA'
  formatIn?: string[]
  formatNotIn?: string[]
}

export const ANILIST_KIND_FILTERS: Record<AnilistMediaKind, AnilistKindFilters> = {
  anime: { type: 'ANIME' },
  comic: { type: 'MANGA', formatNotIn: ['NOVEL'] },
  novel: { type: 'MANGA', formatIn: ['NOVEL'] }
}

/** Which kind an arbitrary Media row belongs to, if any. */
export function resolveMediaKind(
  type: string | null | undefined,
  format: string | null | undefined
): AnilistMediaKind | undefined {
  if (type === 'ANIME') {
    return 'anime'
  }
  if (type === 'MANGA') {
    return format === 'NOVEL' ? 'novel' : 'comic'
  }
  return undefined
}

export function mapAnimeFormat(format: string | null | undefined): LibraryAnimeFormat | undefined {
  switch (format) {
    case 'TV':
    case 'TV_SHORT':
      return 'tv'
    case 'MOVIE':
      return 'movie'
    case 'OVA':
      return 'ova'
    case 'ONA':
      return 'ona'
    case 'SPECIAL':
      return 'special'
    case 'MUSIC':
      return 'other'
    default:
      return undefined
  }
}

/** Comic formats come from the origin country, not the format enum. */
export function mapComicFormat(country: string | null | undefined): LibraryComicFormat {
  switch (country) {
    case 'KR':
      return 'manhwa'
    case 'CN':
    case 'TW':
      return 'manhua'
    default:
      return 'manga'
  }
}

/** AniList's NOVEL format is the light-novel shelf. */
export function mapNovelFormat(): LibraryNovelFormat {
  return 'lightNovel'
}
