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

/** Numbers stay decimal-capable: extras are published between installments (42.5). */
const VOLUME_PATTERNS: ReadonlyArray<RegExp> = [
  /(?:^|[^a-z0-9])(?:v|vol|volume)[\s._-]*(\d{1,4}(?:\.\d)?)(?![a-z0-9])/i,
  /第\s*(\d{1,4}(?:\.\d)?)\s*[巻卷]/,
  /(\d{1,4}(?:\.\d)?)\s*[巻卷]/
]

const CHAPTER_PATTERNS: ReadonlyArray<RegExp> = [
  /(?:^|[^a-z0-9])(?:c|ch|chap|chapter|ep|episode)[\s._-]*(\d{1,4}(?:\.\d)?)(?![a-z0-9])/i,
  /第\s*(\d{1,4}(?:\.\d)?)\s*[話话回]/,
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
  const searchable = stripReleaseTags(baseName)

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
    if (bare !== undefined) {
      if (form === 'archive') {
        candidate.volumeNumber = bare
      } else {
        candidate.chapterNumber = bare
      }
    }
  }

  return candidate
}

/** Whether a candidate carries any readable unit number. */
export function isNumberedComicUnit(candidate: ComicUnitCandidate): boolean {
  return candidate.volumeNumber !== undefined || candidate.chapterNumber !== undefined
}
