import type { PartialDate } from '@kisaki3/extension-sdk'

/**
 * Parses a VNDB release date.
 *
 * Release dates are `YYYY-MM-DD` with `99` standing in for an unknown month or
 * day, and `TBA` for a work with no announced date at all. Each shape maps to
 * the partial date that states exactly what VNDB knows.
 */
export function parseVndbReleaseDate(input: string | null | undefined): PartialDate | undefined {
  const value = input?.trim()
  if (!value || value.toLowerCase() === 'tba') {
    return undefined
  }

  const match = /^(\d{4})(?:-(\d{2}))?(?:-(\d{2}))?$/.exec(value)
  if (!match) {
    return undefined
  }

  const year = Number(match[1])
  if (year < 1 || year >= 3000) {
    return undefined
  }

  const date: PartialDate = { year }

  const month = match[2] === undefined ? undefined : Number(match[2])
  if (month === undefined || month < 1 || month > 12) {
    return date
  }
  date.month = month

  const day = match[3] === undefined ? undefined : Number(match[3])
  if (day !== undefined && day >= 1 && day <= 31) {
    date.day = day
  }

  return date
}

/** Character birthdays are `[month, day]`; VNDB never states a birth year. */
export function parseVndbBirthday(
  birthday: readonly (number | null)[] | null | undefined
): PartialDate | undefined {
  const month = birthday?.[0]
  const day = birthday?.[1]
  if (
    !Number.isInteger(month) ||
    !Number.isInteger(day) ||
    month! < 1 ||
    month! > 12 ||
    day! < 1 ||
    day! > 31
  ) {
    return undefined
  }

  return { month: month!, day: day! }
}

/** Measurements are centimetres or kilograms; zero means "not stated". */
export function toPositiveNumber(value: number | null | undefined): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? value : undefined
}
