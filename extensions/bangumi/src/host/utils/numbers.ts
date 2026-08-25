/** Positive integer reading for counts and ids Bangumi may omit or zero out. */
export function readPositiveInteger(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? Math.trunc(value)
    : undefined
}
