import type {
  LibraryAnimeFormat,
  LibraryComicFormat,
  LibraryNovelFormat
} from '@kisaki3/extension-sdk'

/**
 * The three library media types MAL serves from its two entity families.
 *
 * Anime is its own family; the manga family splits by `media_type` into
 * novels (`light_novel`, `novel`) and comics (everything else).
 */
export type MalMediaKind = 'anime' | 'comic' | 'novel'

/** Which family an id belongs to decides the API path. */
export function toMalFamily(kind: MalMediaKind): 'anime' | 'manga' {
  return kind === 'anime' ? 'anime' : 'manga'
}

export function resolveMangaKind(mediaType: string | null | undefined): 'comic' | 'novel' {
  return mediaType === 'light_novel' || mediaType === 'novel' ? 'novel' : 'comic'
}

export function mapAnimeFormat(
  mediaType: string | null | undefined
): LibraryAnimeFormat | undefined {
  switch (mediaType) {
    case 'tv':
      return 'tv'
    case 'movie':
      return 'movie'
    case 'ova':
      return 'ova'
    case 'ona':
      return 'ona'
    case 'special':
    case 'tv_special':
      return 'special'
    case 'music':
    case 'cm':
    case 'pv':
      return 'other'
    default:
      return undefined
  }
}

export function mapComicFormat(mediaType: string | null | undefined): LibraryComicFormat {
  switch (mediaType) {
    case 'manga':
      return 'manga'
    case 'manhwa':
      return 'manhwa'
    case 'manhua':
      return 'manhua'
    case 'doujinshi':
      return 'doujinshi'
    default:
      return 'other'
  }
}

export function mapNovelFormat(mediaType: string | null | undefined): LibraryNovelFormat {
  return mediaType === 'light_novel' ? 'lightNovel' : 'general'
}
