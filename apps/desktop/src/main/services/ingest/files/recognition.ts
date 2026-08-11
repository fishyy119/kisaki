/**
 * Anime release file recognition.
 *
 * Turns the files inside one anime directory into episode candidates and
 * extras. Recognition is filename-only and deliberately conservative: an
 * unreadable filename becomes an unnumbered candidate the caller can report,
 * never a wrong episode number.
 */

import path from 'node:path'
import type { AnimeEpisodeType, AnimeExtraKind } from '@shared/db'

/** Containers mpv plays and ffprobe understands. */
const VIDEO_EXTENSIONS = new Set([
  '.mkv',
  '.mp4',
  '.m4v',
  '.mov',
  '.avi',
  '.wmv',
  '.flv',
  '.webm',
  '.ts',
  '.m2ts',
  '.mpg',
  '.mpeg',
  '.rmvb',
  '.ogm'
])

/** Directory names that hold supplementary assets rather than episodes. */
const EXTRA_DIRECTORY_NAMES = new Set([
  'extras',
  'extra',
  'specials',
  'sp',
  'sps',
  'bonus',
  'menu',
  'menus',
  'cm',
  'cms',
  'pv',
  'pvs',
  'nc',
  'ncop',
  'nced',
  'scan',
  'scans',
  'cd',
  'cds',
  '特典',
  '映像特典',
  '花絮'
])

// JS `\b` is ASCII-based and never matches next to CJK characters, so CJK
// tokens sit outside the word-boundary anchors that guard the ASCII ones.
const EXTRA_KIND_PATTERNS: ReadonlyArray<{ kind: AnimeExtraKind; pattern: RegExp }> = [
  { kind: 'ncop', pattern: /\b(?:ncop|creditless\s*op|clean\s*op|op\d*_?nc)\b/i },
  { kind: 'nced', pattern: /\b(?:nced|creditless\s*ed|clean\s*ed|ed\d*_?nc)\b/i },
  { kind: 'trailer', pattern: /(?:\b(?:trailer|teaser)\b|予告)/i },
  { kind: 'pv', pattern: /\b(?:pv|cm|spot)\b/i },
  { kind: 'interview', pattern: /(?:\binterview\b|インタビュー|访谈)/i }
]

/**
 * Filenames whose episode number cannot be trusted from a bare number token.
 *
 * Movies and single-file OVAs carry no episode number, so a lone `1080p` or
 * release year must not become episode 1080 or 2011.
 */
// Numbers stay decimal-capable everywhere: recap episodes sit between two
// regular ones (24.5), and the episode number column is REAL.
const SPECIAL_EPISODE_PATTERNS: ReadonlyArray<RegExp> = [
  /\b(oad|ova|special|sp)\s*[-_. ]?(\d{1,3}(?:\.\d)?)\b/i,
  /第\s*(\d{1,3}(?:\.\d)?)\s*[話话]\s*(?:特别篇|特別篇)/
]

const EPISODE_NUMBER_PATTERNS: ReadonlyArray<RegExp> = [
  /\bs\d{1,2}e(\d{1,4}(?:\.\d)?)\b/i,
  /\bep?\s*[.]?\s*(\d{1,4}(?:\.\d)?)(?:v\d)?\b/i,
  /第\s*(\d{1,4}(?:\.\d)?)\s*[話话集]/,
  /(?:^|[\s\-_[])(\d{1,4}(?:\.\d)?)(?:v\d)?(?=[\s\-_\]]|$)/
]

/** Tokens that look like episode numbers but describe the encode instead. */
const NON_EPISODE_TOKEN_PATTERN =
  /\b(?:\d{3,4}[pi]|x?26[45]|hevc|avc|aac|flac|opus|ma\d?|dts|\d{1,2}bit|v\d)\b/gi

export interface AnimeEpisodeCandidate {
  path: string
  fileName: string
  type: AnimeEpisodeType
  /** Absent when the filename states no trustworthy episode number. */
  number?: number
}

export interface AnimeExtraCandidate {
  path: string
  name: string
  kind: AnimeExtraKind
}

export interface AnimeReleaseFiles {
  episodes: AnimeEpisodeCandidate[]
  extras: AnimeExtraCandidate[]
}

export function isVideoFile(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export function isExtraDirectoryName(name: string): boolean {
  return EXTRA_DIRECTORY_NAMES.has(name.trim().toLowerCase())
}

function stripNoise(fileName: string): string {
  // Bracketed groups hold release metadata, and the extension holds none.
  return path
    .basename(fileName, path.extname(fileName))
    .replace(/\[[^\]]*\]/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(NON_EPISODE_TOKEN_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readExtraKind(fileName: string): AnimeExtraKind | undefined {
  for (const { kind, pattern } of EXTRA_KIND_PATTERNS) {
    if (pattern.test(fileName)) {
      return kind
    }
  }
  return undefined
}

/** Integer tokens inside the plausible release-year range (1900-2100). */
function isPlausibleYearToken(value: number): boolean {
  return Number.isInteger(value) && value >= 1900 && value <= 2100
}

function readEpisodeNumber(cleaned: string): number | undefined {
  for (const pattern of EPISODE_NUMBER_PATTERNS) {
    const match = pattern.exec(cleaned)
    const raw = match?.[1]
    if (!raw) continue

    // A release year in the filename ("Movie 1999") must not become an
    // episode number, while genuinely huge episode counts stay accepted.
    const value = Number.parseFloat(raw)
    if (Number.isFinite(value) && value >= 0 && !isPlausibleYearToken(value)) {
      return value
    }
  }

  return undefined
}

function readSpecialEpisodeNumber(cleaned: string): number | undefined {
  for (const pattern of SPECIAL_EPISODE_PATTERNS) {
    const match = pattern.exec(cleaned)
    const raw = match?.[2] ?? match?.[1]
    if (!raw) continue

    const value = Number.parseFloat(raw)
    if (Number.isFinite(value)) {
      return value
    }
  }

  return undefined
}

/**
 * Classify one video file found inside an anime directory.
 *
 * `inExtraDirectory` reflects the directory convention, which outranks the
 * filename: a file under `Extras/` is an extra even when it looks numbered.
 */
export function classifyReleaseFile(
  filePath: string,
  inExtraDirectory: boolean
): AnimeEpisodeCandidate | AnimeExtraCandidate {
  const fileName = path.basename(filePath)
  const cleaned = stripNoise(fileName)
  const extraKind = readExtraKind(cleaned)

  if (inExtraDirectory || extraKind) {
    return {
      path: filePath,
      name: cleaned || fileName,
      kind: extraKind ?? 'other'
    }
  }

  const specialNumber = readSpecialEpisodeNumber(cleaned)
  if (specialNumber !== undefined) {
    return { path: filePath, fileName, type: 'special', number: specialNumber }
  }

  const number = readEpisodeNumber(cleaned)
  return number === undefined
    ? { path: filePath, fileName, type: 'regular' }
    : { path: filePath, fileName, type: 'regular', number }
}

export function isExtraCandidate(
  candidate: AnimeEpisodeCandidate | AnimeExtraCandidate
): candidate is AnimeExtraCandidate {
  return 'kind' in candidate
}
