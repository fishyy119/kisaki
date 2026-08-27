/**
 * Release file recognition for anime entries.
 *
 * Turns the files inside one entry's directory into episode and extra
 * candidates. Recognition is filename-only and deliberately conservative: an
 * unreadable filename becomes an unnumbered candidate the caller can report,
 * never a wrong episode number. Extras follow the disc-release vocabulary the
 * anime ecosystem publishes (NCOP, PV).
 */

import path from 'node:path'
import type { AnimeEpisodeType, AnimeExtraType } from '@shared/db'
import { isPlausibleYearToken } from '../release-naming'

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
// NC/PV markers accept trailing digits (NCOP01, PV2) as BD releases number them.
const EXTRA_TYPE_PATTERNS: ReadonlyArray<{ type: AnimeExtraType; pattern: RegExp }> = [
  { type: 'ncop', pattern: /\b(?:ncop\d*|creditless\s*op|clean\s*op|op\d*_?nc)\b/i },
  { type: 'nced', pattern: /\b(?:nced\d*|creditless\s*ed|clean\s*ed|ed\d*_?nc)\b/i },
  { type: 'trailer', pattern: /(?:\b(?:trailer|teaser)\b|予告)/i },
  { type: 'pv', pattern: /\b(?:pv\d*|cm\d*|spot)\b/i },
  { type: 'interview', pattern: /(?:\binterview\b|インタビュー|访谈)/i }
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
  /第\s*(\d{1,4}(?:\.\d)?)\s*[話话集]/
]

/**
 * Bare number fallback. Global on purpose: the last valid token wins, because
 * release names trail the episode number after the title while title-embedded
 * numbers (season digits, numeric titles like "86") come first.
 */
const BARE_EPISODE_NUMBER_PATTERN = /(?:^|[\s\-_[])(\d{1,4}(?:\.\d)?)(?:v\d)?(?=[\s\-_\]]|$)/g

/** Tokens that look like episode numbers but describe the encode instead. */
const NON_EPISODE_TOKEN_PATTERN =
  /\b(?:\d{3,4}[pi]|x?26[45]|hevc|avc|aac|flac|opus|ma\d?|dts|\d{1,2}[-_ ]?bit|v\d)\b/gi

/**
 * Bracket contents that carry the episode identity instead of release
 * metadata: bare numbers ([01], [24.5], [03v2], [03(v2)]) and special/extra
 * markers ([SP01], [OVA], [NCOP]). These unwrap in `stripNoise` so the token
 * survives the metadata strip that VCB-style names would otherwise lose it to.
 */
const BRACKET_EPISODE_CONTENT_PATTERN =
  /^\s*(?:(?:sp|oad|ova|oav|ncop|nced|pv|cm)\s*[-_. ]?\d{0,4}(?:\.\d)?|\d{1,4}(?:\.\d)?)\s*(?:\(?v\d\)?)?\s*$/i

export interface AnimeEpisodeCandidate {
  path: string
  fileName: string
  /** Display title derived from the filename, without release tags or extension. */
  name: string
  type: AnimeEpisodeType
  /** Absent when the filename states no trustworthy episode number. */
  number?: number
}

export interface AnimeExtraCandidate {
  path: string
  name: string
  type: AnimeExtraType
}

/** Classification of one video file, discriminated explicitly by `kind`. */
export type AnimeReleaseFileClassification =
  | { kind: 'episode'; episode: AnimeEpisodeCandidate }
  | { kind: 'extra'; extra: AnimeExtraCandidate }

export function isVideoFile(filePath: string): boolean {
  return VIDEO_EXTENSIONS.has(path.extname(filePath).toLowerCase())
}

export function isExtraDirectoryName(name: string): boolean {
  return EXTRA_DIRECTORY_NAMES.has(name.trim().toLowerCase())
}

function stripNoise(fileName: string): string {
  // Bracketed groups hold release metadata, and the extension holds none;
  // episode-bearing bracket contents unwrap instead of vanishing with them.
  const unwrapEpisodeContent = (_whole: string, content: string): string =>
    BRACKET_EPISODE_CONTENT_PATTERN.test(content) ? ` ${content} ` : ' '

  return path
    .basename(fileName, path.extname(fileName))
    .replace(/\[([^\]]*)\]/g, unwrapEpisodeContent)
    .replace(/\(([^)]*)\)/g, unwrapEpisodeContent)
    .replace(NON_EPISODE_TOKEN_PATTERN, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function readExtraType(fileName: string): AnimeExtraType | undefined {
  for (const { type, pattern } of EXTRA_TYPE_PATTERNS) {
    if (pattern.test(fileName)) {
      return type
    }
  }
  return undefined
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

  let lastValid: number | undefined
  for (const match of cleaned.matchAll(BARE_EPISODE_NUMBER_PATTERN)) {
    const value = Number.parseFloat(match[1])
    if (Number.isFinite(value) && value >= 0 && !isPlausibleYearToken(value)) {
      lastValid = value
    }
  }

  return lastValid
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
): AnimeReleaseFileClassification {
  const fileName = path.basename(filePath)
  const cleaned = stripNoise(fileName)
  const extraType = readExtraType(cleaned)
  const name = cleaned || path.basename(fileName, path.extname(fileName))

  if (inExtraDirectory || extraType) {
    return {
      kind: 'extra',
      extra: { path: filePath, name, type: extraType ?? 'other' }
    }
  }

  const specialNumber = readSpecialEpisodeNumber(cleaned)
  if (specialNumber !== undefined) {
    return {
      kind: 'episode',
      episode: { path: filePath, fileName, name, type: 'special', number: specialNumber }
    }
  }

  const number = readEpisodeNumber(cleaned)
  return {
    kind: 'episode',
    episode:
      number === undefined
        ? { path: filePath, fileName, name, type: 'regular' }
        : { path: filePath, fileName, name, type: 'regular', number }
  }
}
