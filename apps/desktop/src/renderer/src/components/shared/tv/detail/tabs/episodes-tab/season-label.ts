/**
 * Season display labels shared by the season header, the episode form's season
 * picker, and the episode dialog title. Season 0 is the industry's own encoding
 * for specials, so it reads as such rather than as "Season 0".
 */

import type { Messages } from '@shared/i18n'
import type { TvSeason } from '@shared/db'

/** Anthology seasons carry their own title; the rest read as a number. */
export function formatTvSeasonLabel(
  season: Pick<TvSeason, 'seasonNumber' | 'name'>,
  m: Messages
): string {
  if (season.name) return season.name
  if (season.seasonNumber === 0) return m.tv.seasons.specials
  return m.tv.seasons.unnamed({ number: season.seasonNumber })
}
