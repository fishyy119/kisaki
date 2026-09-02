import type {
  LibraryBloodType,
  LibraryCupSize,
  LibraryGameCharacterRole,
  LibraryGameCompanyRole,
  LibraryGamePersonRole,
  LibraryGender,
  LibraryMediaRelationType
} from '@kisaki3/extension-sdk'
import type { VndbGenderField, VndbSchemaEnumEntry } from '../../api/types'
import { trimToUndefined } from './text'

/** Note text is a stable machine-readable qualifier, not translatable copy. */
export const TAG_NOTES = {
  length: 'Length',
  lengthEstimate: 'Length Estimate',
  platform: 'Platform',
  language: 'Language',
  originalLanguage: 'Original Language',
  developmentStatus: 'Development Status',
  producerType: 'Producer Type',
  primaryLanguage: 'Primary Language'
} as const

const CUP_SIZES = new Set<LibraryCupSize>([
  'aaa',
  'aa',
  'a',
  'b',
  'c',
  'd',
  'e',
  'f',
  'g',
  'h',
  'i',
  'j',
  'k'
])

/**
 * VNDB reports gender either as a scalar or as an `[apparent, actual]` pair,
 * where the first entry is what the work presents.
 */
export function mapGender(value: VndbGenderField | undefined): LibraryGender | undefined {
  const token = readScalarToken(value)?.toLowerCase()
  switch (token) {
    case 'm':
    case 'male':
      return 'male'
    case 'f':
    case 'female':
      return 'female'
    case 'b':
    case 'other':
      return 'other'
    default:
      return undefined
  }
}

export function mapBloodType(value: string | null | undefined): LibraryBloodType | undefined {
  const token = trimToUndefined(value)?.toLowerCase()
  return token === 'a' || token === 'b' || token === 'ab' || token === 'o' ? token : undefined
}

export function mapCupSize(value: string | null | undefined): LibraryCupSize | undefined {
  const token = trimToUndefined(value)?.toLowerCase() as LibraryCupSize | undefined
  return token && CUP_SIZES.has(token) ? token : undefined
}

export function mapCharacterRole(role: string | null | undefined): LibraryGameCharacterRole {
  switch (trimToUndefined(role)?.toLowerCase()) {
    case 'main':
    case 'primary':
      return 'main'
    case 'side':
      return 'supporting'
    case 'appears':
      return 'cameo'
    default:
      return 'other'
  }
}

/**
 * VNDB's staff role vocabulary, mapped onto the library's. Roles the library
 * does not model stay `other`: the credit is real, only its category is
 * coarser, and the source's own role label travels along as the note.
 */
export function mapStaffRole(role: string | null | undefined): LibraryGamePersonRole {
  switch (trimToUndefined(role)?.toLowerCase()) {
    case 'scenario':
      return 'scenario'
    case 'director':
      return 'director'
    case 'chardesign':
    case 'art':
      return 'illustration'
    case 'music':
    case 'songs':
      return 'music'
    default:
      return 'other'
  }
}

export function mapProducerRole(
  isDeveloper: boolean,
  isPublisher: boolean
): LibraryGameCompanyRole[] {
  const roles: LibraryGameCompanyRole[] = []
  if (isDeveloper) {
    roles.push('developer')
  }
  if (isPublisher) {
    roles.push('publisher')
  }
  return roles.length > 0 ? roles : ['other']
}

export interface VnRelationMapping {
  type: LibraryMediaRelationType
  /** Stable machine-readable qualifier carrying the VN-specific form the kind folds. */
  note?: string
}

/**
 * VN-to-VN relation vocabulary, read from the scraped VN towards the related
 * one. A fandisc is a side story in release form, so `fan` and its inverse
 * `orig` fold onto the side-story pair and keep the VNDB word as the note.
 * `set` (same setting) and `ser` (same series) are n-ary group facts and
 * `char` (shares characters) is already encoded by shared character links, so
 * they map to nothing rather than to `other`.
 */
export function mapVnRelation(
  relation: string | null | undefined,
  official: boolean | null | undefined
): VnRelationMapping | undefined {
  const mapping = mapVnRelationKind(trimToUndefined(relation)?.toLowerCase())
  if (!mapping) {
    return undefined
  }

  // VNDB flags fan-made relations explicitly; officiality is orthogonal to the
  // kind, so it travels as a qualifier rather than as a kind of its own.
  if (official === false) {
    return { ...mapping, note: [mapping.note, 'Unofficial'].filter(Boolean).join(', ') }
  }

  return mapping
}

function mapVnRelationKind(relation: string | undefined): VnRelationMapping | undefined {
  switch (relation) {
    case 'seq':
      return { type: 'sequel' }
    case 'preq':
      return { type: 'prequel' }
    case 'side':
      return { type: 'sideStory' }
    case 'par':
      return { type: 'mainStory' }
    case 'fan':
      return { type: 'sideStory', note: 'Fandisc' }
    case 'orig':
      return { type: 'mainStory', note: 'Original game' }
    case 'alt':
      return { type: 'alternativeVersion' }
    default:
      return undefined
  }
}

/** Tag names are source vocabulary, shown as-is rather than translated. */
export function mapDevStatus(value: unknown): string | undefined {
  switch (readScalarToken(value as VndbGenderField)) {
    case '0':
      return 'Finished'
    case '1':
      return 'In development'
    case '2':
      return 'Cancelled'
    default:
      return undefined
  }
}

export function mapLength(value: number | null | undefined): string | undefined {
  switch (value) {
    case 1:
      return 'Very short'
    case 2:
      return 'Short'
    case 3:
      return 'Medium'
    case 4:
      return 'Long'
    case 5:
      return 'Very long'
    default:
      return undefined
  }
}

export function mapProducerType(value: string | null | undefined): string | undefined {
  switch (trimToUndefined(value)?.toLowerCase()) {
    case 'co':
      return 'Company'
    case 'in':
      return 'Individual'
    case 'ng':
      return 'Amateur Group'
    default:
      return undefined
  }
}

export function mapTagCategory(value: string | null | undefined): string | undefined {
  switch (trimToUndefined(value)?.toLowerCase()) {
    case 'cont':
      return 'Content'
    case 'ero':
      return 'Erotic'
    case 'tech':
      return 'Technical'
    default:
      return undefined
  }
}

/** The API's own labels for its enum codes, so tags read as VNDB writes them. */
export function buildEnumLabels(
  entries: readonly VndbSchemaEnumEntry[] | null | undefined
): Map<string, string> {
  const labels = new Map<string, string>()
  for (const entry of entries ?? []) {
    const id = trimToUndefined(entry.id)
    const label = trimToUndefined(entry.label)
    if (id && label) {
      labels.set(id, label)
    }
  }
  return labels
}

function readScalarToken(value: VndbGenderField | undefined): string | undefined {
  if (Array.isArray(value)) {
    for (const entry of value) {
      const token = readScalarToken(entry)
      if (token) {
        return token
      }
    }
    return undefined
  }

  if (typeof value === 'string') {
    return trimToUndefined(value)
  }

  return typeof value === 'number' && Number.isFinite(value) ? String(value) : undefined
}
