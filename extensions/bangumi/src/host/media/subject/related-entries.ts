import {
  LIBRARY_MEDIA_RELATION_TYPE_RULES,
  type LibraryMediaRelationType,
  type LibraryMediaType,
  type ScrapedRelatedEntryFact
} from '@kisaki3/extension-sdk'
import type { BangumiSubject, BangumiSubjectRelation } from '../../api/types'
import { BANGUMI_SOURCE_ID } from '../../utils/constants'
import { BANGUMI_SUBJECT_TYPE_BY_SCOPE } from '../../../shared/scopes'
import { resolveBangumiBookKind } from '../format/formats'

/**
 * Bangumi relation labels are upstream vocabulary, not i18n keys.
 *
 * Labels missing here are deliberately unmapped rather than folded into
 * `other`: "相同世界观" is an n-ary group fact whose container is a collection,
 * and "角色出演" is already encoded by two entries linking the same character.
 * A scrape that emitted `other` for them would assert a narrative derivation
 * the source never stated, and no later scrape could tell it apart from a real
 * one. "系列" and "单行本" are unmapped for a different reason: they state the
 * work/volume layering the unit slots own, not an edge between two entries.
 */
const RELATION_TYPE_BY_LABEL: Record<string, LibraryMediaRelationType> = {
  续集: 'sequel',
  前传: 'prequel',
  番外篇: 'sideStory',
  外传: 'sideStory',
  衍生: 'sideStory',
  主线故事: 'parentStory',
  总集篇: 'summary',
  全集: 'fullStory',
  改编: 'adaptation',
  原作: 'sourceMaterial',
  不同演绎: 'alternative',
  不同版本: 'alternative',
  /**
   * Bangumi labels a cross-media link with the target's own media type and
   * states no direction: an anime's "书籍" points at both the novel it adapts
   * and the art book made from it. `mediaMix` says exactly that much, so these
   * edges survive without a direction being invented for them.
   */
  动画: 'mediaMix',
  书籍: 'mediaMix',
  漫画: 'mediaMix',
  小说: 'mediaMix',
  游戏: 'mediaMix'
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
 * mapping cannot state in the library vocabulary: an unmapped label, or a word
 * the endpoint pair does not allow. Book targets take one extra subject read,
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
    const type = RELATION_TYPE_BY_LABEL[relation.relation?.trim() ?? '']
    return type ? [{ relation, type }] : []
  })

  const facts = await Promise.all(
    labelled.map(async ({ relation, type }): Promise<ScrapedRelatedEntryFact[]> => {
      const mediaType = await resolveRelatedMediaType(relation, getRelatedSubject)
      if (!mediaType) return []
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
