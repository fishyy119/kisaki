import type { PartialDate } from '@shared/db'
import { normalizePartialDate } from '@shared/db/columns/partial-date'

/** Scraped components only become a date when they satisfy the stored contract. */
function toPartialDate(components: PartialDate): PartialDate | undefined {
  return normalizePartialDate(components) ?? undefined
}

/** Parse scraper date text into PartialDate. */
export function parsePartialDate(input: string | null | undefined): PartialDate | undefined {
  if (!input) {
    return undefined
  }

  const value = input.trim()
  if (!value) {
    return undefined
  }

  const lower = value.toLowerCase()
  if (lower === 'tba' || lower === 'unknown' || lower === 'n/a') {
    return undefined
  }

  const fullMatch = value.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:T.*)?$/)
  if (fullMatch) {
    const year = Number(fullMatch[1])
    const month = Number(fullMatch[2])
    const day = Number(fullMatch[3])
    if (year >= 3000) {
      return toPartialDate({ month, day })
    }
    return toPartialDate({ year, month, day })
  }

  const yearMonthMatch = value.match(/^(\d{4})[-/.](\d{1,2})$/)
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1])
    const month = Number(yearMonthMatch[2])
    if (year >= 3000) {
      return undefined
    }
    return toPartialDate({ year, month })
  }

  const yearOnlyMatch = value.match(/^(\d{4})$/)
  if (yearOnlyMatch) {
    const year = Number(yearOnlyMatch[1])
    if (year >= 3000) {
      return undefined
    }
    return toPartialDate({ year })
  }

  const monthDayMatch = value.match(/^(\d{1,2})[-/.](\d{1,2})$/)
  if (monthDayMatch) {
    const month = Number(monthDayMatch[1])
    const day = Number(monthDayMatch[2])
    return toPartialDate({ month, day })
  }

  return undefined
}
