import {
  isLibraryMediaRelationTypeAllowed,
  type LibraryMediaRelationType,
  type LibraryMediaType,
  type ScrapedRelatedEntryFact
} from '@kisaki3/extension-sdk'
import type { BangumiSubject, BangumiSubjectRelation } from '../../api/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'
import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../../../shared/scopes'
import { resolveBangumiBookKind } from '../format/formats'

interface RelationMapping {
  type: LibraryMediaRelationType
  /** Stable machine-readable qualifier carrying the medium-specific form the kind folds. */
  note?: string
}

/**
 * Bangumi relation labels are upstream vocabulary, not i18n keys. A label reads
 * from the scraped subject towards the related one, matching the library's
 * "to is the type of from" convention, so 续集 on subject A pointing at B
 * states that B is A's sequel.
 *
 * Labels missing here are deliberately unmapped rather than folded into
 * `other`: 相同世界观, 不同世界观, and 联动 are n-ary facts (a shared or parallel
 * setting, a crossover) whose container is a collection, and 角色出演 is
 * already encoded by two entries linking the same character. A scrape that
 * emitted `other` for them would assert a narrative derivation the source
 * never stated. 系列, 单行本, and 画集 are unmapped for a different reason: they
 * state the work/volume layering the unit slots own, or point at books the
 * library has no entry type for.
 */
const RELATION_BY_LABEL: Record<string, RelationMapping> = {
  续集: { type: 'sequel' },
  前传: { type: 'prequel' },
  番外篇: { type: 'sideStory' },
  外传: { type: 'sideStory' },
  主线故事: { type: 'mainStory' },
  衍生: { type: 'spinOff' },
  总集篇: { type: 'summary' },
  全集: { type: 'fullStory' },
  改编: { type: 'adaptation' },
  原作: { type: 'sourceMaterial' },
  不同演绎: { type: 'alternativeVersion' },
  不同版本: { type: 'alternativeVersion' },
  主版本: { type: 'alternativeVersion' },
  扩展包: { type: 'sideStory', note: 'Expansion' },
  合集: { type: 'compilation' },
  收录作品: { type: 'includedWork' },
  其他: { type: 'other' },
  /**
   * Bangumi labels a cross-media link with the target's own media type and
   * states no direction: an anime's "书籍" points at both the novel it adapts
   * and the art book made from it. `crossMedia` says exactly that much, so
   * these edges survive without a direction being invented for them.
   */
  动画: { type: 'crossMedia' },
  书籍: { type: 'crossMedia' },
  漫画: { type: 'crossMedia' },
  小说: { type: 'crossMedia' },
  游戏: { type: 'crossMedia' }
}

const MEDIA_TYPE_BY_SUBJECT_TYPE: Partial<Record<number, LibraryMediaType>> = {
  [BANGUMI_SUBJECT_TYPE_BY_SCOPE.anime]: 'anime',
  [BANGUMI_SUBJECT_TYPE_BY_SCOPE.game]: 'game'
}

export interface SubjectRelatedEntriesOptions {
  /** Library media type of the entry being scraped; constrains the vocabulary. */
  scopeMediaType: LibraryMediaType
  getSubjectRelations: () => Promise<BangumiSubjectRelation[]>
  /** Shared per-subject reader; book targets need the platform label it carries. */
  getRelatedSubject: (subjectId: number) => Promise<BangumiSubject | null>
}

/**
 * Related media entries of a subject, referenced by Bangumi identity only.
 *
 * Non-media subjects (music, real) are dropped, as is any relation this
 * mapping cannot state in the library vocabulary: an unmapped label, or a kind
 * the endpoint rule does not allow. Book targets take one extra subject read,
 * because Bangumi folds comics and novels into one subject type and only the
 * platform label on the full subject tells them apart; a book the label never
 * places (an art book, or one left unlabelled) is dropped rather than filed
 * into a library by guess.
 */
export async function buildSubjectRelatedEntries({
  scopeMediaType,
  getSubjectRelations,
  getRelatedSubject
}: SubjectRelatedEntriesOptions): Promise<ScrapedRelatedEntryFact[]> {
  const relations = await getSubjectRelations()

  // The label is checked before the media type so unmapped relations never pay
  // for a subject read: a serialized comic lists every one of its volumes here.
  const labelled = relations.flatMap((relation) => {
    const mapping = RELATION_BY_LABEL[relation.relation?.trim() ?? '']
    return mapping ? [{ relation, mapping }] : []
  })

  const facts = await Promise.all(
    labelled.map(async ({ relation, mapping }): Promise<ScrapedRelatedEntryFact[]> => {
      const mediaType = await resolveRelatedMediaType(relation, getRelatedSubject)
      if (!mediaType) return []
      if (!isLibraryMediaRelationTypeAllowed(mapping.type, scopeMediaType, mediaType)) {
        return []
      }

      return [
        {
          mediaType,
          source: BANGUMI_SOURCE_ID,
          externalId: String(relation.id),
          type: mapping.type,
          note: mapping.note
        }
      ]
    })
  )

  return facts.flat()
}

/** Library type a related subject belongs to, or undefined when none claims it. */
async function resolveRelatedMediaType(
  relation: BangumiSubjectRelation,
  getRelatedSubject: (subjectId: number) => Promise<BangumiSubject | null>
): Promise<LibraryMediaType | undefined> {
  if (relation.type !== BANGUMI_SUBJECT_TYPE_BY_SCOPE.book) {
    return MEDIA_TYPE_BY_SUBJECT_TYPE[relation.type]
  }

  const subject = await getRelatedSubject(relation.id)
  return resolveBangumiBookKind(subject?.platform)
}
