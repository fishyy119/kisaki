/**
 * Date/time utilities (system local timezone)
 *
 * Conventions:
 * - We store instants as `Date` (epoch-ms under the hood).
 * - Any "calendar" logic (day/week/month/hour buckets, date-only parsing/formatting)
 *   MUST use system local time.
 * - Never use `new Date('YYYY-MM-DD')` for date-only strings (it parses as UTC).
 * - Pure calendar math and HTML input formatting only. Locale-aware display
 *   formatting lives in the i18n formatters (`useI18n().f`).
 */

export interface TimeSlice {
  start: Date
  end: Date
  durationMs: number
}

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

// =============================================================================
// Date Key Functions
// =============================================================================

/** Local calendar day key: `YYYY-MM-DD` (system timezone). */
export function toLocalDateKey(date: Date): string {
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  return `${y}-${m}-${d}`
}

/**
 * ISO week key: `YYYY-Www` (e.g., "2024-W01").
 * Week starts on Monday (ISO 8601).
 */
export function toLocalWeekKey(date: Date): string {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  // Thursday of current week determines the year
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7))
  const week1 = new Date(d.getFullYear(), 0, 4)
  const weekNum =
    1 +
    Math.round(((d.getTime() - week1.getTime()) / 86400000 - 3 + ((week1.getDay() + 6) % 7)) / 7)
  return `${d.getFullYear()}-W${pad2(weekNum)}`
}

/** Month key: `YYYY-MM` (e.g., "2024-01"). */
export function toLocalMonthKey(date: Date): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}`
}

/** Parse `YYYY-MM-DD` as a local midnight `Date`. */
export function parseLocalDateKey(key: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(key)
  if (!m) return null
  const date = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

// =============================================================================
// ISO Week Functions
// =============================================================================

/** Get year and ISO week number from a date */
export function getYearWeek(date: Date): { year: number; week: number } {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  d.setDate(d.getDate() + 4 - (d.getDay() || 7))
  const yearStart = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d.getTime() - yearStart.getTime()) / 86400000 + 1) / 7)
  return { year: d.getFullYear(), week }
}

/** Get the start date of a week (Monday) given year and week number */
export function getWeekStartDate(year: number, week: number): Date {
  // ISO week date calculation
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const firstMonday = new Date(jan4)
  firstMonday.setDate(jan4.getDate() - dayOfWeek + 1)

  const result = new Date(firstMonday)
  result.setDate(firstMonday.getDate() + (week - 1) * 7)
  return result
}

/** Parse `<input type="date">` value as a local midnight `Date`. */
export function parseDateInputLocal(value: string): Date | null {
  return parseLocalDateKey(value)
}

export function startOfLocalDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

export function endOfLocalDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

function nextLocalDayBoundary(date: Date): Date {
  const d = startOfLocalDay(date)
  d.setDate(d.getDate() + 1)
  return d
}

function nextLocalHourBoundary(date: Date): Date {
  const d = new Date(date)
  d.setMinutes(0, 0, 0)
  d.setHours(d.getHours() + 1)
  return d
}

export function splitLocalByDay(start: Date, end: Date): TimeSlice[] {
  const startMs = start.getTime()
  const endMs = end.getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return []

  const slices: TimeSlice[] = []
  let cursor = new Date(startMs)

  while (cursor.getTime() < endMs) {
    const boundary = nextLocalDayBoundary(cursor)
    const sliceEndMs = Math.min(boundary.getTime(), endMs)
    const sliceEnd = new Date(sliceEndMs)
    slices.push({
      start: new Date(cursor),
      end: sliceEnd,
      durationMs: sliceEndMs - cursor.getTime()
    })
    cursor = sliceEnd
  }

  return slices
}

export function splitLocalByHour(start: Date, end: Date): TimeSlice[] {
  const startMs = start.getTime()
  const endMs = end.getTime()
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || endMs <= startMs) return []

  const slices: TimeSlice[] = []
  let cursor = new Date(startMs)

  while (cursor.getTime() < endMs) {
    const boundary = nextLocalHourBoundary(cursor)
    const sliceEndMs = Math.min(boundary.getTime(), endMs)
    const sliceEnd = new Date(sliceEndMs)
    slices.push({
      start: new Date(cursor),
      end: sliceEnd,
      durationMs: sliceEndMs - cursor.getTime()
    })
    cursor = sliceEnd
  }

  return slices
}

/**
 * Format date for HTML datetime-local input.
 *
 * @example
 * formatDatetimeLocalInput(new Date()) // "2024-12-16T15:30"
 */
export function formatDatetimeLocalInput(date: Date | null): string {
  if (!date) return ''
  const y = date.getFullYear()
  const m = pad2(date.getMonth() + 1)
  const d = pad2(date.getDate())
  const h = pad2(date.getHours())
  const min = pad2(date.getMinutes())
  return `${y}-${m}-${d}T${h}:${min}`
}

/**
 * Format date for HTML date input.
 *
 * @example
 * formatDateInput(new Date()) // "2024-12-16"
 */
export function formatDateInput(date: Date | null): string {
  if (!date) return ''
  return toLocalDateKey(date)
}
