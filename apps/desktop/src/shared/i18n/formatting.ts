/**
 * Locale-aware display formatting built on the Intl API.
 *
 * Pure factories only: no reactive state, no process-specific dependencies.
 * Formatters accept non-null values; callers decide how to render absent data
 * (usually with a message from the catalog).
 */

import type { PartialDate } from '../db'
import type { UiLocale } from './locales'

export interface I18nFormatters {
  /** Full calendar date, e.g. "January 5, 2026". Accepts partial dates. */
  date(date: Date | PartialDate): string
  /** Calendar date with time, e.g. "Jan 5, 2026, 15:30". */
  dateTime(date: Date): string
  /** Time of day, e.g. "15:30". */
  time(date: Date): string
  /** Compact date range, e.g. "Jan 1 – Jan 31, 2026". */
  dateRange(start: Date, end: Date): string
  /** Month-day range without year, e.g. "Jan 5 – Jan 11". */
  monthDayRange(start: Date, end: Date): string
  /** Year and month, e.g. "January 2026". */
  yearMonth(date: Date): string
  /** Date-time range within close days, e.g. "1/5, 15:30 – 17:00". */
  dateTimeRange(start: Date, end: Date): string
  /** Relative time from now, e.g. "3 days ago". */
  relativeTime(date: Date): string
  /** Human-readable duration in hours and minutes, e.g. "1 hr 5 min". */
  duration(ms: number): string
  /** Duration with seconds (and sub-second) precision, e.g. "1 min 5 sec" / "800 ms". */
  durationFine(ms: number): string
  /** Compact duration for dense UI, e.g. "12.5h" / "30m". */
  durationCompact(ms: number): string
  /** Grouped decimal number. */
  number(value: number): string
  /** Percentage from a 0-100 value, e.g. "45.7%". */
  percent(value: number, fractionDigits?: number): string
  /** Standalone month name for chart axes, from month number 1-12. */
  monthName(month: number): string
  /** Standalone short weekday name for chart axes, from ISO day 1 (Monday) to 7 (Sunday). */
  weekdayName(isoDay: number): string
  /** Display name of a language tag, e.g. "日本語". */
  languageName(tag: string): string
}

/**
 * Autonym (self-name) of a language tag, e.g. "日本語" for "ja".
 * Used by language pickers so every option is readable in its own language.
 */
export function languageAutonym(tag: string): string {
  const name = new Intl.DisplayNames(tag, { type: 'language' }).of(tag)
  if (!name) {
    return tag
  }
  return name.charAt(0).toLocaleUpperCase(tag) + name.slice(1)
}

/** Create cached Intl formatters for one UI locale. */
export function createFormatters(locale: UiLocale): I18nFormatters {
  const dateFull = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  })
  const dateYearMonth = new Intl.DateTimeFormat(locale, { year: 'numeric', month: 'long' })
  const dateYear = new Intl.DateTimeFormat(locale, { year: 'numeric' })
  const dateMonthDay = new Intl.DateTimeFormat(locale, { month: 'long', day: 'numeric' })
  const dateMonth = new Intl.DateTimeFormat(locale, { month: 'long' })
  const dateDay = new Intl.DateTimeFormat(locale, { day: 'numeric' })
  const dateTime = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const timeOnly = new Intl.DateTimeFormat(locale, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const dateShort = new Intl.DateTimeFormat(locale, {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  })
  const monthDayShort = new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric' })
  const dayTime = new Intl.DateTimeFormat(locale, {
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false
  })
  const relative = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })
  const duration = new Intl.DurationFormat(locale, { style: 'short' })
  const hoursCompact = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'hour',
    unitDisplay: 'narrow',
    maximumFractionDigits: 1
  })
  const minutesCompact = new Intl.NumberFormat(locale, {
    style: 'unit',
    unit: 'minute',
    unitDisplay: 'narrow',
    maximumFractionDigits: 0
  })
  const decimal = new Intl.NumberFormat(locale)
  const monthStandalone = new Intl.DateTimeFormat(locale, { month: 'short' })
  const weekdayStandalone = new Intl.DateTimeFormat(locale, { weekday: 'short' })
  const languageNames = new Intl.DisplayNames(locale, { type: 'language' })

  return {
    date(value) {
      if (value instanceof Date) {
        return dateFull.format(value)
      }
      return formatPartialDate(value, {
        dateFull,
        dateYearMonth,
        dateYear,
        dateMonthDay,
        dateMonth,
        dateDay
      })
    },
    dateTime(value) {
      return dateTime.format(value)
    },
    time(value) {
      return timeOnly.format(value)
    },
    dateRange(start, end) {
      return dateShort.formatRange(start, end)
    },
    monthDayRange(start, end) {
      return monthDayShort.formatRange(start, end)
    },
    yearMonth(date) {
      return dateYearMonth.format(date)
    },
    dateTimeRange(start, end) {
      return dayTime.formatRange(start, end)
    },
    relativeTime(value) {
      const [amount, unit] = pickRelativeUnit(value.getTime() - Date.now())
      return relative.format(amount, unit)
    },
    duration(ms) {
      const totalMinutes = Math.floor(Math.max(0, ms) / 60000)
      const hours = Math.floor(totalMinutes / 60)
      const minutes = totalMinutes % 60
      if (hours > 0) {
        return duration.format(minutes > 0 ? { hours, minutes } : { hours })
      }
      return duration.format({ minutes })
    },
    durationFine(ms) {
      const safeMs = Math.max(0, Math.floor(ms))
      if (safeMs < 1000) {
        return duration.format({ milliseconds: safeMs })
      }
      const totalSeconds = Math.floor(safeMs / 1000)
      const seconds = totalSeconds % 60
      const minutes = Math.floor(totalSeconds / 60) % 60
      const hours = Math.floor(totalSeconds / 3600)
      const parts: Record<string, number> = {}
      if (hours > 0) parts.hours = hours
      if (minutes > 0) parts.minutes = minutes
      if (seconds > 0 || (hours === 0 && minutes === 0)) parts.seconds = seconds
      return duration.format(parts)
    },
    durationCompact(ms) {
      const hours = Math.max(0, ms) / 3600000
      if (hours >= 1) {
        return hoursCompact.format(Math.round(hours * 10) / 10)
      }
      return minutesCompact.format(Math.floor(Math.max(0, ms) / 60000))
    },
    number(value) {
      return decimal.format(value)
    },
    percent(value, fractionDigits = 1) {
      return `${value.toFixed(fractionDigits)}%`
    },
    monthName(month) {
      return monthStandalone.format(new Date(2000, month - 1, 1))
    },
    weekdayName(isoDay) {
      // 2024-01-01 is a Monday; offset by ISO day 1-7.
      return weekdayStandalone.format(new Date(2024, 0, isoDay))
    },
    languageName(tag) {
      return languageNames.of(tag) ?? tag
    }
  }
}

interface PartialDateFormatters {
  dateFull: Intl.DateTimeFormat
  dateYearMonth: Intl.DateTimeFormat
  dateYear: Intl.DateTimeFormat
  dateMonthDay: Intl.DateTimeFormat
  dateMonth: Intl.DateTimeFormat
  dateDay: Intl.DateTimeFormat
}

function createLocalDate(year: number, month = 1, day = 1): Date {
  const date = new Date(0)
  date.setFullYear(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date
}

function formatPartialDate(value: PartialDate, formatters: PartialDateFormatters): string {
  const { year, month, day } = value

  if (year && month && day) {
    return formatters.dateFull.format(createLocalDate(year, month, day))
  }
  if (year && month) {
    return formatters.dateYearMonth.format(createLocalDate(year, month))
  }
  if (year) {
    return formatters.dateYear.format(createLocalDate(year))
  }
  if (month && day) {
    return formatters.dateMonthDay.format(createLocalDate(2000, month, day))
  }
  if (month) {
    return formatters.dateMonth.format(createLocalDate(2000, month))
  }
  if (day) {
    return formatters.dateDay.format(createLocalDate(2000, 1, day))
  }

  return ''
}

const RELATIVE_UNITS: ReadonlyArray<
  [ms: number, limit: number, unit: Intl.RelativeTimeFormatUnit]
> = [
  [1000, 60, 'second'],
  [60000, 60, 'minute'],
  [3600000, 24, 'hour'],
  [86400000, 7, 'day'],
  [604800000, 4.35, 'week'],
  [2592000000, 12, 'month']
]

function pickRelativeUnit(diffMs: number): [number, Intl.RelativeTimeFormatUnit] {
  for (const [unitMs, limit, unit] of RELATIVE_UNITS) {
    const amount = Math.round(diffMs / unitMs)
    if (Math.abs(amount) < limit) {
      return [amount, unit]
    }
  }
  return [Math.round(diffMs / 31536000000), 'year']
}
