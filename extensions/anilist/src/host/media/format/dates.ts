import type { PartialDate } from '@kisaki3/extension-sdk'
import type { AnilistFuzzyDate } from '../../api/types'

/** Fuzzy dates null any member AniList does not know; keep exactly the rest. */
export function parseFuzzyDate(date: AnilistFuzzyDate | null | undefined): PartialDate | undefined {
  const year = readComponent(date?.year, 1, 2999)
  const month = readComponent(date?.month, 1, 12)
  const day = readComponent(date?.day, 1, 31)

  if (year === undefined) {
    // A month-day birthday without a year is still a statement.
    if (month === undefined) {
      return undefined
    }
    return { month, ...(day !== undefined ? { day } : {}) }
  }

  const result: PartialDate = { year }
  if (month !== undefined) {
    result.month = month
    if (day !== undefined) {
      result.day = day
    }
  }
  return result
}

function readComponent(
  value: number | null | undefined,
  min: number,
  max: number
): number | undefined {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? value
    : undefined
}
