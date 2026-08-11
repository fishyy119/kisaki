import type {
  ContentLocale,
  LibraryAnimeEpisodeType,
  ScrapedAnimeEpisode
} from '@kisaki3/extension-sdk'
import type { BangumiEpisode, BangumiEpisodeType } from '../../../api/types'
import { BANGUMI_SOURCE_ID } from '../../../utils/constants'
import { omitUndefined } from '../../../utils/object'
import { parseBangumiSubjectDate } from '../../format/dates'
import { resolveLocalizedSubjectName } from '../../format/names'
import { normalizeDescription } from '../../format/text'

const MILLISECONDS_PER_SECOND = 1000

/**
 * Map Bangumi episodes to library episodes.
 *
 * Only main story and specials are library episodes; openings, endings,
 * trailers and other clips stay out because the library models them as extras
 * discovered from files, not as numbered entries.
 */
export function buildAnimeEpisodes(
  episodes: readonly BangumiEpisode[],
  locale?: ContentLocale
): ScrapedAnimeEpisode[] {
  const mapped: ScrapedAnimeEpisode[] = []
  const seen = new Set<string>()

  for (const episode of episodes) {
    const type = mapEpisodeType(episode.type)
    if (!type) continue

    const number = readEpisodeNumber(episode)
    if (number === undefined) continue

    const key = `${type}:${number}`
    if (seen.has(key)) continue
    seen.add(key)

    const { name, originalName } = resolveLocalizedSubjectName(
      episode.name,
      episode.name_cn,
      locale
    )

    mapped.push(
      omitUndefined({
        number,
        type,
        name: name || undefined,
        originalName: originalName || undefined,
        airDate: parseBangumiSubjectDate(episode.airdate),
        description: normalizeDescription(episode.desc),
        durationMs: readDurationMs(episode),
        externalIds: [{ source: BANGUMI_SOURCE_ID, id: String(episode.id) }]
      })
    )
  }

  return mapped
}

function mapEpisodeType(type: BangumiEpisodeType): LibraryAnimeEpisodeType | undefined {
  switch (type) {
    case 0:
      return 'regular'
    case 1:
      return 'special'
    default:
      return undefined
  }
}

/** `ep` is the main-story number; `sort` numbers the episode within its type. */
function readEpisodeNumber(episode: BangumiEpisode): number | undefined {
  for (const candidate of [episode.ep, episode.sort]) {
    if (typeof candidate === 'number' && Number.isFinite(candidate) && candidate > 0) {
      return candidate
    }
  }

  return undefined
}

function readDurationMs(episode: BangumiEpisode): number | undefined {
  const seconds = episode.duration_seconds
  if (typeof seconds === 'number' && Number.isFinite(seconds) && seconds > 0) {
    return Math.round(seconds * MILLISECONDS_PER_SECOND)
  }

  return parseDurationText(episode.duration)
}

/** Bangumi writes durations as `mm:ss`, `hh:mm:ss`, or free text. */
function parseDurationText(duration?: string): number | undefined {
  const value = duration?.trim()
  if (!value) return undefined

  const parts = value.split(':').map((part) => Number(part.trim()))
  if (parts.length < 2 || parts.length > 3 || parts.some((part) => !Number.isFinite(part))) {
    return undefined
  }

  const seconds = parts.reduce((total, part) => total * 60 + part, 0)
  return seconds > 0 ? seconds * MILLISECONDS_PER_SECOND : undefined
}
