import type { PartialDate } from '@kisaki3/extension-sdk'

/** TMDB dates are `YYYY-MM-DD`, but empty strings stand in for "unknown". */
export function parseTmdbDate(input: string | null | undefined): PartialDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(input?.trim() ?? '')
  if (!match) {
    return undefined
  }

  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])

  if (year < 1 || year >= 3000 || month < 1 || month > 12 || day < 1 || day > 31) {
    return undefined
  }

  return { year, month, day }
}

export function readTmdbYear(input: string | null | undefined): number | undefined {
  return parseTmdbDate(input)?.year
}

/** TMDB runtimes are whole minutes; zero means the source has no runtime. */
export function toDurationMs(minutes: number | null | undefined): number | undefined {
  return typeof minutes === 'number' && Number.isFinite(minutes) && minutes > 0
    ? Math.trunc(minutes) * 60_000
    : undefined
}
