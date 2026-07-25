/**
 * Statistics period domain: current-period resolution, period arithmetic,
 * date-range calculation, and display formatting for the report types.
 * Owned by the statistics feature; consumed by the provider composable and
 * the header's period navigator.
 */

import { getWeekStartDate, getYearWeek } from '@renderer/utils/datetime'
import { formatters, messages } from '@renderer/core/i18n'
import type { Period, PeriodDisplay, ReportType } from './types'

/** Get the period containing today for the given report type. */
export function getCurrentPeriod(reportType: ReportType): Period {
  const now = new Date()

  switch (reportType) {
    case 'weekly': {
      const { year, week } = getYearWeek(now)
      return { year, week }
    }
    case 'monthly':
      return { year: now.getFullYear(), month: now.getMonth() + 1 }
    case 'yearly':
    case 'overview':
      return { year: now.getFullYear() }
  }
}

/** Shift a period by whole steps (negative = into the past). */
export function shiftPeriod(reportType: ReportType, period: Period, delta: number): Period {
  switch (reportType) {
    case 'weekly': {
      const date = getWeekStartDate(period.year, period.week!)
      date.setDate(date.getDate() + delta * 7)
      const { year, week } = getYearWeek(date)
      return { year, week }
    }
    case 'monthly': {
      const date = new Date(period.year, period.month! - 1 + delta, 1)
      return { year: date.getFullYear(), month: date.getMonth() + 1 }
    }
    case 'yearly':
    case 'overview':
      return { year: period.year + delta }
  }
}

/** Whether the period lies strictly before the one containing today. */
export function isPeriodBeforeCurrent(reportType: ReportType, period: Period): boolean {
  const current = getCurrentPeriod(reportType)

  switch (reportType) {
    case 'weekly':
      return (
        period.year < current.year || (period.year === current.year && period.week! < current.week!)
      )
    case 'monthly':
      return (
        period.year < current.year ||
        (period.year === current.year && period.month! < current.month!)
      )
    case 'yearly':
    case 'overview':
      return period.year < current.year
  }
}

/** Calculate the date range covered by a period. Overview spans the past year. */
export function calculatePeriodDateRange(
  reportType: ReportType,
  period: Period
): { start: Date; end: Date } {
  switch (reportType) {
    case 'overview': {
      const now = new Date()
      const end = new Date(now)
      end.setHours(23, 59, 59, 999)
      const start = new Date(now)
      start.setFullYear(start.getFullYear() - 1)
      start.setDate(start.getDate() + 1)
      start.setHours(0, 0, 0, 0)
      return { start, end }
    }

    case 'weekly': {
      const start = getWeekStartDate(period.year, period.week!)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }

    case 'monthly': {
      const start = new Date(period.year, period.month! - 1, 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(period.year, period.month!, 0)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }

    case 'yearly': {
      const start = new Date(period.year, 0, 1)
      start.setHours(0, 0, 0, 0)
      const end = new Date(period.year, 11, 31)
      end.setHours(23, 59, 59, 999)
      return { start, end }
    }
  }
}

/** Format a period for the header navigator and hero headline. */
export function formatPeriodDisplay(reportType: ReportType, period: Period): PeriodDisplay {
  switch (reportType) {
    case 'weekly': {
      const start = getWeekStartDate(period.year, period.week!)
      start.setHours(0, 0, 0, 0)
      const end = new Date(start)
      end.setDate(end.getDate() + 6)
      end.setHours(23, 59, 59, 999)

      // Use date range instead of week number to avoid cross-year ambiguity.
      const label = formatters.value.dateRange(start, end)
      const shortLabel = `${start.getMonth() + 1}/${start.getDate()}-${end.getMonth() + 1}/${end.getDate()}`

      return { label, shortLabel }
    }
    case 'monthly':
      return {
        label: formatters.value.yearMonth(new Date(period.year, period.month! - 1, 1)),
        shortLabel: formatters.value.monthName(period.month!)
      }
    case 'yearly':
      return {
        label: formatters.value.date({ year: period.year }),
        shortLabel: `${period.year}`
      }
    case 'overview':
      return {
        label: messages.value.statistics.period.pastYear,
        shortLabel: messages.value.statistics.tabs.overview
      }
  }
}

/** Human label for "the previous period" in comparison copy. */
export function getPreviousPeriodLabel(reportType: ReportType): string {
  switch (reportType) {
    case 'weekly':
      return messages.value.statistics.period.previousWeek
    case 'monthly':
      return messages.value.statistics.period.previousMonth
    case 'yearly':
      return messages.value.statistics.period.previousYear
    case 'overview':
      return messages.value.statistics.period.previousPeriod
  }
}
