import type {
  ContentLocale,
  ExternalId,
  PartialDate,
  ScrapedComicChapter,
  ScrapedNovelVolume
} from '@kisaki3/extension-sdk'
import type { BangumiSubject, BangumiSubjectRelation } from '../../api/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'
import { omitUndefined } from '../../utils/object'
import { parseBangumiSubjectDate } from '../format/dates'
import { extractImageUrls } from '../format/images'
import { resolveLocalizedSubjectName } from '../format/names'
import { normalizeDescription } from '../format/text'

/** Relation label Bangumi files a work's collected volumes under. */
const OFFPRINT_RELATION_LABEL = '单行本'

/**
 * Volume number written into a book volume's title.
 *
 * Bangumi titles a collected volume `<work> (04)`, sometimes with a subtitle
 * after the marker, and CJK printings write `第4巻` instead. Numbers stay
 * decimal-capable because side volumes ship between two numbered ones (5.5).
 */
const VOLUME_NUMBER_PATTERNS: readonly RegExp[] = [
  /[(（]\s*(\d{1,4}(?:\.\d)?)\s*[)）]/,
  /第\s*(\d{1,4}(?:\.\d)?)\s*[巻卷]/,
  /(\d{1,4}(?:\.\d)?)\s*[巻卷]/
]

export interface BangumiBookUnitOptions {
  getSubjectRelations: () => Promise<BangumiSubjectRelation[]>
  /** Shared per-subject reader; a relation stub carries no date or summary. */
  getRelatedSubject: (subjectId: number) => Promise<BangumiSubject | null>
  locale?: ContentLocale
}

/** One collected volume, as Bangumi files it: its own subject under the work. */
interface BangumiBookVolume {
  volumeNumber?: number
  name?: string
  originalName?: string
  releaseDate?: PartialDate
  description?: string
  coverUrl?: string
  externalIds: readonly ExternalId[]
}

/** Collected volumes of a comic work, at the volume grain comic units allow. */
export async function buildComicVolumeUnits(
  options: BangumiBookUnitOptions
): Promise<ScrapedComicChapter[] | undefined> {
  return readBookVolumes(options)
}

/** Collected volumes of a novel work. */
export async function buildNovelVolumeUnits(
  options: BangumiBookUnitOptions
): Promise<ScrapedNovelVolume[] | undefined> {
  return readBookVolumes(options)
}

/**
 * Read a work's collected volumes from its relation list.
 *
 * Bangumi gives every volume its own subject, so the volumes arrive as
 * `单行本` relations: the stub names it and carries its cover, and the subject
 * behind it carries the release date and blurb. Reads share the session's
 * per-subject memo, so a re-read for the related-entry slot costs nothing.
 *
 * A work with no such relations answers `undefined` rather than an empty list:
 * Bangumi not having catalogued the volumes is not the work declaring it has
 * none, and an authoritative empty would let a `replace` pass delete the unit
 * rows file sync built.
 */
async function readBookVolumes({
  getSubjectRelations,
  getRelatedSubject,
  locale
}: BangumiBookUnitOptions): Promise<BangumiBookVolume[] | undefined> {
  const relations = await getSubjectRelations()
  const offprints = relations.filter(
    (relation) => relation.relation?.trim() === OFFPRINT_RELATION_LABEL
  )
  if (offprints.length === 0) {
    return undefined
  }

  // Relation order is the source's own volume order, and it is kept even when
  // a title states no number: an unnumbered volume still reads in sequence.
  return Promise.all(offprints.map((relation) => readVolume(relation, getRelatedSubject, locale)))
}

async function readVolume(
  relation: BangumiSubjectRelation,
  getRelatedSubject: (subjectId: number) => Promise<BangumiSubject | null>,
  locale?: ContentLocale
): Promise<BangumiBookVolume> {
  const subject = await getRelatedSubject(relation.id)
  const { name, originalName } = resolveLocalizedSubjectName(
    subject?.name ?? relation.name,
    subject?.name_cn ?? relation.name_cn,
    locale
  )

  return omitUndefined({
    volumeNumber: readVolumeNumber(relation.name, relation.name_cn),
    name: name || undefined,
    originalName: originalName || undefined,
    releaseDate: parseBangumiSubjectDate(subject?.date),
    description: normalizeDescription(subject?.summary),
    coverUrl: extractImageUrls(relation.images ?? subject?.images)[0],
    externalIds: [{ source: BANGUMI_SOURCE_ID, id: String(relation.id) }]
  })
}

/**
 * Volume number stated by a title, in either of the names Bangumi carries.
 *
 * A plausible release year is refused: `三体 (2008)` is a printing year, and a
 * volume numbered 2008 would collide with nothing but read as nonsense.
 */
function readVolumeNumber(...titles: readonly (string | undefined)[]): number | undefined {
  for (const title of titles) {
    if (!title?.trim()) continue

    for (const pattern of VOLUME_NUMBER_PATTERNS) {
      const raw = title.match(pattern)?.[1]
      if (raw === undefined) continue

      const value = Number.parseFloat(raw)
      if (Number.isFinite(value) && value > 0 && !isPlausibleYear(value)) {
        return value
      }
    }
  }

  return undefined
}

function isPlausibleYear(value: number): boolean {
  return Number.isInteger(value) && value >= 1900 && value <= 2100
}
