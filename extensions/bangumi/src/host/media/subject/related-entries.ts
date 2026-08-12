import type {
  LibraryMediaRelationType,
  LibraryMediaType,
  ScrapedRelatedEntryFact
} from '@kisaki3/extension-sdk'
import type { BangumiSubjectRelation } from '../../api/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'

/** Bangumi relation labels are upstream vocabulary, not i18n keys. */
const RELATION_TYPE_BY_LABEL: Record<string, LibraryMediaRelationType> = {
  续集: 'sequel',
  前传: 'prequel',
  番外篇: 'sideStory',
  外传: 'sideStory',
  主线故事: 'parentStory',
  总集篇: 'summary',
  全集: 'fullStory',
  改编: 'adaptation',
  原作: 'sourceMaterial',
  不同演绎: 'alternative',
  不同版本: 'alternative'
}

const MEDIA_TYPE_BY_SUBJECT_TYPE: Partial<Record<number, LibraryMediaType>> = {
  2: 'anime',
  4: 'game'
}

const CROSS_TYPE_RELATION_TYPES: readonly LibraryMediaRelationType[] = [
  'adaptation',
  'sourceMaterial',
  'other'
]

/**
 * Related media entries of a subject, referenced by Bangumi identity only.
 * Non-media subjects (books, music, real) are dropped; vocabulary outside the
 * cross-type provenance set folds to `other` when the target crosses media
 * types.
 */
export async function buildSubjectRelatedEntries(
  scopeMediaType: LibraryMediaType,
  getSubjectRelations: () => Promise<BangumiSubjectRelation[]>
): Promise<ScrapedRelatedEntryFact[]> {
  const relations = await getSubjectRelations()

  return relations.flatMap((relation): ScrapedRelatedEntryFact[] => {
    const mediaType = MEDIA_TYPE_BY_SUBJECT_TYPE[relation.type]
    if (!mediaType) return []

    let type = RELATION_TYPE_BY_LABEL[relation.relation?.trim() ?? ''] ?? 'other'
    if (mediaType !== scopeMediaType && !CROSS_TYPE_RELATION_TYPES.includes(type)) {
      type = 'other'
    }

    return [
      {
        mediaType,
        source: BANGUMI_SOURCE_ID,
        externalId: String(relation.id),
        type
      }
    ]
  })
}
