import type { PartialDate } from '@kisaki3/extension-sdk'

/**
 * Parses the date shapes YMGal archives use.
 *
 * Archives carry release dates and birthdays as free text, so precision varies
 * from a full date down to a year, and a birthday often omits the year
 * entirely. Each shape maps to the partial date that states exactly what the
 * source knows; anything else (placeholders, prose) is unknown.
 */
export function parseYmgalDate(input: string | null | undefined): PartialDate | undefined {
  const value = input?.trim()
  if (!value || isPlaceholder(value)) {
    return undefined
  }

  const full = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})(?:[T\s].*)?$/.exec(value)
  if (full) {
    return toPartialDate(Number(full[1]), Number(full[2]), Number(full[3]))
  }

  const yearMonth = /^(\d{4})[-/.](\d{1,2})$/.exec(value)
  if (yearMonth) {
    return toPartialDate(Number(yearMonth[1]), Number(yearMonth[2]), undefined)
  }

  const yearOnly = /^(\d{4})$/.exec(value)
  if (yearOnly) {
    return toPartialDate(Number(yearOnly[1]), undefined, undefined)
  }

  // A birthday with no year; the day is what the source actually states.
  const monthDay = /^(\d{1,2})[-/.](\d{1,2})$/.exec(value)
  if (monthDay) {
    return toPartialDate(undefined, Number(monthDay[1]), Number(monthDay[2]))
  }

  return undefined
}

function isPlaceholder(value: string): boolean {
  const lower = value.toLowerCase()
  return lower === 'tba' || lower === 'unknown' || lower === 'n/a'
}

function toPartialDate(
  year: number | undefined,
  month: number | undefined,
  day: number | undefined
): PartialDate | undefined {
  if (year !== undefined && (year < 1 || year >= 3000)) {
    return undefined
  }
  if (month !== undefined && (month < 1 || month > 12)) {
    return undefined
  }
  if (day !== undefined && (day < 1 || day > 31)) {
    return undefined
  }

  // A day without a month names nothing, and an empty date is not a date.
  if (day !== undefined && month === undefined) {
    return undefined
  }
  if (year === undefined && month === undefined) {
    return undefined
  }

  const date: PartialDate = {}
  if (year !== undefined) {
    date.year = year
  }
  if (month !== undefined) {
    date.month = month
  }
  if (day !== undefined) {
    date.day = day
  }
  return date
}
