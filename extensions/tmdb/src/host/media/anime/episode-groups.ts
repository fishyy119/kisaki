import type { TmdbEpisodeGroupDetail, TmdbEpisodeGroupItem } from '../../api/types'
import { m } from '../../i18n'
import { TmdbExtensionError } from '../../utils/errors'
import { trimToUndefined } from '../format/text'

/**
 * Groups of one TMDB episode group, in reading order.
 *
 * TMDB returns them ordered and also numbers them, but the numbering is not
 * guaranteed to start anywhere in particular, so the declared order decides and
 * ties fall back to the response order. Position is presentation only: entry ids
 * name a group by its own id.
 */
export function readEpisodeGroupItems(detail: TmdbEpisodeGroupDetail): TmdbEpisodeGroupItem[] {
  return [...(detail.groups ?? [])]
    .map((group, index) => ({ group, order: group.order ?? index, index }))
    .sort((left, right) => left.order - right.order || left.index - right.index)
    .map((entry) => entry.group)
}

export interface TmdbEpisodeGroupPosition {
  item: TmdbEpisodeGroupItem
  /** Where the group reads, for display and neighbours only. */
  index: number
}

/** Locates a group by the id an entry stores. */
export function findEpisodeGroupItem(
  detail: TmdbEpisodeGroupDetail,
  groupId: string
): TmdbEpisodeGroupPosition {
  const items = readEpisodeGroupItems(detail)
  if (items.length === 0) {
    throw new TmdbExtensionError(
      'tmdb_not_found',
      m().errors.episodeGroupEmpty({ setId: detail.id })
    )
  }

  const index = items.findIndex((item) => item.id === groupId)
  if (index < 0) {
    throw new TmdbExtensionError(
      'tmdb_not_found',
      m().errors.episodeGroupMissing({ setId: detail.id, groupId })
    )
  }

  return { item: items[index]!, index }
}

/**
 * The series an episode group belongs to.
 *
 * TMDB does not state it on the group itself, so it is read from the episodes,
 * which each carry their show id.
 */
export function readEpisodeGroupSeriesId(detail: TmdbEpisodeGroupDetail): number | undefined {
  for (const group of detail.groups ?? []) {
    for (const episode of group.episodes ?? []) {
      if (typeof episode.show_id === 'number') {
        return episode.show_id
      }
    }
  }

  return undefined
}

/**
 * Display name of one group, qualified by its episode group when that adds
 * information. TMDB frequently names a group after the whole episode group, so
 * an overlapping pair collapses to the more specific half.
 */
export function composeEpisodeGroupPartName(
  detail: TmdbEpisodeGroupDetail,
  item: TmdbEpisodeGroupItem,
  index: number
): string {
  // Not user-facing copy: neutral stand-ins for names TMDB left blank.
  const setName = trimToUndefined(detail.name) ?? 'Episode group'
  const groupName = trimToUndefined(item.name) ?? `Group ${index + 1}`
  const overlaps =
    groupName.toLowerCase().includes(setName.toLowerCase()) ||
    setName.toLowerCase().includes(groupName.toLowerCase())

  return overlaps ? groupName : `${setName} ${groupName}`
}
