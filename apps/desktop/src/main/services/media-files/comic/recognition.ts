/**
 * Unit file recognition for comic entries.
 *
 * Turns the containers inside one entry's directory into unit candidates.
 * Recognition is filename-only and deliberately conservative: an unreadable
 * name becomes an unnumbered candidate the caller can report, never a wrong
 * unit number. Both storage idioms are read at their own grain — a volume
 * token yields a volume-grained candidate, a chapter token a chapter-grained
 * one — and a bare number defaults to the idiom its container form implies.
 */

import path from 'node:path'

const ARCHIVE_EXTENSIONS = new Set(['.cbz', '.zip', '.cbr', '.rar', '.pdf'])

/** Loose pages a directory container is recognized by. */
const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.webp',
  '.gif',
  '.bmp',
  '.avif',
  '.jxl'
])

/**
 * Numbers stay decimal-capable: extras are published between installments
 * (42.5). Full-width volume words match anywhere; the bare `v` form is left to
 * `stripRevisionMarkers`, which decides whether it means a volume or a scan
 * revision.
 */
const VOLUME_PATTERNS: ReadonlyArray<RegExp> = [
  /(?:^|[^a-z0-9])(?:v|vol|volume)[\s._-]*(\d{1,4}(?:\.\d)?)(?![a-z0-9])/i,
  /(\d{1,4}(?:\.\d)?)\s*[巻卷]/
]

const CHAPTER_PATTERNS: ReadonlyArray<RegExp> = [
  /(?:^|[^a-z0-9])(?:c|ch|chap|chapter|ep|episode)[\s._-]*(\d{1,4}(?:\.\d)?)(?![a-z0-9])/i,
  /(\d{1,4}(?:\.\d)?)\s*[話话回]/
]

/** A bare number is trusted only when it is the name's leading token. */
const BARE_NUMBER_PATTERN = /^\s*(?:#\s*)?(\d{1,4}(?:\.\d)?)(?![a-z0-9])/i

export interface ComicUnitCandidate {
  /** Absolute path of the container: an archive file or an image directory. */
  path: string
  fileName: string
  /** Cleaned display name used only for unnumbered units. */
  name: string
  volumeNumber?: number
  chapterNumber?: number
}

export function isComicArchiveFile(fileName: string): boolean {
  return ARCHIVE_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}

export function isComicPageFile(fileName: string): boolean {
  return IMAGE_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

function matchFirst(name: string, patterns: ReadonlyArray<RegExp>): number | undefined {
  for (const pattern of patterns) {
    const match = name.match(pattern)
    const parsed = parseNumber(match?.[1])
    if (parsed !== undefined) return parsed
  }
  return undefined
}

/**
 * Drops scan-revision markers.
 *
 * Releases append `v2` to a re-scan of an installment they already numbered
 * ("One Piece 1044 v2"), which reads exactly like the volume shorthand. A
 * single-letter `v` that follows another number is the revision; the full
 * words `vol` and `volume` always mean the volume.
 */
function stripRevisionMarkers(name: string): string {
  return name.replace(/(\d)([\s._-]*)v\d{1,2}(?![a-z0-9])/gi, '$1')
}

/** Integer tokens inside the plausible release-year range (1900-2100). */
function isPlausibleYearToken(value: number): boolean {
  return Number.isInteger(value) && value >= 1900 && value <= 2100
}

/** Bracketed release-group and quality tags carry no unit identity. */
function stripReleaseTags(name: string): string {
  return name
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/【[^】]*】/g, ' ')
}

function cleanDisplayName(baseName: string): string {
  const cleaned = stripReleaseTags(baseName)
    .replace(/[\s._-]+/g, ' ')
    .trim()
  return cleaned || baseName
}

/**
 * Recognize one container as a unit candidate.
 *
 * @param containerPath - Archive file or image directory path.
 * @param form - Container form: a bare number on an archive reads as a volume
 * (single-file volumes dominate archive libraries), on a directory as a
 * chapter (per-chapter folders dominate scan libraries).
 */
export function recognizeComicUnit(
  containerPath: string,
  form: 'archive' | 'directory'
): ComicUnitCandidate {
  const fileName = path.basename(containerPath)
  const baseName =
    form === 'archive'
      ? fileName.slice(0, fileName.length - path.extname(fileName).length)
      : fileName
  const searchable = stripRevisionMarkers(stripReleaseTags(baseName))

  const chapterNumber = matchFirst(searchable, CHAPTER_PATTERNS)
  const volumeNumber = matchFirst(searchable, VOLUME_PATTERNS)

  const candidate: ComicUnitCandidate = {
    path: containerPath,
    fileName,
    name: cleanDisplayName(baseName)
  }

  if (chapterNumber !== undefined) candidate.chapterNumber = chapterNumber
  if (volumeNumber !== undefined) candidate.volumeNumber = volumeNumber

  if (chapterNumber === undefined && volumeNumber === undefined) {
    const bare = parseNumber(searchable.match(BARE_NUMBER_PATTERN)?.[1])
    // A leading year is a title ("1984", "2001 Nights"), not a unit number.
    if (bare !== undefined && !isPlausibleYearToken(bare)) {
      if (form === 'archive') {
        candidate.volumeNumber = bare
      } else {
        candidate.chapterNumber = bare
      }
    }
  }

  return candidate
}
