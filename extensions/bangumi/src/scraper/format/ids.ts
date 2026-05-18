export function parseBangumiId(id: string): number {
  const value = Number.parseInt(id, 10)
  if (!Number.isFinite(value) || value <= 0) {
    throw new Error(`Invalid Bangumi ID: ${id}`)
  }
  return value
}
