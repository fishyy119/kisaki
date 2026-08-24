import type { PartialDate } from '@kisaki3/extension-sdk'
import type { IgdbReleaseDate } from '../../api/types'

/** IGDB timestamps are UTC seconds; zero stands in for "not stated". */
export function parseUnixDate(timestamp: number | null | undefined): PartialDate | undefined {
  if (!Number.isFinite(timestamp) || !timestamp) {
    return undefined
  }

  const date = new Date(timestamp * 1_000)
  if (Number.isNaN(date.getTime())) {
    return undefined
  }

  return {
    year: date.getUTCFullYear(),
    month: date.getUTCMonth() + 1,
    day: date.getUTCDate()
  }
}

/**
 * The game's release date, as precisely as IGDB states it.
 *
 * `first_release_date` is the canonical answer. When a game has none — common
 * for unreleased or region-staggered titles — the earliest dated release row
 * stands in, and a row with only a year or month contributes that much.
 */
export function resolveReleaseDate(
  firstReleaseDate: number | null | undefined,
  releaseDates: readonly IgdbReleaseDate[]
): PartialDate | undefined {
  const canonical = parseUnixDate(firstReleaseDate)
  if (canonical) {
    return canonical
  }

  const dated = releaseDates
    .filter((row) => Number.isFinite(row.date) && row.date)
    .sort((left, right) => (left.date ?? 0) - (right.date ?? 0))

  const earliest = parseUnixDate(dated[0]?.date)
  if (earliest) {
    return earliest
  }

  const fallback = releaseDates[0]
  if (!fallback) {
    return undefined
  }

  const year = Number.isFinite(fallback.y) ? (fallback.y ?? undefined) : undefined
  if (!year) {
    return undefined
  }

  const month = Number.isFinite(fallback.m) ? (fallback.m ?? undefined) : undefined
  return month && month >= 1 && month <= 12 ? { year, month } : { year }
}
