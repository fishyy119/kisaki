/**
 * Book file recognition for novel entries.
 *
 * Turns the book files inside one entry's directory into volume candidates.
 * Recognition is filename-only and deliberately conservative: an unreadable
 * name becomes an unnumbered candidate the caller can report, never a wrong
 * volume number. A whole-work single file (a web novel's one TXT) is exactly
 * that unnumbered candidate.
 */

import path from 'node:path'
import {
  cleanDisplayName,
  isPlausibleYearToken,
  parseNumberToken,
  stripReleaseTags,
  stripRevisionMarkers
} from '../release-naming'

const BOOK_EXTENSIONS = new Set(['.epub', '.mobi', '.azw3', '.azw', '.fb2', '.txt', '.pdf'])

/**
 * Numbers stay decimal-capable: side volumes ship between numbered ones (5.5).
 * Full-width volume words match anywhere; the bare `v` form is left to
 * `stripRevisionMarkers`, which decides whether it means a volume or a
 * release revision.
 */
const VOLUME_PATTERNS: ReadonlyArray<RegExp> = [
  /(?:^|[^a-z0-9])(?:v|vol|volume)[\s._-]*(\d{1,4}(?:\.\d)?)(?![a-z0-9])/i,
  /(\d{1,4}(?:\.\d)?)\s*[巻卷]/
]

/** A bare number is trusted only when it is the name's leading token. */
const BARE_NUMBER_PATTERN = /^\s*(?:#\s*)?(\d{1,4}(?:\.\d)?)(?![a-z0-9])/i

export interface NovelVolumeCandidate {
  /** Absolute path of the book file. */
  path: string
  fileName: string
  /** Cleaned display name used only for unnumbered volumes. */
  name: string
  volumeNumber?: number
}

export function isNovelBookFile(fileName: string): boolean {
  return BOOK_EXTENSIONS.has(path.extname(fileName).toLowerCase())
}

/** Recognize one book file as a volume candidate. */
export function recognizeNovelVolume(filePath: string): NovelVolumeCandidate {
  const fileName = path.basename(filePath)
  const baseName = fileName.slice(0, fileName.length - path.extname(fileName).length)
  const searchable = stripRevisionMarkers(stripReleaseTags(baseName))

  let volumeNumber = undefined as number | undefined
  for (const pattern of VOLUME_PATTERNS) {
    volumeNumber = parseNumberToken(searchable.match(pattern)?.[1])
    if (volumeNumber !== undefined) break
  }
  if (volumeNumber === undefined) {
    const bare = parseNumberToken(searchable.match(BARE_NUMBER_PATTERN)?.[1])
    // A leading year is a title ("1984"), not a volume number.
    if (bare !== undefined && !isPlausibleYearToken(bare)) volumeNumber = bare
  }

  const candidate: NovelVolumeCandidate = {
    path: filePath,
    fileName,
    name: cleanDisplayName(baseName)
  }
  if (volumeNumber !== undefined) candidate.volumeNumber = volumeNumber

  return candidate
}
