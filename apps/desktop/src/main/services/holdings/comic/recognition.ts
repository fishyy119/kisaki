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
import {
  cleanDisplayName,
  isPlausibleYearToken,
  parseNumberToken,
  stripReleaseTags,
  stripRevisionMarkers
} from '../release-naming'

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

function matchFirst(name: string, patterns: ReadonlyArray<RegExp>): number | undefined {
  for (const pattern of patterns) {
    const match = name.match(pattern)
    const parsed = parseNumberToken(match?.[1])
    if (parsed !== undefined) return parsed
  }
  return undefined
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
    const bare = parseNumberToken(searchable.match(BARE_NUMBER_PATTERN)?.[1])
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
