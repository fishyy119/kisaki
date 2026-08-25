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

const BOOK_EXTENSIONS = new Set(['.epub', '.mobi', '.azw3', '.azw', '.fb2', '.txt', '.pdf'])

/** Numbers stay decimal-capable: side volumes ship between numbered ones (5.5). */
const VOLUME_PATTERNS: ReadonlyArray<RegExp> = [
  /(?:^|[^a-z0-9])(?:v|vol|volume)[\s._-]*(\d{1,4}(?:\.\d)?)(?![a-z0-9])/i,
  /第\s*(\d{1,4}(?:\.\d)?)\s*[巻卷]/,
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

function parseNumber(value: string | undefined): number | undefined {
  if (value === undefined) return undefined
  const parsed = Number.parseFloat(value)
  return Number.isFinite(parsed) ? parsed : undefined
}

/** Bracketed release-group and quality tags carry no volume identity. */
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

/** Recognize one book file as a volume candidate. */
export function recognizeNovelVolume(filePath: string): NovelVolumeCandidate {
  const fileName = path.basename(filePath)
  const baseName = fileName.slice(0, fileName.length - path.extname(fileName).length)
  const searchable = stripReleaseTags(baseName)

  let volumeNumber = undefined as number | undefined
  for (const pattern of VOLUME_PATTERNS) {
    volumeNumber = parseNumber(searchable.match(pattern)?.[1])
    if (volumeNumber !== undefined) break
  }
  if (volumeNumber === undefined) {
    volumeNumber = parseNumber(searchable.match(BARE_NUMBER_PATTERN)?.[1])
  }

  const candidate: NovelVolumeCandidate = {
    path: filePath,
    fileName,
    name: cleanDisplayName(baseName)
  }
  if (volumeNumber !== undefined) candidate.volumeNumber = volumeNumber

  return candidate
}
