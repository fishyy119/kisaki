/**
 * Release filename token helpers shared by the per-media recognition modules.
 *
 * Pure string mechanics only: what a stripped token means for unit identity
 * stays in each media's recognition module.
 */

/** Bracketed release-group and quality tags carry no unit identity. */
export function stripReleaseTags(name: string): string {
  return name
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/【[^】]*】/g, ' ')
}

/**
 * Drops release-revision markers.
 *
 * A re-release appends `v2` to an installment it already numbered, which reads
 * exactly like the volume shorthand. A single-letter `v` that follows another
 * number is the revision; the full words `vol` and `volume` always mean the
 * volume.
 */
export function stripRevisionMarkers(name: string): string {
  return name.replace(/(\d)([\s._-]*)v\d{1,2}(?![a-z0-9])/gi, '$1')
}

export function parseNumberToken(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Integer tokens inside the plausible release-year range (1900-2100). */
export function isPlausibleYearToken(value: number): boolean {
  return Number.isInteger(value) && value >= 1900 && value <= 2100
}

/** Display name with release tags stripped and separators collapsed. */
export function cleanDisplayName(baseName: string): string {
  const cleaned = stripReleaseTags(baseName)
    .replace(/[\s._-]+/g, ' ')
    .trim()
  return cleaned || baseName
}
