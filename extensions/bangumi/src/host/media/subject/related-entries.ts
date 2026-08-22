import {
  LIBRARY_MEDIA_RELATION_TYPE_RULES,
  type LibraryMediaRelationType,
  type LibraryMediaType,
  type ScrapedRelatedEntryFact
} from '@kisaki3/extension-sdk'
import type { BangumiSubjectRelation } from '../../api/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'

/**
 * Bangumi relation labels are upstream vocabulary, not i18n keys.
 *
 * Labels missing here are deliberately unmapped rather than folded into
 * `other`: "相同世界观" is an n-ary group fact whose container is a collection,
 * and "角色出演" is already encoded by two entries linking the same character.
 * A scrape that emitted `other` for them would assert a narrative derivation
 * the source never stated, and no later scrape could tell it apart from a real
 * one.
 */
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

/**
 * Related media entries of a subject, referenced by Bangumi identity only.
 *
 * Non-media subjects (books, music, real) are dropped, as is any relation this
 * mapping cannot state in the library vocabulary: an unmapped label, or a word
 * the endpoint pair does not allow.
 */
export async function buildSubjectRelatedEntries(
  scopeMediaType: LibraryMediaType,
  getSubjectRelations: () => Promise<BangumiSubjectRelation[]>
): Promise<ScrapedRelatedEntryFact[]> {
  const relations = await getSubjectRelations()

  return relations.flatMap((relation): ScrapedRelatedEntryFact[] => {
    const mediaType = MEDIA_TYPE_BY_SUBJECT_TYPE[relation.type]
    if (!mediaType) return []

    const type = RELATION_TYPE_BY_LABEL[relation.relation?.trim() ?? '']
    if (!type) return []
    if (!LIBRARY_MEDIA_RELATION_TYPE_RULES[`${scopeMediaType}-${mediaType}`].includes(type)) {
      return []
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
