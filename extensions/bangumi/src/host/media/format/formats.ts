import type {
  LibraryAnimeFormat,
  LibraryComicFormat,
  LibraryNovelFormat,
  MediaEntryGrain
} from '@kisaki3/extension-sdk'
import type { BangumiInfoboxItem, BangumiTag } from '../../api/types'
import { extractInfoboxValuesByKeys } from './infobox'
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

/**
 * Layer a Bangumi book subject sits at.
 *
 * Only the series flag is trusted, and only when set: it marks the work
 * outright. `false` covers both a collected volume and a work that shipped in
 * a single release, so it separates nothing and stays unstated.
 */
export function resolveBangumiBookGrain(series?: boolean): MediaEntryGrain | undefined {
  return series === true ? 'work' : undefined
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
 * The subject fields book-format inference reads.
 *
 * A search row, a detail read, and an import row each carry a different subset
 * — an import row states only the platform label — so every signal is optional
 * and inference degrades to whatever it was given.
 */
export interface BangumiFormatSignals {
  platform?: string | null | undefined
  infobox?: BangumiInfoboxItem[] | null | undefined
  meta_tags?: string[] | null | undefined
  tags?: BangumiTag[] | null | undefined
}

/**
 * Top user tags trusted as a format signal.
 *
 * User tags are folk classification, so only the ones the crowd actually voted
 * for count; the tail is one person's private label.
 */
const USER_TAG_SIGNAL_LIMIT = 15

/**
 * Infobox keys naming the imprint a novel shipped under.
 *
 * These fields belong to Bangumi's light-novel wiki template, so a wiki editor
 * filling one in has effectively stated the format.
 */
const NOVEL_IMPRINT_INFOBOX_KEYS = ['文库', '文庫', '书系', '書系', 'レーベル']

const DOUJINSHI_MARKERS = ['同人']
const WEBTOON_MARKERS = ['webtoon', '条漫', '條漫']
const MANHWA_MARKERS = ['韩漫', '韓漫', 'manhwa']
const MANHUA_MARKERS = ['国漫', '國漫', 'manhua']
const COMIC_MARKERS = ['漫画', '漫畫', 'comic', 'manga']

const LIGHT_NOVEL_MARKERS = ['轻小说', '輕小說', 'lightnovel', 'ラノベ', 'ライトノベル']
const WEB_NOVEL_MARKERS = [
  '网络小说',
  '網路小說',
  '網絡小說',
  '网文',
  'web小说',
  'web小説',
  'webnovel'
]
const NOVEL_MARKERS = ['小说', '小說', 'novel']

/**
 * Which comic format a Bangumi book subject states.
 *
 * The platform label only ever says "a comic", so the regional tradition and
 * the doujinshi/webtoon split come from the tag vocabulary around it. Wording
 * none of the markers recognize stays `other`, and a subject that states
 * nothing at all answers `undefined` — unknown is not a licence to guess.
 */
export function resolveBangumiComicFormat(
  subject: BangumiFormatSignals
): LibraryComicFormat | undefined {
  const signals = readFormatSignals(subject)
  if (signals.length === 0) return undefined

  if (matchesAnyMarker(signals, DOUJINSHI_MARKERS)) return 'doujinshi'
  if (matchesAnyMarker(signals, WEBTOON_MARKERS)) return 'webtoon'
  if (matchesAnyMarker(signals, MANHWA_MARKERS)) return 'manhwa'
  if (matchesAnyMarker(signals, MANHUA_MARKERS)) return 'manhua'
  if (matchesAnyMarker(signals, COMIC_MARKERS)) return 'manga'

  return 'other'
}

/**
 * Which novel format a Bangumi book subject states.
 *
 * The platform label separates novels from comics and nothing further — every
 * novel reads `小说` there — so the light-novel answer comes from the imprint
 * field the wiki template carries, then from the tag vocabulary. The label is
 * only the fallback, and it can say no more than "a novel".
 */
export function resolveBangumiNovelFormat(
  subject: BangumiFormatSignals
): LibraryNovelFormat | undefined {
  if (extractInfoboxValuesByKeys(subject.infobox, NOVEL_IMPRINT_INFOBOX_KEYS).length > 0) {
    return 'lightNovel'
  }

  const signals = readFormatSignals(subject)
  if (signals.length === 0) return undefined

  if (matchesAnyMarker(signals, LIGHT_NOVEL_MARKERS)) return 'lightNovel'
  if (matchesAnyMarker(signals, WEB_NOVEL_MARKERS)) return 'webNovel'
  if (matchesAnyMarker(signals, NOVEL_MARKERS)) return 'general'

  return 'other'
}

/** Normalized tokens a format decision may read, platform first. */
function readFormatSignals(subject: BangumiFormatSignals): string[] {
  const userTags = [...(subject.tags ?? [])]
    .sort((left, right) => right.count - left.count)
    .slice(0, USER_TAG_SIGNAL_LIMIT)
    .map((tag) => tag.name)

  return [subject.platform, ...(subject.meta_tags ?? []), ...userTags]
    .map((value) => normalizeToken(value))
    .filter(Boolean)
}

function matchesAnyMarker(signals: readonly string[], markers: readonly string[]): boolean {
  return signals.some((signal) => markers.some((marker) => signal.includes(marker)))
}
