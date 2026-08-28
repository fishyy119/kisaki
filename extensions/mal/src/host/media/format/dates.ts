import type { PartialDate } from '@kisaki3/extension-sdk'

/** MAL dates are `YYYY`, `YYYY-MM`, or `YYYY-MM-DD` strings. */
export function parseMalDate(value: string | null | undefined): PartialDate | undefined {
  const match = /^(\d{4})(?:-(\d{2})(?:-(\d{2}))?)?$/.exec(value?.trim() ?? '')
  if (!match) {
    return undefined
  }

  const year = Number(match[1])
  if (year < 1 || year > 2999) {
    return undefined
  }

  const result: PartialDate = { year }
  const month = match[2] !== undefined ? Number(match[2]) : undefined
  if (month !== undefined && month >= 1 && month <= 12) {
    result.month = month
    const day = match[3] !== undefined ? Number(match[3]) : undefined
    if (day !== undefined && day >= 1 && day <= 31) {
      result.day = day
    }
  }
  return result
}

/** Mirror air times are full ISO timestamps; the date part is the statement. */
export function parseMirrorAired(value: string | null | undefined): PartialDate | undefined {
  const match = /^(\d{4})-(\d{2})-(\d{2})T/.exec(value?.trim() ?? '')
  if (!match) {
    return undefined
  }

  return parseMalDate(`${match[1]}-${match[2]}-${match[3]}`)
}
