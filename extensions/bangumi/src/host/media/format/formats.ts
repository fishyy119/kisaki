import type {
  LibraryAnimeFormat,
  LibraryComicFormat,
  LibraryNovelFormat
} from '@kisaki3/extension-sdk'
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
  if (
    normalized.includes('剧场版') ||
    normalized.includes('劇場版') ||
    normalized.includes('movie')
  ) {
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

/** Library a Bangumi book subject belongs to. */
export type BangumiBookKind = 'comic' | 'novel'

/**
 * Which library a Bangumi book subject belongs to, at the platform grain.
 *
 * Bangumi folds comics, novels, and art books into one subject type, and the
 * platform label is the only per-entry fact that separates them. Art books
 * are deliberately unclaimed: they have no unit a reader pages through, so
 * neither library takes them automatically. An unlabelled entry answers
 * `undefined` too — unknown is not a licence to guess.
 */
export function resolveBangumiBookKind(platform?: string | null): BangumiBookKind | undefined {
  const normalized = normalizeToken(platform)
  if (!normalized) return undefined

  if (
    normalized.includes('画集') ||
    normalized.includes('畫集') ||
    normalized.includes('绘本') ||
    normalized.includes('繪本') ||
    normalized.includes('artbook')
  ) {
    return undefined
  }

  if (
    normalized.includes('漫画') ||
    normalized.includes('漫畫') ||
    normalized.includes('条漫') ||
    normalized.includes('條漫') ||
    normalized.includes('comic') ||
    normalized.includes('manga') ||
    normalized.includes('webtoon')
  ) {
    return 'comic'
  }

  if (normalized.includes('小说') || normalized.includes('小說') || normalized.includes('novel')) {
    return 'novel'
  }

  return undefined
}

/**
 * Map the Bangumi book platform label to a comic format.
 *
 * Bangumi does not state the regional tradition, so the split rests on the
 * series wording it does use; unknown wording stays `other`.
 */
export function mapBangumiComicFormat(platform?: string | null): LibraryComicFormat | undefined {
  const normalized = normalizeToken(platform)
  if (!normalized) return undefined

  if (normalized.includes('同人')) return 'doujinshi'
  if (
    normalized.includes('webtoon') ||
    normalized.includes('条漫') ||
    normalized.includes('條漫')
  ) {
    return 'webtoon'
  }
  if (normalized.includes('漫画') || normalized.includes('漫畫') || normalized.includes('manga')) {
    return 'manga'
  }

  return 'other'
}

/** Map the Bangumi book platform label to a novel format. */
export function mapBangumiNovelFormat(platform?: string | null): LibraryNovelFormat | undefined {
  const normalized = normalizeToken(platform)
  if (!normalized) return undefined

  if (
    normalized.includes('轻小说') ||
    normalized.includes('輕小說') ||
    normalized.includes('lightnovel') ||
    normalized.includes('ラノベ')
  ) {
    return 'lightNovel'
  }
  if (normalized.includes('网络') || normalized.includes('網路') || normalized.includes('web')) {
    return 'webNovel'
  }
  if (normalized.includes('小说') || normalized.includes('小說') || normalized.includes('novel')) {
    return 'general'
  }

  return 'other'
}
