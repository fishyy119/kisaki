import type { PartialDate } from '@kisaki3/extension-sdk'

const PARTIAL_DATE_KEYS = new Set(['year', 'month', 'day'])

export function parseBangumiSubjectDate(input: string | null | undefined): PartialDate | undefined {
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
      return normalizePartialDate({ month, day })
    }
    return normalizePartialDate({ year, month, day })
  }

  const yearMonthMatch = value.match(/^(\d{4})[-/.](\d{1,2})$/)
  if (yearMonthMatch) {
    const year = Number(yearMonthMatch[1])
    const month = Number(yearMonthMatch[2])
    if (year >= 3000) {
      return undefined
    }
    return normalizePartialDate({ year, month })
  }

  const yearOnlyMatch = value.match(/^(\d{4})$/)
  if (yearOnlyMatch) {
    const year = Number(yearOnlyMatch[1])
    if (year >= 3000) {
      return undefined
    }
    return normalizePartialDate({ year })
  }

  const monthDayMatch = value.match(/^(\d{1,2})[-/.](\d{1,2})$/)
  if (monthDayMatch) {
    const month = Number(monthDayMatch[1])
    const day = Number(monthDayMatch[2])
    return normalizePartialDate({ month, day })
  }

  return undefined
}

export function toPartialDateFromParts(
  year?: number | null,
  month?: number | null,
  day?: number | null
): PartialDate | undefined {
  const y =
    Number.isInteger(year) && (year as number) > 0 && (year as number) < 3000 ? year : undefined
  const m =
    Number.isInteger(month) && (month as number) >= 1 && (month as number) <= 12 ? month : undefined
  const d = Number.isInteger(day) && (day as number) >= 1 && (day as number) <= 31 ? day : undefined

  if (y && m && d) return { year: y, month: m, day: d }
  if (y && m) return { year: y, month: m }
  if (y) return { year: y }
  if (m && d) return { month: m, day: d }
  return undefined
}

function isInteger(value: unknown): value is number {
  return typeof value === 'number' && Number.isInteger(value)
}

function normalizePartialDate(value: PartialDate | null | undefined): PartialDate | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }

  const record = value as Record<string, unknown>
  const keys = Object.keys(record)

  if (keys.length === 0) {
    return undefined
  }

  if (keys.some((key) => !PARTIAL_DATE_KEYS.has(key))) {
    return undefined
  }

  const hasYear = 'year' in record
  const hasMonth = 'month' in record
  const hasDay = 'day' in record

  if (hasYear && hasDay && !hasMonth) {
    return undefined
  }

  if (hasYear && !isInteger(record.year)) {
    return undefined
  }

  if (hasMonth && !isInteger(record.month)) {
    return undefined
  }

  if (hasDay && !isInteger(record.day)) {
    return undefined
  }

  const normalized: PartialDate = {}
  if (record.year !== undefined) normalized.year = record.year as number
  if (record.month !== undefined) normalized.month = record.month as number
  if (record.day !== undefined) normalized.day = record.day as number
  return normalized
}
